// 站点配置 —— 仅保存仓库元信息。
//
// PAT 不再硬编码：用户点击「开始构建」时弹窗输入，仅保存在本次浏览器会话
// （sessionStorage），不会写入源码、不会持久化。每次构建都会使用该次输入的 PAT。
//
// 安全建议：请使用「仅限 MrGfs/Kwrt 仓库、含 contents + workflows」的细粒度 PAT。
// 若担心泄露，可改用 Cloudflare Pages Function 代理（见 app.js 顶部 PROXY 开关），
// 由后端代发带 token 的请求。
const SITE_CONFIG = {
  OWNER: "MrGfs",
  REPO: "Kwrt",
  API: "https://api.github.com"
};
