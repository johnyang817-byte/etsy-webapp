// api/white-bg.js - 产品白底图生成 API（豆包 Seedream）
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
    const doubaoKey = process.env.DOUBAO_API_KEY || 'e7d9ccf8-9bbc-41cb-8e04-430dd88b5d5b';
    if (!dashscopeKey) return res.status(500).json({ success: false, error: 'Missing API Key' });

    try {
        // Step 1: Vision识别产品（用DashScope qwen-vl-plus）
        const productDesc = await callVision(dashscopeKey, imageBase64,
            `You are a professional product photographer. Describe this product in EXTREME detail:
1. Exact product type and name
2. ALL visible colors (be very precise, e.g. "deep crimson red", "18K gold-tone")
3. ALL materials and textures
4. Shape, proportions, structural details
5. Any text, engravings, patterns, clasps, decorations
6. Surface finish (matte, glossy, satin, metallic)
This description will be used to generate professional white background product photos.`);

        if (!productDesc) return res.status(500).json({ success: false, error: 'Failed to analyze image' });

        // Step 2: 用豆包Seedream生成4张不同角度的白底图
        const basePrompt = `产品精修，产品置于纯净的纯白背景上，精准还原产品颜色与包装材质，清除所有指纹灰尘与瑕疵，提升整体质感和高级感，符合电商主图标准。Product: ${productDesc}`;

        const prompts = [
            `${basePrompt}，正面平视角度，产品居中，专业棚拍，4K高清，商业摄影质感。`,
            `${basePrompt}，45度侧面角度，展示产品立体感和层次，专业棚拍，4K高清。`,
            `${basePrompt}，微距特写，展示材质纹理和工艺细节，浅景深效果，4K高清。`,
            `${basePrompt}，优雅模特佩戴/使用该产品，时尚杂志风格，柔和自然光，高级感，简约背景。`
        ];
        const labels = ['Front View', '45° Angle', 'Detail Close-up', 'Model Lifestyle'];

        // 并行生成4张图
        const imagePromises = prompts.map(prompt =>
            fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doubaoKey}` },
                body: JSON.stringify({
                    model: 'doubao-seedream-4-0-250828',
                    prompt,
                    response_format: 'url',
                    size: '1024x1024',
                    stream: false
                })
            }).then(r => r.json()).catch(e => ({ error: e.message }))
        );

        const results = await Promise.all(imagePromises);
        const allImages = [];
        results.forEach((data, i) => {
            if (data.data?.[0]?.url) {
                allImages.push({ url: data.data[0].url, label: labels[i] });
            }
        });

        if (allImages.length === 0) throw new Error('All image generations failed');

        return res.status(200).json({
            success: true,
            images: allImages,
            description: productDesc,
            resolution: '1024x1024'
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
