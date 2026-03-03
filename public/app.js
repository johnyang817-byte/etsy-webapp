// public/app.js - 完整稳定版
document.addEventListener('DOMContentLoaded', function() {
    // 元素引用
    const manualTab = document.getElementById('manual-tab');
    const csvTab = document.getElementById('csv-tab');
    const manualForm = document.getElementById('manual-form');
    const csvUploadArea = document.getElementById('csv-upload-area');
    const csvFileInput = document.getElementById('csv-file');
    const generateAllBtn = document.getElementById('generate-all');
    const generateSingleBtn = document.getElementById('generate-single');
    const resultsContainer = document.getElementById('results');
    const resultsList = document.getElementById('results-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');
    const downloadTemplateBtn = document.getElementById('download-template');

    // 切换标签
    manualTab.addEventListener('click', () => {
        manualTab.classList.add('active');
        csvTab.classList.remove('active');
        manualForm.style.display = 'block';
        csvUploadArea.style.display = 'none';
        clearResults();
    });

    csvTab.addEventListener('click', () => {
        csvTab.classList.add('active');
        manualTab.classList.remove('active');
        csvUploadArea.style.display = 'block';
        manualForm.style.display = 'none';
        clearResults();
    });

    // 下载模板
    downloadTemplateBtn.addEventListener('click', () => {
        window.location.href = '/etsy_products_template.csv';
    });

    // 收集手动输入的产品数据
    function collectProductData() {
        return {
            product_name: document.getElementById('productName').value.trim(),
            keywords: document.getElementById('keywords').value.trim(),
            material: document.getElementById('material').value.trim(),
            size: document.getElementById('size').value.trim(),
            color: document.getElementById('color').value.trim(),
            occasion: document.getElementById('occasion').value.trim()
        };
    }

    // 生成单个产品文案
    async function generateForProduct(product) {
        console.log('Generating for product:', product); // 调试日志
      
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
      
        if (result.error) {
            resultItem.innerHTML = `
                <div class="result-product">${result.product.product_name}</div>
                <div class="result-error">错误: ${result.error}</div>
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
                <div class="result-product">${result.product.product_name}</div>
                <div class="result-section">
                    <strong>标题：</strong>
                    <span class="copyable" data-text="${title}">${title}</span>
                </div>
                <div class="result-section">
                    <strong>描述：</strong>
                    <span class="copyable" data-text="${description}">${description}</span>
                </div>
                <div class="result-section">
                    <strong>标签：</strong>
                    <span class="copyable" data-text="${tags}">${tags}</span>
                </div>
            `;
          
            // 添加复制功能
            resultItem.querySelectorAll('.copyable').forEach(el => {
                el.addEventListener('click', () => {
                    navigator.clipboard.writeText(el.dataset.text).then(() => {
                        const original = el.textContent;
                        el.textContent = '已复制！';
                        setTimeout(() => el.textContent = original, 1500);
                    });
                });
            });
        }
      
        resultsList.appendChild(resultItem);
    }

    function clearResults() {
        resultsList.innerHTML = '';
    }

    // 手动生成
    generateSingleBtn.addEventListener('click', async () => {
        const product = collectProductData();
        if (!product.product_name) {
            alert('请填写产品名称');
            return;
        }
      
        loadingSpinner.style.display = 'block';
        loadingText.textContent = '正在生成...';
        clearResults();
      
        const result = await generateForProduct(product);
        displayResult(result);
      
        loadingSpinner.style.display = 'none';
    });

    // CSV 文件处理
    csvFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
      
        loadingSpinner.style.display = 'block';
        loadingText.textContent = '正在解析 CSV...';
      
        Papa.parse(file, {
            complete: async function(results) {
                const products = results.data.map(row => ({
    // 优先使用 product_name_en（英文产品名），如果没有则用 product_name（可能也是英文），再没有用 product_name_cn（中文）
    product_name: row['product_name_en'] || row['product_name'] || row['Product Name'] || row['产品名称'] || '',
    // keywords 可以从多个字段合并：technique, target_audience, usage_scene
    keywords: [
        row['technique'], 
        row['target_audience'], 
        row['usage_scene']
    ].filter(Boolean).join(', '),
    material: row['material'] || row['Material'] || row['材质'] || '',
    size: row['size'] || row['Size'] || row['尺寸'] || '',
    color: row['color'] || row['Color'] || row['颜色'] || '',
    // occasion 对应 usage_scene 或 适用场景
    occasion: row['usage_scene'] || row['Occasion'] || row['适用场景'] || row['使用场景'] || ''
})).filter(p => p.product_name); // 过滤掉没有产品名称的行
              
                loadingText.textContent = `共 ${products.length} 个产品，正在生成...`;
                resultsList.innerHTML = '';
              
                for (const product of products) {
                    const result = await generateForProduct(product);
                    displayResult(result);
                    // 避免请求过快
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
              
                loadingSpinner.style.display = 'none';
            },
            error: function(err) {
                console.error('CSV 解析错误:', err);
                alert('CSV 文件解析失败，请检查格式');
                loadingSpinner.style.display = 'none';
            }
        });
    });

    // 初始化
    clearResults();
});