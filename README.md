# Claude PDF 账单分析器

这是一个极简的 React + Vite 前端项目，支持 PDF 上传并调用 Claude API 进行账单分析。适合部署到 Netlify。

## 功能
- 支持 PDF 文件上传（多页账单）
- 用户输入 Claude API Key
- 前端调用 Claude API，显示分析结果
- 结构简单，易于维护

## 使用方法
1. 克隆本仓库到本地，或 Fork 后推送到你的 GitHub。
2. 在 Netlify 选择本仓库一键部署。
3. 部署后，网页会提示输入 Claude API Key。
4. 上传 PDF 文件，等待 Claude 分析结果。

## Claude API Key
- 本项目不会保存你的 API Key，只在本地浏览器使用。
- 请在网页界面手动输入你的 Claude API Key。

## 本地开发
```bash
npm install
npm run dev
```

## 部署到 Netlify
- 直接在 Netlify 选择本仓库即可自动部署。 