// api/image-generate.js - 图片识别→竞品搜索→分析→生成 API
export default async function handler(req, res) {
    // CORS
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (process.env.NODE_ENV === 'development') {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { imageBase64, productInfo, customPrompts } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'Missing image' });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;
    const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
    const visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-plus';
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing AI API Key' });

    try {
        // ========== Step 1: Identify Product from Image ==========
        let identified = {};
        try {
            const visionRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: visionModel,
                    input: { messages: [{
                        role: 'user',
                        content: [
                            { image: imageBase64 },
                            { text: `Analyze this product image. Return a JSON object with these fields:
- product_name: specific English product name for Etsy listing
- category: product category (e.g. Necklace, Bracelet, Ring, Earrings)
- material: detected materials (e.g. gold, silver, leather, gemstone)
- color: main colors
- style: design style (e.g. minimalist, bohemian, vintage)
- keywords: 5 search keywords for Etsy separated by comma
- target_audience: who would buy this (e.g. women, men, teens)

Return ONLY the JSON object, no other text.` }
                        ]
                    }]},
                    parameters: { result_format: 'message' }
                })
            });
            const visionData = await visionRes.json();
            const visionText = visionData.output?.choices?.[0]?.message?.content?.[0]?.text
                || visionData.output?.choices?.[0]?.message?.content
                || '';
            // Try to parse JSON from response
            const jsonMatch = visionText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                identified = JSON.parse(jsonMatch[0]);
            }
        } catch (visionErr) {
            // Vision failed, fall back to text-only with user-provided info
            identified = { product_name: productInfo?.product_name || 'Jewelry Product', keywords: 'jewelry, handmade, gift' };
        }

        // Merge user input (override AI if user provided)
        const finalProduct = {
            product_name: productInfo?.product_name?.trim() || identified.product_name || 'Product',
            material: productInfo?.material?.trim() || identified.material || '',
            color: identified.color || '',
            style: identified.style || '',
            category: identified.category || '',
            occasion: productInfo?.occasion?.trim() || '',
            keywords: identified.keywords || '',
            target_audience: identified.target_audience || ''
        };

        // Build search keyword from identified info
        const searchKeyword = identified.keywords
            ? identified.keywords.split(',')[0].trim()
            : finalProduct.product_name;

        // ========== Step 2: Search Competitors ==========
        let competitors = [];
        if (serperKey) {
            const searchRes = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: `${searchKeyword} site:etsy.com`, num: 20, gl: 'us', hl: 'en' })
            });
            const searchData = await searchRes.json();
            if (searchData.organic) {
                competitors = searchData.organic
                    .filter(i => i.link?.includes('etsy.com'))
                    .map(i => ({
                        title: i.title, snippet: i.snippet, url: i.link,
                        price: (i.snippet?.match(/\$[\d,.]+/) || [''])[0]
                    }));
            }
        }

        // ========== Step 3: Analyze Competitors ==========
        const competitorText = competitors.length > 0
            ? competitors.slice(0, 15).map((c, i) => `${i+1}. ${c.title}\n   ${c.snippet}\n   Price: ${c.price || 'N/A'}`).join('\n\n')
            : `No competitor data (Serper API not configured). Using AI knowledge for "${searchKeyword}".`;

        const analysisPrompt = `Analyze Etsy competitors for "${searchKeyword}":\n\n${competitorText}\n\nProvide:\n1. Top 10 Keywords\n2. Price Range (min, max, avg, recommended)\n3. Common Selling Points\n4. Market Gaps\n5. Recommended Strategy`;
        const analysisRes = await callAI(apiKey, model, 'You are an Etsy market analyst.', analysisPrompt);

        // ========== Step 4: Generate Differentiated Listing ==========
        const productDesc = `Product identified from image:
- Name: ${finalProduct.product_name}
- Category: ${finalProduct.category}
- Material: ${finalProduct.material || 'See photos'}
- Color: ${finalProduct.color || 'See photos'}
- Style: ${finalProduct.style}
- Target: ${finalProduct.target_audience}
- Occasion: ${finalProduct.occasion}`;

        const defaultTitle = customPrompts?.title || 'Generate 3 Etsy titles (each under 140 chars), SEO-optimized, include gift keywords, natural American English.';
        const defaultDesc = customPrompts?.description || 'Write a rich, emotionally engaging Etsy product description with promo tags, story, gifting suggestions, customer reviews, and CTA. Use emojis.';
        const defaultTags = customPrompts?.tags || 'Generate 13 Etsy tags, each under 20 characters, comma-separated. Cover product type, gifting, usage scenes.';
        const defaultAttrs = customPrompts?.attributes || 'Fill relevant Etsy listing attributes: color, material, occasion, style, recipient, theme.';

        const genPrompt = `You are an Etsy Growth Hacker and SEO Copywriter.

PRODUCT (identified from image):
${productDesc}

COMPETITOR INTELLIGENCE:
${analysisRes}

Based on the product analysis and competitor intelligence, generate a DIFFERENTIATED listing that outperforms competitors.

Output in these 4 sections with 【】 markers:

【标题】
${defaultTitle}

【描述】
${defaultDesc}

【标签】
${defaultTags}

【属性】
${defaultAttrs}`;

        const listing = await callAI(apiKey, model,
            'Expert Etsy SEO copywriter. Use image analysis and competitor intelligence to create differentiated listings.',
            genPrompt
        );

        return res.status(200).json({
            success: true,
            identified: finalProduct,
            competitorCount: competitors.length,
            competitorReport: analysisRes,
            listing,
            searchKeyword
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function callAI(apiKey, model, systemMsg, userMsg) {
    const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            input: { messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }] },
            parameters: { result_format: 'message', max_tokens: 4000 }
        })
    });
    const data = await res.json();
    if (data.output?.choices?.[0]?.message?.content) return data.output.choices[0].message.content;
    throw new Error(data.message || 'AI API error');
}
