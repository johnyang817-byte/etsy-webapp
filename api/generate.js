// api/generate.js - Etsy 文案生成 API
export default async function handler(req, res) {
    // CORS
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (process.env.NODE_ENV === 'development') {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    let product, customPrompts;
    try { product = req.body.product; customPrompts = req.body.customPrompts || null; } catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
    if (!product || !product.product_name || !product.product_name.trim()) {
        return res.status(400).json({ success: false, error: '产品信息不完整：缺少产品名称' });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing API Key' });

    const productInfo = `- 产品名称：${product.product_name}
- 关键词/描述：${product.keywords || ''}
- 材质：${product.material || 'See photos'}
- 尺寸：${product.size || 'See photos'}
- 颜色：${product.color || ''}
- 适用场景：${product.occasion || ''}`;

    // Default prompts for each section
    const defaultTitle = `【标题】
生成 3 个 Etsy 英文标题（每个 140 字符以内），爆款结构要求：
- 符合 Etsy 搜索逻辑，美式自然表达
- 包含送礼关键词（如 gift, present, for her, for him, birthday, christmas 等）
- 符合 Etsy 平台规范，不要有敏感词汇`;

    const defaultDescription = `【描述】
请用美式电商风格写一整套丰富的 Etsy 产品描述，语气温暖、真诚、有感染力，不要像广告。我们是定制产品，描述去品牌化，不提品牌故事。必须包含以下完整结构：

1. 【促销标签行】3-5个卖点标签，用表情符号（🌟 New Arrival | ✨ Free Shipping | 🏷️ 40% OFF Sale | 🎁 Ready to Gift）
2. 【情绪型引入】1-2句话，诗意化，点明产品情感价值，如 "Sometimes the smallest things carry the biggest meaning"
3. 【产品故事】2-3段，讲述产品意义，不只是功能，定位为情感载体 / wearable blessings
4. 【场景化价值】用 ✨ 符号列出 Work / Love / Health / Life 等具体场景的价值
5. 【送礼建议】用 👉 符号引导，具体建议给伴侣/给自己/给家人
6. 【送给母亲或父亲】用 👉 符号引导，男款产品给父亲，女款产品给母亲
7. 【产品特点】用简短有力的 bullet points
8. 【客户评价】加入两句模拟客户评价，最好有男也有女客户，美国人名字
9. 【结尾号召】诗意化结尾 + "Add to cart today" 行动号召 + 紧迫感

使用 emoji 增加视觉吸引力。材质/尺寸如不确定写 "See photos"。`;

    const defaultTags = `【标签】
根据 Etsy 美国市场搜索习惯和 2026 Etsy 热搜词，生成 13 个 Etsy Tags：
- 每个标签严格不超过 20 个字符
- 用逗号隔开以便直接上传
- 覆盖：产品类型 / 送礼 / 使用场景
- 避免重复关键词
- 可适当加入生动的表情符号
- 符合 Etsy 平台规范，避免敏感词汇`;

    const defaultAttributes = `【属性】
帮我根据产品信息填写 Etsy Listing 中的 Attributes，不一定需要全部填写，根据实际情况判断，不确定的可以不填。常见属性包括：
- Primary color
- Secondary color
- Holiday
- Occasion
- Material
- Style
- Recipient
- Theme
等，请根据产品实际情况选择合适的属性填写。`;

    // Build prompt: use custom if provided, otherwise default
    const titleSection = customPrompts?.title ? `【标题】\n${customPrompts.title}` : defaultTitle;
    const descSection = customPrompts?.description ? `【描述】\n${customPrompts.description}` : defaultDescription;
    const tagsSection = customPrompts?.tags ? `【标签】\n${customPrompts.tags}` : defaultTags;
    const attrSection = customPrompts?.attributes ? `【属性】\n${customPrompts.attributes}` : defaultAttributes;

    const prompt = `你是一名美国本土 Etsy SEO 文案专家。请根据以下产品信息，生成完整的 Etsy Listing 文案。不要限制字数，尽量丰富详尽。

产品信息：
${productInfo}

请严格按照以下四个板块输出，每个板块用 【板块名】 标记开头：

${titleSection}

${descSection}

${tagsSection}

${attrSection}`;

    try {
        const apiRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                input: { messages: [
                    { role: 'system', content: 'You are an expert Etsy SEO copywriter based in the US. Write rich, detailed, emotionally engaging content. Do not limit word count. Be thorough and creative.' },
                    { role: 'user', content: prompt }
                ]},
                parameters: { result_format: 'message', max_tokens: 4000 }
            })
        });
        const data = await apiRes.json();
        if (data.output?.choices?.[0]?.message?.content) {
            return res.status(200).json({ success: true, text: data.output.choices[0].message.content });
        }
        return res.status(500).json({ success: false, error: data.message || 'API返回格式异常' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
