// public/app.js - 修复版，同时监听按钮点击和表单提交
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== App Starting ===');
  
    // 元素引用
    const elements = {
        manualForm: document.getElementById('manual-form'),
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
        manualSection: document.getElementById('manual-section')
    };
  
    console.log('=== Elements Check ===');
    Object.entries(elements).forEach(([key, el]) => {
        console.log(`${key}:`, el ? '✅ Found' : '❌ Missing');
    });
  
    if (!elements.manualForm) {
        console.error('❌ CRITICAL: manual-form element not found!');
        return;
    }
  
    // 查找提交按钮
    const submitButtons = elements.manualForm.querySelectorAll('button[type="submit"]');
    console.log('🔘 Found submit buttons:', submitButtons.length);
    submitButtons.forEach((btn, idx) => {
        console.log(`  Button ${idx}:`, btn);
    });
  
    // 方案：同时监听按钮点击和表单提交
    submitButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log('🔘 SUBMIT BUTTON CLICKED!');
            console.log('Button type:', e.target.type);
            console.log('Form will submit:', elements.manualForm.checkValidity());
        });
    });
  
    // 监听表单提交
    elements.manualForm.addEventListener('submit', async (e) => {
        console.log('🔥 FORM SUBMIT EVENT TRIGGERED!');
        e.preventDefault();
        console.log('🔧 Form submission prevented');
      
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
    });
  
    function displayResult(result) {
        console.log('🎯 displayResult called with:', result);
        if (!elements.resultContent) {
            console.error('❌ resultContent element not found');
            return;
        }
      
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
      
        if (elements.resultSection) {
            elements.resultSection.classList.remove('hidden');
            elements.resultSection.style.display = 'block';
            console.log('✅ Result section shown');
        }
      
        if (elements.csvSection) elements.csvSection.style.display = 'none';
        if (elements.manualSection) elements.manualSection.style.display = 'none';
    }
  
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
  
    console.log('=== App Initialized Successfully ===');
    console.log('💡 请手动填写表单并点击"生成文案"按钮，然后查看控制台日志');
});