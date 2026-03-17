// api/white-bg.js - 产品白底图生成 API（4张不同角度 + 模特示范）
export default async function handler(req, res) {
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    else if (process.env.NODE_ENV === 'development') res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { imageBase64, plan, ratio } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'Missing image' });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing API Key' });

    const isPro = plan === 'pro' || plan === 'unlimited';
    const sizeMap = { '1:1': '1024*1024', '4:3': '1024*768', '16:9': '1280*720', '9:16': '720*1280' };
    const imageSize = isPro ? (sizeMap[ratio] || '1024*1024') : '512*512';

    try {
        // Step 1: Describe product via vision (OpenAI-compatible)
        const productDesc = await callVision(apiKey, imageBase64,
            'Describe this product in extreme detail for recreating a white background product photo. Include: exact type, all colors, materials, textures, shape, decorations, finish. Be very specific and accurate.');

        if (!productDesc) return res.status(500).json({ success: false, error: 'Failed to analyze image' });

        // Step 2: Generate 4 images
        const basePrompt = `${productDesc}. Product retouching: pure white background #FFFFFF, accurately restore colors and textures, remove ALL dust fingerprints imperfections, enhance premium feel, studio lighting, photorealistic, commercial quality.`;
        const prompts = [
            `${basePrompt} Front-facing hero shot, centered, straight-on angle.`,
            `${basePrompt} 45-degree angle view showing depth and dimension.`,
            `${basePrompt} Close-up macro detail shot showing craftsmanship.`,
            `${basePrompt} Elegant model wearing/using this product, fashion editorial style, soft lighting, luxury feel.`
        ];
        const labels = ['Front View', '45° Angle', 'Detail Close-up', 'Model Lifestyle'];

        const taskIds = [];
        for (const p of prompts) {
            const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' },
                body: JSON.stringify({ model: 'wanx-v1', input: { prompt: p }, parameters: { n: 1, size: imageSize, style: '<photo>' } })
            });
            const d = await r.json();
            if (d.output?.task_id) taskIds.push(d.output.task_id);
        }

        const allImages = [];
        for (let t = 0; t < taskIds.length; t++) {
            for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 3000));
                const r = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskIds[t]}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
                const d = await r.json();
                if (d.output?.task_status === 'SUCCEEDED' && d.output?.results?.[0]?.url) { allImages.push({ url: d.output.results[0].url, label: labels[t] }); break; }
                else if (d.output?.task_status === 'FAILED') break;
            }
        }
        if (allImages.length === 0) throw new Error('All image generations failed');

        return res.status(200).json({ success: true, images: allImages, description: productDesc, isPro, ratio: ratio || '1:1', resolution: imageSize });
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
