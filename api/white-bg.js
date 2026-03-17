// api/white-bg.js - 产品白底图生成 API（豆包 Seedream 5.0）
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

    const dashscopeKey = process.env.DASHSCOPE_API_KEY;
    const doubaoKey = process.env.DOUBAO_API_KEY_V2 || 'b3f3eac1-8556-4f20-8ad7-ec42f75b02f1';
    if (!dashscopeKey) return res.status(500).json({ success: false, error: 'Missing API Key' });

    try {
        // Step 1: Vision识别产品（严格不猜测）
        const productDesc = await callVision(dashscopeKey, imageBase64,
            `You are a professional product photographer. Describe ONLY what you clearly see.

CRITICAL: Do NOT guess, invent, or hallucinate. If unclear, say "not visible".

Describe:
1. EXACT product type (e.g. "braided red cord bracelet with gold knot charm")
2. EXACT colors (precise, e.g. "deep crimson red cord, gold-tone metal")
3. EXACT materials visible
4. Shape, proportions, structure
5. ALL visible details: clasps, beads, charms, engravings, patterns
6. Surface finish
7. What is NOT there

DO NOT add features not visible in the image.`);

        if (!productDesc) return res.status(500).json({ success: false, error: 'Failed to analyze image' });

        // Step 2: 豆包 Seedream 5.0 并行生成4张
        const basePrompt = `产品精修，产品置于纯净的纯白背景上，精准还原产品颜色与包装材质，清除所有指纹灰尘与瑕疵，保留产品本身，提升整体质感和高级感，符合电商主图标准，产品一致性强，写实高清。严格按照以下描述还原产品，不要添加任何原图中没有的元素: ${productDesc}`;

        const prompts = [
            `${basePrompt}，正面平视角度，产品居中，不要添加额外装饰，专业棚拍，8K高清，商业摄影质感。`,
            `${basePrompt}，45度侧面角度，展示产品立体感和层次，不要改变产品任何细节，专业棚拍，8K高清。`,
            `${basePrompt}，微距特写，展示材质纹理和工艺细节，不要添加原图没有的元素，浅景深效果，8K高清。`,
            `${basePrompt}，优雅模特佩戴/使用该产品，产品必须与原图完全一致不要修改，时尚杂志风格，柔和自然光，高级感，简约背景，8K高清。`
        ];
        const labels = ['Front View', '45° Angle', 'Detail Close-up', 'Model Lifestyle'];

        const imagePromises = prompts.map(prompt =>
            fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doubaoKey}` },
                body: JSON.stringify({
                    model: 'doubao-seedream-5-0-260128',
                    prompt,
                    response_format: 'url',
                    size: '2K',
                    stream: false,
                    watermark: false
                })
            }).then(r => r.json()).catch(e => ({ error: e.message }))
        );

        const results = await Promise.all(imagePromises);
        const allImages = [];
        results.forEach((data, i) => {
            if (data.data?.[0]?.url) allImages.push({ url: data.data[0].url, label: labels[i] });
        });

        if (allImages.length === 0) throw new Error('All image generations failed');

        return res.status(200).json({
            success: true,
            images: allImages,
            description: productDesc,
            resolution: '2K'
        });
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
