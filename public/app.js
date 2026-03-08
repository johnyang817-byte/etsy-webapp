// Etsy Copy AI - SaaS App
document.addEventListener('DOMContentLoaded', function () {
  // ========== 页面路由 ==========
  window.showPage = function (page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-' + page).classList.remove('hidden');
    if (page === 'dashboard') refreshDashboard();
    updateLandingNav();
    window.scrollTo(0, 0);
  };

  // If logged in → dashboard, otherwise → signup
  window.goToApp = function () {
    showPage(getUser() ? 'dashboard' : 'signup');
  };

  function updateLandingNav() {
    const user = getUser();
    const loggedIn = !!user;
    const btnLogin = document.getElementById('landing-btn-login');
    const btnSignup = document.getElementById('landing-btn-signup');
    const btnDashboard = document.getElementById('landing-btn-dashboard');
    const btnLogout = document.getElementById('landing-btn-logout');
    if (btnLogin) btnLogin.classList.toggle('hidden', loggedIn);
    if (btnSignup) btnSignup.classList.toggle('hidden', loggedIn);
    if (btnDashboard) btnDashboard.classList.toggle('hidden', !loggedIn);
    if (btnLogout) btnLogout.classList.toggle('hidden', !loggedIn);
  }

  // ========== 用户系统（localStorage 模拟，后续接真实后端） ==========
  const AUTH_KEY = 'listingpaw_user';

  function getUserKey(suffix) {
    const user = getUser();
    const uid = user?.email || 'guest';
    return 'listingpaw_' + uid + '_' + suffix;
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
  }

  function setUser(user) { localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(getUserKey('history'))) || []; } catch { return []; }
  }

  function saveHistory(item) {
    const history = getHistory();
    history.unshift({ ...item, date: new Date().toISOString() });
    if (history.length > 200) history.length = 200;
    localStorage.setItem(getUserKey('history'), JSON.stringify(history));
  }

  function getUsage() {
    const data = JSON.parse(localStorage.getItem(getUserKey('usage')) || '{}');
    const month = new Date().toISOString().slice(0, 7);
    if (data.month !== month) return { month, count: 0 };
    return data;
  }

  function addUsage() {
    const usage = getUsage();
    usage.count++;
    localStorage.setItem(getUserKey('usage'), JSON.stringify(usage));
    return usage;
  }

  function getPlan() {
    const user = getUser();
    return user?.plan || 'free';
  }

  function getLimit() {
    const plan = getPlan();
    if (plan === 'unlimited') return Infinity;
    if (plan === 'pro') return 100;
    return 20;
  }

  function canGenerate() {
    return getUsage().count < getLimit();
  }

  function getSavedPrompts() {
    try { return JSON.parse(localStorage.getItem(getUserKey('prompts'))) || {}; } catch { return {}; }
  }

  // ========== 注册 ==========
  document.getElementById('signup-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const pw = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    if (pw !== confirm) { alert('Passwords do not match'); return; }
    if (pw.length < 6) { alert('Password must be at least 6 characters'); return; }

    // 模拟注册（后续接真实 API）
    const users = JSON.parse(localStorage.getItem('listingpaw_users') || '{}');
    if (users[email]) { alert('Email already registered. Please log in.'); return; }
    users[email] = { email, password: btoa(pw), plan: 'free', created: new Date().toISOString() };
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
    if (!users[email] || users[email].password !== btoa(pw)) {
      alert('Invalid email or password'); return;
    }
    setUser({ email, plan: users[email].plan || 'free' });
    showPage('dashboard');
  });

  // ========== 登出 ==========
  function doLogout() {
    localStorage.removeItem(AUTH_KEY);
    updateLandingNav();
    showPage('landing');
  }

  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('landing-btn-logout').addEventListener('click', doLogout);

  // ========== Dashboard 刷新 ==========
  function refreshDashboard() {
    const user = getUser();
    if (!user) { showPage('landing'); return; }
    const usage = getUsage();
    const limit = getLimit();
    const plan = getPlan();

    document.getElementById('dash-usage').textContent = `${usage.count} / ${limit === Infinity ? '∞' : limit} used`;
    document.getElementById('dash-plan').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);

    if (plan !== 'free') {
      document.getElementById('btn-upgrade').textContent = 'Manage Plan';
    }

    const warning = document.getElementById('usage-warning');
    if (!canGenerate()) {
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }
  }

  // ========== DOM 元素 ==========
  const el = {
    modeCsv: document.getElementById('mode-csv'),
    modeManual: document.getElementById('mode-manual'),
    modeHistory: document.getElementById('mode-history'),
    modePrompts: document.getElementById('mode-prompts'),
    csvSection: document.getElementById('csv-section'),
    manualSection: document.getElementById('manual-section'),
    historySection: document.getElementById('history-section'),
    promptsSection: document.getElementById('prompts-section'),
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
  function switchMode(mode) {
    ['csv', 'manual', 'history', 'prompts'].forEach(m => {
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
    if (mode === 'prompts') loadPromptSettings();
  }

  el.modeCsv.addEventListener('click', () => switchMode('csv'));
  el.modeManual.addEventListener('click', () => switchMode('manual'));
  el.modeHistory.addEventListener('click', () => switchMode('history'));
  el.modePrompts.addEventListener('click', () => switchMode('prompts'));

  // ========== CSV 上传 ==========
  el.dropZone.addEventListener('click', () => {
    el.csvInput.value = '';  // 清空以允许重新选择同一文件
    el.csvInput.click();
  });
  el.dropZone.addEventListener('dragover', e => { e.preventDefault(); el.dropZone.style.background = '#e0e7ff'; });
  el.dropZone.addEventListener('dragleave', () => { el.dropZone.style.background = 'white'; });
  el.dropZone.addEventListener('drop', e => {
    e.preventDefault();
    el.dropZone.style.background = 'white';
    if (e.dataTransfer.files.length) handleCsvFile(e.dataTransfer.files[0]);
  });
  el.csvInput.addEventListener('change', e => { if (e.target.files.length) handleCsvFile(e.target.files[0]); });

  let csvProductSelected = []; // 记录每个产品的勾选状态

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
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        const product = {
          product_name: (row['product_name_en'] || row['product_name'] || row['Product Name'] || row['product_name_cn'] || '').trim(),
          keywords: [row['keywords'], row['technique'], row['target_audience'], row['usage_scene']].filter(Boolean).join(', '),
          material: (row['material'] || '').trim(),
          size: (row['size'] || '').trim(),
          color: (row['color'] || '').trim(),
          occasion: (row['occasion'] || row['usage_scene'] || '').trim()
        };
        if (product.product_name) csvProducts.push(product);
      }
      if (csvProducts.length === 0) { alert('No valid products found in CSV'); return; }
      csvProductSelected = csvProducts.map(() => true);
      renderProductList();
      el.csvPreview.classList.remove('hidden');
      el.generateSection.classList.remove('hidden');
      updateSelectedCount();
    } catch (err) {
      alert('CSV parse error: ' + err.message);
    }
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

  window.toggleProduct = function (index) {
    csvProductSelected[index] = !csvProductSelected[index];
    renderProductList();
    updateSelectedCount();
  };

  window.toggleSelectAll = function (checked) {
    csvProductSelected = csvProductSelected.map(() => checked);
    renderProductList();
    updateSelectedCount();
  };

  function updateSelectedCount() {
    const count = csvProductSelected.filter(Boolean).length;
    el.productCount.textContent = count;
    el.generateAllBtn.disabled = count === 0;
  }

  function getSelectedProducts() {
    return csvProducts.filter((_, i) => csvProductSelected[i]);
  }

  // ========== 手动输入 ==========
  el.manualForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!canGenerate()) {
      alert('You have reached your monthly limit. Please upgrade your plan.');
      return;
    }
    const product = {
      product_name: document.getElementById('manual-name').value.trim(),
      keywords: document.getElementById('manual-keywords').value.trim(),
      material: document.getElementById('manual-material').value.trim() || 'See photos',
      size: document.getElementById('manual-size').value.trim() || 'See photos',
      color: document.getElementById('manual-color').value.trim(),
      occasion: document.getElementById('manual-occasion').value.trim()
    };
    if (!product.product_name) { alert('Please enter a product name'); return; }
    showLoading(true);
    try {
      const result = await callApi(product);
      if (!result.error) {
        addUsage();
        saveHistory({ product_name: product.product_name, text: result.text });
        refreshDashboard();
      }
      showResults([result]);
    } catch (err) {
      alert('Generation failed: ' + err.message);
    } finally {
      showLoading(false);
    }
  });

  // ========== CSV 批量生成 ==========
  el.generateAllBtn.addEventListener('click', async () => {
    const selected = getSelectedProducts();
    if (selected.length === 0) { alert('No products selected'); return; }
    const remaining = getLimit() - getUsage().count;
    if (remaining <= 0) {
      alert('You have reached your monthly limit. Please upgrade your plan.');
      return;
    }
    const toGenerate = selected.slice(0, remaining);
    if (toGenerate.length < selected.length) {
      if (!confirm(`You can only generate ${remaining} more this month. Continue with the first ${remaining} products?`)) return;
    }
    showLoading(true);
    const results = [];
    for (const product of toGenerate) {
      const result = await callApi(product);
      if (!result.error) {
        addUsage();
        saveHistory({ product_name: product.product_name, text: result.text });
      }
      results.push(result);
    }
    refreshDashboard();
    showResults(results);
    showLoading(false);
  });

  // ========== API 调用 ==========
  async function callApi(product) {
    try {
      const customPrompts = getCustomPrompts();
      const body = { product };
      if (customPrompts) body.customPrompts = customPrompts;
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Generation failed');
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
    const positions = markers.map(m => {
      const match = text.match(m.regex);
      return { key: m.key, index: match ? match.index : -1 };
    }).filter(p => p.index >= 0).sort((a, b) => a.index - b.index);

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].index + text.match(markers.find(m => m.key === positions[i].key).regex)[0].length;
      const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
      sections[positions[i].key] = text.slice(start, end).trim();
    }
    if (positions.length === 0) sections.description = text;
    return sections;
  }

  // ========== 显示结果 ==========
  let lastResults = []; // 保存最近一次生成结果用于导出
  let resultExportSelected = []; // 每个结果的勾选状态

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
        if (item.error) {
          return `<div class="result-block"><div class="block-header"><span class="block-icon">❌</span><span class="block-label">Failed: ${escapeHtml(item.product.product_name)}</span></div><div class="block-content" style="color:#e53e3e;">${escapeHtml(item.error)}</div></div>`;
        }
        // 找到在 lastResults 中的真实索引
        const realIdx = lastResults.indexOf(item);
        return buildResultHtml(item, i, realIdx);
      }).join('');
    el.resultSection.classList.remove('hidden');
    el.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  window.toggleExportSelect = function (realIdx, event) {
    event.stopPropagation();
    resultExportSelected[realIdx] = !resultExportSelected[realIdx];
    const cb = document.getElementById('export-cb-' + realIdx);
    if (cb) cb.checked = resultExportSelected[realIdx];
    updateExportCount();
  };

  function updateExportCount() {
    const countEl = document.getElementById('export-count');
    if (countEl) countEl.textContent = resultExportSelected.filter(Boolean).length;
  }

  window.toggleProductResult = function (index) {
    const body = document.getElementById('product-body-' + index);
    const icon = document.getElementById('product-toggle-' + index);
    if (body.classList.contains('hidden')) {
      body.classList.remove('hidden');
      icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
    } else {
      body.classList.add('hidden');
      icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
    }
  };

  window.toggleAllProducts = function (expand) {
    document.querySelectorAll('.product-body').forEach(el => {
      el.classList.toggle('hidden', !expand);
    });
    document.querySelectorAll('.product-toggle-icon').forEach(icon => {
      if (expand) icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
      else icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
    });
  };

  window.exportResultsCsv = function () {
    const selected = lastResults.filter((_, i) => resultExportSelected[i]);
    if (selected.length === 0) { alert('No products selected for export'); return; }

    const rows = [['Product Name', 'Title 1', 'Title 2', 'Title 3', 'Description', 'Tags', 'Attributes']];
    selected.forEach(item => {
      const s = parseSections(item.text);
      const titles = s.title.split('\n').map(l => l.replace(/^\d+[\.\)、]\s*/, '').trim()).filter(Boolean).slice(0, 3);
      while (titles.length < 3) titles.push('');
      const tags = s.tags.replace(/\n/g, ' ').split(/[,，]/).map(t => t.trim()).filter(Boolean).join(', ');

      rows.push([
        item.product.product_name,
        titles[0], titles[1], titles[2],
        s.description,
        tags,
        s.attributes
      ]);
    });

    const csv = rows.map(row => row.map(cell => '"' + (cell || '').replace(/"/g, '""').replace(/\n/g, '\n') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'listingpaw_results_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
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

    const blocks = [
      { key: 'title', icon: '🏷️', label: 'Etsy Titles (3 Options)' },
      { key: 'description', icon: '📝', label: 'Product Description' },
      { key: 'tags', icon: '🔖', label: 'Etsy Tags (13)' },
      { key: 'attributes', icon: '📋', label: 'Listing Attributes' }
    ];

    blocks.forEach(b => {
      if (!s[b.key]) return;
      let content;
      if (b.key === 'tags') {
        const tagLine = s.tags.replace(/\n/g, ' ').trim();
        const tags = tagLine.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        content = `<div class="tags-display">${tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div><div class="tags-raw">${escapeHtml(tagLine)}</div>`;
      } else {
        content = formatText(s[b.key]);
      }
      html += `<div class="result-block">
        <div class="block-header"><span class="block-icon">${b.icon}</span><span class="block-label">${b.label}</span>
          <button class="copy-btn" onclick="copyText(this)">📋 Copy</button></div>
        <div class="block-content copyable">${content}</div>
      </div>`;
    });

    html += '</div></div>';
    return html;
  }

  function formatText(text) {
    return escapeHtml(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.copyText = function (btn) {
    const content = btn.closest('.result-block').querySelector('.copyable');
    const text = content.innerText || content.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
    });
  };

  // ========== 历史记录 ==========
  let historySelected = new Set(); // 已选中的历史索引
  let historyViewOpen = new Set(); // 已展开查看的历史索引

  function renderHistory() {
    const history = getHistory();
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');

    if (history.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    const hasSelected = historySelected.size > 0;

    list.innerHTML =
      `<div class="history-toolbar">
        <label class="history-select-all"><input type="checkbox" ${historySelected.size === history.length ? 'checked' : ''} onchange="historyToggleAll(this.checked)"> Select All (${history.length})</label>
        <div class="history-toolbar-right">
          <span class="history-selected-count">${historySelected.size} selected</span>
          <button class="btn-export" onclick="exportHistorySelected()" ${hasSelected ? '' : 'disabled'}><i class="fas fa-download"></i> Export Selected CSV</button>
          <button class="btn-history-remove" onclick="removeHistorySelected()" ${hasSelected ? '' : 'disabled'}><i class="fas fa-trash-alt"></i> Remove</button>
        </div>
      </div>` +
      history.map((item, i) => {
        const date = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isSelected = historySelected.has(i);
        const isOpen = historyViewOpen.has(i);
        let html = `<div class="history-item ${isSelected ? 'history-item-selected' : ''}">
          <div class="history-item-row">
            <input type="checkbox" class="history-cb" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation();historyToggleSelect(${i})">
            <div class="history-item-toggle" onclick="historyToggleView(${i})">
              <i class="fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'} history-toggle-icon"></i>
            </div>
            <span class="history-item-name" onclick="historyToggleView(${i})">${escapeHtml(item.product_name)}</span>
            <span class="history-item-date">${date}</span>
          </div>
          <div class="history-item-body ${isOpen ? '' : 'hidden'}" id="history-body-${i}">`;
        if (isOpen) {
          const s = parseSections(item.text);
          if (s.title) html += `<div class="history-detail-block"><strong>🏷️ Titles</strong><div>${formatText(s.title)}</div></div>`;
          if (s.description) html += `<div class="history-detail-block"><strong>📝 Description</strong><div>${formatText(s.description)}</div></div>`;
          if (s.tags) {
            const tags = s.tags.replace(/\n/g, ' ').split(/[,，]/).map(t => t.trim()).filter(Boolean);
            html += `<div class="history-detail-block"><strong>🔖 Tags</strong><div class="tags-display">${tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div></div>`;
          }
          if (s.attributes) html += `<div class="history-detail-block"><strong>📋 Attributes</strong><div>${formatText(s.attributes)}</div></div>`;
        }
        html += `</div></div>`;
        return html;
      }).join('');
  }

  window.historyToggleSelect = function (index) {
    if (historySelected.has(index)) historySelected.delete(index);
    else historySelected.add(index);
    renderHistory();
  };

  window.historyToggleAll = function (checked) {
    const history = getHistory();
    historySelected = checked ? new Set(history.map((_, i) => i)) : new Set();
    renderHistory();
  };

  window.historyToggleView = function (index) {
    const body = document.getElementById('history-body-' + index);
    if (!body) return;
    const isOpen = historyViewOpen.has(index);

    if (isOpen) {
      // 收起：隐藏内容
      body.classList.add('hidden');
      historyViewOpen.delete(index);
      // 更新箭头
      const row = body.previousElementSibling;
      const icon = row.querySelector('.history-toggle-icon');
      if (icon) { icon.classList.replace('fa-chevron-down', 'fa-chevron-right'); }
    } else {
      // 展开：填充内容并显示
      historyViewOpen.add(index);
      const history = getHistory();
      const item = history[index];
      if (!item) return;
      const s = parseSections(item.text);
      let content = '';
      if (s.title) content += `<div class="history-detail-block"><strong>🏷️ Titles</strong><div>${formatText(s.title)}</div></div>`;
      if (s.description) content += `<div class="history-detail-block"><strong>📝 Description</strong><div>${formatText(s.description)}</div></div>`;
      if (s.tags) {
        const tags = s.tags.replace(/\n/g, ' ').split(/[,，]/).map(t => t.trim()).filter(Boolean);
        content += `<div class="history-detail-block"><strong>🔖 Tags</strong><div class="tags-display">${tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div></div>`;
      }
      if (s.attributes) content += `<div class="history-detail-block"><strong>📋 Attributes</strong><div>${formatText(s.attributes)}</div></div>`;
      body.innerHTML = content;
      body.classList.remove('hidden');
      // 更新箭头
      const row = body.previousElementSibling;
      const icon = row.querySelector('.history-toggle-icon');
      if (icon) { icon.classList.replace('fa-chevron-right', 'fa-chevron-down'); }
    }
  };

  window.removeHistorySelected = function () {
    if (historySelected.size === 0) return;
    if (!confirm(`Remove ${historySelected.size} item(s) from history?`)) return;
    const history = getHistory();
    const remaining = history.filter((_, i) => !historySelected.has(i));
    localStorage.setItem(getUserKey('history'), JSON.stringify(remaining));
    historySelected.clear();
    historyViewOpen.clear();
    renderHistory();
  };

  window.exportHistorySelected = function () {
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
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'listingpaw_history_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };

  window.viewHistory = function (index) {
    historyToggleView(index);
  };

  // ========== Prompt Settings ==========
  const PROMPT_SECTIONS = ['title', 'description', 'tags', 'attributes'];
  const PROMPT_HISTORY_MAX = 5;

  function getCustomPrompts() {
    const saved = getSavedPrompts();
    const result = {};
    PROMPT_SECTIONS.forEach(key => {
      if (saved[key]?.mode === 'custom' && saved[key]?.text?.trim()) {
        result[key] = saved[key].text.trim();
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  }

  function getPromptHistory(section) {
    try { return JSON.parse(localStorage.getItem(getUserKey('prompt_history_' + section))) || []; } catch { return []; }
  }

  function addPromptHistory(section, text) {
    if (!text || !text.trim()) return;
    const history = getPromptHistory(section);
    // Don't add duplicate of the most recent
    if (history.length > 0 && history[0].text === text.trim()) return;
    history.unshift({ text: text.trim(), date: new Date().toISOString() });
    if (history.length > PROMPT_HISTORY_MAX) history.length = PROMPT_HISTORY_MAX;
    localStorage.setItem(getUserKey('prompt_history_' + section), JSON.stringify(history));
  }

  function loadPromptSettings() {
    const saved = getSavedPrompts();
    PROMPT_SECTIONS.forEach(key => {
      const textarea = document.getElementById('prompt-' + key);
      const body = document.getElementById('body-' + key);
      const status = document.getElementById('status-' + key);
      const isCustom = saved[key]?.mode === 'custom';
      textarea.value = saved[key]?.text || '';
      body.classList.toggle('hidden', !isCustom);
      status.textContent = isCustom ? 'Custom' : 'Default';
      status.className = 'ps-item-badge' + (isCustom ? ' ps-badge-custom' : '');
      const segmented = document.querySelector(`.ps-seg[data-target="${key}"]`);
      segmented.querySelectorAll('.ps-seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === (isCustom ? 'custom' : 'default'));
      });
    });
  }

  // Segmented control clicks
  document.querySelectorAll('.ps-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const segmented = btn.closest('.ps-seg');
      const target = segmented.dataset.target;
      const mode = btn.dataset.mode;
      const body = document.getElementById('body-' + target);
      const status = document.getElementById('status-' + target);
      segmented.querySelectorAll('.ps-seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      body.classList.toggle('hidden', mode === 'default');
      status.textContent = mode === 'custom' ? 'Custom' : 'Default';
      status.className = 'ps-item-badge' + (mode === 'custom' ? ' ps-badge-custom' : '');
      if (mode === 'custom') document.getElementById('prompt-' + target).focus();
    });
  });

  // Save
  document.getElementById('btn-save-prompts').addEventListener('click', () => {
    const prompts = {};
    PROMPT_SECTIONS.forEach(key => {
      const textarea = document.getElementById('prompt-' + key);
      const segmented = document.querySelector(`.ps-seg[data-target="${key}"]`);
      const activeBtn = segmented.querySelector('.ps-seg-btn.active');
      const mode = activeBtn?.dataset.mode || 'default';
      prompts[key] = { mode, text: textarea.value };
      if (mode === 'custom' && textarea.value.trim()) {
        addPromptHistory(key, textarea.value);
      }
    });
    localStorage.setItem(getUserKey('prompts'), JSON.stringify(prompts));
    const btn = document.getElementById('btn-save-prompts');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
    btn.classList.add('ps-btn-saved');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('ps-btn-saved'); }, 1800);
  });

  // Reset
  document.getElementById('btn-reset-prompts').addEventListener('click', () => {
    if (!confirm('Reset all prompts to default?')) return;
    localStorage.removeItem(getUserKey('prompts'));
    loadPromptSettings();
  });

  // Prompt History Modal
  window.showPromptHistory = function (section) {
    const sectionNames = { title: 'Title', description: 'Description', tags: 'Tags', attributes: 'Attributes' };
    const modal = document.getElementById('prompt-history-modal');
    const title = document.getElementById('prompt-history-modal-title');
    const list = document.getElementById('prompt-history-list');
    title.textContent = sectionNames[section] + ' Prompt History';

    const history = getPromptHistory(section);
    if (history.length === 0) {
      list.innerHTML = '<div class="prompt-history-empty">No saved prompts yet.<br>Your custom prompts will appear here after saving.</div>';
    } else {
      list.innerHTML = history.map((item, i) => {
        const date = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `<div class="prompt-history-item" onclick="usePromptHistory('${section}', ${i})">
          <div class="prompt-history-item-text">${escapeHtml(item.text)}</div>
          <div class="prompt-history-item-date">${date}</div>
          <button class="prompt-history-item-use" onclick="event.stopPropagation();usePromptHistory('${section}', ${i})">Use</button>
        </div>`;
      }).join('');
    }
    modal.classList.remove('hidden');
  };

  window.closePromptHistory = function () {
    document.getElementById('prompt-history-modal').classList.add('hidden');
  };

  window.usePromptHistory = function (section, index) {
    const history = getPromptHistory(section);
    if (!history[index]) return;
    const textarea = document.getElementById('prompt-' + section);
    textarea.value = history[index].text;
    // Switch to custom mode
    const segmented = document.querySelector(`.ps-seg[data-target="${section}"]`);
    segmented.querySelectorAll('.ps-seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === 'custom');
    });
    document.getElementById('body-' + section).classList.remove('hidden');
    const status = document.getElementById('status-' + section);
    status.textContent = 'Custom';
    status.className = 'ps-item-badge ps-badge-custom';
    closePromptHistory();
    textarea.focus();
  };

  // ========== 工具 ==========
  function showLoading(show) {
    el.loading.classList.toggle('hidden', !show);
    if (show) el.resultSection.classList.add('hidden');
  }

  el.backBtn.addEventListener('click', () => {
    el.resultSection.classList.add('hidden');
    if (el.modeCsv.classList.contains('active')) switchMode('csv');
    else if (el.modeHistory.classList.contains('active')) switchMode('history');
    else if (el.modePrompts.classList.contains('active')) switchMode('prompts');
    else switchMode('manual');
  });

  // ========== 初始化 ==========
  updateLandingNav();
  const initUser = getUser();
  if (initUser) {
    showPage('dashboard');
  } else {
    showPage('landing');
  }
});
