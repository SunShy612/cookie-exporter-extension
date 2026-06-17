# 🍪 Cookie 导出器（Cookie Exporter）

一个极简的 Chrome / Edge 浏览器扩展：在你登录某个网站后，点一下插件图标，就能看到并**一键复制当前页面的全部 Cookie**（包括 `document.cookie` 读不到的 **HttpOnly 登录凭证**），方便用于接口调试、`curl`、Postman 等场景。

> **数据安全**：所有读取与展示都在你本地浏览器中完成，**不会上传到任何服务器**。

---

## ✨ 功能特性

- 点击图标即时读取**当前标签页**对应域名下的全部 Cookie
- 通过 `chrome.cookies` API 读取，能拿到 **HttpOnly** 的 Cookie（登录态通常就是 HttpOnly）
- 输出标准的 `name=value; name2=value2` Cookie 请求头格式，可直接粘到 `curl -H "Cookie: ..."`
- 一键复制到剪贴板，并在弹窗中完整显示内容
- 顶部显示来源域名与 Cookie 条数，支持「刷新」重新读取
- 纯原生 JS，零第三方依赖，体积极小

---

## 📦 安装方法（开发者模式加载）

本扩展未上架商店，需以「加载已解压的扩展程序」方式安装：

### Chrome

1. 下载本仓库（`Code → Download ZIP` 后解压，或 `git clone`）
2. 打开浏览器，地址栏输入 `chrome://extensions` 回车
3. 打开右上角的 **开发者模式** 开关
4. 点击 **加载已解压的扩展程序**，选择本项目文件夹（包含 `manifest.json` 的那一级目录）
5. 安装完成后，建议在地址栏右侧的扩展图标里把「Cookie 导出器」**固定**到工具栏

### Edge

1. 地址栏输入 `edge://extensions` 回车
2. 打开左下角 **开发人员模式**
3. 点击 **加载解压缩的扩展**，选择本项目文件夹
4. 完成

---

## 🚀 使用方法

1. 在浏览器里正常**登录**你的目标网站
2. 停留在该网站的页面上，点击工具栏的 🍪 **Cookie 导出器** 图标
3. 弹窗会自动显示当前页面的全部 Cookie（`name=value; ...` 格式）
4. 点击 **复制到剪贴板**，即可粘贴使用
5. 如果切换了页面或刚登录，点右上角 **↻** 重新读取

---

## 🔐 权限说明

| 权限 | 用途 |
|------|------|
| `cookies` | 读取 Cookie（含 HttpOnly）的核心权限 |
| `activeTab` | 点击图标时临时获取当前激活标签页的 URL，以确定要读取哪个域名的 Cookie |
| `host_permissions: <all_urls>` | `chrome.cookies.getAll` 需要对目标站点有 host 权限，才能返回该域名的 Cookie；声明 `<all_urls>` 是为了能在任意你访问的网站上工作 |

本扩展**没有**任何后台联网代码，不收集、不上传、不存储你的数据。所有逻辑都在 `popup.js` 中，可自行审阅。

---

## ⚠️ 安全提示

Cookie（尤其是登录态）等同于你的**登录凭证**，拿到它就可能冒用你的身份。请注意：

- 复制出来的内容不要随意发给他人、贴到公开聊天/截图里
- 用完及时清理剪贴板和临时文件
- 仅在你信任的调试环境中使用

---

## ❓ FAQ

**Q：为什么它能看到 HttpOnly 的 Cookie，而网页 JS 看不到？**
A：网页里的 `document.cookie` 被浏览器限制，读不到 HttpOnly Cookie。本扩展使用浏览器扩展专属的 `chrome.cookies` API，由浏览器授权读取，因此能拿到完整 Cookie。

**Q：点了图标提示「浏览器内部页面，无法读取」？**
A：`chrome://`、`edge://`、扩展页、`about:` 等内部页面不允许读取 Cookie，请切换到普通网页（http/https）后再试。

**Q：显示 0 条 Cookie？**
A：可能该页面确实没有设置 Cookie，或你尚未登录。先登录、刷新页面后再点 ↻ 重新读取。

**Q：复制按钮没反应？**
A：扩展已做了 `clipboard` API + `execCommand` 双重兜底；若仍失败，可直接在文本框里手动选中复制。

---

## 🛠 项目结构

```
cookie-exporter-extension/
├── manifest.json    # MV3 清单
├── popup.html       # 弹窗界面
├── popup.css        # 样式
├── popup.js         # 核心逻辑（读取 / 显示 / 复制）
├── icons/           # 16/48/128 图标
└── README.md
```

## 📄 License

[MIT](./LICENSE)
