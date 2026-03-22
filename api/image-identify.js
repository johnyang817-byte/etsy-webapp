// api/image-identify.js - Step 1: Image identification only
export default async function handler(req, res) {
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    else if (process.env.NODE_ENV === 'development') res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'Missing image' });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    const visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-max';
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing AI API Key' });

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
                        { text: `You are a professional product identifier for Etsy sellers.
Look at this product image VERY carefully. Describe EXACTLY what you see — the actual physical product.

IMPORTANT: Do NOT guess or hallucinate. Only describe what is visible.

Return a JSON object:
{
  "product_name": "specific English name, e.g. Red Cord Woven Lucky Knot Bracelet",
  "category": "e.g. Bracelet, Necklace, Ring, Earrings, Pendant, Charm",
  "material": "visible materials, e.g. red cord, gold beads, stainless steel",
  "color": "main visible colors, e.g. red, gold",
  "style": "design style, e.g. minimalist, bohemian, Chinese traditional, handmade",
  "keywords": "5 Etsy search keywords comma-separated",
  "target_audience": "e.g. women, men, unisex"
}

Return ONLY valid JSON. No explanation.` }
                    ]
                }]},
                parameters: { result_format: 'message' }
            })
        });
        const data = await visionRes.json();
        let visionText = '';
        const choices = data.output?.choices;
        if (choices?.[0]?.message?.content) {
            const content = choices[0].message.content;
            visionText = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => c.text || '').join('') : JSON.stringify(content));
        }
        const jsonMatch = visionText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return res.status(200).json({ success: true, identified: JSON.parse(jsonMatch[0]) });
        }
        return res.status(200).json({ success: true, identified: { product_name: 'Unknown Product', keywords: 'jewelry, handmade' }, raw: visionText });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
