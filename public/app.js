// public/app.js - 修复版，监听表单提交
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
  
    // 元素引用 - 根据实际 HTML ID
    const modeCsvBtn = document.getElementById('mode-csv');
    const modeManualBtn = document.getElementById('mode-manual');
    const csvSection = document.getElementById('csv-section');
    const manualSection = document.getElementById('manual-section');
    const csvInput = document.getElementById('csv-input');
    const generateAllBtn = document.getElementById('generate-all');
    const manualForm = document.getElementById('manual-form');
    const productCountSpan = document.getElementById('product-count');
    const loadingDiv = document.getElementById('loading');
    const resultSection = document.getElementById('result-section');
    const resultContent = document.getElementById('result-content');
    const backBtn = document.getElementById('back-btn');
    const dropZone = document.getElementById('drop-zone');

    // 检查元素是否存在
    if (!modeCsvBtn || !modeManualBtn || !csvSection || !manualSection) {
        console.error('Missing required DOM elements');
        return;
    }

    console.log('All elements found, setting up event listeners...');

    // 切换模式
    modeCsvBtn.addEventListener('click', () => {
        modeCsvBtn.classList.add('active');
        modeManualBtn.classList.remove('active');
        csvSection.style.display = 'block';
        manualSection.style.display = 'none';
        resultSection.classList.add('hidden');
        clearResults();
    });

    modeManualBtn.addEventListener('click', () => {
        modeManualBtn.classList.add('active');
        modeCsvBtn.classList.remove('active');
        manualSection.style.display = 'block';
        csvSection.style.display = 'none';
        resultSection.classList.add('hidden');
        clearResults();
    });

    // 收集手动输入的产品数据
    function collectProductData() {
        const productName = document.getElementById('manual-name');
        const keywords = document.getElementById('manual-keywords');
        const material = document.getElementById('manual-material');
        const size = document.getElementById('manual-size');
        const color = document.getElementById('manual-color');
        const occasion = document.getElementById('manual-occasion');
      
        if (!productName || !keywords || !material || !size || !color || !occasion) {
            console.error('Missing form elements');
            return null;
        }
      
        return {
            product_name: productName.value.trim(),
            keywords: keywords.value.trim(),
            material: material.value.trim(),
            size: size.value.trim(),
            color: color.value.trim(),
            occasion: occasion.value.trim()
        };
    }

    // 生成单个产品文案
    async function generateForProduct(product) {
        console.log('Generating for product:', product);
      
        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product })
            });
          
            if (!response.ok) {
                const errorText = await response.text();
                console.error("HTTP error:", response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }
          
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "生成失败");
            }
            return { product, text: data.text };
        } catch (error) {
            console.error("生成错误:", error);
            return { product, error: error.message };
        }
    }

    // 显示结果
    function displayResult(result) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
      
        if (result.error) {
            resultItem.innerHTML = `
                <div style="font-weight: bold; color: #e53e3e; margin-bottom: 8px;">${result.product.product_name}</div>
                <div style="color: #718096;">错误: ${result.error}</div>
            `;
        } else {
            const lines = result.text.split('\n');
            let title = '', description = '', tags = '';
            lines.forEach(line => {
                if (line.startsWith('标题：')) title = line.substring(3);
                else if (line.startsWith('描述：')) description = line.substring(3);
                else if (line.startsWith('标签：')) tags = line.substring(3);
            });
          
            resultItem.innerHTML = `
                <div style="font-weight: bold; color: #2d3748; margin-bottom: 12px; font-size: 1.1em;">${result.product.product_name}</div>
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
            `;
        }
      
        resultContent.appendChild(resultItem);
    }

    function clearResults() {
        resultContent.innerHTML = '';
    }

    // 复制文本功能
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
            // 降级方案：选中文本
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });
    };

    // 手动表单提交 - 监听表单的 submit 事件
    if (manualForm) {
        manualForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // 阻止表单默认提交
            const product = collectProductData();
            if (!product.product_name) {
                alert('请填写产品名称');
                return;
            }
          
            loadingDiv.classList.remove('hidden');
            clearResults();
            resultSection.classList.remove('hidden');
            csvSection.style.display = 'none';
            manualSection.style.display = 'none';
          
            const result = await generateForProduct(product);
            displayResult(result);
          
            loadingDiv.classList.add('hidden');
        });
    } else {
        console.error('Manual form not found');
    }

    // CSV 文件处理 - 拖拽上传
    if (dropZone && csvInput) {
        // 点击上传
        dropZone.addEventListener('click', () => csvInput.click());
      
        // 文件选择变化
        csvInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
          
            handleCsvFile(file);
        });

        // 拖拽上传
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#3182ce';
            dropZone.style.backgroundColor = '#ebf8ff';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#cbd5e0';
            dropZone.style.backgroundColor = '';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#cbd5e0';
            dropZone.style.backgroundColor = '';
          
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'text/csv') {
                handleCsvFile(file);
            } else {
                alert('请上传 CSV 文件');
            }
        });
    }

    // 处理 CSV 文件
    async function handleCsvFile(file) {
        loadingDiv.classList.remove('hidden');
        document.getElementById('file-name').textContent = file.name;
      
        Papa.parse(file, {
            complete: async function(results) {
                console.log('CSV parsed, data:', results.data);
              
                // 映射 CSV 列到产品对象 - 支持多种列名格式
                const products = results.data.map(row => ({
                    product_name: (row['product_name'] || row['Product Name'] || row['产品名称'] || row['product_name_en'] || '').trim(),
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
                })).filter(p => p.product_name); // 过滤掉没有产品名称的行
              
                console.log('Parsed products:', products);
              
                if (products.length === 0) {
                    alert('CSV 中没有有效的产品数据，请检查列名是否正确');
                    loadingDiv.classList.add('hidden');
                    return;
                }
              
                productCountSpan.textContent = products.length;
                resultSection.classList.remove('hidden');
                csvSection.style.display = 'none';
                manualSection.style.display = 'none';
                document.getElementById('generate-section').classList.remove('hidden');
              
                // 保存产品列表供后续生成使用
                window.csvProducts = products;
                loadingDiv.classList.add('hidden');
            },
            error: function(err) {
                console.error('CSV 解析错误:', err);
                alert('CSV 文件解析失败，请检查格式');
                loadingDiv.classList.add('hidden');
            }
        });
    }

    // CSV 批量生成
    if (generateAllBtn) {
        generateAllBtn.addEventListener('click', async () => {
            const products = window.csvProducts;
            if (!products || products.length === 0) {
                alert('没有可生成的产品');
                return;
            }
          
            loadingDiv.classList.remove('hidden');
            document.getElementById('generate-section').classList.add('hidden');
            clearResults();
          
            for (let i = 0; i < products.length; i++) {
                const product = products[i];
                const result = await generateForProduct(product);
                displayResult(result);
                // 避免请求过快，每生成一个暂停 1 秒
                if (i < products.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
          
            loadingDiv.classList.add('hidden');
        });
    }

    // 返回按钮
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            resultSection.classList.add('hidden');
            if (window.csvProducts && window.csvProducts.length > 0) {
                csvSection.style.display = 'none';
                document.getElementById('generate-section').classList.remove('hidden');
            } else {
                csvSection.style.display = 'block';
                manualSection.style.display = 'none';
                modeCsvBtn.classList.add('active');
                modeManualBtn.classList.remove('active');
            }
        });
    }

    // 初始化
    clearResults();
    console.log('App initialized successfully');
});