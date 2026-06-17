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

// 获取指定 URL 下的全部 cookie（含 HttpOnly）
function getCookies(url) {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({ url }, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(cookies || []);
    });
  });
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
