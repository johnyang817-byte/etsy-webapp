// Batch Generate API - Generate multiple images with custom prompt
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { imageBase64, prompt, ratio, count } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Missing image' });
    }

    const doubaoKey = process.env.DOUbao_API_KEY;
    if (!doubaoKey) {
      return res.status(500).json({ success: false, error: 'Doubao API key not configured' });
    }

    // Map ratio to size
    const sizeMap = { '1:1': '1024x1024', '3:4': '768x1024', '9:16': '576x1024', '16:9': '1024x576' };
    const size = sizeMap[ratio] || '1024x1024';

    // Generate prompts
    const basePrompt = prompt || 'Professional product photography, clean background, high quality';
    const prompts = [
      basePrompt + ', professional studio shot, clean background, commercial photography',
      basePrompt + ', lifestyle product shot, natural lighting, elegant composition',
      basePrompt + ', product detail view, texture focus, professional lighting',
      basePrompt + ', product in context, lifestyle setting, modern aesthetic',
      basePrompt + ', artistic product shot, creative composition, premium feel',
      basePrompt + ', minimalist product photography, clean aesthetic, professional'
    ].slice(0, parseInt(count) || 4);

    const labels = ['Style 1', 'Style 2', 'Style 3', 'Style 4', 'Style 5', 'Style 6'].slice(0, prompts.length);

    // Generate images
    const imagePromises = prompts.map((p, i) =>
      fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doubaoKey}` },
        body: JSON.stringify({
          model: 'doubao-seedream-5-0-260128',
          prompt: p,
          image: imageBase64,
          size: size,
          output_format: 'png',
          watermark: false,
          seed: Math.floor(Math.random() * 1000000)
        })
      }).then(r => r.json()).then(d => ({ data: d, label: labels[i] }))
    );

    const results = await Promise.all(imagePromises);
    const images = results.filter(r => r.data.data?.[0]?.url).map(r => ({
      url: r.data.data[0].url,
      label: r.label
    }));

    return res.status(200).json({ success: true, images });
  } catch (error) {
    console.error('Batch generate error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
