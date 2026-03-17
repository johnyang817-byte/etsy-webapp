// local-server.js - 本地测试服务器
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// 加载 .env
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && key.trim()) process.env[key.trim()] = vals.join('=').trim();
  });
} catch (e) {}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function buildPrompt(product, customPrompts) {
  const productInfo = `- 产品名称：${product.product_name}
- 关键词/描述：${product.keywords || ''}
- 材质：${product.material || 'See photos'}
- 尺寸：${product.size || 'See photos'}
- 颜色：${product.color || ''}
- 适用场景：${product.occasion || ''}`;

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

  const titleSection = customPrompts?.title ? `【标题】\n${customPrompts.title}` : defaultTitle;
  const descSection = customPrompts?.description ? `【描述】\n${customPrompts.description}` : defaultDescription;
  const tagsSection = customPrompts?.tags ? `【标签】\n${customPrompts.tags}` : defaultTags;
  const attrSection = customPrompts?.attributes ? `【属性】\n${customPrompts.attributes}` : defaultAttributes;

  return `你是一名美国本土 Etsy SEO 文案专家。请根据以下产品信息，生成完整的 Etsy Listing 文案。不要限制字数，尽量丰富详尽。

产品信息：
${productInfo}

请严格按照以下四个板块输出，每个板块用 【板块名】 标记开头：

${titleSection}

${descSection}

${tagsSection}

${attrSection}`;
}

