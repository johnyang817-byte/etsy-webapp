// Etsy 文案助手 - app.js
document.addEventListener('DOMContentLoaded', function () {
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
      if (csvProducts.length === 0) { alert('CSV 中没有有效的产品数据'); return; }
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

  // ========== 解析四板块结果 ==========
  function parseSections(text) {
    const sections = { title: '', description: '', tags: '', attributes: '' };
    const markers = [
      { key: 'title', regex: /【标题】/i },
      { key: 'description', regex: /【描述】/i },
      { key: 'tags', regex: /【标签】/i },
      { key: 'attributes', regex: /【属性】/i }
    ];

    // 找到每个板块的位置
    const positions = markers.map(m => {
      const match = text.match(m.regex);
      return { key: m.key, index: match ? match.index : -1 };
    }).filter(p => p.index >= 0).sort((a, b) => a.index - b.index);

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].index + text.match(markers.find(m => m.key === positions[i].key).regex)[0].length;
      const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
      sections[positions[i].key] = text.slice(start, end).trim();
    }

    // 如果没有匹配到板块标记，整体作为描述
    if (positions.length === 0) {
      sections.description = text;
    }

    return sections;
  }

  // ========== 显示结果 ==========
  function showResults(results) {
    el.resultContent.innerHTML = results.map((item, i) => {
      if (item.error) {
        return `<div class="result-block"><h3>❌ 失败：${item.product.product_name}</h3><p style="color:#e53e3e;">${item.error}</p></div>`;
      }
      return buildResultHtml(item, i);
    }).join('');
    el.resultSection.classList.remove('hidden');
    el.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  function buildResultHtml(item, index) {
    const s = parseSections(item.text);
    const productName = item.product.product_name;

    let html = `<div class="result-product">
      <h2 class="result-product-title">📦 ${productName}</h2>`;

    // 标题板块
    if (s.title) {
      html += `<div class="result-block">
        <div class="block-header"><span class="block-icon">🏷️</span><span class="block-label">Etsy 标题（3个选项）</span>
          <button class="copy-btn" onclick="copyText(this)">📋 复制</button></div>
        <div class="block-content copyable">${formatText(s.title)}</div>
      </div>`;
    }

    // 描述板块
    if (s.description) {
      html += `<div class="result-block">
        <div class="block-header"><span class="block-icon">📝</span><span class="block-label">产品描述</span>
          <button class="copy-btn" onclick="copyText(this)">📋 复制</button></div>
        <div class="block-content copyable">${formatText(s.description)}</div>
      </div>`;
    }

    // 标签板块
    if (s.tags) {
      const tagLine = s.tags.replace(/\n/g, ' ').trim();
      html += `<div class="result-block">
        <div class="block-header"><span class="block-icon">🔖</span><span class="block-label">Etsy 标签（13个）</span>
          <button class="copy-btn" onclick="copyText(this)">📋 复制</button></div>
        <div class="block-content copyable"><div class="tags-display">${renderTags(tagLine)}</div>
          <div class="tags-raw">${escapeHtml(tagLine)}</div></div>
      </div>`;
    }

    // 属性板块
    if (s.attributes) {
      html += `<div class="result-block">
        <div class="block-header"><span class="block-icon">📋</span><span class="block-label">Listing 属性</span>
          <button class="copy-btn" onclick="copyText(this)">📋 复制</button></div>
        <div class="block-content copyable">${formatText(s.attributes)}</div>
      </div>`;
    }

    html += '</div>';
    return html;
  }

  function formatText(text) {
    return escapeHtml(text)
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderTags(tagLine) {
    // 提取逗号分隔的标签
    const tags = tagLine.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    return tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('');
  }

  // ========== 复制功能 ==========
  window.copyText = function (btn) {
    const content = btn.closest('.result-block').querySelector('.copyable');
    // 获取纯文本
    const text = content.innerText || content.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅ 已复制';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      const orig = btn.textContent;
      btn.textContent = '✅ 已复制';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  };

  // ========== 工具函数 ==========
  function showLoading(show) {
    el.loading.classList.toggle('hidden', !show);
    if (show) el.resultSection.classList.add('hidden');
  }

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
