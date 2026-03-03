// 全局状态
let currentMode = "csv";
let csvProducts = [];
let currentResult = null;

// DOM 元素
const modeCsvBtn = document.getElementById("mode-csv");
const modeManualBtn = document.getElementById("mode-manual");
const csvSection = document.getElementById("csv-section");
const manualSection = document.getElementById("manual-section");
const generateSection = document.getElementById("generate-section");
const dropZone = document.getElementById("drop-zone");
const csvInput = document.getElementById("csv-input");
const csvPreview = document.getElementById("csv-preview");
const productList = document.getElementById("product-list");
const productCount = document.getElementById("product-count");
const manualForm = document.getElementById("manual-form");
const loading = document.getElementById("loading");
const resultSection = document.getElementById("result-section");
const resultContent = document.getElementById("result-content");
const backBtn = document.getElementById("back-btn");
const generateAllBtn = document.getElementById("generate-all");

// 模式切换
modeCsvBtn.addEventListener("click", () => switchMode("csv"));
modeManualBtn.addEventListener("click", () => switchMode("manual"));

function switchMode(mode) {
    currentMode = mode;
    modeCsvBtn.classList.toggle("active", mode === "csv");
    modeManualBtn.classList.toggle("active", mode === "manual");
    csvSection.classList.toggle("hidden", mode !== "csv");
    manualSection.classList.toggle("hidden", mode !== "manual");
    generateSection.classList.toggle("hidden", mode !== "csv");
}

// CSV 上传处理
dropZone.addEventListener("click", () => csvInput.click());
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.background = "#e0e7ff";
});
dropZone.addEventListener("dragleave", () => {
    dropZone.style.background = "#f8f9ff";
});
dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.background = "#f8f9ff";
    if (e.dataTransfer.files.length) {
        handleCsvFile(e.dataTransfer.files[0]);
    }
});
csvInput.addEventListener("change", (e) => {
    if (e.target.files.length) {
        handleCsvFile(e.target.files[0]);
    }
});

function handleCsvFile(file) {
    if (!file.name.endsWith(".csv")) {
        alert("请上传 CSV 文件");
        return;
    }
    document.getElementById("file-name").textContent = file.name;
    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            csvProducts = results.data;
            renderProductList();
            csvPreview.classList.remove("hidden");
            generateSection.classList.remove("hidden");
            productCount.textContent = csvProducts.length;
        },
        error: function(err) {
            alert("CSV 解析失败: " + err.message);
        }
    });
}

function renderProductList() {
    productList.innerHTML = "";
    csvProducts.forEach((product, index) => {
        const div = document.createElement("div");
        div.className = "product-item";
        div.innerHTML = `<i class="fas fa-check-circle"></i> ${product.product_name || "未命名产品"}`;
        productList.appendChild(div);
    });
}

// 手动表单提交
manualForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const product = {
        id: "manual_" + Date.now(),
        product_name: document.getElementById("manual-name").value.trim(),
        keywords: document.getElementById("manual-keywords").value.trim(),
        material: document.getElementById("manual-material").value.trim() || "See photos",
        size: document.getElementById("manual-size").value.trim() || "See photos",
        color: document.getElementById("manual-color").value.trim(),
        occasion: document.getElementById("manual-occasion").value.trim()
    };
    await generateForProduct(product);
});

// 生成全部
generateAllBtn.addEventListener("click", async () => {
    if (csvProducts.length === 0) {
        alert("没有可生成的产品");
        return;
    }
    loading.classList.remove("hidden");
    try {
        const results = [];
        for (let i = 0; i < csvProducts.length; i++) {
            const product = csvProducts[i];
            const result = await generateForProduct(product);
            results.push(result);
            console.log(`已生成 ${i+1}/${csvProducts.length}`);
        }
        showResults(results);
    } catch (error) {
        alert("生成失败: " + error.message);
    } finally {
        loading.classList.add("hidden");
    }
});

// 调用后端 API
async function generateForProduct(product) {
    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "生成失败");
        }
        return { product, text: data.text };
    } catch (error) {
        console.error("生成错误:", error);
        return { product, error: error.message };
    }
}

// 显示结果
function showResults(results) {
    resultContent.innerHTML = "";
    results.forEach((item, index) => {
        if (item.error) {
            const errorDiv = document.createElement("div");
            errorDiv.className = "result-block";
            errorDiv.innerHTML = `
                <h3><i class="fas fa-exclamation-triangle"></i> 失败：${item.product.product_name}</h3>
                <p style="color: #e53e3e;">${item.error}</p>
            `;
            resultContent.appendChild(errorDiv);
            return;
        }
        const resultBlock = document.createElement("div");
        resultBlock.className = "result-block";
        resultBlock.innerHTML = parseResultText(item.text, index);
        resultContent.appendChild(resultBlock);
    });
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth" });
}

// 解析 AI 返回的文本
function parseResultText(text, index) {
    const lines = text.split("\n");
    let title = "", description = "", tags = "";
    let currentSection = null;
  
    lines.forEach(line => {
        if (line.startsWith("标题：") || line.startsWith("标题:")) {
            currentSection = "title";
            title = line.replace(/^[：:]\s*/, "").trim();
        } else if (line.startsWith("描述：") || line.startsWith("描述:")) {
            currentSection = "description";
            description = line.replace(/^[：:]\s*/, "").trim();
        } else if (line.startsWith("标签：") || line.startsWith("标签:")) {
            currentSection = "tags";
            tags = line.replace(/^[：:]\s*/, "").trim();
        } else if (currentSection && line.trim()) {
            if (currentSection === "title") title += " " + line.trim();
            else if (currentSection === "description") description += "\n" + line.trim();
            else if (currentSection === "tags") tags += " " + line.trim();
        }
    });

    if (!title && !description && !tags) {
        return `<h3>原始输出</h3><pre style="white-space: pre-wrap; font-size: 0.85rem;">${text}</pre>`;
    }

    const tagArray = tags.split(/[,，\s]+/).filter(t => t);
    const tagsHtml = tagArray.map(t => `<span class="tag">#${t}</span>`).join("");

    return `
        <h3>产品 ${index + 1}</h3>
        <div style="margin-bottom: 10px;">
            <strong>标题选项：</strong>
            <div style="margin-top: 5px;">
                <div style="background: white; padding: 8px; border-radius: 4px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${title}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${title.replace(/'/g, "\\'")}')">复制</button>
                </div>
            </div>
        </div>
        <div style="margin-bottom: 10px;">
            <strong>描述：</strong>
            <div style="background: white; padding: 8px; border-radius: 4px; margin-top: 5px; position: relative;">
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${description}</pre>
                <button class="copy-btn" onclick="copyToClipboard('${description.replace(/'/g, "\\'")}')">复制</button>
            </div>
        </div>
        <div>
            <strong>标签：</strong>
            <div class="tags-container" style="margin-top: 5px;">
                ${tagsHtml}
            </div>
            <button class="copy-btn" style="margin-top: 5px;" onclick="copyToClipboard('${tagArray.map(t => "#" + t).join(" ")}')">复制全部标签</button>
        </div>
    `;
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("已复制到剪贴板！");
    }).catch(err => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        alert("已复制到剪贴板！");
    });
}

// 返回按钮
backBtn.addEventListener("click", () => {
    resultSection.classList.add("hidden");
    if (currentMode === "csv") {
        csvPreview.classList.remove("hidden");
        generateSection.classList.remove("hidden");
    }
});

// 初始化
switchMode("csv");
