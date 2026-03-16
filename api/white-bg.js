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

    // Determine image size based on ratio and plan
    const sizeMap = {
        '1:1': '1024*1024',
        '4:3': '1024*768',
        '16:9': '1280*720',
        '9:16': '720*1280'
    };
    const selectedRatio = isPro ? (ratio || '1:1') : '1:1';
    const imageSize = isPro ? (sizeMap[selectedRatio] || '1024*1024') : '512*512'; // Free = low res

    try {
        // Step 1: Vision model identifies product precisely
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
                        { text: `You are a professional product photographer. Analyze this product image with EXTREME precision.

CRITICAL RULES:
- Describe ONLY what you can clearly see. Do NOT guess or invent details you cannot confirm.
- If you cannot see a specific angle or detail, say "not visible" instead of guessing.
- Product consistency is the #1 priority.

Provide:
1. EXACT product type and name (be very specific, e.g. "red braided cord bracelet with gold lucky knot charm")
2. ALL visible colors with precise descriptions (e.g. "deep crimson red cord, 18K gold-tone metal charm")
3. ALL visible materials and textures
4. Exact shape, proportions, and structural details
5. Any text, engravings, patterns, clasps, closures, or decorations
6. Surface finish (matte, glossy, satin, metallic, etc.)
7. Approximate size relative to common objects

IMPORTANT: If you are unsure about any detail, explicitly state that rather than guessing.` }
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
        if (!productDescription) return res.status(500).json({ success: false, error: 'Failed to analyze product image' });

        // Step 2: Generate 4 different angle images
        const basePrompt = `${productDescription}. Product retouching: product placed on pure clean white background #FFFFFF, accurately restore product colors and material textures, remove ALL fingerprints dust and imperfections keeping ONLY the product itself, enhance overall texture and premium luxury feel, meets e-commerce main image standards, professional studio lighting, photorealistic, commercial photography quality.`;

        const prompts = [
            // Image 1: Front view hero shot
            `${basePrompt} Front-facing hero shot, product centered, straight-on angle, clean composition, ${imageSize === '512*512' ? '' : 'ultra high detail,'}  4K quality.`,
            // Image 2: 45-degree angle
            `${basePrompt} 45-degree angle view showing depth and dimension, product slightly rotated, revealing texture and craftsmanship details, elegant composition.`,
            // Image 3: Close-up detail
            `${basePrompt} Close-up macro detail shot, showing material texture, craftsmanship quality, clasp or closure details if applicable, shallow depth of field effect.`,
            // Image 4: Lifestyle model wearing/using
            `${basePrompt} Elegant model wearing/using this product, premium fashion editorial style, soft natural lighting, model's skin tone complements the product, luxury lifestyle feel, clean minimal background, high-end magazine quality. Do NOT use the reference image directly.`
        ];

        // Generate all 4 images
        const taskIds = [];
        for (const prompt of prompts) {
            const imgRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'X-DashScope-Async': 'enable'
                },
                body: JSON.stringify({
                    model: 'wanx-v1',
                    input: { prompt },
                    parameters: { n: 1, size: imageSize, style: '<photo>' }
                })
            });
            const imgData = await imgRes.json();
            if (imgData.output?.task_id) taskIds.push(imgData.output.task_id);
        }

        // Poll all tasks
        const allImages = [];
        const labels = ['Front View', '45° Angle', 'Detail Close-up', 'Model Lifestyle'];
        for (let t = 0; t < taskIds.length; t++) {
            let result = null;
            for (let i = 0; i < 40; i++) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const pollRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskIds[t]}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                const pollData = await pollRes.json();
                if (pollData.output?.task_status === 'SUCCEEDED') {
                    result = pollData.output.results;
                    break;
                } else if (pollData.output?.task_status === 'FAILED') {
                    break; // Skip this one
                }
            }
            if (result?.[0]?.url) {
                allImages.push({ url: result[0].url, label: labels[t] });
            }
        }

        if (allImages.length === 0) throw new Error('All image generations failed');

        return res.status(200).json({
            success: true,
            images: allImages,
            description: productDescription,
            isPro,
            ratio: selectedRatio,
            resolution: imageSize
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
