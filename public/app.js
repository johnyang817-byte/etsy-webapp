// public/app.js - 最终修复版，全局点击监听
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== App Starting ===');
  
    // 元素引用
    const elements = {
        manualName: document.getElementById('manual-name'),
        manualKeywords: document.getElementById('manual-keywords'),
        manualMaterial: document.getElementById('manual-material'),
        manualSize: document.getElementById('manual-size'),
        manualColor: document.getElementById('manual-color'),
        manualOccasion: document.getElementById('manual-occasion'),
        loading: document.getElementById('loading'),
        resultSection: document.getElementById('result-section'),
        resultContent: document.getElementById('result-content'),
        modeCsv: document.getElementById('mode-csv'),
        modeManual: document.getElementById('mode-manual'),
        csvSection: document.getElementById('csv-section'),
        manualSection: document.getElementById('manual-section'),
        generateAllBtn: document.getElementById('generate-all'),
        backBtn: document.getElementById('back-btn'),
        dropZone: document.getElementById('drop-zone'),
        csvInput: document.getElementById('csv-input'),
        fileName: document.getElementById('file-name'),
        productCount: document.getElementById('product-count')
    };
  
    console.log('=== Elements Check ===');
    Object.entries(elements).forEach(([key, el]) => {
        console.log(`${key}:`, el ? '✅ Found' : '❌ Missing');
    });
  
    // 模式切换
    if (elements.modeCsv && elements.modeManual) {
        elements.modeCsv.addEventListener('click', () => switchMode('csv'));
        elements.modeManual.addEventListener('click', () => switchMode('manual'));
    }
  
    function switchMode(mode) {
        console.log(`🔄 Switching to ${mode} mode`);
        if (mode === 'csv') {
            elements.modeCsv.classList.add('active');
            elements.modeManual.classList.remove('active');
            elements.csvSection.style.display = 'block';
            elements.manualSection.style.display = 'none';
        } else {
            elements.modeManual.classList.add('active');
            elements.modeCsv.classList.remove('active');
            elements.manualSection.style.display = 'block';
            elements.csvSection.style.display = 'none';
        }
        elements.resultSection.classList.add('hidden');
        clearResults();
    }
  
    // ============== 关键：全局点击监听 ==============
    console.log('👀 Setting up global click listener...');
  
    // 监听所有点击事件
    document.addEventListener('click', async (e) => {
        // 检查点击目标是否是"生成文案"按钮
        const target = e.target;
        const isButton = target.tagName === 'BUTTON' && 
                         (target.textContent.includes('生成文案') || 
                          target.classList.contains('submit-btn') ||
                          target.closest('button[type="submit"]'));
      
        if (isButton) {
            console.log('🔥 GLOBAL CLICK CAPTURED! Target:', target);
            console.log('📍 Clicked at:', e.clientX, e.clientY);
          
            // 防止事件冒泡和默认行为
            e.preventDefault();
            e.stopPropagation();
          
            // 触发生成
            await handleManualGenerate();
        }
    }, true); // 使用捕获阶段，确保能捕获到事件
  
    // ============== 处理手动生成 ==============
    async function handleManualGenerate() {
        console.log('🚀 Starting manual generate...');
      
        // 收集数据
        const product = {
            product_name: elements.manualName ? elements.manualName.value.trim() : '',
            keywords: elements.manualKeywords ? elements.manualKeywords.value.trim() : '',
            material: elements.manualMaterial ? elements.manualMaterial.value.trim() : '',
            size: elements.manualSize ? elements.manualSize.value.trim() : '',
            color: elements.manualColor ? elements.manualColor.value.trim() : '',
            occasion: elements.manualOccasion ? elements.manualOccasion.value.trim() : ''
        };
      
        console.log('📦 Collected product data:', product);
      
        if (!product.product_name) {
            console.warn('⚠️ Product name is empty!');
            alert('请填写产品名称');
            return;
        }
      
        // 显示加载
        if (elements.loading) {
            console.log('⏳ Showing loading spinner');
            elements.loading.classList.remove('hidden');
        } else {
            console.error('❌ Loading element not found');
        }
      
        // 调用 API
        console.log('🚀 Calling API...');
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product })
            });
          
            console.log('📡 API response status:', response.status);
            const responseText = await response.text();
            console.log('📡 API response body (raw):', responseText.substring(0, 500));
          
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('❌ Failed to parse API response as JSON:', e);
                throw new Error('API返回的不是有效的JSON格式');
            }
          
            console.log('📡 API response data (parsed):', data);
          
            if (!response.ok || !data.success) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
          
            // 显示结果
            console.log('✅ API call successful, displaying result...');
            displayResult({ product, text: data.text });
          
        } catch (error) {
            console.error('❌ API call failed:', error);
            alert('生成失败: ' + error.message);
        } finally {
            if (elements.loading) {
                elements.loading.classList.add('hidden');
                console.log('✅ Hidden loading spinner');
            }
        }
    }
  
    // 显示结果
    function displayResult(result) {
        console.log('🎯 displayResult called with:', result);
      
        if (!elements.resultContent) {
            console.error('❌ resultContent element not found');
            return;
        }
      
        if (result.error) {
            elements.resultContent.innerHTML = `
                <div class="result-item error" style="background: #fff5f5; border: 1px solid #fc8181; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="color: #c53030; margin: 0 0 10px 0;">${result.product.product_name}</h4>
                    <p style="color: #c53030; margin: 0;">错误: ${result.error}</p>
                </div>
            `;
        } else {
            const lines = result.text.split('\n');
            let title = '', description = '', tags = '';
            lines.forEach(line => {
                if (line.startsWith('标题：')) title = line.substring(3);
                else if (line.startsWith('描述：')) description = line.substring(3);
                else if (line.startsWith('标签：')) tags = line.substring(3);
            });
          
            elements.resultContent.innerHTML = `
                <div class="result-item" style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="margin-top: 0; color: #2d3748;">${result.product.product_name}</h3>
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #4a5568;">标题：</strong>
                        <span class="copyable" data-text="${title}" style="cursor: pointer; color: #3182ce;" onclick="copyText(this)">${title}</span>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #4a5568;">描述：</strong>
                        <div class="copyable" data-text="${description}" style="cursor: pointer; color: #3182ce; margin-top: 4px; white-space: pre-wrap;" onclick="copyText(this)">${description}</div>
                    </div>
                    <div>
                        <strong style="color: #4a5568;">标签：</strong>
                        <span class="copyable" data-text="${tags}" style="cursor: pointer; color: #3182ce;" onclick="copyText(this)">${tags}</span>
                    </div>
                </div>
            `;
        }
      
        if (elements.resultSection) {
            elements.resultSection.classList.remove('hidden');
            elements.resultSection.style.display = 'block';
            console.log('✅ Result section shown');
        }
      
        if (elements.csvSection) elements.csvSection.style.display = 'none';
        if (elements.manualSection) elements.manualSection.style.display = 'none';
    }
  
    function clearResults() {
        if (elements.resultContent) elements.resultContent.innerHTML = '';
    }
  
    // 复制功能
    window.copyText = function(element) {
        const text = element.dataset.text;
        navigator.clipboard.writeText(text).then(() => {
            const original = element.textContent;
            element.textContent = '已复制！';
            element.style.color = '#48bb78';
            setTimeout(() => {
                element.textContent = original;
                element.style.color = '#3182ce';
            }, 1500);
        }).catch(err => {
            console.error('复制失败:', err);
        });
    };
  
    // ============== CSV 处理（原生解析）==============
    if (elements.dropZone && elements.csvInput) {
        elements.dropZone.addEventListener('click', () => elements.csvInput.click());
      
        elements.csvInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            handleCsvFile(file);
        });
  
        elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropZone.style.borderColor = '#3182ce';
            elements.dropZone.style.backgroundColor = '#ebf8ff';
        });
  
        elements.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            elements.dropZone.style.borderColor = '#cbd5e0';
            elements.dropZone.style.backgroundColor = '';
        });
  
        elements.dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            elements.dropZone.style.borderColor = '#cbd5e0';
            elements.dropZone.style.backgroundColor = '';
          
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'text/csv') {
                handleCsvFile(file);
            } else {
                alert('请上传 CSV 文件');
            }
        });
    }
  
    async function handleCsvFile(file) {
        if (!elements.loading || !elements.fileName || !elements.productCount || !elements.resultSection || !elements.csvSection || !elements.manualSection || !elements.generateAllBtn) {
            console.error('Missing required elements for CSV handling');
            return;
        }
      
        elements.loading.classList.remove('hidden');
        elements.fileName.textContent = file.name;
      
        try {
            const text = await file.text();
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // 移除 BOM
          
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length < 2) {
                alert('CSV 文件内容为空或格式不正确');
                elements.loading.classList.add('hidden');
                return;
            }
          
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            console.log('CSV headers:', headers);
          
            const products = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
              
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
              
                const product = {
                    product_name: (row['product_name_en'] || row['product_name'] || row['Product Name'] || row['产品名称'] || row['product_name_cn'] || '').trim(),
                    keywords: [
                        row['keywords'] || row['Keywords'] || row['关键词'],
                        row['technique'] || row['Technique'] || row['工艺'],
                        row['target_audience'] || row['Target Audience'] || row['目标客户'],
                        row['usage_scene'] || row['Usage Scene'] || row['使用场景']
                    ].filter(Boolean).join(', '),
                    material: (row['material'] || row['Material'] || row['材质'] || '').trim(),
                    size: (row['size'] || row['Size'] || row['尺寸'] || '').trim(),
                    color: (row['color'] || row['Color'] || row['颜色'] || '').trim(),
                    occasion: (row['occasion'] || row['Occasion'] || row['适用场景'] || row['usage_scene'] || '').trim()
                };
              
                if (product.product_name) {
                    products.push(product);
                }
            }
          
            console.log('Parsed products:', products);
          
            if (products.length === 0) {
                alert('CSV 中没有有效的产品数据，请检查列名是否正确');
                elements.loading.classList.add('hidden');
                return;
            }
          
            elements.productCount.textContent = products.length;
            elements.resultSection.classList.remove('hidden');
            elements.csvSection.style.display = 'none';
            elements.manualSection.style.display = 'none';
            elements.generateAllBtn.parentElement.classList.remove('hidden');
          
            window.csvProducts = products;
            elements.loading.classList.add('hidden');
          
        } catch (error) {
            console.error('CSV 解析错误:', error);
            alert('CSV 文件解析失败: ' + error.message);
            elements.loading.classList.add('hidden');
        }
    }
  
    // CSV 批量生成
    if (elements.generateAllBtn) {
        elements.generateAllBtn.addEventListener('click', async () => {
            const products = window.csvProducts;
            if (!products || products.length === 0) {
                alert('没有可生成的产品');
                return;
            }
          
            elements.loading.classList.remove('hidden');
            elements.generateAllBtn.parentElement.classList.add('hidden');
            elements.resultContent.innerHTML = '';
          
            for (let i = 0; i < products.length; i++) {
                const product = products[i];
                const result = await generateForProduct(product);
                displayResult(result);
                if (i < products.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
          
            elements.loading.classList.add('hidden');
        });
    }
  
    // 返回按钮
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', () => {
            elements.resultSection.classList.add('hidden');
            if (window.csvProducts && window.csvProducts.length > 0) {
                elements.csvSection.style.display = 'none';
                document.getElementById('generate-section').classList.remove('hidden');
            } else {
                elements.csvSection.style.display = 'block';
                elements.manualSection.style.display = 'none';
                switchMode('csv');
            }
        });
    }
  
    // 生成单个产品的函数
    async function generateForProduct(product) {
        console.log('Generating for:', product);
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product })
            });
          
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }
          
            const data = await response.json();
            if (!data.success) throw new Error(data.error || '生成失败');
            return { product, text: data.text };
        } catch (error) {
            console.error('Generate error:', error);
            return { product, error: error.message };
        }
    }
  
    function clearResults() {
        if (elements.resultContent) elements.resultContent.innerHTML = '';
    }
  
    console.log('=== App Initialized Successfully ===');
    console.log('👀 Global click listener is active. Click the "生成文案" button and check console for "🔥 GLOBAL CLICK CAPTURED!"');
});