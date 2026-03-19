// api/ai-write.js - AI 分析产品特征生成卖点描述
export default async function handler(req, res) {
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    else if (process.env.NODE_ENV === 'development') res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { productName, imageBase64 } = req.body || {};
    if (!productName && !imageBase64) return res.status(400).json({ success: false, error: 'Please provide product name or image' });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing API Key' });

    try {
        let productInfo = productName || '';

        // If image provided, use vision to identify product
        if (imageBase64) {
            try {
                const vr = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'qwen-vl-plus',
                        messages: [{ role: 'user', content: [
                            { type: 'image_url', image_url: { url: imageBase64 } },
                            { type: 'text', text: `Identify this product. What is it exactly? Describe its key features, materials, colors, design style, and target audience. Be specific and accurate. One paragraph.` }
                        ]}]
                    })
                });
                const vd = await vr.json();
                if (vd.choices?.[0]?.message?.content) {
                    productInfo = (productName ? productName + '. ' : '') + vd.choices[0].message.content;
                }
            } catch (e) { /* use productName only */ }
        }

        // Use qwen-turbo to generate selling points
        const prompt = `You are an e-commerce product marketing expert. Based on the following product information, generate 5-8 core selling points in English.

Product: ${productInfo}

Requirements:
- Each selling point should be concise (3-8 words)
- Focus on features that matter to buyers: quality, uniqueness, convenience, value
- Include material quality, design features, use cases, gift potential
- Format: comma-separated list, no numbering
- Example: "Premium 925 Sterling Silver, Adjustable Size Fits All, Perfect Birthday Gift, Hypoallergenic & Skin-Safe, Handcrafted with Love, Free Gift Box Included"

Output ONLY the comma-separated selling points, nothing else.`;

        const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen-turbo',
                input: { messages: [
                    { role: 'system', content: 'You are an e-commerce product marketing expert. Output only selling points.' },
                    { role: 'user', content: prompt }
                ]},
                parameters: { result_format: 'message', max_tokens: 500 }
            })
        });
        const d = await r.json();
        if (d.output?.choices?.[0]?.message?.content) {
            return res.status(200).json({ success: true, text: d.output.choices[0].message.content.trim() });
        }
        throw new Error(d.message || 'AI error');
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
