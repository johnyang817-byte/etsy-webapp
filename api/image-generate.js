// api/image-generate.js - 图片识别→竞品搜索→分析→生成 API
export default async function handler(req, res) {
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    else if (process.env.NODE_ENV === 'development') res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { imageBase64, productInfo, customPrompts } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'Missing image' });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;
    const serpApiKey = process.env.SERPAPI_KEY;
    const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
    const visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-max';
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing AI API Key' });

    try {
        // ========== Step 1: Identify Product from Image ==========
        let identified = {};
        try {
            // Compress image if too large - keep only first 500KB of base64
            let imgData = imageBase64;
            if (imgData.length > 700000) {
                // Already base64 data URL, truncate is not ideal. Use as-is but with smaller model.
            }

            const visionRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: visionModel,
                    input: { messages: [{
                        role: 'user',
                        content: [
                            { image: imgData },
                            { text: `You are a professional jewelry/product identifier for Etsy sellers. 
Look at this product image VERY carefully. Describe EXACTLY what you see.

IMPORTANT: Focus on the ACTUAL physical product in the image. Do NOT guess or hallucinate.

Return a JSON object:
{
  "product_name": "specific English name, e.g. Red Cord Woven Lucky Knot Bracelet",
  "category": "e.g. Bracelet, Necklace, Ring, Earrings, Pendant",
  "material": "what materials you can identify, e.g. red cord, gold beads, leather",
  "color": "main visible colors",
  "style": "design style, e.g. minimalist, bohemian, Chinese traditional, handmade",
  "keywords": "5 Etsy search keywords comma-separated",
  "target_audience": "e.g. women, men, unisex"
}

Return ONLY valid JSON. No other text.` }
                        ]
                    }]},
                    parameters: { result_format: 'message' }
                })
            });
            const visionData = await visionRes.json();
            let visionText = '';
            const choices = visionData.output?.choices;
            if (choices?.[0]?.message?.content) {
                const content = choices[0].message.content;
                visionText = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => c.text || '').join('') : JSON.stringify(content));
            }
            const jsonMatch = visionText.match(/\{[\s\S]*\}/);
            if (jsonMatch) identified = JSON.parse(jsonMatch[0]);
        } catch (visionErr) {
            // Vision failed - use product info from user
            identified = {
                product_name: productInfo?.product_name || 'Jewelry Product',
                keywords: productInfo?.product_name || 'jewelry, handmade, gift',
                category: 'Jewelry'
            };
        }

        // Merge user input (user values override AI)
        const finalProduct = {
            product_name: productInfo?.product_name?.trim() || identified.product_name || 'Product',
            material: productInfo?.material?.trim() || identified.material || '',
            style: productInfo?.style || identified.style || '',
            color: identified.color || productInfo?.style || '',
            category: identified.category || '',
            adjustable: productInfo?.adjustable || 'no',
            customizable: productInfo?.customizable || 'no',
            keywords: identified.keywords || '',
            target_audience: identified.target_audience || ''
        };

        const searchKeyword = identified.keywords
            ? identified.keywords.split(',')[0].trim()
            : finalProduct.product_name;

        // ========== Step 2: Multi-Source Search (100 results from Etsy) ==========
        let competitors = [];
        let shoppingResults = [];
        let trendsData = null;
        const dataSources = {};

        if (serperKey) {
            // Etsy Search - 5 pages of 20 = 100 results
            try {
                const pages = [0, 20, 40, 60, 80];
                const allResults = [];
                for (const start of pages) {
                    const r = await fetch('https://google.serper.dev/search', {
                        method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ q: `${searchKeyword} site:etsy.com best seller`, num: 20, start, gl: 'us', hl: 'en' })
                    });
                    const d = await r.json();
                    if (d.organic) allResults.push(...d.organic);
                }
                competitors = allResults.filter(i => i.link?.includes('etsy.com')).map(i => ({
                    title: i.title, snippet: i.snippet, url: i.link, price: extractPrice(i.snippet || i.title || '')
                }));
                dataSources.etsy_search = { count: competitors.length, status: 'ok' };
            } catch (e) { dataSources.etsy_search = { count: 0, status: 'error' }; }

            // Google Shopping
            try {
                const r = await fetch('https://google.serper.dev/shopping', {
                    method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: searchKeyword, num: 20, gl: 'us', hl: 'en' })
                });
                const d = await r.json();
                if (d.shopping) shoppingResults = d.shopping.map(i => ({ title: i.title, price: i.price, source: i.source, rating: i.rating }));
                dataSources.google_shopping = { count: shoppingResults.length, status: 'ok' };
            } catch (e) { dataSources.google_shopping = { count: 0, status: 'error' }; }
        }

        // Google Trends
        if (serpApiKey) {
            try {
                const r = await fetch(`https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(searchKeyword)}&date=today+12-m&api_key=${serpApiKey}`);
                const d = await r.json();
                if (d.interest_over_time?.timeline_data) {
                    const recent = d.interest_over_time.timeline_data.slice(-12);
                    const values = recent.map(t => t.values?.[0]?.extracted_value || 0);
                    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
                    const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;
                    trendsData = { avg_interest: avg, trend_direction: trend > 10 ? 'Rising' : trend < -10 ? 'Declining' : 'Stable', peak_interest: Math.max(...values) };
                }
                if (d.related_queries?.rising) { trendsData = trendsData || {}; trendsData.rising_queries = d.related_queries.rising.slice(0, 10).map(q => ({ query: q.query, growth: q.value })); }
                dataSources.google_trends = { status: 'ok', direction: trendsData?.trend_direction || 'N/A' };
            } catch (e) { dataSources.google_trends = { status: 'error' }; }
        }

        // ========== Step 3: AI Analysis ==========
        let intel = `## Intelligence for "${searchKeyword}" (from product image)\n\n`;
        intel += `### Etsy Best Sellers (${competitors.length} results)\n`;
        intel += competitors.slice(0, 50).map((c, i) => `${i+1}. ${c.title} | ${c.price || 'N/A'}`).join('\n');
        intel += `\n\n### Google Shopping (${shoppingResults.length})\n`;
        intel += shoppingResults.slice(0, 10).map((s, i) => `${i+1}. ${s.title} — ${s.price || 'N/A'} (${s.source})`).join('\n');
        if (trendsData) { intel += `\n\n### Google Trends\nTrend: ${trendsData.trend_direction} | Avg: ${trendsData.avg_interest}/100`; if (trendsData.rising_queries) intel += `\nRising: ${trendsData.rising_queries.map(q => q.query).join(', ')}`; }

        const analysisRes = await callAI(apiKey, model, 'Senior Etsy market analyst.', `Analyze:\n${intel}\n\nProvide:\n1. Top 15 High-Frequency Keywords from titles\n2. Price Intelligence (min/max/avg/recommended)\n3. Trend Direction\n4. Top Selling Points\n5. Market Gaps & Opportunities\n6. Differentiation Strategy`, 4000);

        // ========== Step 4: Generate Listing ==========
        const productDesc = `Product (identified from image):
- Name: ${finalProduct.product_name}
- Category: ${finalProduct.category}
- Material: ${finalProduct.material || 'See photos'}
- Style/Color: ${finalProduct.style || 'See photos'}
- Adjustable: ${finalProduct.adjustable === 'yes' ? 'Yes' : 'No'}
- Customizable: ${finalProduct.customizable === 'yes' ? 'Yes (customers can personalize with name/text engraving)' : 'No'}
- Target: ${finalProduct.target_audience}`;

        const defaultTitle = customPrompts?.title || 'Generate 3 Etsy titles (each under 140 chars). Use trending keywords. Include gift keywords. Natural American English.';
        const defaultDesc = customPrompts?.description || 'Write a rich, emotionally engaging Etsy product description with promo tags, story, gifting suggestions, customer reviews, CTA. Mention adjustable/customizable features if applicable. Use emojis.';
        const defaultTags = customPrompts?.tags || '13 Etsy tags, each under 20 chars, comma-separated. Use high-frequency keywords from competitor analysis. Cover product type, gifting, usage scenes.';
        const defaultAttrs = customPrompts?.attributes || 'Fill relevant Etsy listing attributes: color, material, occasion, style, recipient, theme.';

        const genPrompt = `You are an Etsy Growth Hacker and SEO Copywriter.

${productDesc}

COMPETITOR INTELLIGENCE (${competitors.length} Etsy listings analyzed):
${analysisRes}

Generate a DIFFERENTIATED listing that OUTPERFORMS the ${competitors.length} competitors analyzed.

IMPORTANT: You MUST output ALL 4 sections below. Do NOT skip any section.

【标题】
${defaultTitle}

【描述】
${defaultDesc}

【标签】
${defaultTags}

【属性】
${defaultAttrs}

Remember: ALL 4 sections (标题, 描述, 标签, 属性) are REQUIRED.`;

        const listing = await callAI(apiKey, model, 'Expert Etsy SEO copywriter. Output ALL 4 sections.', genPrompt, 8000);

        return res.status(200).json({
            success: true,
            identified: finalProduct,
            competitorCount: competitors.length,
            shoppingCount: shoppingResults.length,
            trendsData,
            dataSources,
            competitorReport: analysisRes,
            listing,
            searchKeyword
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function callAI(apiKey, model, systemMsg, userMsg, maxTokens) {
    const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: { messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }] }, parameters: { result_format: 'message', max_tokens: maxTokens || 8000 } })
    });
    const d = await r.json();
    if (d.output?.choices?.[0]?.message?.content) return d.output.choices[0].message.content;
    throw new Error(d.message || 'AI API error');
}

function extractPrice(text) { const m = text.match(/\$[\d,.]+/); return m ? m[0] : ''; }
