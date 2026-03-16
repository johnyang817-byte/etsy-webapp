// api/white-bg.js - 产品白底图生成 API
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
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing API Key' });

    try {
        // Use DashScope image generation API to create white background version
        // Step 1: Use vision model to describe the product
        const visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-max';

        const descRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: visionModel,
                input: { messages: [{
                    role: 'user',
                    content: [
                        { image: imageBase64 },
                        { text: `Describe this product in detail for creating a professional e-commerce product photo. Include:
1. Exact product type and name
2. All visible colors and materials
3. Shape, size proportions, and form
4. Any text, engravings, patterns, or decorations
5. Texture and finish (matte, glossy, metallic, etc.)

Be extremely specific and accurate. This description will be used to generate a professional white background product photo.` }
                    ]
                }]},
                parameters: { result_format: 'message' }
            })
        });

        const descData = await descRes.json();
        let productDescription = '';
        const choices = descData.output?.choices;
        if (choices?.[0]?.message?.content) {
            const content = choices[0].message.content;
            productDescription = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => c.text || '').join('') : '');
        }

        if (!productDescription) {
            return res.status(500).json({ success: false, error: 'Failed to analyze product image' });
        }

        // Step 2: Generate white background image using text-to-image
        const imagePrompt = `Professional e-commerce product photography on pure white background. ${productDescription}. Studio lighting, no shadows, no reflections, clean pure white background #FFFFFF, product centered, high resolution, commercial quality, remove all dust fingerprints and imperfections, enhance texture and premium feel, meets e-commerce main image standards, photorealistic, 4K quality.`;

        const imgGenRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable'
            },
            body: JSON.stringify({
                model: 'wanx-v1',
                input: { prompt: imagePrompt },
                parameters: { n: 2, size: '1024*1024', style: '<photo>' }
            })
        });

        const imgGenData = await imgGenRes.json();

        if (imgGenData.output?.task_id) {
            // Async task - poll for result
            const taskId = imgGenData.output.task_id;
            let result = null;
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const pollRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                const pollData = await pollRes.json();
                if (pollData.output?.task_status === 'SUCCEEDED') {
                    result = pollData.output.results;
                    break;
                } else if (pollData.output?.task_status === 'FAILED') {
                    throw new Error('Image generation failed: ' + (pollData.output?.message || 'Unknown error'));
                }
            }

            if (result && result.length > 0) {
                return res.status(200).json({
                    success: true,
                    images: result.map(r => r.url),
                    description: productDescription
                });
            } else {
                throw new Error('Image generation timed out');
            }
        } else {
            throw new Error(imgGenData.message || 'Failed to start image generation');
        }

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
