// Etsy 文案助手 - app.js
document.addEventListener('DOMContentLoaded', function () {
  // DOM 元素
  const el = {
    modeCsv: document.getElementById('mode-csv'),
    modeManual: document.getElementById('mode-manual'),
    csvSection: document.getElementById('csv-section'),
    manualSection: document.getElementById('manual-section'),
    generateSection: document.getElementById('generate-section'),
    generateAllBtn: document.getElementById('generate-all'),
    dropZone: document.getElementById('drop-zone'),
    csvInput: document.getElementById('csv-input'),
    fileName: document.getElementById('file-name'),
    csvPreview: document.getElementById('csv-preview'),
    productList: document.getElementById('product-list'),
    productCount: document.getElementById('product-count'),
    manualForm: document.getElementById('manual-form'),
    loading: document.getElementById('loading'),
    resultSection: document.getElementById('result-section'),
    resultContent: document.getElementById('result-content'),
    backBtn: document.getElementById('back-btn')
  };

  let csvProducts = [];

  // ========== 模式切换 ==========
  el.modeCsv.addEventListener('click', () => switchMode('csv'));
  el.modeManual.addEventListener('click', () => switchMode('manual'));

  function switchMode(mode) {
    const isCsv = mode === 'csv';
    el.modeCsv.classList.toggle('active', isCsv);
    el.modeManual.classList.toggle('active', !isCsv);
    el.csvSection.classList.toggle('hidden', !isCsv);
    el.manualSection.classList.toggle('hidden', isCsv);
    el.generateSection.classList.add('hidden');
    el.resultSection.classList.add('hidden');
  }

  // ========== CSV 上传 ==========
  el.dropZone.addEventListener('click', () => el.csvInput.click());
  el.dropZone.addEventListener('dragover', e => { e.preventDefault(); el.dropZone.style.background = '#e0e7ff'; });
  el.dropZone.addEventListener('dragleave', () => { el.dropZone.style.background = '#f8f9ff'; });
  el.dropZone.addEventListener('drop', e => {
    e.preventDefault();
    el.dropZone.style.background = '#f8f9ff';
    if (e.dataTransfer.files.length) handleCsvFile(e.dataTransfer.files[0]);
  });
  el.csvInput.addEventListener('change', e => { if (e.target.files.length) handleCsvFile(e.target.files[0]); });

  async function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) { alert('请上传 CSV 文件'); return; }
    el.fileName.textContent = file.name;
    el.loading.classList.remove('hidden');

    try {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { alert('CSV 文件内容为空或格式不正确'); return; }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      csvProducts = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

        const product = {
          product_name: (row['product_name_en'] || row['product_name'] || row['Product Name'] || row['产品名称'] || row['product_name_cn'] || '').trim(),
          keywords: [row['keywords'] || row['关键词'], row['technique'] || row['工艺'], row['target_audience'] || row['目标客户'], row['usage_scene'] || row['使用场景']].filter(Boolean).join(', '),
          material: (row['material'] || row['材质'] || '').trim(),
          size: (row['size'] || row['尺寸'] || '').trim(),
          color: (row['color'] || row['颜色'] || '').trim(),
          occasion: (row['occasion'] || row['适用场景'] || row['usage_scene'] || '').trim()
        };
        if (product.product_name) csvProducts.push(product);
      }

      if (csvProducts.length === 0) { alert('CSV 中没有有效的产品数据，请检查列名'); return; }

      el.productList.innerHTML = csvProducts.map(p =>
        `<div class="product-item"><i class="fas fa-check-circle"></i> ${p.product_name}</div>`
      ).join('');
      el.csvPreview.classList.remove('hidden');
      el.generateSection.classList.remove('hidden');
      el.productCount.textContent = csvProducts.length;
    } catch (err) {
      alert('CSV 解析失败: ' + err.message);
    } finally {
      el.loading.classList.add('hidden');
    }
  }

  // ========== 手动输入 ==========
  el.manualForm.addEventListener('submit', async e => {
    e.preventDefault();
    const product = {
      product_name: document.getElementById('manual-name').value.trim(),
      keywords: document.getElementById('manual-keywords').value.trim(),
      material: document.getElementById('manual-material').value.trim() || 'See photos',
      size: document.getElementById('manual-size').value.trim() || 'See photos',
      color: document.getElementById('manual-color').value.trim(),
      occasion: document.getElementById('manual-occasion').value.trim()
    };
    if (!product.product_name) { alert('请填写产品名称'); return; }

    showLoading(true);
    try {
      const result = await callApi(product);
      showResults([result]);
    } catch (err) {
      alert('生成失败: ' + err.message);
    } finally {
      showLoading(false);
    }
  });

  // ========== CSV 批量生成 ==========
  el.generateAllBtn.addEventListener('click', async () => {
    if (csvProducts.length === 0) { alert('没有可生成的产品'); return; }
    showLoading(true);
    const results = [];
    for (const product of csvProducts) {
      results.push(await callApi(product));
    }
    showResults(results);
    showLoading(false);
  });

  // ========== API 调用 ==========
  async function callApi(product) {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '生成失败');
      return { product, text: data.text };
    } catch (err) {
      return { product, error: err.message };
    }
  }

  // ========== 显示结果 ==========
  function showResults(results) {
    el.resultContent.innerHTML = results.map((item, i) => {
      if (item.error) {
        return `<div class="result-block"><h3><i class="fas fa-exclamation-triangle"></i> 失败：${item.product.product_name}</h3><p style="color:#e53e3e;">${item.error}</p></div>`;
      }
      return parseResultHtml(item.text, i);
    }).join('');
    el.resultSection.classList.remove('hidden');
    el.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  function parseResultHtml(text, index) {
    const lines = text.split('\n');
    let title = '', description = '', tags = '', section = null;

    lines.forEach(line => {
      if (/^标题[：:]/.test(line)) { section = 'title'; title = line.replace(/^标题[：:]\s*/, ''); }
      else if (/^描述[：:]/.test(line)) { section = 'desc'; description = line.replace(/^描述[：:]\s*/, ''); }
      else if (/^标签[：:]/.test(line)) { section = 'tags'; tags = line.replace(/^标签[：:]\s*/, ''); }
      else if (section && line.trim()) {
        if (section === 'title') title += ' ' + line.trim();
        else if (section === 'desc') description += '\n' + line.trim();
        else if (section === 'tags') tags += ' ' + line.trim();
      }
    });

    if (!title && !description && !tags) {
      return `<div class="result-block"><h3>产品 ${index + 1}</h3><pre style="white-space:pre-wrap;font-size:0.85rem;">${text}</pre></div>`;
    }

    const tagArray = tags.split(/[,，\s]+/).filter(Boolean);
    const safeTitle = title.replace(/'/g, "\\'");
    const safeDesc = description.replace(/'/g, "\\'");
    const safeTags = tagArray.map(t => '#' + t).join(' ').replace(/'/g, "\\'");

    return `
      <div class="result-block">
        <h3>产品 ${index + 1}</h3>
        <div style="margin-bottom:10px">
          <strong>标题：</strong>
          <div style="background:white;padding:8px;border-radius:4px;margin-top:5px;display:flex;justify-content:space-between;align-items:center;">
            <span>${title}</span>
            <button class="copy-btn" onclick="copyToClipboard('${safeTitle}')">复制</button>
          </div>
        </div>
        <div style="margin-bottom:10px">
          <strong>描述：</strong>
          <div style="background:white;padding:8px;border-radius:4px;margin-top:5px;position:relative;">
            <pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${description}</pre>
            <button class="copy-btn" onclick="copyToClipboard('${safeDesc}')">复制</button>
          </div>
        </div>
        <div>
          <strong>标签：</strong>
          <div class="tags-container" style="margin-top:5px">${tagArray.map(t => `<span class="tag">#${t}</span>`).join('')}</div>
          <button class="copy-btn" style="margin-top:5px" onclick="copyToClipboard('${safeTags}')">复制全部标签</button>
        </div>
      </div>`;
  }

  // ========== 工具函数 ==========
  function showLoading(show) {
    el.loading.classList.toggle('hidden', !show);
    if (show) el.resultSection.classList.add('hidden');
  }

  window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板！')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      alert('已复制到剪贴板！');
    });
  };

  el.backBtn.addEventListener('click', () => {
    el.resultSection.classList.add('hidden');
    switchMode(el.modeCsv.classList.contains('active') ? 'csv' : 'manual');
    if (csvProducts.length > 0) {
      el.csvPreview.classList.remove('hidden');
      el.generateSection.classList.remove('hidden');
    }
  });

  switchMode('csv');
});
