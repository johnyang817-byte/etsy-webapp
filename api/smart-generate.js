// api/smart-generate.js - 智能搜索→分析→生成 API
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

    const { keyword, productInfo, customPrompts } = req.body || {};
    if (!keyword || !keyword.trim()) {
        return res.status(400).json({ success: false, error: 'Missing keyword' });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;
    const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing AI API Key' });

    try {
        // ========== Step 1: Search Competitors ==========
        let competitors = [];

        if (serperKey) {
            // Use Serper.dev for Google search (site:etsy.com)
            const searchRes = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: `${keyword.trim()} site:etsy.com`,
                    num: 20,
                    gl: 'us',
                    hl: 'en'
                })
            });
            const searchData = await searchRes.json();
            if (searchData.organic) {
                competitors = searchData.organic.map(item => ({
                    title: item.title || '',
                    snippet: item.snippet || '',
                    url: item.link || '',
                    price: extractPrice(item.snippet || item.title || '')
                })).filter(c => c.url.includes('etsy.com'));
            }
        } else {
            // Fallback: use AI to simulate competitor analysis based on keyword knowledge
            competitors = [{ title: `(AI-simulated) Top results for "${keyword}"`, snippet: 'Serper API key not configured. Using AI knowledge for competitor analysis.', url: '', price: '' }];
        }

        // ========== Step 2: Analyze with AI ==========
        const competitorText = competitors.slice(0, 15).map((c, i) =>
            `${i + 1}. ${c.title}\n   ${c.snippet}\n   Price: ${c.price || 'N/A'}`
        ).join('\n\n');

        const analysisPrompt = `You are an Etsy market analyst. Analyze these competitor listings for the keyword "${keyword}":

${competitorText}

Provide a structured analysis in this exact format:

【竞品分析报告】
1. Top Keywords (most frequently used words/phrases in titles):
   List the top 10 keywords with estimated frequency

2. Price Range:
   Min, Max, Average, Recommended price point

3. Common Selling Points:
   List the top 5 selling points competitors emphasize

4. Market Gaps (opportunities competitors are missing):
   List 3-5 gaps or underserved angles

5. Recommended Strategy:
   2-3 sentences on how to differentiate`;

        const analysisRes = await callAI(apiKey, model, 'You are an expert Etsy market analyst.', analysisPrompt);

        // ========== Step 3: Generate Listing ==========
        const productDesc = productInfo ? `
Product Info:
- Name: ${productInfo.product_name || keyword}
- Material: ${productInfo.material || 'See photos'}
- Color: ${productInfo.color || ''}
- Occasion: ${productInfo.occasion || ''}` : `Product: ${keyword}`;

        const defaultTitle = customPrompts?.title || `Generate 3 Etsy titles (each under 140 chars), SEO-optimized, include gift keywords, natural American English.`;
        const defaultDesc = customPrompts?.description || `Write a rich, emotionally engaging Etsy product description with promo tags, story, gifting suggestions, customer reviews, and CTA. Use emojis.`;
        const defaultTags = customPrompts?.tags || `Generate 13 Etsy tags, each under 20 characters, comma-separated. Cover product type, gifting, usage scenes.`;
        const defaultAttrs = customPrompts?.attributes || `Fill relevant Etsy listing attributes: color, material, occasion, style, recipient, theme.`;

        const generatePrompt = `You are an Etsy Growth Hacker and SEO Copywriter.

COMPETITOR INTELLIGENCE:
${analysisRes}

${productDesc}

Based on the competitor analysis above, generate a DIFFERENTIATED listing that outperforms competitors.

Output in these 4 sections with 【】 markers:

【标题】
${defaultTitle}

【描述】
${defaultDesc}

【标签】
${defaultTags}

【属性】
${defaultAttrs}`;

        const listingRes = await callAI(apiKey, model,
            'You are an expert Etsy SEO copywriter. Use competitor intelligence to create differentiated, high-converting listings.',
            generatePrompt
        );

        return res.status(200).json({
            success: true,
            competitorCount: competitors.length,
            competitorReport: analysisRes,
            listing: listingRes,
            keyword: keyword.trim()
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

// Helper: Call DashScope AI
async function callAI(apiKey, model, systemMsg, userMsg) {
    const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            input: { messages: [
                { role: 'system', content: systemMsg },
                { role: 'user', content: userMsg }
            ]},
            parameters: { result_format: 'message', max_tokens: 4000 }
        })
    });
    const data = await res.json();
    if (data.output?.choices?.[0]?.message?.content) {
        return data.output.choices[0].message.content;
    }
    throw new Error(data.message || 'AI API error');
}

// Helper: Extract price from text
function extractPrice(text) {
    const match = text.match(/\$[\d,.]+/);
    return match ? match[0] : '';
}
