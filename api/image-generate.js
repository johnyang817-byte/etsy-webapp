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
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing AI API Key' });

    try {
        // Step 1: Identify product via vision (OpenAI-compatible)
        let identified = {};
        try {
            const visionText = await callVision(apiKey, imageBase64,
                `You are a professional jewelry/product identifier for Etsy sellers. Analyze this product image. Return a JSON object:
{"product_name":"specific name","category":"e.g. Bracelet","material":"visible materials","color":"main colors","style":"design style","keywords":"5 Etsy search keywords comma-separated","target_audience":"e.g. women"}
Return ONLY valid JSON.`);
            const jsonMatch = visionText.match(/\{[\s\S]*\}/);
            if (jsonMatch) identified = JSON.parse(jsonMatch[0]);
        } catch (e) {
            identified = { product_name: productInfo?.product_name || 'Jewelry Product', keywords: 'jewelry, handmade, gift' };
        }

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

        const searchKeyword = identified.keywords ? identified.keywords.split(',')[0].trim() : finalProduct.product_name;

        // Step 2: Multi-Source Search
        let competitors = [];
        let shoppingResults = [];
        let trendsData = null;
        const dataSources = {};

        if (serperKey) {
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

        // Step 3: Analyze
        let intel = `## Intelligence for "${searchKeyword}"\n\n### Etsy (${competitors.length})\n`;
        intel += competitors.slice(0, 50).map((c, i) => `${i+1}. ${c.title} | ${c.price || 'N/A'}`).join('\n');
        intel += `\n\n### Google Shopping (${shoppingResults.length})\n`;
        intel += shoppingResults.slice(0, 10).map((s, i) => `${i+1}. ${s.title} — ${s.price || 'N/A'}`).join('\n');
        if (trendsData) intel += `\n\n### Trends: ${trendsData.trend_direction} | Avg: ${trendsData.avg_interest}/100`;

        const analysisRes = await callAI(apiKey, model, 'Etsy market analyst.', `Analyze:\n${intel}\n\nProvide: 1.Top Keywords 2.Price Intelligence 3.Trends 4.Selling Points 5.Gaps 6.Strategy`, 4000);

        // Step 4: Generate
        const productDesc = `Product:\n- Name: ${finalProduct.product_name}\n- Category: ${finalProduct.category}\n- Material: ${finalProduct.material || 'See photos'}\n- Style: ${finalProduct.style}\n- Adjustable: ${finalProduct.adjustable === 'yes' ? 'Yes' : 'No'}\n- Customizable: ${finalProduct.customizable === 'yes' ? 'Yes' : 'No'}\n- Target: ${finalProduct.target_audience}`;
        const listing = await callAI(apiKey, model, 'Expert Etsy SEO copywriter. Output ALL 4 sections.',
            `${productDesc}\n\nINTELLIGENCE:\n${analysisRes}\n\nIMPORTANT: Output ALL 4 sections:\n\n【标题】\n3 titles under 140 chars, SEO, gift keywords.\n\n【描述】\nRich description with promo tags, story, gifting, reviews, CTA.\n\n【标签】\n13 tags under 20 chars each, comma-separated.\n\n【属性】\nFill color, material, occasion, style, recipient.`, 8000);

        return res.status(200).json({ success: true, identified: finalProduct, competitorCount: competitors.length, shoppingCount: shoppingResults.length, trendsData, dataSources, competitorReport: analysisRes, listing, searchKeyword });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function callVision(apiKey, imageData, textPrompt) {
    const r = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'qwen-vl-plus',
            messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: imageData } },
                { type: 'text', text: textPrompt }
            ]}]
        })
    });
    const d = await r.json();
    if (d.choices?.[0]?.message?.content) return d.choices[0].message.content;
    throw new Error(d.error?.message || 'Vision API error');
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
