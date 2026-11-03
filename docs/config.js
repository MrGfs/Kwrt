// 站点配置 —— 前端内置凭据（GitHub Pages + 内置 PAT 方案）
//
// 安全提示：此 PAT 会出现在公开的前端源码里，任何人可读取并用它触发你仓库的构建
// （消耗你的 Actions 分钟），且当前 token 拥有 MrGfs 账户的 repo+workflow 权限（范围较宽）。
// 生产环境建议：改用 Cloudflare Pages Function 代理（见 app.js 顶部 PROXY 开关），
// 或换一个「仅限 MrGfs/Kwrt 仓库、repo+workflow」的细粒度 token。
const SITE_CONFIG = {
  OWNER: "MrGfs",
  REPO: "Kwrt",
  // 内置 PAT（repo+workflow，仅限 MrGfs/Kwrt 本仓库）。
  // 部署前请把下面占位符替换为你自己的 PAT；推送时若 GitHub 弹出
  // "push declined due to secret" 提示，点它给的 unblock 链接允许即可。
  // 注意：此 token 会出现在公开前端源码里，任何人可读取并用它触发你仓库的构建。
  PAT: "PASTE_YOUR_PAT_HERE",
  API: "https://api.github.com"
};
