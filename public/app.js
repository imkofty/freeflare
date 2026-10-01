// GratisChat frontend — vanilla JS, no build, no deps (except optional Turnstile).
"use strict";

const I18N = {
  id: {
    newChat: "Chat baru", placeholder: "Tulis pesan…", you: "Kamu", ai: "AI",
    empty: "Mau tanya apa hari ini?", emptySub: "Gratis, tanpa API key, tanpa kartu kredit.",
    quota: "kuota harian", estNote: "estimasi, bukan angka resmi Cloudflare",
    copied: "disalin!", copy: "salin", send: "kirim", needTs: "Verifikasi dulu ya.",
    errNet: "Koneksi gagal. Coba lagi.", errQuota: "Kuota harian tercapai.",
    today: "Hari ini", yesterday: "Kemarin",
  },
  en: {
    newChat: "New chat", placeholder: "Type a message…", you: "You", ai: "AI",
    empty: "What do you want to ask today?", emptySub: "Free, no API key, no credit card.",
    quota: "daily quota", estNote: "estimate, not official Cloudflare numbers",
    copied: "copied!", copy: "copy", send: "send", needTs: "Please verify first.",
    errNet: "Connection failed. Try again.", errQuota: "Daily quota reached.",
    today: "Today", yesterday: "Yesterday",
  },
};

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let lang = localStorage.getItem("gc-lang") || ((navigator.language || "").startsWith("id") ? "id" : "en");
let CFG = null, sessionToken = localStorage.getItem("gc-session") || null;
let convs = JSON.parse(localStorage.getItem("gc-convs") || "[]");
let curId = localStorage.getItem("gc-cur") || null;
let sending = false;

const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

// ---------- minimal markdown ----------
function md(src) {
  const blocks = [];
  // code fences first
  src = src.replace(/```(\w*)\n([\s\S]*?)(```|$)/g, (_, l, code) => {
    blocks.push(`<div class="codeblock"><button class="copybtn" onclick="copyCode(this)">${t("copy")}</button><pre><code>${esc(code.replace(/\n$/, ""))}</code></pre></div>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const html = src.split(/\n{2,}/).map((para) => {
    if (/^\u0000\d+\u0000$/.test(para.trim())) return para.trim();
    const lines = para.split("\n");
    if (lines.every((l) => /^\s*[-*] /.test(l)))
      return "<ul>" + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ""))}</li>`).join("") + "</ul>";
    if (lines.every((l) => /^\s*\d+[.)] /.test(l)))
      return "<ol>" + lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)] /, ""))}</li>`).join("") + "</ol>";
    if (/^#{1,3} /.test(lines[0]))
      return `<h3>${inline(lines[0].replace(/^#{1,3} /, ""))}</h3>`;
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  }).join("\n");
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i] || "");
}
window.copyCode = (btn) => {
  const code = btn.parentElement.querySelector("code").innerText;
  navigator.clipboard.writeText(code).then(() => {
    const o = btn.textContent; btn.textContent = t("copied");
    setTimeout(() => (btn.textContent = o), 1200);
  });
};

// ---------- conversations ----------
const cur = () => convs.find((c) => c.id === curId);
function save() {
  localStorage.setItem("gc-convs", JSON.stringify(convs.slice(0, 50)));
  localStorage.setItem("gc-cur", curId || "");
}
function newChat() {
  const c = { id: "c" + Date.now().toString(36), title: t("newChat"), ts: Date.now(), msgs: [] };
  convs.unshift(c); curId = c.id; save(); renderConvs(); renderMsgs();
  if (innerWidth <= 760) $("sidebar").classList.remove("open");
}
function renderConvs() {
  const el = $("convList"); el.innerHTML = "";
  for (const c of convs) {
    const d = document.createElement("div");
    d.className = "conv" + (c.id === curId ? " active" : "");
    const date = new Date(c.ts);
    const day = date.toDateString() === new Date().toDateString() ? t("today")
      : date.toDateString() === new Date(Date.now() - 864e5).toDateString() ? t("yesterday")
      : date.toLocaleDateString();
    d.innerHTML = `${esc(c.title)}<small>${day}</small>`;
    d.onclick = () => { curId = c.id; save(); renderConvs(); renderMsgs(); $("sidebar").classList.remove("open"); };
    el.appendChild(d);
  }
}
function addMsg(role, content) {
  let c = cur(); if (!c) { newChat(); c = cur(); }
  c.msgs.push({ role, content });
  if (c.msgs.length === 1 && role === "user")
    c.title = content.slice(0, 42) + (content.length > 42 ? "…" : "");
  save(); renderConvs();
  return c;
}

// ---------- messages UI ----------
function renderMsgs() {
  const box = $("messages"); box.innerHTML = "";
  const c = cur();
  if (!c || !c.msgs.length) {
    box.innerHTML = `<div class="empty"><h2>${t("empty")}</h2><p>${t("emptySub")}</p></div>`;
    return;
  }
  for (const m of c.msgs) box.appendChild(msgEl(m.role, m.content));
  box.scrollTop = box.scrollHeight;
}
function msgEl(role, content) {
  const d = document.createElement("div");
  d.className = "msg " + role;
  d.innerHTML = `<div class="who">${role === "user" ? t("you") : t("ai")}</div><div class="bubble">${role === "user" ? esc(content).replace(/\n/g, "<br>") : md(content)}</div>`;
  return d;
}
function applyLang() {
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.documentElement.lang = lang;
  renderConvs(); renderMsgs(); refreshUsage();
}