const server = http.createServer({ maxHeaderSize: 16384 }, async (req, res) => {
  // Increase body size limit for base64 images
  req.setEncoding('utf8');
  // API 路由
  // Image Generate (识别+竞品+生成)
  if (req.url === '/api/image-generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { imageBase64, productInfo, customPrompts } = JSON.parse(body);
        if (!imageBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Missing image' }));
        }
        const apiKey = process.env.DASHSCOPE_API_KEY;
        const serperKey = process.env.SERPER_API_KEY;
        const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Missing AI API Key' }));
        }

        // Step 1: Identify from image via vision (OpenAI-compatible)
        let identified = {};
        try {
          const visionText = await callVision(apiKey, imageBase64, 'Analyze this product. Return JSON: {"product_name":"...","category":"...","material":"...","color":"...","style":"...","keywords":"5 comma-separated","target_audience":"..."}. ONLY JSON.');
          const jsonMatch = visionText.match(/\{[\s\S]*\}/);
          if (jsonMatch) identified = JSON.parse(jsonMatch[0]);
        } catch (e) { identified = { product_name: productInfo?.product_name || 'Product', keywords: 'jewelry, handmade' }; }

        const finalProduct = {
          product_name: productInfo?.product_name?.trim() || identified.product_name || 'Product',
          material: productInfo?.material?.trim() || identified.material || '',
          color: identified.color || '', style: identified.style || '', category: identified.category || '',
          occasion: productInfo?.occasion?.trim() || '', keywords: identified.keywords || '', target_audience: identified.target_audience || ''
        };
        const searchKeyword = identified.keywords ? identified.keywords.split(',')[0].trim() : finalProduct.product_name;

        // Step 2: Search competitors
        let competitors = [];
        if (serperKey) {
          const searchRes = await fetch('https://google.serper.dev/search', {
            method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: `${searchKeyword} site:etsy.com`, num: 20, gl: 'us', hl: 'en' })
          });
          const searchData = await searchRes.json();
          if (searchData.organic) competitors = searchData.organic.filter(i => i.link?.includes('etsy.com')).map(i => ({ title: i.title, snippet: i.snippet, url: i.link, price: (i.snippet?.match(/\$[\d,.]+/) || [''])[0] }));
        }

        // Step 3: Analyze
        const competitorText = competitors.length > 0 ? competitors.slice(0, 15).map((c, i) => `${i+1}. ${c.title}\n   ${c.snippet}\n   Price: ${c.price || 'N/A'}`).join('\n\n') : `Using AI knowledge for "${searchKeyword}".`;
        const analysisRes = await callAI(apiKey, model, 'Etsy market analyst.', `Analyze Etsy competitors for "${searchKeyword}":\n\n${competitorText}\n\n1. Top 10 Keywords\n2. Price Range\n3. Selling Points\n4. Market Gaps\n5. Strategy`);

        // Step 4: Generate
        const genPrompt = `Etsy Growth Hacker.\n\nPRODUCT:\n- Name: ${finalProduct.product_name}\n- Category: ${finalProduct.category}\n- Material: ${finalProduct.material || 'See photos'}\n- Color: ${finalProduct.color}\n- Style: ${finalProduct.style}\n\nCOMPETITOR INTELLIGENCE:\n${analysisRes}\n\nGenerate differentiated listing with 【标题】【描述】【标签】【属性】.`;
        const listing = await callAI(apiKey, model, 'Expert Etsy SEO copywriter.', genPrompt);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, identified: finalProduct, competitorCount: competitors.length, competitorReport: analysisRes, listing, searchKeyword }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Smart Generate (multi-source)
  if (req.url === '/api/smart-generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { keyword, productInfo, customPrompts } = JSON.parse(body);
        if (!keyword) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ success: false, error: 'Missing keyword' })); }
        const apiKey = process.env.DASHSCOPE_API_KEY;
        const serperKey = process.env.SERPER_API_KEY;
        const serpApiKey = process.env.SERPAPI_KEY;
        const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
        if (!apiKey) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ success: false, error: 'Missing AI API Key' })); }
        const kw = keyword.trim();
        const dataSources = {};

        // Source 1: Etsy
        let competitors = [];
        if (serperKey) {
          try {
            const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ q: `${kw} site:etsy.com`, num: 20, gl: 'us', hl: 'en' }) });
            const d = await r.json();
            if (d.organic) competitors = d.organic.filter(i => i.link?.includes('etsy.com')).map(i => ({ title: i.title, snippet: i.snippet, url: i.link, price: (i.snippet?.match(/\$[\d,.]+/) || [''])[0] }));
            dataSources.etsy_search = { count: competitors.length, status: 'ok' };
          } catch (e) { dataSources.etsy_search = { count: 0, status: 'error' }; }
        }

        // Source 2: Google Shopping
        let shoppingResults = [];
        if (serperKey) {
          try {
            const r = await fetch('https://google.serper.dev/shopping', { method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ q: kw, num: 10, gl: 'us', hl: 'en' }) });
            const d = await r.json();
            if (d.shopping) shoppingResults = d.shopping.map(i => ({ title: i.title, price: i.price, source: i.source, rating: i.rating }));
            dataSources.google_shopping = { count: shoppingResults.length, status: 'ok' };
          } catch (e) { dataSources.google_shopping = { count: 0, status: 'error' }; }
        }

        // Source 3: Amazon
        let amazonResults = [];
        if (serperKey) {
          try {
            const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ q: `${kw} site:amazon.com`, num: 10, gl: 'us', hl: 'en' }) });
            const d = await r.json();
            if (d.organic) amazonResults = d.organic.filter(i => i.link?.includes('amazon.com')).slice(0, 5).map(i => ({ title: i.title, snippet: i.snippet, price: (i.snippet?.match(/\$[\d,.]+/) || [''])[0] }));
            dataSources.amazon = { count: amazonResults.length, status: 'ok' };
          } catch (e) { dataSources.amazon = { count: 0, status: 'error' }; }
        }

        // Source 4: Google Trends
        let trendsData = null;
        if (serpApiKey) {
          try {
            const r = await fetch(`https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(kw)}&date=today+12-m&api_key=${serpApiKey}`);
            const d = await r.json();
            if (d.interest_over_time?.timeline_data) {
              const recent = d.interest_over_time.timeline_data.slice(-12);
              const values = recent.map(t => t.values?.[0]?.extracted_value || 0);
              const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
              const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;
              trendsData = { avg_interest: avg, trend_direction: trend > 10 ? 'Rising' : trend < -10 ? 'Declining' : 'Stable', peak_interest: Math.max(...values) };
            }
            if (d.related_queries?.rising) { trendsData = trendsData || {}; trendsData.rising_queries = d.related_queries.rising.slice(0, 10).map(q => ({ query: q.query, growth: q.value })); }
            if (d.related_queries?.top) { trendsData = trendsData || {}; trendsData.top_queries = d.related_queries.top.slice(0, 10).map(q => ({ query: q.query, value: q.value })); }
            dataSources.google_trends = { status: 'ok', direction: trendsData?.trend_direction || 'N/A' };
          } catch (e) { dataSources.google_trends = { status: 'error' }; }
        }

        // Build intelligence
        let intel = `## Intelligence for "${kw}"\n\n### Etsy (${competitors.length})\n`;
        intel += competitors.slice(0, 15).map((c, i) => `${i+1}. ${c.title} | ${c.price || 'N/A'}`).join('\n');
        intel += `\n\n### Google Shopping (${shoppingResults.length})\n`;
        intel += shoppingResults.map((s, i) => `${i+1}. ${s.title} — ${s.price || 'N/A'} (${s.source})`).join('\n');
        intel += `\n\n### Amazon (${amazonResults.length})\n`;
        intel += amazonResults.map((a, i) => `${i+1}. ${a.title} | ${a.price || 'N/A'}`).join('\n');
        if (trendsData) { intel += `\n\n### Google Trends\nTrend: ${trendsData.trend_direction} | Avg: ${trendsData.avg_interest}/100`; if (trendsData.rising_queries) intel += `\nRising: ${trendsData.rising_queries.map(q => q.query).join(', ')}`; }

        const analysisRes = await callAI(apiKey, model, 'Etsy market analyst.', `Analyze:\n${intel}\n\nProvide: 1.Top Keywords 2.Price Intelligence 3.Trends 4.Selling Points 5.Gaps 6.Strategy`);
        const pName = productInfo?.product_name || kw;
        const listing = await callAI(apiKey, model, 'Expert Etsy SEO copywriter.', `INTELLIGENCE:\n${analysisRes}\n\nProduct: ${pName}\nMaterial: ${productInfo?.material || 'See photos'}\nColor: ${productInfo?.color || ''}\n\nGenerate with 【标题】【描述】【标签】【属性】.`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, competitorCount: competitors.length, shoppingCount: shoppingResults.length, amazonCount: amazonResults.length, trendsData, dataSources, competitorReport: analysisRes, listing, keyword: kw }));
      } catch (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: err.message })); }
    });
    return;
  }

  // White BG Generate (豆包 Seedream)
  if (req.url === '/api/white-bg' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { imageBase64 } = JSON.parse(body);
        if (!imageBase64) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ success: false, error: 'Missing image' })); }
        const apiKey = process.env.DASHSCOPE_API_KEY;
        const doubaoKey = process.env.DOUBAO_API_KEY_V2 || 'b3f3eac1-8556-4f20-8ad7-ec42f75b02f1';
        if (!apiKey || !doubaoKey) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ success: false, error: 'Missing API Key' })); }

        // Step 1: Vision识别
        const productDesc = await callVision(apiKey, imageBase64, 'Describe ONLY what you see in this product image. Do NOT guess or add details not visible. Include: exact product type, exact colors, exact materials, shape, all visible details (clasps, charms, patterns), surface finish. Say "not visible" for anything unclear.');
        if (!productDesc) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ success: false, error: 'Failed to analyze image' })); }

        // Step 2: 豆包Seedream并行生成4张
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
            body: JSON.stringify({ model: 'doubao-seedream-5-0-260128', prompt: p, response_format: 'url', size: '2K', stream: false, watermark: false })
          }).then(r => r.json()).catch(e => ({ error: e.message }))
        );

        const results = await Promise.all(imagePromises);
        const allImages = [];
        results.forEach((data, i) => {
          if (data.data?.[0]?.url) allImages.push({ url: data.data[0].url, label: labels[i] });
        });
        if (allImages.length === 0) throw new Error('All image generations failed');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, images: allImages, description: productDesc, resolution: '1024x1024' }));
      } catch (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: err.message })); }
    });
    return;
  }

  // Generate
  if (req.url === '/api/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { product, customPrompts } = JSON.parse(body);
        if (!product || !product.product_name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: '缺少产品名称' }));
        }

        const apiKey = process.env.DASHSCOPE_API_KEY;
        const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';

        if (!apiKey || apiKey === 'your_api_key_here') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: '请在 .env 文件中配置 DASHSCOPE_API_KEY' }));
        }

        const prompt = buildPrompt(product, customPrompts || null);

        const apiRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            input: { messages: [
              { role: 'system', content: 'You are an expert Etsy SEO copywriter based in the US. Write rich, detailed, emotionally engaging content. Do not limit word count. Be thorough and creative.' },
              { role: 'user', content: prompt }
            ]},
            parameters: { result_format: 'message', max_tokens: 8000 }
          })
        });

        const data = await apiRes.json();
        if (data.output?.choices?.[0]?.message?.content) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, text: data.output.choices[0].message.content }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: data.message || 'API返回格式异常' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 静态文件
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, filePath);
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n✅ Etsy 文案助手本地服务已启动！`);
  console.log(`👉 打开浏览器访问: http://localhost:${PORT}\n`);
});

// Helper: Call DashScope Vision (OpenAI-compatible)
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

// Helper: Call DashScope AI

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

async function callAI(apiKey, model, systemMsg, userMsg) {
  const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }] },
      parameters: { result_format: 'message', max_tokens: 8000 }
    })
  });
  const data = await res.json();
  if (data.output?.choices?.[0]?.message?.content) return data.output.choices[0].message.content;
  throw new Error(data.message || 'AI API error');
}
