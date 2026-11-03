// 自定义固件构建前端逻辑
// 数据流：选设备+勾包+SSH key → 点击「开始构建」→ 弹窗输入 PAT →
//        POST /dispatches 触发 Openwrt-AutoBuild.yml → 轮询 actions/runs →
//        完成后从 releases 取下载链接
const { OWNER, REPO, API } = SITE_CONFIG;

// CORS 说明：GitHub REST API（api.github.com）支持浏览器跨域，直连可用。
// 若你的站点域名被拦截，把 PROXY 设为你的反代/Cloudflare Function 地址，
// 由它代发带 token 的请求（前端仍直连，但 token 可只发往你自己的代理）。
const PROXY = ""; // 例如 "https://kwrt-api.example.com"

// PAT 在用户点击「开始构建」时弹窗输入，仅保存在本次会话（sessionStorage），不写入源码。
let sessionPAT = sessionStorage.getItem("kwrt_pat") || "";

function updatePatState() {
  const el = document.getElementById("patState");
  if (!el) return;
  el.textContent = sessionPAT ? "PAT：本次已填入 ✓" : "PAT：未填入（构建时需输入）";
  el.classList.toggle("ok", !!sessionPAT);
}

const BASE_HEADERS = () => ({
  Authorization: `Bearer ${sessionPAT}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json"
});

async function api(path, opts = {}) {
  const url = PROXY ? `${PROXY}${path}` : `${API}${path}`;
  const headers = PROXY ? { "Content-Type": "application/json" } : BASE_HEADERS();
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${txt.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// 兼容两种包定义：字符串 或 {pkg, desc, default, locked}
function pkgName(p) { return typeof p === "string" ? p : p.pkg; }
function pkgDesc(p) { return (typeof p === "string") ? "" : (p.desc || ""); }
function pkgDefault(p) { return (typeof p === "string") ? false : !!p.default; }
function pkgLocked(p) { return (typeof p === "string") ? false : !!p.locked; }

let DEVICES = [], GROUPS = [], selectedTarget = null;

async function init() {
  document.getElementById("repoLink").href = `https://github.com/${OWNER}/${REPO}`;
  updatePatState();
  const data = await fetch("devices.json").then((r) => r.json());
  DEVICES = data.devices;
  GROUPS = data.groups;
  renderDevices();
}

function renderDevices() {
  const sel = document.getElementById("device");
  sel.innerHTML = "";
  DEVICES.forEach((d) => {
    const o = document.createElement("option");
    o.value = d.target;
    o.textContent = d.name;
    sel.appendChild(o);
  });
  sel.addEventListener("change", onDeviceChange);
  onDeviceChange();
}

function onDeviceChange() {
  selectedTarget = document.getElementById("device").value;
  const d = DEVICES.find((x) => x.target === selectedTarget);
  document.getElementById("deviceHint").textContent = d && d.qmodem_default
    ? "该设备默认勾选 QModem（可取消）。"
    : "该设备非蜂窝机型，QModem 包仍可选，但不一定适用。";
  renderGroups();
}

function renderGroups() {
  const wrap = document.getElementById("packageGroups");
  wrap.innerHTML = "";
  const d = DEVICES.find((x) => x.target === selectedTarget);
  GROUPS.forEach((g) => {
    const open = g.id === "qmodem" || g.id === "system";
    const card = document.createElement("div");
    card.className = "group";

    const head = document.createElement("div");
    head.className = "group-head";
    head.innerHTML = `<div><div class="title">${g.title}</div><div class="desc">${g.desc}</div></div><span>${open ? "▾" : "▸"}</span>`;

    const body = document.createElement("div");
    body.className = "group-body" + (open ? "" : " collapsed");

    g.packages.forEach((p) => {
      const name = pkgName(p);
      const desc = pkgDesc(p);
      const locked = pkgLocked(p);
      const def = (g.id === "qmodem")
        ? !!(d && d.qmodem_default)
        : pkgDefault(p);

      const label = document.createElement("label");
      label.className = "pkg" + (locked ? " locked" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = name;
      cb.checked = def;
      cb.disabled = locked; // 锁定项不可取消
      if (locked) cb.dataset.locked = "1";

      const code = document.createElement("code");
      code.textContent = name;

      label.appendChild(cb);
      label.appendChild(code);
      if (locked) {
        const lock = document.createElement("span");
        lock.className = "lock-icon";
        lock.textContent = "🔒";
        label.appendChild(lock);
      }
      if (desc) {
        const sub = document.createElement("span");
        sub.className = "pkg-desc";
        sub.textContent = desc;
        label.appendChild(sub);
      }
      body.appendChild(label);
    });

    head.onclick = () => body.classList.toggle("collapsed");
    card.appendChild(head);
    card.appendChild(body);
    wrap.appendChild(card);
  });
}

function collectPackages() {
  const pkgs = [];
  // 锁定项始终包含；普通项取勾选
  document.querySelectorAll("#packageGroups input[type=checkbox]").forEach((cb) => {
    if (cb.checked || cb.disabled) pkgs.push(cb.value);
  });
  return pkgs;
}

// ---- PAT 弹窗 ----
function openPatModal(onConfirm) {
  const modal = document.getElementById("patModal");
  const input = document.getElementById("patInput");
  const err = document.getElementById("patError");
  modal.classList.remove("hidden");
  input.value = sessionPAT || "";
  err.textContent = "";
  input.focus();
  const confirm = () => {
    const v = input.value.trim();
    if (!v) { err.textContent = "请输入 PAT 才能触发构建。"; return; }
    sessionPAT = v;
    sessionStorage.setItem("kwrt_pat", v);
    updatePatState();
    modal.classList.add("hidden");
    onConfirm();
  };
  const cancel = () => modal.classList.add("hidden");
  document.getElementById("patConfirm").onclick = confirm;
  document.getElementById("patCancel").onclick = cancel;
  input.onkeydown = (e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(); };
}

async function startBuild() {
  if (!sessionPAT) {
    openPatModal(() => doStartBuild());
    return;
  }
  doStartBuild();
}

async function doStartBuild() {
  const target = document.getElementById("device").value;
  const packages = collectPackages();
  const sshkey = document.getElementById("sshkey").value.trim();
  const btn = document.getElementById("buildBtn");
  btn.disabled = true;
  setStatus(`提交构建请求…（target=${target}，包数量=${packages.length}）`);
  try {
    await api(`/repos/${OWNER}/${REPO}/dispatches`, {
      method: "POST",
      body: JSON.stringify({
        event_type: `${target} build`,
        client_payload: { target, packages: packages.join(" "), sshkey }
      })
    });
    setStatus("已提交 dispatch，等待 Actions 拉起构建…");
    pollRun(target);
  } catch (e) {
    setStatus("提交失败：" + e.message);
    btn.disabled = false;
  }
}

let pollTimer = null;
function pollRun(target) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const runs = await api(`/repos/${OWNER}/${REPO}/actions/runs?event=repository_dispatch&per_page=20`);
      const list = runs.workflow_runs || [];
      const run = list.find((r) => r.name === `Build ${target}`) || list[0];
      if (!run) {
        setStatus("等待 Actions run 出现…（如长时间无反应，请到仓库 Actions 页查看是否被并发限制）");
        return;
      }
      updateStatus(run);
      if (run.status === "completed") {
        clearInterval(pollTimer);
        if (run.conclusion === "success") {
          loadRelease(target);
        } else {
          setStatus(`构建${run.conclusion}。`);
          document.getElementById("buildBtn").disabled = false;
        }
      }
    } catch (e) {
      setStatus("轮询出错：" + e.message);
    }
  }, 8000);
}

