// api/generate.js - 修复版，完整 CORS 支持
export default async function handler(req, res) {
    // ============== CORS 配置 ==============
    // 设置允许的来源（根据你的前端域名调整）
    const allowedOrigins = [
        'https://etsy-webapp.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173'
    ];
  
    const origin = req.headers.origin;
    const isAllowed = allowedOrigins.includes(origin);
  
    // 设置 CORS 头
    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        // 开发环境允许所有，生产环境严格限制
        if (process.env.NODE_ENV === 'development') {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    }
  
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24小时
  
    // ============== 处理 OPTIONS 预检请求 ==============
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
  
    // ============== 只允许 POST ==============
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }
  
    // ============== 解析请求体 ==============
    let product;
    try {
        const body = req.body;
        product = body.product;
    } catch (e) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid JSON body' 
        });
    }
  
    // ============== 验证产品数据 ==============
    if (!product) {
        return res.status(400).json({ 
            success: false, 
            error: '产品信息不完整：未接收到产品数据' 
        });
    }
  
    if (!product.product_name || product.product_name.trim() === '') {
        return res.status(400).json({ 
            success: false, 
            error: '产品信息不完整：缺少产品名称' 
        });
    }
  
    // ============== 从环境变量获取 API Key 和模型 ==============
    const apiKey = process.env.DASHSCOPE_API_KEY;
    const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
  
    if (!apiKey) {
        console.error('DASHSCOPE_API_KEY is not set');
        return res.status(500).json({ 
            success: false, 
            error: '服务器配置错误：缺少API密钥' 
        });
    }
  
    // ============== 构建提示词 ==============
    const prompt = `你是一名美国本土Etsy SEO文案专家。请根据以下产品信息，生成完整的Etsy列表文案，包含：
1. 标题（3个选项，140字符内）
2. 产品描述（美式电商风格，包含情绪引入、特点列表、送礼建议、材质尺寸）
3. 标签（13个，每个≤20字符）

产品信息：
- 产品名称：${product.product_name}
- 关键词/描述：${product.keywords || ''}
- 材质：${product.material || 'See photos'}
- 尺寸：${product.size || 'See photos'}
- 颜色：${product.color || ''}
- 适用场景：${product.occasion || ''}

要求：
- 符合Etsy搜索逻辑，自然美式表达
- 标题必须包含送礼关键词（如gift, present, for her, for him, birthday等）
- 描述要真诚、像朋友推荐，不要像广告
- 避免敏感词，符合平台规范
- 材质/尺寸如不确定写"See photos"
- 标签覆盖：产品类型、送礼、使用场景，不重复

请按以下格式输出：
标题：xxx
描述：xxx
标签：xxx`;
  
    try {
        // ============== 调用 DashScope API ==============
        console.log('Calling DashScope with model:', model);
      
        const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                input: {
                    messages: [
                        { role: 'system', content: 'You are an expert Etsy SEO copywriter.' },
                        { role: 'user', content: prompt }
                    ]
                },
                parameters: {
                    result_format: 'message'
                }
            })
        });
      
        const responseText = await response.text();
        console.log('DashScope response status:', response.status);
        console.log('DashScope response body (truncated):', responseText.substring(0, 500));
      
        if (!response.ok) {
            let errorMessage = `DashScope API error: ${response.status}`;
            try {
                const errorData = JSON.parse(responseText);
                if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (e) {
                errorMessage = responseText.substring(0, 200);
            }
            return res.status(response.status).json({ 
                success: false, 
                error: errorMessage 
            });
        }
      
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse DashScope response as JSON:', responseText);
            return res.status(500).json({ 
                success: false, 
                error: 'DashScope返回的数据格式不正确' 
            });
        }
      
        if (data.output && data.output.choices && data.output.choices.length > 0) {
            const text = data.output.choices[0].message.content;
            return res.status(200).json({ success: true, text });
        } else {
            console.error('Invalid response structure:', data);
            return res.status(500).json({ 
                success: false, 
                error: 'DashScope返回的数据格式不正确' 
            });
        }
      
    } catch (error) {
        console.error('DashScope 调用失败:', error);
        return res.status(500).json({ 
            success: false, 
            error: `API调用失败: ${error.message}` 
        });
    }
}