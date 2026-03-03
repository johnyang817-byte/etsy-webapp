const cloud = require("@vercel/node");
const dashscope = require("dashscope");

// 初始化 DashScope
dashscope.apiKey = process.env.DASHSCOPE_API_KEY;
const model = process.env.DASHSCOPE_MODEL || "qwen-35-plus";

module.exports = async (req, res) => {
    // 允许跨域
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const { product } = req.body;

    if (!product || !product.product_name) {
        return res.status(400).json({ success: false, error: "产品信息不完整" });
    }

    // 构建提示词
    const prompt = `
你是一名美国本土Etsy SEO文案专家。请根据以下产品信息，生成完整的Etsy列表文案，包含：
1. 标题（3个选项，140字符内）
2. 产品描述（美式电商风格，包含情绪引入、特点列表、送礼建议、材质尺寸）
3. 标签（13个，每个≤20字符）

产品信息：
- 产品名称：${product.product_name}
- 关键词/描述：${product.keywords || ""}
- 材质：${product.material || "See photos"}
- 尺寸：${product.size || "See photos"}
- 颜色：${product.color || ""}
- 适用场景：${product.occasion || ""}

要求：
- 符合Etsy搜索逻辑，自然美式表达
- 标题必须包含送礼关键词（如gift, present, for her, for him, birthday等）
- 描述要真诚、像朋友推荐，不要像广告
- 避免敏感词，符合平台规范
- 材质/尺寸如不确定写“See photos”
- 标签覆盖：产品类型、送礼、使用场景，不重复

请按以下格式输出：
标题：xxx
描述：xxx
标签：xxx
`;

    try {
        const response = await dashscope.Generation.call({
            model: model,
            messages: [
                { role: "system", content: "You are an expert Etsy SEO copywriter." },
                { role: "user", content: prompt }
            ],
            result_format: "message"
        });

        if (response.statusCode === 200) {
            const text = response.output.choices[0].message.content;
            return res.status(200).json({ success: true, text });
        } else {
            return res.status(500).json({ 
                success: false, 
                error: `DashScope API 错误: ${response.statusCode} - ${response.message}` 
            });
        }
    } catch (error) {
        console.error("DashScope 调用失败:", error);
        return res.status(500).json({ 
            success: false, 
            error: `API 调用异常: ${error.message}` 
        });
    }
};
