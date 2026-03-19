// api/white-bg.js - 产品白底图生成（豆包 Seedream 5.0 图生图）
export default async function handler(req, res) {
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    else if (process.env.NODE_ENV === 'development') res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { imageBase64, imageCount, size } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'Missing image' });

    const doubaoKey = process.env.DOUBAO_API_KEY_V2 || 'b3f3eac1-8556-4f20-8ad7-ec42f75b02f1';
    const count = Math.min(Math.max(parseInt(imageCount) || 4, 1), 6);
    const imageSize = size || '2K';

    try {
        const allPrompts = [
            '产品精修，将产品置于纯净的纯白背景上，精准还原产品颜色与包装材质，清除所有指纹灰尘与瑕疵，保持产品本身完全不变，提升整体质感和高级感，符合电商主图标准，正面平视角度，产品居中，专业棚拍，写实高清，8K',
            '产品精修，将产品置于纯净的纯白背景上，精准还原产品颜色与包装材质，清除所有指纹灰尘与瑕疵，保持产品本身完全不变，提升整体质感和高级感，45度侧面角度展示产品立体感，专业棚拍，写实高清，8K',
            '产品精修，将产品置于纯净的纯白背景上，精准还原产品颜色与包装材质，清除所有指纹灰尘与瑕疵，保持产品本身完全不变，微距特写展示材质纹理和工艺细节，浅景深效果，写实高清，8K',
            '保持产品完全不变，优雅模特佩戴/使用该产品，产品必须与原图完全一致，时尚杂志风格，柔和自然光，高级感，简约干净背景，写实高清，8K',
            '产品精修，将产品置于纯净的纯白背景上，俯视角度拍摄，产品平放展示，精准还原颜色材质，清除瑕疵，专业棚拍，写实高清，8K',
            '产品精修，将产品置于纯净的纯白背景上，多角度组合展示，展示产品不同面，精准还原颜色材质，专业棚拍，写实高清，8K'
        ];
        const allLabels = ['Front View', '45° Angle', 'Detail Close-up', 'Model Lifestyle', 'Top View', 'Multi-Angle'];

        const prompts = allPrompts.slice(0, count);
        const labels = allLabels.slice(0, count);

        const imagePromises = prompts.map(async (prompt) => {
            try {
                const r = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doubaoKey}` },
                    body: JSON.stringify({
                        model: 'doubao-seedream-5-0-260128',
                        prompt,
                        image: imageBase64,
                        size: imageSize,
                        output_format: 'png',
                        watermark: false
                    })
                });
                if (!r.ok) {
                    const text = await r.text();
                    return { error: { message: `HTTP ${r.status}: ${text.slice(0, 100)}` } };
                }
                return await r.json();
            } catch (e) {
                return { error: { message: e.message } };
            }
        });

        const results = await Promise.all(imagePromises);
        const allImages = [];
        results.forEach((data, i) => {
            if (data.data?.[0]?.url) allImages.push({ url: data.data[0].url, label: labels[i] });
        });

        if (allImages.length === 0) {
            const firstError = results.find(r => r.error)?.error?.message || 'Unknown error';
            throw new Error('Image generation failed: ' + firstError);
        }

        return res.status(200).json({
            success: true,
            images: allImages,
            resolution: '2K'
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
