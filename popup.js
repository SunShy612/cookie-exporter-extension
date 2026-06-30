"use strict";

// DOM 元素
const originEl = document.getElementById("origin");
const countEl = document.getElementById("count");
const outputEl = document.getElementById("cookie-output");
const copyBtn = document.getElementById("copy-btn");
const refreshBtn = document.getElementById("refresh-btn");
const statusEl = document.getElementById("status");

// 受限页面（无法读取 cookie 的内部页面）协议前缀
const RESTRICTED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
  "view-source:",
  "data:",
];

function setStatus(text, isError) {
  statusEl.textContent = text || "";
  statusEl.classList.toggle("error", Boolean(isError));
}

// 把 cookie 数组拼成 "name=value; name2=value2" 格式
function buildCookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

// 获取当前激活标签页
function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tabs && tabs[0]);
    });
  });
}

// 去掉 cookie domain 的前导点，便于精确比较（".example.com" -> "example.com"）
function bareDomain(domain) {
  return (domain || "").replace(/^\./, "");
}

// 生成 hostname 的域名链：a.b.example.com -> ["a.b.example.com", "b.example.com", "example.com"]
// 对应「浏览器向当前页发送 cookie」的域规则：cookie domain 等于 host 或为 host 的父域
function buildDomainChain(hostname) {
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const parts = hostname.split(".");
  if (isIp || parts.length < 2) return [hostname];
  const chain = [];
  for (let i = 0; i <= parts.length - 2; i++) {
    chain.push(parts.slice(i).join("."));
  }
  return chain;
}

// chrome.cookies.getAll 的 Promise 封装；单次查询出错不中断整体流程（返回空数组）
function getAllByFilter(filter) {
  return new Promise((resolve) => {
    try {
      chrome.cookies.getAll(filter, (cookies) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        resolve(cookies || []);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

// 去重 key：同名 cookie 可能存在于不同 domain/path/分区，需全部纳入
function cookieKey(c) {
  const pk = c.partitionKey ? JSON.stringify(c.partitionKey) : "";
  return `${c.name}|${bareDomain(c.domain)}|${c.path}|${pk}`;
}

// 获取当前页面可用的全部 cookie（含 HttpOnly、各级父域、所有 path、分区 cookie）
async function getCookies(url) {
  let hostname;
  let origin;
  try {
    const u = new URL(url);
    hostname = u.hostname;
    origin = u.origin;
  } catch (_) {
    // URL 解析失败时回退到最朴素的查询
    return getAllByFilter({ url });
  }

  const chain = buildDomainChain(hostname);
  // 只保留恰好设在域名链各级上的 cookie，避免把兄弟子域 / 整个 TLD 的 cookie 误拉进来
  const allowed = new Set(chain);
  const map = new Map();

  for (const domain of chain) {
    // 1) 普通（未分区）cookie：按 domain 查，覆盖该域下所有 path
    const normal = await getAllByFilter({ domain });
    // 2) 分区 cookie（CHIPS / Partitioned）：best-effort，以当前站点作为 topLevelSite
    //    老版本 Chrome 不支持 partitionKey 参数时会被 getAllByFilter 容错为空数组
    const partitioned = await getAllByFilter({
      domain,
      partitionKey: { topLevelSite: origin },
    });

    for (const c of normal.concat(partitioned)) {
      if (!allowed.has(bareDomain(c.domain))) continue;
      const key = cookieKey(c);
      if (!map.has(key)) map.set(key, c);
    }
  }

  return [...map.values()];
}

function isRestricted(url) {
  return RESTRICTED_PREFIXES.some((p) => url.startsWith(p));
}

async function loadCookies() {
  // 重置 UI
  copyBtn.disabled = true;
  copyBtn.classList.remove("copied");
  copyBtn.textContent = "复制到剪贴板";
  outputEl.value = "";
  countEl.textContent = "";
  setStatus("");

  let tab;
  try {
    tab = await getActiveTab();
  } catch (err) {
    originEl.textContent = "—";
    setStatus(`无法获取当前标签页：${err.message}`, true);
    return;
  }

  if (!tab || !tab.url) {
    originEl.textContent = "—";
    setStatus("无法识别当前页面地址。", true);
    return;
  }

  if (isRestricted(tab.url)) {
    originEl.textContent = "—";
    outputEl.placeholder = "";
    setStatus("当前是浏览器内部页面，无法读取 Cookie，请切换到普通网页后重试。", true);
    return;
  }

  let host = tab.url;
  try {
    host = new URL(tab.url).host;
  } catch (_) {
    /* 保底用原始 url 展示 */
  }
  originEl.textContent = host;
  originEl.title = tab.url;

  let cookies;
  try {
    cookies = await getCookies(tab.url);
  } catch (err) {
    setStatus(`读取 Cookie 失败：${err.message}`, true);
    return;
  }

  if (cookies.length === 0) {
    countEl.textContent = "0 条";
    setStatus("当前页面没有可读取的 Cookie。");
    return;
  }

  const header = buildCookieHeader(cookies);
  outputEl.value = header;
  countEl.textContent = `${cookies.length} 条`;
  copyBtn.disabled = false;
  setStatus("已读取，可点击下方按钮复制。");
}

// 复制：优先 clipboard API，失败回退 execCommand
async function copyToClipboard() {
  const text = outputEl.value;
  if (!text) return;

  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (_) {
    // 回退方案
    outputEl.removeAttribute("readonly");
    outputEl.select();
    try {
      ok = document.execCommand("copy");
    } catch (_) {
      ok = false;
    }
    outputEl.setAttribute("readonly", "");
    window.getSelection().removeAllRanges();
  }

  if (ok) {
    copyBtn.classList.add("copied");
    copyBtn.textContent = "已复制 ✓";
    setStatus("Cookie 已复制到剪贴板。");
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.textContent = "复制到剪贴板";
    }, 1500);
  } else {
    setStatus("复制失败，请手动选中文本复制。", true);
  }
}

copyBtn.addEventListener("click", copyToClipboard);
refreshBtn.addEventListener("click", loadCookies);
document.addEventListener("DOMContentLoaded", loadCookies);
