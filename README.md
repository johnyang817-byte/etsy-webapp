# Etsy 文案助手 (Web App)

一个基于 DashScope AI 的 Etsy SEO 文案生成工具，支持 CSV 批量生成和手动输入。

## ✨ 功能
- 📤 上传 CSV 文件批量生成
- ✏️ 手动输入单产品信息
- 📱 响应式设计，手机/电脑均可使用
- 🚀 一键复制标题、描述、标签
- 🔒 API Key 安全存储（Vercel 环境变量）

## 🚀 快速开始

### 1. 部署到 Vercel
1. Fork 本仓库到你的 GitHub
2. 登录 [Vercel](https://vercel.com/) 并导入仓库
3. 在 Vercel 项目设置 → Environment Variables 中添加：
   - `DASHSCOPE_API_KEY` = 你的 DashScope API Key
   - `DASHSCOPE_MODEL` = qwen-35-plus (或其他模型)
4. 点击 Deploy，等待部署完成

### 2. 使用
- 访问 Vercel 提供的 `.vercel.app` 链接
- 选择“CSV 批量生成”或“手动输入”
- 点击生成，等待 AI 创作
- 复制结果到 Etsy 后台

### 3. CSV 格式
```csv
id,product_name,keywords,material,size,color,occasion
1,Lucky Knot Bracelet,bohemian jewelry gift for her,leather,adjustable,brown,birthday
2,Personalized Leather Wallet,men's gift engraved,cowhide,4x3 inches,brown,anniversary
🔐 安全说明
API Key 存储在 Vercel 环境变量中，不会暴露给前端
所有 API 调用由 Vercel 云函数中转
建议使用单独的 DashScope API Key（非主账号）
📝 自定义
修改提示词：编辑 api/generate.js 中的 prompt 变量
修改样式：编辑 public/style.css
修改模型：在 Vercel 环境变量中更改 DASHSCOPE_MODEL
⚠️ 注意事项
Vercel 免费额度：每月 100GB 流量、1000 次函数调用，个人使用足够
如果生成速度慢，可能是 DashScope 限流，请检查阿里云控制台
CSV 文件必须为 UTF-8 编码
📄 许可证
MIT
# Trigger deploy Sun Mar 22 14:26:02 CST 2026
# Deploy trigger 1774166579
# Force redeploy 1774168483
