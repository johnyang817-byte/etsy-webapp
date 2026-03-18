// api/ecom-suite.js - 电商套图生成（图生图 Seedream 5.0）
export default async function handler(req, res) {
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    else if (process.env.NODE_ENV === 'development') res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { imageBase64, productDesc } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'Missing image' });

    const doubaoKey = process.env.DOUBAO_API_KEY_V2 || 'b3f3eac1-8556-4f20-8ad7-ec42f75b02f1';
    const dashscopeKey = process.env.DASHSCOPE_API_KEY;

    try {
        // Step 1: If no product description, use vision to identify
        let desc = productDesc || '';
        if (!desc && dashscopeKey) {
            try {
                const vr = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${dashscopeKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'qwen-vl-plus',
                        messages: [{ role: 'user', content: [
                            { type: 'image_url', image_url: { url: imageBase64 } },
                            { type: 'text', text: 'Identify this product precisely. What is it? Brand? Model? Key features? Be specific and accurate. One paragraph.' }
                        ]}]
                    })
                });
                const vd = await vr.json();
                if (vd.choices?.[0]?.message?.content) desc = vd.choices[0].message.content;
            } catch (e) { desc = 'product'; }
        }

        // Step 2: Generate 4 e-commerce detail images
        const basePrompt = `你是一个资深的SEO、GEO以及电商美工设计专家，设计符合欧美审美的电商套图。产品信息：${desc}。要求：保持产品一致性！产品外形大小包括包装文字图案全部保持不变！其他附件的细节全美式英文描述，不要有任何违规词汇！`;

        const prompts = [
            `${basePrompt}，使用场景图：展示产品在真实生活中的使用场景，欧美风格家居/户外环境，自然光线，高级感，产品清晰可见，8K高清，电商详情图风格。`,
            `${basePrompt}，送礼场景图：精美礼盒包装，节日氛围（圣诞/生日/情人节），温馨感人，产品作为礼物的展示，附英文祝福语，8K高清。`,
            `${basePrompt}，产品细节特写图：微距展示产品材质、工艺、质感细节，附英文标注说明产品特点和卖点，专业产品摄影风格，8K高清。`,
            `${basePrompt}，产品对比/尺寸展示图：展示产品尺寸、颜色选项或与常见物品的大小对比，附英文尺寸标注，清晰直观，电商信息图风格，8K高清。`
        ];
        const labels = ['Lifestyle Scene', 'Gift Scene', 'Detail Close-up', 'Size & Info'];

        const imagePromises = prompts.map(async (prompt) => {
            try {
                const r = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doubaoKey}` },
                    body: JSON.stringify({
                        model: 'doubao-seedream-5-0-260128',
                        prompt,
                        image: imageBase64,
                        size: '2K',
                        output_format: 'png',
                        watermark: false
                    })
                });
                if (!r.ok) { const t = await r.text(); return { error: { message: `HTTP ${r.status}: ${t.slice(0, 100)}` } }; }
                return await r.json();
            } catch (e) { return { error: { message: e.message } }; }
        });

        const results = await Promise.all(imagePromises);
        const allImages = [];
        results.forEach((data, i) => {
            if (data.data?.[0]?.url) allImages.push({ url: data.data[0].url, label: labels[i] });
        });

        if (allImages.length === 0) {
            const err = results.find(r => r.error)?.error?.message || 'Unknown';
            throw new Error('Failed: ' + err);
        }

        return res.status(200).json({ success: true, images: allImages, description: desc, resolution: '2K' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
