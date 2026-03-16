// ListingPaw AI - app.js (4 modules: Image Upload, Smart Generate, CSV Bulk, History)
document.addEventListener('DOMContentLoaded', function () {
  // ========== 页面路由 ==========
  window.showPage = function (page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + page).classList.remove('hidden');
    if (page === 'dashboard') refreshDashboard();
    updateLandingNav();
    window.scrollTo(0, 0);
  };

  window.goToApp = function () {
    showPage(getUser() ? 'dashboard' : 'signup');
  };

  function updateLandingNav() {
    const user = getUser();
    const loggedIn = !!user;
    ['landing-btn-login', 'landing-btn-signup'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', loggedIn);
    });
    ['landing-btn-dashboard', 'landing-btn-logout'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !loggedIn);
    });
  }

  // ========== 用户系统 ==========
  const AUTH_KEY = 'listingpaw_user';

  function getUserKey(suffix) {
    const user = getUser();
    return 'listingpaw_' + (user?.email || 'guest') + '_' + suffix;
  }

  function getUser() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } }
  function setUser(user) { localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }

  function getHistory() { try { return JSON.parse(localStorage.getItem(getUserKey('history'))) || []; } catch { return []; } }
  function saveHistory(item) {
    const h = getHistory();
    h.unshift({ ...item, date: new Date().toISOString() });
    if (h.length > 200) h.length = 200;
    localStorage.setItem(getUserKey('history'), JSON.stringify(h));
  }

  function getUsage() {
    const d = JSON.parse(localStorage.getItem(getUserKey('usage')) || '{}');
    const m = new Date().toISOString().slice(0, 7);
    return d.month === m ? d : { month: m, count: 0 };
  }
  function addUsage() {
    const u = getUsage(); u.count++;
    localStorage.setItem(getUserKey('usage'), JSON.stringify(u));
    return u;
  }

  function getPlan() { return getUser()?.plan || 'free'; }
  function getLimit() { const p = getPlan(); return p === 'unlimited' ? Infinity : p === 'pro' ? 100 : 20; }
  function canGenerate() { return getUsage().count < getLimit(); }

  function getSavedPrompts() { try { return JSON.parse(localStorage.getItem(getUserKey('prompts'))) || {}; } catch { return {}; } }
  function getCustomPrompts() {
    const saved = getSavedPrompts();
    const result = {};
    ['title', 'description', 'tags', 'attributes'].forEach(k => {
      const v = saved[k];
      const text = typeof v === 'string' ? v : (v?.text || '');
      if (text.trim()) result[k] = text.trim();
    });
    return Object.keys(result).length > 0 ? result : null;
  }

  // ========== 注册 ==========
  document.getElementById('signup-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const pw = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    if (pw !== confirm) { alert('Passwords do not match'); return; }
    if (pw.length < 6) { alert('Password must be at least 6 characters'); return; }
    const users = JSON.parse(localStorage.getItem('listingpaw_users') || '{}');
    if (users[email]) { alert('Email already registered'); return; }
    users[email] = { password: pw, plan: 'free' };
    localStorage.setItem('listingpaw_users', JSON.stringify(users));
    setUser({ email, plan: 'free' });
    showPage('dashboard');
  });

  // ========== 登录 ==========
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;
    const users = JSON.parse(localStorage.getItem('listingpaw_users') || '{}');
    if (!users[email] || users[email].password !== pw) { alert('Invalid email or password'); return; }
    setUser({ email, plan: users[email].plan || 'free' });
    showPage('dashboard');
  });

  // ========== 登出 ==========
  function doLogout() { localStorage.removeItem(AUTH_KEY); updateLandingNav(); showPage('landing'); }
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('landing-btn-logout').addEventListener('click', doLogout);

  // ========== Dashboard 刷新 ==========
  function refreshDashboard() {
    const user = getUser();
    if (!user) return;
    const usage = getUsage();
    const limit = getLimit();
    document.getElementById('dash-usage').textContent = `${usage.count} / ${limit === Infinity ? '∞' : limit} used`;
    document.getElementById('dash-plan').textContent = getPlan().charAt(0).toUpperCase() + getPlan().slice(1);
    const warning = document.getElementById('usage-warning');
    if (usage.count >= limit && limit !== Infinity) warning.classList.remove('hidden');
    else warning.classList.add('hidden');
  }

  // ========== DOM 元素 ==========
  const el = {
    modeImage: document.getElementById('mode-image'),
    modeSmart: document.getElementById('mode-smart'),
    modeCsv: document.getElementById('mode-csv'),
    modeHistory: document.getElementById('mode-history'),
    imageSection: document.getElementById('image-section'),
    smartSection: document.getElementById('smart-section'),
    csvSection: document.getElementById('csv-section'),
    historySection: document.getElementById('history-section'),
    generateSection: document.getElementById('generate-section'),
    generateAllBtn: document.getElementById('generate-all'),
    dropZone: document.getElementById('drop-zone'),
    csvInput: document.getElementById('csv-input'),
    fileName: document.getElementById('file-name'),
    csvPreview: document.getElementById('csv-preview'),
    productList: document.getElementById('product-list'),
    productCount: document.getElementById('product-count'),
    loading: document.getElementById('loading'),
    resultSection: document.getElementById('result-section'),
    resultContent: document.getElementById('result-content'),
    backBtn: document.getElementById('back-btn')
  };

  let csvProducts = [];

  // ========== 模式切换 ==========
  function switchMode(mode) {
    ['image', 'smart', 'csv', 'history'].forEach(m => {
      const btn = document.getElementById('mode-' + m);
      const sec = document.getElementById(m + '-section');
      if (btn) btn.classList.toggle('active', m === mode);
      if (sec) sec.classList.toggle('hidden', m !== mode);
    });
    el.generateSection.classList.add('hidden');
    el.resultSection.classList.add('hidden');
    if (mode === 'csv' && csvProducts.length > 0) {
      el.csvPreview.classList.remove('hidden');
      el.generateSection.classList.remove('hidden');
    }
    if (mode === 'history') renderHistory();
  }

  el.modeImage.addEventListener('click', () => switchMode('image'));
  el.modeSmart.addEventListener('click', () => switchMode('smart'));
  el.modeCsv.addEventListener('click', () => switchMode('csv'));
  el.modeHistory.addEventListener('click', () => switchMode('history'));

  // ========== CSV 上传 ==========
  el.dropZone.addEventListener('click', function() { el.csvInput.value = ''; el.csvInput.click(); });
  el.csvInput.addEventListener('change', function() { if (this.files.length) handleCsvFile(this.files[0]); });
  el.dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over'); });
  el.dropZone.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
  el.dropZone.addEventListener('drop', function(e) {
    e.preventDefault(); this.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleCsvFile(e.dataTransfer.files[0]);
  });

  let csvProductSelected = [];

  async function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) { alert('Please upload a CSV file'); return; }
    el.fileName.textContent = file.name;
    try {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { alert('CSV file is empty or invalid'); return; }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      csvProducts = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {}; headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        const product = {
          product_name: (row['product_name_en'] || row['product_name'] || row['Product Name'] || row['product_name_cn'] || '').trim(),
          keywords: [row['keywords'], row['technique'], row['target_audience'], row['usage_scene']].filter(Boolean).join(', '),
          material: (row['material'] || '').trim(), size: (row['size'] || '').trim(),
          color: (row['color'] || '').trim(), occasion: (row['occasion'] || row['usage_scene'] || '').trim()
        };
        if (product.product_name) csvProducts.push(product);
      }
      if (csvProducts.length === 0) { alert('No valid products found in CSV'); return; }
      csvProductSelected = csvProducts.map(() => true);
      renderProductList();
      el.csvPreview.classList.remove('hidden');
      el.generateSection.classList.remove('hidden');
      updateSelectedCount();
    } catch (err) { alert('CSV parse error: ' + err.message); }
  }

  function renderProductList() {
    el.productList.innerHTML =
      `<div class="product-select-all">
        <label><input type="checkbox" id="select-all-cb" ${csvProductSelected.every(Boolean) ? 'checked' : ''} onchange="toggleSelectAll(this.checked)"> Select All (${csvProducts.length})</label>
        <button class="btn-reupload" onclick="document.getElementById('csv-input').value='';document.getElementById('csv-input').click()"><i class="fas fa-sync-alt"></i> Re-upload</button>
      </div>` +
      csvProducts.map((p, i) =>
        `<div class="product-item ${csvProductSelected[i] ? '' : 'product-unchecked'}" onclick="toggleProduct(${i})">
          <input type="checkbox" ${csvProductSelected[i] ? 'checked' : ''} onclick="event.stopPropagation();toggleProduct(${i})">
          <span>${escapeHtml(p.product_name)}</span>
        </div>`
      ).join('');
  }

  window.toggleProduct = function(i) { csvProductSelected[i] = !csvProductSelected[i]; renderProductList(); updateSelectedCount(); };
  window.toggleSelectAll = function(checked) { csvProductSelected = csvProductSelected.map(() => checked); renderProductList(); updateSelectedCount(); };
  function updateSelectedCount() {
    const c = csvProductSelected.filter(Boolean).length;
    el.productCount.textContent = c;
    el.generateAllBtn.disabled = c === 0;
  }
  function getSelectedProducts() { return csvProducts.filter((_, i) => csvProductSelected[i]); }

  // ========== CSV 批量生成 ==========
  el.generateAllBtn.addEventListener('click', async () => {
    const selected = getSelectedProducts();
    if (selected.length === 0) { alert('No products selected'); return; }
    const remaining = getLimit() - getUsage().count;
    if (remaining <= 0) { alert('Monthly limit reached. Please upgrade.'); return; }
    const toGen = selected.slice(0, remaining);
    if (toGen.length < selected.length && !confirm(`You can only generate ${remaining} more. Continue?`)) return;
    showLoading(true);
    const results = [];
    for (const product of toGen) {
      const result = await callApi(product);
      if (!result.error) { addUsage(); saveHistory({ product_name: product.product_name, text: result.text }); }
      results.push(result);
    }
    refreshDashboard(); showResults(results); showLoading(false);
  });

  // ========== API 调用 ==========
  async function callApi(product) {
    try {
      const customPrompts = getCustomPrompts();
      const body = { product };
      if (customPrompts) body.customPrompts = customPrompts;
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');
      return { product, text: data.text };
    } catch (err) { return { product, error: err.message }; }
  }

  // ========== Smart Generate ==========
  document.getElementById('btn-smart-generate').addEventListener('click', async () => {
    if (!canGenerate()) { alert('Monthly limit reached. Please upgrade.'); return; }
    const keyword = document.getElementById('smart-keyword').value.trim();
    if (!keyword) { alert('Please enter a search keyword'); return; }
    const productInfo = {
      product_name: document.getElementById('smart-product-name').value.trim() || keyword,
      material: document.getElementById('smart-material').value.trim(),
      color: document.getElementById('smart-color').value.trim(),
      occasion: document.getElementById('smart-occasion').value.trim()
    };
    const progress = document.getElementById('smart-progress');
    const report = document.getElementById('smart-report');
    const sources = document.getElementById('smart-sources');
    progress.classList.remove('hidden'); report.classList.add('hidden'); sources.classList.add('hidden'); el.resultSection.classList.add('hidden');

    setSmartStep('search', 'active', 'Searching...'); setSmartStep('trends', '', 'waiting'); setSmartStep('analyze', '', 'waiting'); setSmartStep('generate', '', 'waiting');

    try {
      setTimeout(() => { setSmartStep('search', 'done', 'Multi-source search complete'); setSmartStep('trends', 'active', 'Fetching...'); }, 2000);
      setTimeout(() => { setSmartStep('trends', 'done', 'Trends data loaded'); setSmartStep('analyze', 'active', 'Analyzing...'); }, 4000);
      setTimeout(() => { setSmartStep('analyze', 'done', 'Analysis complete'); setSmartStep('generate', 'active', 'Generating...'); }, 7000);

      const customPrompts = getCustomPrompts();
      const res = await fetch('/api/smart-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword, productInfo, customPrompts }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Smart generation failed');

      setSmartStep('search', 'done', `Etsy: ${data.competitorCount} | Shopping: ${data.shoppingCount || 0} | Amazon: ${data.amazonCount || 0}`);
      setSmartStep('trends', 'done', data.trendsData ? `${data.trendsData.trend_direction} (${data.trendsData.avg_interest}/100)` : 'No data');
      setSmartStep('analyze', 'done', 'Analysis complete');
      setSmartStep('generate', 'done', 'Listing generated!');

      // Show data sources
      if (data.dataSources) {
        const srcHtml = Object.entries(data.dataSources).map(([k, v]) => {
          const icon = v.status === 'ok' ? '✅' : '⚠️';
          const name = { etsy_search: 'Etsy Search', google_shopping: 'Google Shopping', amazon: 'Amazon', google_trends: 'Google Trends' }[k] || k;
          const detail = v.count !== undefined ? `${v.count} results` : (v.direction || '');
          return `<span class="source-badge">${icon} ${name} ${detail ? '(' + detail + ')' : ''}</span>`;
        }).join('');
        document.getElementById('smart-sources-content').innerHTML = `<strong>Data Sources:</strong> ${srcHtml}`;
        sources.classList.remove('hidden');
      }

      if (data.competitorReport) { document.getElementById('smart-report-content').textContent = data.competitorReport; report.classList.remove('hidden'); }
      addUsage(); saveHistory({ product_name: productInfo.product_name, text: data.listing }); refreshDashboard();
      showResults([{ product: productInfo, text: data.listing }]);
    } catch (err) {
      setSmartStep('generate', '', 'Failed: ' + err.message);
      alert('Smart Generate failed: ' + err.message);
    }
  });

  function setSmartStep(step, state, statusText) {
    const e = document.getElementById('step-' + step);
    const s = document.getElementById('step-' + step + '-status');
    if (e) e.className = 'smart-step' + (state ? ' ' + state : '');
    if (s && statusText !== undefined) s.textContent = statusText;
  }

  // ========== Image Upload ==========
  let uploadedImages = [];
  const imgDropZone = document.getElementById('img-drop-zone');
  const imgInput = document.getElementById('img-input');
  const imgPreviewArea = document.getElementById('img-preview-area');
  const imgPreviewGrid = document.getElementById('img-preview-grid');
  const imgExtraFields = document.getElementById('img-extra-fields');

  imgDropZone.addEventListener('click', (e) => {
    if (e.target.closest('.img-hero-btn')) return; // btn handles itself
    imgInput.value = ''; imgInput.click();
  });
  const imgUploadBtn = document.getElementById('img-upload-btn');
  if (imgUploadBtn) imgUploadBtn.addEventListener('click', (e) => { e.stopPropagation(); imgInput.value = ''; imgInput.click(); });
  imgInput.addEventListener('change', () => { if (imgInput.files.length) handleImageFiles(imgInput.files); });
  imgDropZone.addEventListener('dragover', e => { e.preventDefault(); imgDropZone.classList.add('drag-over'); });
  imgDropZone.addEventListener('dragleave', () => imgDropZone.classList.remove('drag-over'));
  imgDropZone.addEventListener('drop', e => { e.preventDefault(); imgDropZone.classList.remove('drag-over'); handleImageFiles(e.dataTransfer.files); });
  document.getElementById('btn-add-more-img').addEventListener('click', () => { imgInput.value = ''; imgInput.click(); });

  function handleImageFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB): ' + file.name); continue; }
      if (uploadedImages.length >= 5) { alert('Maximum 5 images'); break; }
      const reader = new FileReader();
      reader.onload = e => { uploadedImages.push({ file, dataUrl: e.target.result }); renderImagePreviews(); };
      reader.readAsDataURL(file);
    }
  }

  function renderImagePreviews() {
    if (uploadedImages.length === 0) {
      imgPreviewArea.classList.add('hidden'); imgExtraFields.classList.add('hidden'); imgDropZone.style.display = ''; return;
    }
    imgDropZone.style.display = 'none';
    imgPreviewArea.classList.remove('hidden'); imgExtraFields.classList.remove('hidden');
    imgPreviewGrid.innerHTML = uploadedImages.map((img, i) =>
      `<div class="img-thumb"><img src="${img.dataUrl}" alt="Product ${i+1}"><button class="img-thumb-remove" onclick="removeImage(${i})"><i class="fas fa-xmark"></i></button></div>`
    ).join('');
  }

  window.removeImage = function(i) { uploadedImages.splice(i, 1); renderImagePreviews(); };

  // Toggle buttons (Yes/No)
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const value = btn.dataset.value;
      document.getElementById(field).value = value;
      btn.closest('.toggle-row').querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('btn-generate-from-img').addEventListener('click', async () => {
    if (uploadedImages.length === 0) { alert('Please upload at least one image'); return; }
    if (!canGenerate()) { alert('Monthly limit reached. Please upgrade.'); return; }

    const productInfo = {
      product_name: document.getElementById('img-product-name').value.trim(),
      material: document.getElementById('img-material').value.trim(),
      style: document.getElementById('img-style').value,
      adjustable: document.getElementById('img-adjustable').value,
      customizable: document.getElementById('img-customizable').value
    };

    // Show progress
    const progress = document.getElementById('img-progress');
    const identified = document.getElementById('img-identified');
    const report = document.getElementById('img-report');
    progress.classList.remove('hidden');
    identified.classList.add('hidden');
    report.classList.add('hidden');
    el.resultSection.classList.add('hidden');

    setImgStep('identify', 'active', 'Analyzing image...');
    setImgStep('search', '', 'waiting');
    setImgStep('analyze', '', 'waiting');
    setImgStep('generate', '', 'waiting');

    try {
      // Animate steps
      setTimeout(() => {
        setImgStep('identify', 'done', 'Product identified');
        setImgStep('search', 'active', 'Searching...');
      }, 3000);
      setTimeout(() => {
        setImgStep('search', 'done', 'Found competitors');
        setImgStep('analyze', 'active', 'Analyzing...');
      }, 6000);
      setTimeout(() => {
        setImgStep('analyze', 'done', 'Analysis complete');
        setImgStep('generate', 'active', 'Generating...');
      }, 9000);

      const customPrompts = getCustomPrompts();
      const body = { imageBase64: uploadedImages[0].dataUrl, productInfo };
      if (customPrompts) body.customPrompts = customPrompts;

      const res = await fetch('/api/image-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');

      // All steps done
      setImgStep('identify', 'done', 'Product identified');
      setImgStep('search', 'done', `Found ${data.competitorCount} competitors`);
      setImgStep('analyze', 'done', 'Analysis complete');
      setImgStep('generate', 'done', 'Listing generated!');

      // Show identified product
      if (data.identified) {
        const id = data.identified;
        document.getElementById('img-identified-content').innerHTML =
          `<div class="identified-grid">
            ${id.product_name ? `<div><strong>Product:</strong> ${escapeHtml(id.product_name)}</div>` : ''}
            ${id.category ? `<div><strong>Category:</strong> ${escapeHtml(id.category)}</div>` : ''}
            ${id.material ? `<div><strong>Material:</strong> ${escapeHtml(id.material)}</div>` : ''}
            ${id.color ? `<div><strong>Color:</strong> ${escapeHtml(id.color)}</div>` : ''}
            ${id.style ? `<div><strong>Style:</strong> ${escapeHtml(id.style)}</div>` : ''}
            ${id.keywords ? `<div><strong>Keywords:</strong> ${escapeHtml(id.keywords)}</div>` : ''}
          </div>`;
        identified.classList.remove('hidden');
      }

      // Show competitor report
      if (data.competitorReport) {
        document.getElementById('img-report-content').textContent = data.competitorReport;
        report.classList.remove('hidden');
      }

      const productName = data.identified?.product_name || productInfo.product_name || 'Product from image';
      addUsage();
      saveHistory({ product_name: productName, text: data.listing });
      refreshDashboard();
      showResults([{ product: { product_name: productName }, text: data.listing }]);

    } catch (err) {
      setImgStep('generate', '', 'Failed: ' + err.message);
      alert('Generation failed: ' + err.message);
    }
  });

  function setImgStep(step, state, statusText) {
    const e = document.getElementById('img-step-' + step);
    const s = document.getElementById('img-step-' + step + '-status');
    if (e) e.className = 'smart-step' + (state ? ' ' + state : '');
    if (s && statusText !== undefined) s.textContent = statusText;
  }

  document.getElementById('img-toggle-report')?.addEventListener('click', () => {
    const body = document.getElementById('img-report-body');
    const icon = document.querySelector('#img-toggle-report .smart-toggle-report i');
    body.classList.toggle('hidden');
    if (icon) { icon.classList.toggle('fa-chevron-up'); icon.classList.toggle('fa-chevron-down'); }
  });

  // ========== 结果展示 ==========
  let lastResults = [];
  let resultExportSelected = [];

  function showResults(results) {
    lastResults = results.filter(r => !r.error);
    resultExportSelected = lastResults.map(() => true);
    el.resultContent.innerHTML =
      `<div class="result-toolbar">
        <button class="btn-toggle-all" onclick="toggleAllProducts(true)"><i class="fas fa-chevron-down"></i> Expand All</button>
        <button class="btn-toggle-all" onclick="toggleAllProducts(false)"><i class="fas fa-chevron-up"></i> Collapse All</button>
        <button class="btn-export-results" onclick="exportResultsCsv()"><i class="fas fa-download"></i> Export Selected as CSV (<span id="export-count">${lastResults.length}</span>)</button>
      </div>` +
      results.map((item, i) => {
        if (item.error) return `<div class="result-block"><div class="block-header"><span class="block-icon">❌</span><span class="block-label">Failed: ${escapeHtml(item.product.product_name)}</span></div><div class="block-content" style="color:#e53e3e;">${escapeHtml(item.error)}</div></div>`;
        const realIdx = lastResults.indexOf(item);
        return buildResultHtml(item, i, realIdx);
      }).join('');
    el.resultSection.classList.remove('hidden');
    el.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  window.toggleExportSelect = function(realIdx, event) {
    event.stopPropagation();
    resultExportSelected[realIdx] = !resultExportSelected[realIdx];
    const cb = document.getElementById('export-cb-' + realIdx);
    if (cb) cb.checked = resultExportSelected[realIdx];
    const c = document.getElementById('export-count');
    if (c) c.textContent = resultExportSelected.filter(Boolean).length;
  };

  window.toggleProductResult = function(index) {
    const body = document.getElementById('product-body-' + index);
    const icon = document.getElementById('product-toggle-' + index);
    if (body.classList.contains('hidden')) { body.classList.remove('hidden'); icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); }
    else { body.classList.add('hidden'); icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); }
  };

  window.toggleAllProducts = function(expand) {
    document.querySelectorAll('.product-body').forEach(el => el.classList.toggle('hidden', !expand));
    document.querySelectorAll('.product-toggle-icon').forEach(icon => {
      if (expand) icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
      else icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
    });
  };

  window.exportResultsCsv = function() {
    const selected = lastResults.filter((_, i) => resultExportSelected[i]);
    if (selected.length === 0) { alert('No products selected for export'); return; }
    const rows = [['Product Name', 'Title 1', 'Title 2', 'Title 3', 'Description', 'Tags', 'Attributes']];
    selected.forEach(item => {
      const s = parseSections(item.text);
      const titles = s.title.split('\n').map(l => l.replace(/^\d+[\.\)、]\s*/, '').trim()).filter(Boolean).slice(0, 3);
      while (titles.length < 3) titles.push('');
      const tags = s.tags.replace(/\n/g, ' ').split(/[,，]/).map(t => t.trim()).filter(Boolean).join(', ');
      rows.push([item.product.product_name, titles[0], titles[1], titles[2], s.description, tags, s.attributes]);
    });
    const csv = rows.map(row => row.map(cell => '"' + (cell || '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'listingpaw_results_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  };

  function buildResultHtml(item, index, realIdx) {
    const s = parseSections(item.text);
    const name = item.product.product_name;
    let html = `<div class="result-product">
      <div class="result-product-header" onclick="toggleProductResult(${index})">
        <input type="checkbox" id="export-cb-${realIdx}" class="export-checkbox" ${resultExportSelected[realIdx] ? 'checked' : ''} onclick="toggleExportSelect(${realIdx}, event)">
        <i id="product-toggle-${index}" class="fas fa-chevron-down product-toggle-icon"></i>
        <h2 class="result-product-title">📦 ${escapeHtml(name)}</h2>
      </div>
      <div id="product-body-${index}" class="product-body">`;
    if (s.title) html += `<div class="result-block"><div class="block-header"><span class="block-icon">🏷️</span><span class="block-label">Etsy Titles</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable">${formatText(s.title)}</div></div>`;
    if (s.description) html += `<div class="result-block"><div class="block-header"><span class="block-icon">📝</span><span class="block-label">Description</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable">${formatText(s.description)}</div></div>`;
    if (s.tags) {
      const tagLine = s.tags.replace(/\n/g, ' ').trim();
      html += `<div class="result-block"><div class="block-header"><span class="block-icon">🔖</span><span class="block-label">Tags</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable"><div class="tags-display">${renderTags(tagLine)}</div><div class="tags-raw">${escapeHtml(tagLine)}</div></div></div>`;
    }
    if (s.attributes) html += `<div class="result-block"><div class="block-header"><span class="block-icon">📋</span><span class="block-label">Attributes</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable">${formatText(s.attributes)}</div></div>`;
    html += '</div></div>';
    return html;
  }

  function parseSections(text) {
    const sections = { title: '', description: '', tags: '', attributes: '' };
    const markers = [{ key: 'title', regex: /【标题】/i }, { key: 'description', regex: /【描述】/i }, { key: 'tags', regex: /【标签】/i }, { key: 'attributes', regex: /【属性】/i }];
    const positions = markers.map(m => { const match = text.match(m.regex); return { key: m.key, index: match ? match.index : -1 }; }).filter(p => p.index >= 0).sort((a, b) => a.index - b.index);
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].index + text.match(markers.find(m => m.key === positions[i].key).regex)[0].length;
      const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
      sections[positions[i].key] = text.slice(start, end).trim();
    }
    if (positions.length === 0) sections.description = text;
    return sections;
  }

  function formatText(text) { return escapeHtml(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); }
  function escapeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function renderTags(tagLine) { return tagLine.split(/[,，]/).map(t => t.trim()).filter(Boolean).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join(''); }

  window.copyText = function(btn) {
    const content = btn.closest('.result-block').querySelector('.copyable');
    const text = content.innerText || content.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent; btn.textContent = '✅ Copied'; setTimeout(() => btn.textContent = orig, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      const orig = btn.textContent; btn.textContent = '✅ Copied'; setTimeout(() => btn.textContent = orig, 2000);
    });
  };

  // ========== 历史记录 ==========
  let historySelected = new Set();
  let historyViewOpen = new Set();

  function renderHistory() {
    const history = getHistory();
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');
    if (history.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    const hasSelected = historySelected.size > 0;
    list.innerHTML =
      `<div class="history-toolbar">
        <label class="history-select-all"><input type="checkbox" ${historySelected.size === history.length ? 'checked' : ''} onchange="historyToggleAll(this.checked)"> Select All (${history.length})</label>
        <div class="history-toolbar-right">
          <span class="history-selected-count">${historySelected.size} selected</span>
          <button class="btn-export" onclick="exportHistorySelected()" ${hasSelected ? '' : 'disabled'}><i class="fas fa-download"></i> Export CSV</button>
          <button class="btn-history-remove" onclick="removeHistorySelected()" ${hasSelected ? '' : 'disabled'}><i class="fas fa-trash-alt"></i> Remove</button>
        </div>
      </div>` +
      history.map((item, i) => {
        const date = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isSelected = historySelected.has(i);
        const isOpen = historyViewOpen.has(i);
        return `<div class="history-item ${isSelected ? 'history-item-selected' : ''}">
          <div class="history-item-row">
            <input type="checkbox" class="history-cb" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation();historyToggleSelect(${i})">
            <div class="history-item-toggle" onclick="historyToggleView(${i})"><i class="fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'} history-toggle-icon"></i></div>
            <span class="history-item-name" onclick="historyToggleView(${i})">${escapeHtml(item.product_name)}</span>
            <span class="history-item-date">${date}</span>
          </div>
          <div class="history-item-body ${isOpen ? '' : 'hidden'}" id="history-body-${i}"></div>
        </div>`;
      }).join('');
  }

  window.historyToggleSelect = function(i) { if (historySelected.has(i)) historySelected.delete(i); else historySelected.add(i); renderHistory(); };
  window.historyToggleAll = function(checked) { const h = getHistory(); historySelected = checked ? new Set(h.map((_, i) => i)) : new Set(); renderHistory(); };

  window.historyToggleView = function(index) {
    const body = document.getElementById('history-body-' + index);
    if (!body) return;
    if (historyViewOpen.has(index)) {
      body.classList.add('hidden'); historyViewOpen.delete(index);
      const row = body.previousElementSibling; const icon = row.querySelector('.history-toggle-icon');
      if (icon) icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
    } else {
      historyViewOpen.add(index);
      const history = getHistory(); const item = history[index]; if (!item) return;
      const s = parseSections(item.text); let content = '';
      if (s.title) content += `<div class="result-block"><div class="block-header"><span class="block-icon">🏷️</span><span class="block-label">Etsy Titles</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable">${formatText(s.title)}</div></div>`;
      if (s.description) content += `<div class="result-block"><div class="block-header"><span class="block-icon">📝</span><span class="block-label">Description</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable">${formatText(s.description)}</div></div>`;
      if (s.tags) {
        const tagLine = s.tags.replace(/\n/g, ' ').trim();
        content += `<div class="result-block"><div class="block-header"><span class="block-icon">🔖</span><span class="block-label">Tags</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable"><div class="tags-display">${renderTags(tagLine)}</div><div class="tags-raw">${escapeHtml(tagLine)}</div></div></div>`;
      }
      if (s.attributes) content += `<div class="result-block"><div class="block-header"><span class="block-icon">📋</span><span class="block-label">Attributes</span><button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div><div class="block-content copyable">${formatText(s.attributes)}</div></div>`;
      body.innerHTML = content; body.classList.remove('hidden');
      const row = body.previousElementSibling; const icon = row.querySelector('.history-toggle-icon');
      if (icon) icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
    }
  };

  window.removeHistorySelected = function() {
    if (historySelected.size === 0) return;
    if (!confirm(`Remove ${historySelected.size} item(s)?`)) return;
    const h = getHistory(); const remaining = h.filter((_, i) => !historySelected.has(i));
    localStorage.setItem(getUserKey('history'), JSON.stringify(remaining));
    historySelected.clear(); historyViewOpen.clear(); renderHistory();
  };

  window.exportHistorySelected = function() {
    if (historySelected.size === 0) { alert('No items selected'); return; }
    const history = getHistory();
    const selected = [...historySelected].sort((a, b) => a - b).map(i => history[i]).filter(Boolean);
    const rows = [['Product Name', 'Title 1', 'Title 2', 'Title 3', 'Description', 'Tags', 'Attributes']];
    selected.forEach(item => {
      const s = parseSections(item.text);
      const titles = s.title.split('\n').map(l => l.replace(/^\d+[\.\)、]\s*/, '').trim()).filter(Boolean).slice(0, 3);
      while (titles.length < 3) titles.push('');
      const tags = s.tags.replace(/\n/g, ' ').split(/[,，]/).map(t => t.trim()).filter(Boolean).join(', ');
      rows.push([item.product_name, titles[0], titles[1], titles[2], s.description, tags, s.attributes]);
    });
    const csv = rows.map(row => row.map(cell => '"' + (cell || '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'listingpaw_history_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  };

  // ========== 工具 ==========
  function showLoading(show) { el.loading.classList.toggle('hidden', !show); if (show) el.resultSection.classList.add('hidden'); }

  el.backBtn.addEventListener('click', () => {
    el.resultSection.classList.add('hidden');
    // Reset image upload state
    if (el.modeImage.classList.contains('active')) {
      uploadedImages = [];
      imgDropZone.style.display = '';
      imgPreviewArea.classList.add('hidden');
      imgExtraFields.classList.add('hidden');
      document.getElementById('img-progress').classList.add('hidden');
      document.getElementById('img-identified').classList.add('hidden');
      document.getElementById('img-report').classList.add('hidden');
    }
    // Reset smart generate state
    if (el.modeSmart.classList.contains('active')) {
      document.getElementById('smart-progress').classList.add('hidden');
      document.getElementById('smart-sources').classList.add('hidden');
      document.getElementById('smart-report').classList.add('hidden');
    }
    if (el.modeImage.classList.contains('active')) switchMode('image');
    else if (el.modeSmart.classList.contains('active')) switchMode('smart');
    else if (el.modeCsv.classList.contains('active')) switchMode('csv');
    else if (el.modeHistory.classList.contains('active')) switchMode('history');
    else switchMode('image');
    if (csvProducts.length > 0) { el.csvPreview.classList.remove('hidden'); el.generateSection.classList.remove('hidden'); }
  });

  // ========== 初始化 ==========
  updateLandingNav();
  const initUser = getUser();
  if (initUser) showPage('dashboard');
  else showPage('landing');
});