async function loadRelease(target) {
  setStatus("构建成功，拉取 Release 下载链接…");
  try {
    const rels = await api(`/repos/${OWNER}/${REPO}/releases?per_page=8`);
    const list = (rels || []).filter((r) => !r.draft && !r.prerelease);
    const found = list.find((r) => r.tag_name && r.tag_name.includes(target)) || list[0];
    if (!found) {
      setStatus("构建成功，但未找到对应 Release（可能 Release 尚未生成，请稍后到仓库查看）。");
      document.getElementById("buildBtn").disabled = false;
      return;
    }
    renderDownload(found, found.assets || []);
  } catch (e) {
    setStatus("获取 Release 失败：" + e.message);
  }
  document.getElementById("buildBtn").disabled = false;
}

function updateStatus(run) {
  const body = document.getElementById("statusBody");
  document.getElementById("statusCard").classList.remove("hidden");
  body.innerHTML = `
    <div class="status-row"><span>运行状态</span><span class="badge ${run.status}">${run.status}</span></div>
    <div class="status-row"><span>结论</span><span>${run.conclusion || "—"}</span></div>
    <div class="status-row"><span>Workflow 日志</span><a href="${run.html_url}" target="_blank" rel="noopener" style="color:var(--accent)">查看 ↗</a></div>
    <div class="status-row"><span>更新时间</span><span>${new Date(run.updated_at).toLocaleString()}</span></div>`;
}

function renderDownload(rel, assets) {
  const body = document.getElementById("statusBody");
  const items = assets
    .map(
      (a) => `
    <div class="dl-item">
      <a href="${a.browser_download_url}" target="_blank" rel="noopener">${a.name}</a>
      <span class="dl-size">${(a.size / 1048576).toFixed(1)} MB</span>
    </div>`
    )
    .join("");
  body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="status-row" style="margin-top:10px"><span>Release</span><a href="${rel.html_url}" target="_blank" rel="noopener" style="color:var(--accent)">${rel.tag_name} ↗</a></div>
    <div class="dl-list">${items || '<div class="hint">该 Release 暂无资产</div>'}</div>`
  );
}

function setStatus(msg) {
  document.getElementById("statusCard").classList.remove("hidden");
  document.getElementById("statusBody").innerHTML = `<div class="status-row"><span>状态</span><span>${msg}</span></div>`;
}

document.getElementById("buildBtn").addEventListener("click", startBuild);
init().catch((e) => {
  document.getElementById("deviceHint").textContent = "加载失败：" + e.message;
});
