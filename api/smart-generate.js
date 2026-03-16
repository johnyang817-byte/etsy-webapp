// api/smart-generate.js - 多源搜索→分析→生成 API
// 数据源: Serper(Google Etsy搜索) + Serper(Google Shopping) + SerpApi(Google Trends) + Serper(Amazon参考)
export default async function handler(req, res) {
    const allowedOrigins = ['https://etsy-webapp.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    else if (process.env.NODE_ENV === 'development') res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { keyword, productInfo, customPrompts } = req.body || {};
    if (!keyword?.trim()) return res.status(400).json({ success: false, error: 'Missing keyword' });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;
    const serpApiKey = process.env.SERPAPI_KEY;
    const model = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
    if (!apiKey) return res.status(500).json({ success: false, error: 'Missing AI API Key' });

    try {
        const kw = keyword.trim();
        const dataSources = {};

        // ========== Source 1: Serper — Etsy Competitors (Google site:etsy.com) ==========
        let competitors = [];
        if (serperKey) {
            try {
                const r = await fetch('https://google.serper.dev/search', {
                    method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: `${kw} site:etsy.com`, num: 20, gl: 'us', hl: 'en' })
                });
                const d = await r.json();
                if (d.organic) {
                    competitors = d.organic.filter(i => i.link?.includes('etsy.com')).map(i => ({
                        title: i.title, snippet: i.snippet, url: i.link, price: extractPrice(i.snippet || i.title || '')
                    }));
                }
                dataSources.etsy_search = { count: competitors.length, status: 'ok' };
            } catch (e) { dataSources.etsy_search = { count: 0, status: 'error: ' + e.message }; }
        }

        // ========== Source 2: Serper — Google Shopping Prices ==========
        let shoppingResults = [];
        if (serperKey) {
            try {
                const r = await fetch('https://google.serper.dev/shopping', {
                    method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: kw, num: 10, gl: 'us', hl: 'en' })
                });
                const d = await r.json();
                if (d.shopping) {
                    shoppingResults = d.shopping.map(i => ({
                        title: i.title, price: i.price, source: i.source, link: i.link, rating: i.rating, reviews: i.ratingCount
                    }));
                }
                dataSources.google_shopping = { count: shoppingResults.length, status: 'ok' };
            } catch (e) { dataSources.google_shopping = { count: 0, status: 'error: ' + e.message }; }
        }

        // ========== Source 3: Serper — Amazon Reference ==========
        let amazonResults = [];
        if (serperKey) {
            try {
                const r = await fetch('https://google.serper.dev/search', {
                    method: 'POST', headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: `${kw} site:amazon.com`, num: 10, gl: 'us', hl: 'en' })
                });
                const d = await r.json();
                if (d.organic) {
                    amazonResults = d.organic.filter(i => i.link?.includes('amazon.com')).slice(0, 5).map(i => ({
                        title: i.title, snippet: i.snippet, price: extractPrice(i.snippet || i.title || '')
                    }));
                }
                dataSources.amazon = { count: amazonResults.length, status: 'ok' };
            } catch (e) { dataSources.amazon = { count: 0, status: 'error: ' + e.message }; }
        }

        // ========== Source 4: SerpApi — Google Trends ==========
        let trendsData = null;
        if (serpApiKey) {
            try {
                const trendsUrl = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(kw)}&date=today+12-m&api_key=${serpApiKey}`;
                const r = await fetch(trendsUrl);
                const d = await r.json();
                if (d.interest_over_time?.timeline_data) {
                    const timeline = d.interest_over_time.timeline_data;
                    const recent = timeline.slice(-12);
                    const values = recent.map(t => t.values?.[0]?.extracted_value || 0);
                    const avg = values.reduce((a, b) => a + b, 0) / values.length;
                    const trend = values.length >= 2 ? (values[values.length - 1] - values[0]) : 0;
                    trendsData = {
                        avg_interest: Math.round(avg),
                        trend_direction: trend > 10 ? 'Rising' : trend < -10 ? 'Declining' : 'Stable',
                        peak_interest: Math.max(...values),
                        recent_values: recent.map(t => ({ date: t.date, value: t.values?.[0]?.extracted_value || 0 }))
                    };
                }
                // Related queries
                if (d.related_queries?.rising) {
                    trendsData = trendsData || {};
                    trendsData.rising_queries = d.related_queries.rising.slice(0, 10).map(q => ({ query: q.query, growth: q.value }));
                }
                if (d.related_queries?.top) {
                    trendsData = trendsData || {};
                    trendsData.top_queries = d.related_queries.top.slice(0, 10).map(q => ({ query: q.query, value: q.value }));
                }
                dataSources.google_trends = { status: 'ok', direction: trendsData?.trend_direction || 'N/A' };
            } catch (e) { dataSources.google_trends = { status: 'error: ' + e.message }; }
        }

        // ========== Build Intelligence Report for AI ==========
        let intelligenceText = `## Multi-Source Market Intelligence for "${kw}"\n\n`;

        // Etsy competitors
        intelligenceText += `### 1. Etsy Competitors (${competitors.length} results)\n`;
        if (competitors.length > 0) {
            intelligenceText += competitors.slice(0, 15).map((c, i) =>
                `${i+1}. ${c.title}\n   ${c.snippet}\n   Price: ${c.price || 'N/A'}`
            ).join('\n\n');
        } else {
            intelligenceText += 'No Etsy results found.\n';
        }

        // Google Shopping
        intelligenceText += `\n\n### 2. Google Shopping Prices (${shoppingResults.length} results)\n`;
        if (shoppingResults.length > 0) {
            intelligenceText += shoppingResults.map((s, i) =>
                `${i+1}. ${s.title} — ${s.price || 'N/A'} (${s.source}) ${s.rating ? `★${s.rating} (${s.reviews} reviews)` : ''}`
            ).join('\n');
        } else {
            intelligenceText += 'No shopping results.\n';
        }

        // Amazon
        intelligenceText += `\n\n### 3. Amazon Reference (${amazonResults.length} results)\n`;
        if (amazonResults.length > 0) {
            intelligenceText += amazonResults.map((a, i) =>
                `${i+1}. ${a.title}\n   Price: ${a.price || 'N/A'}`
            ).join('\n');
        } else {
            intelligenceText += 'No Amazon results.\n';
        }

        // Google Trends
        intelligenceText += `\n\n### 4. Google Trends (12-month)\n`;
        if (trendsData) {
            intelligenceText += `Trend: ${trendsData.trend_direction} | Avg Interest: ${trendsData.avg_interest}/100 | Peak: ${trendsData.peak_interest}/100\n`;
            if (trendsData.rising_queries) {
                intelligenceText += `Rising queries: ${trendsData.rising_queries.map(q => `${q.query} (+${q.growth})`).join(', ')}\n`;
            }
            if (trendsData.top_queries) {
                intelligenceText += `Top related: ${trendsData.top_queries.map(q => q.query).join(', ')}\n`;
            }
        } else {
            intelligenceText += 'No trends data.\n';
        }

        // ========== AI Analysis ==========
        const analysisPrompt = `You are a senior Etsy market analyst. Analyze this multi-source intelligence report:

${intelligenceText}

Provide a structured analysis:

【竞品分析报告】

📊 Data Sources Used:
${Object.entries(dataSources).map(([k, v]) => `- ${k}: ${v.status} (${v.count || ''} ${v.direction || ''})`).join('\n')}

1. **Top SEO Keywords** (from Etsy titles + Google Trends rising queries):
   List top 15 keywords with source

2. **Price Intelligence**:
   - Etsy price range: min/max/avg
   - Google Shopping comparison
   - Amazon comparison
   - Recommended Etsy price point

3. **Trend Analysis**:
   - Google Trends direction (rising/stable/declining)
   - Seasonal patterns
   - Rising related keywords to capitalize on

4. **Competitor Selling Points**:
   Top 5 most common selling angles

5. **Market Gaps & Opportunities**:
   5 specific gaps competitors are missing

6. **Differentiation Strategy**:
   3-5 actionable recommendations`;

        const analysisRes = await callAI(apiKey, model, 'Senior Etsy market analyst with access to multi-source data.', analysisPrompt);

        // ========== Generate Listing ==========
        const pName = productInfo?.product_name || kw;
        const genPrompt = `You are an Etsy Growth Hacker and SEO Copywriter.

MULTI-SOURCE INTELLIGENCE:
${analysisRes}

Product: ${pName}
Material: ${productInfo?.material || 'See photos'}
Color: ${productInfo?.color || ''}
Occasion: ${productInfo?.occasion || ''}

${trendsData?.rising_queries ? `TRENDING KEYWORDS TO INCLUDE: ${trendsData.rising_queries.slice(0, 5).map(q => q.query).join(', ')}` : ''}

Generate a DIFFERENTIATED, trend-optimized Etsy listing:

【标题】
${customPrompts?.title || 'Generate 3 Etsy titles (each under 140 chars). Use trending keywords from the analysis. Natural American English.'}

【描述】
${customPrompts?.description || 'Rich, emotionally engaging description with promo tags, story, gifting suggestions, reviews, CTA. Use emojis.'}

【标签】
${customPrompts?.tags || '13 Etsy tags, each under 20 chars, comma-separated. Incorporate trending/rising keywords from Google Trends.'}

【属性】
${customPrompts?.attributes || 'Fill relevant Etsy listing attributes.'}`;

        const listing = await callAI(apiKey, model,
            'Expert Etsy SEO copywriter. Use multi-source intelligence and trending data to create high-converting listings.',
            genPrompt
        );

        return res.status(200).json({
            success: true,
            competitorCount: competitors.length,
            shoppingCount: shoppingResults.length,
            amazonCount: amazonResults.length,
            trendsData,
            dataSources,
            competitorReport: analysisRes,
            listing,
            keyword: kw
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function callAI(apiKey, model, systemMsg, userMsg, maxTokens) {
    const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: { messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }] }, parameters: { result_format: 'message', max_tokens: 4000 } })
    });
    const d = await r.json();
    if (d.output?.choices?.[0]?.message?.content) return d.output.choices[0].message.content;
    throw new Error(d.message || 'AI API error');
}

function extractPrice(text) { const m = text.match(/\$[\d,.]+/); return m ? m[0] : ''; }