// ---------- turnstile ----------
function ensureTurnstile() {
  if (!CFG.turnstileSiteKey || window._tsReady) return;
  window._tsReady = true;
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  s.async = true;
  s.onload = () => window.turnstile.render("#turnstileBox", {
    sitekey: CFG.turnstileSiteKey, theme: "dark", size: "compact",
    callback: () => {},
  });
  document.head.appendChild(s);
}

// ---------- usage meter ----------
async function refreshUsage() {
  try {
    const r = await fetch("/api/usage");
    const u = await r.json();
    const pct = Math.min(100, (u.globalUsed / u.globalCap) * 100);
    $("usageFill").style.width = pct + "%";
    $("usageFill").style.background = pct > 85 ? "var(--danger)" : pct > 60 ? "#e0a63f" : "var(--ok)";
    $("usageText").textContent = `${t("quota")}: ${u.globalUsed}/${u.globalCap} (${t("estNote")})`;
    $("usageMeter").title = t("estNote");
  } catch { /* abaikan */ }
}

// ---------- chat ----------
function setSending(v) {
  sending = v; $("sendBtn").disabled = v; $("input").disabled = v;
}
async function send(e) {
  e.preventDefault();
  const text = $("input").value.trim();
  if (!text || sending) return;
  setSending(true); $("input").value = ""; autosize();
  const c = addMsg("user", text); renderMsgs();

  const aiEl = msgEl("assistant", "");
  aiEl.querySelector(".bubble").classList.add("typing");
  $("messages").appendChild(aiEl);
  $("messages").scrollTop = $("messages").scrollHeight;

  let tsToken = null;
  if (CFG.turnstileSiteKey && !sessionToken) {
    try { tsToken = window.turnstile.getResponse(); } catch {}
    if (!tsToken) {
      aiEl.querySelector(".bubble").classList.remove("typing");
      aiEl.querySelector(".bubble").textContent = t("needTs");
      setSending(false); return;
    }
  }
  const payload = {
    messages: c.msgs.map((m) => ({ role: m.role, content: m.content })),
    model: $("modelPicker").value,
    sessionToken, turnstileToken: tsToken,
  };
  let full = "", ok = false;
  try {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const newSession = r.headers.get("X-Session-Token");
    if (newSession) { sessionToken = newSession; localStorage.setItem("gc-session", newSession); }
    const servedBy = r.headers.get("X-Served-By");
    if (servedBy) $("servedBy").textContent = "via " + servedBy.split("/").pop();
    if (r.status === 402) throw new Error(t("needTs"));
    if (r.status === 429) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || t("errQuota"));
    }
    if (!r.ok || !r.body) throw new Error(t("errNet"));
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const delta = j.response || j.choices?.[0]?.delta?.content || "";
          if (delta) {
            full += delta;
            const b = aiEl.querySelector(".bubble");
            b.classList.remove("typing");
            b.innerHTML = md(full);
            $("messages").scrollTop = $("messages").scrollHeight;
          }
        } catch {}
      }
      ok = true;
    }
  } catch (err) {
    aiEl.querySelector(".bubble").classList.remove("typing");
    aiEl.querySelector(".bubble").textContent = err.message || t("errNet");
  }
  if (ok && full.trim()) {
    c.msgs.push({ role: "assistant", content: full });
    save();
    const b = aiEl.querySelector(".bubble");
    b.innerHTML = md(full);
    try { window.turnstile.reset(); } catch {}
  }
  refreshUsage();
  setSending(false);
  $("input").focus();
}

function autosize() {
  const el = $("input");
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

// ---------- export ----------
function exportMd() {
  const c = cur(); if (!c || !c.msgs.length) return;
  let out = `# ${c.title}\n\n_${new Date(c.ts).toLocaleString()} · ${$("modelPicker").selectedOptions[0]?.text || ""}_\n\n`;
  for (const m of c.msgs)
    out += m.role === "user" ? `## 🙋 ${t("you")}\n\n${m.content}\n\n` : `## 🤖 ${t("ai")}\n\n${m.content}\n\n`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "text/markdown" }));
  a.download = "chat-" + c.id + ".md"; a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- init ----------
async function init() {
  const r = await fetch("/api/config");
  CFG = await r.json();
  document.title = CFG.appName + " — AI gratis, tanpa API key";
  $("modelPicker").innerHTML = CFG.models.map((m) =>
    `<option value="${m.id}"${m.id === CFG.defaultModel ? " selected" : ""}>${m.label} · ${m.hint}</option>`).join("");
  ensureTurnstile(); applyLang(); refreshUsage();
  setInterval(refreshUsage, 60000);
  if (!cur()) newChat(); else { renderConvs(); renderMsgs(); }
}
$("composer").addEventListener("submit", send);
$("input").addEventListener("input", autosize);
$("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); }
});
$("newChat").onclick = newChat;
$("exportBtn").onclick = exportMd;
$("langToggle").onclick = () => {
  lang = lang === "id" ? "en" : "id";
  localStorage.setItem("gc-lang", lang); applyLang();
};
$("openSide").onclick = () => $("sidebar").classList.add("open");
$("closeSide").onclick = () => $("sidebar").classList.remove("open");
init();
