// cf-free-chat worker — 100% free chatbot on Cloudflare Workers AI.
// No API keys needed: inference via the env.AI binding.
// Abuse protection: Cache API burst limiter + D1 daily ledger (optional) +
// global circuit breaker + optional Turnstile (graceful degrade when unset).

const MODELS = [
  { id: "@cf/meta/llama-3.1-8b-instruct-fp8-fast", label: "Llama 3.1 8B", hint: "seimbang", msgsPerDay: "~800" },
  { id: "@cf/meta/llama-3.2-3b-instruct", label: "Llama 3.2 3B", hint: "paling cepat", msgsPerDay: "~870" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Qwen3 30B", hint: "penalaran", msgsPerDay: "~870" },
  { id: "@cf/zai-org/glm-4.7-flash", label: "GLM 4.7 Flash", hint: "multibahasa", msgsPerDay: "~730" },
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", hint: "kualitas", msgsPerDay: "~300" },
  { id: "@cf/openai/gpt-oss-20b", label: "GPT-OSS 20B", hint: "agentic", msgsPerDay: "~400" },
  { id: "@cf/ibm-granite/granite-4.0-h-micro", label: "Granite 4 Micro", hint: "paling hemat", msgsPerDay: "~2600" },
];
// Fallback order when the requested model errors out.
const FALLBACK = [
  "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/meta/llama-3.2-3b-instruct",
  "@cf/ibm-granite/granite-4.0-h-micro",
];

const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const dayKey = () => new Date().toISOString().slice(0, 10); // UTC day

async function sha256Hex(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const clientIp = (req) =>
  req.headers.get("CF-Connecting-IP") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

// ---- stateless HMAC session (24h, IP-bound) after one Turnstile pass ----
async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const b64url = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

async function mintSession(env, ip) {
  const exp = Date.now() + 24 * 3600 * 1000;
  const secret = env.TURNSTILE_SECRET || env.SESSION_SECRET || "cf-free-chat-dev";
  const sig = await hmacSign(secret, `${ip}.${exp}`);
  return b64url(`${exp}.${sig}`);
}
async function validSession(env, token, ip) {
  try {
    const [exp, sig] = unb64url(token).split(".");
    if (Date.now() > parseInt(exp, 10)) return false;
    const secret = env.TURNSTILE_SECRET || env.SESSION_SECRET || "cf-free-chat-dev";
    return timingEq(sig, await hmacSign(secret, `${ip}.${exp}`));
  } catch { return false; }
}
function timingEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function verifyTurnstile(env, token, ip) {
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  const j = await r.json().catch(() => ({}));
  return j.success === true;
}

// ---- quotas ----
// Burst: Cache API, best-effort, zero quota cost.
async function burstOk(ipHash, limit) {
  try {
    const cache = caches.default;
    const key = new Request(`https://quota.local/burst/${ipHash}`);
    const hit = await cache.match(key);
    let count = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    count++;
    await cache.put(key, new Response(String(count), {
      headers: { "Cache-Control": "max-age=60" },
    }));
    return count <= limit;
  } catch { return true; } // fail open on cache errors
}
// Daily ledger: D1 when bound, else in-memory estimate (resets on isolate restart).
const memLedger = new Map();
async function dailyUse(env, ipHash) {
  const day = dayKey();
  if (env.DB) {
    const row = await env.DB.prepare(
      "SELECT count FROM quota_daily WHERE day=? AND ip_hash=?").bind(day, ipHash).first();
    const g = await env.DB.prepare("SELECT count FROM quota_global WHERE day=?").bind(day).first();
    return { ip: row?.count || 0, global: g?.count || 0 };
  }
  const m = memLedger.get(day) || { ips: new Map(), global: 0 };
  return { ip: m.ips.get(ipHash) || 0, global: m.global, lite: true };
}
async function dailyBump(env, ipHash) {
  const day = dayKey();
  if (env.DB) {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO quota_daily(day,ip_hash,count) VALUES(?,?,1)
        ON CONFLICT(day,ip_hash) DO UPDATE SET count=count+1`).bind(day, ipHash),
      env.DB.prepare(`INSERT INTO quota_global(day,count) VALUES(?,1)
        ON CONFLICT(day) DO UPDATE SET count=count+1`).bind(day),
    ]);
  } else {
    let m = memLedger.get(day);
    if (!m) { m = { ips: new Map(), global: 0 }; memLedger.set(day, m); }
    m.ips.set(ipHash, (m.ips.get(ipHash) || 0) + 1);
    m.global++;
  }
}

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
const quotaMsg = (lang) => lang === "id"
  ? "Kuota harian tercapai. Coba lagi besok ya — kuota reset tiap 00:00 UTC."
  : "Daily quota reached. Please try again after 00:00 UTC when it resets.";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ---- public config for the frontend ----
    if (path === "/api/config" && req.method === "GET") {
      return json({
        appName: env.APP_NAME || "GratisChat",
        models: MODELS,
        defaultModel: env.DEFAULT_MODEL || MODELS[0].id,
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
        maxTokens: num(env.MAX_TOKENS, 600),
      });
    }

    // ---- usage meter (clearly an estimate) ----
    if (path === "/api/usage" && req.method === "GET") {
      const ipHash = await sha256Hex(clientIp(req) + ":usage");
      const u = await dailyUse(env, ipHash);
      return json({
        estimate: true,
        note: "Angka ini estimasi dari server ini, bukan angka resmi Cloudflare.",
        globalUsed: u.global,
        globalCap: num(env.GLOBAL_DAILY_CAP, 700),
        ipUsed: u.ip,
        ipCap: num(env.DAILY_PER_IP, 60),
        resetsAt: dayKey() + "T24:00:00Z",
        quotaLite: !!u.lite,
      });
    }

    // ---- chat ----
    if (path === "/api/chat" && req.method === "POST") {
      const lang = (req.headers.get("accept-language") || "").startsWith("id") ? "id" : "en";
      const ip = clientIp(req);
      const ipHash = await sha256Hex(ip + ":chat");

      let body;
      try {
        const raw = await req.text();
        if (raw.length > 64 * 1024) return json({ error: "body too large" }, 413);
        body = JSON.parse(raw);
      } catch { return json({ error: "invalid JSON" }, 400); }

      // Turnstile gate (only when configured)
      let sessionToken = null;
      if (env.TURNSTILE_SECRET) {
        const okSession = body.sessionToken && await validSession(env, body.sessionToken, ip);
        if (!okSession) {
          if (!body.turnstileToken) return json({ needTurnstile: true }, 402);
          if (!await verifyTurnstile(env, body.turnstileToken, ip))
            return json({ error: "turnstile failed" }, 403);
          sessionToken = await mintSession(env, ip);
        } else {
          sessionToken = body.sessionToken;
        }
      }

      // Quotas (checked before any neuron spend)
      if (!await burstOk(ipHash, num(env.BURST_PER_MINUTE, 12)))
        return json({ error: quotaMsg(lang) }, 429);
      const use = await dailyUse(env, ipHash);
      if (use.global >= num(env.GLOBAL_DAILY_CAP, 700) || use.ip >= num(env.DAILY_PER_IP, 60))
        return json({ error: quotaMsg(lang) }, 429);

      // Input caps
      const maxTurns = num(env.MAX_TURNS, 20);
      const maxChars = num(env.MAX_MSG_CHARS, 4000);
      let messages = Array.isArray(body.messages) ? body.messages.slice(-maxTurns) : [];
      messages = messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, maxChars) }));
      if (!messages.length || messages[messages.length - 1].role !== "user")
        return json({ error: "need at least one user message" }, 400);
      messages.unshift({ role: "system", content: env.SYSTEM_PROMPT || "You are a helpful assistant." });

      const want = MODELS.some((m) => m.id === body.model) ? body.model : (env.DEFAULT_MODEL || MODELS[0].id);
      const chain = [want, ...FALLBACK.filter((m) => m !== want)];
      const maxTokens = Math.min(num(body.maxTokens, num(env.MAX_TOKENS, 600)), 1000);

      let upstream = null, servedBy = null, lastErr = "";
      for (const model of chain) {
        try {
          upstream = await env.AI.run(model, { messages, stream: true, max_tokens: maxTokens });
          servedBy = model;
          break;
        } catch (e) { lastErr = String(e?.message || e).slice(0, 200); }
      }
      if (!upstream) return json({ error: `all models failed: ${lastErr}` }, 502);

      await dailyBump(env, ipHash); // count only on successful inference start

      const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Served-By": servedBy,
      };
      if (sessionToken && sessionToken !== body.sessionToken)
        headers["X-Session-Token"] = sessionToken;
      return new Response(upstream, { headers });
    }

    // ---- static assets ----
    return env.ASSETS.fetch(req);
  },
};
