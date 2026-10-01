# GratisChat — 100% free AI chatbot on Cloudflare

🇬🇧 **English** · [🇮🇩 Indonesia](README.id.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F68204?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue)]
![Workers AI](https://img.shields.io/badge/AI-Workers_AI-8A2BE2)

A ChatGPT-style web app that runs **entirely on Cloudflare's free tier**.
No AI API key. No credit card. One command to deploy.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/USERNAME/cf-free-chat)

> Replace `USERNAME` with your GitHub username after forking.

## Deploy (pick one)

**Option A — one-command script (recommended, full D1 quotas):**
```bash
./deploy.sh
```
Two modes, chosen interactively at runtime:
- **Laptop (has a browser):** OAuth login via browser — **no API token,
  no account ID needed.**
- **VPS/headless:** `export CLOUDFLARE_API_TOKEN=xxxx && ./deploy.sh`
  (account ID auto-detected when the token covers exactly one account).

The script creates a D1 database for daily quotas, then deploys. Done.

**Option B — the Deploy button above:** click → log in → pick an account → done.
No D1 (runs in quota-lite mode: burst limiter only), but zero manual steps.

## Features

- **Multi-model picker + automatic fallback** — 7 free Workers AI models
  (Llama 3.1 8B, Llama 3.2 3B, Qwen3 30B, GLM 4.7 Flash, Llama 4 Scout,
  GPT-OSS 20B, Granite 4 Micro). If the primary model fails, it switches
  by itself.
- **SSE streaming** — answers flow token by token.
- **Markdown + code blocks + copy button**, mobile-first dark UI.
- **Bilingual EN/ID** — toggle in the sidebar, auto-detects browser language.
- **History in localStorage** — no login, no user database.
- **One-click Markdown export** of any chat.
- **Per-deployment system prompt** — change `SYSTEM_PROMPT` in
  `wrangler.toml`, no code touched (e.g. shop assistant, tutor, …).
- **Layered anti-abuse**: burst limiter (Cache API, free) + daily per-IP
  quota + global circuit breaker (D1) + optional Turnstile.
- **Honest usage meter** — a clearly-labelled estimate, not official
  Cloudflare numbers. See [docs/LIMITS.md](docs/LIMITS.md).

## Configuration (wrangler.toml)

| Var | Default | Meaning |
|---|---|---|
| `SYSTEM_PROMPT` | helpful assistant | Bot personality |
| `DEFAULT_MODEL` | Llama 3.1 8B | Starting model |
| `MAX_TOKENS` | 600 | Max answer length |
| `MAX_TURNS` | 20 | History turns sent to the model |
| `DAILY_PER_IP` | 60 | Messages/day per IP |
| `GLOBAL_DAILY_CAP` | 700 | Messages/day across the deployment |
| `TURNSTILE_SITE_KEY` | — | Optional, see below |

**Turnstile** (optional): create a widget in the Cloudflare dashboard
(Turnstile → Add site), set `TURNSTILE_SITE_KEY`, then
`wrangler secret put TURNSTILE_SECRET`. Without it the app still runs
in quota-only mode. The challenge appears at most once per 24h
(HMAC session, IP-bound) — normal users almost never see a captcha.

## Structure

```
src/worker.js      API + quotas + fallback + Turnstile
public/            vanilla UI (no build step)
schema.sql         D1 quota tables
deploy.sh          one-click deploy
docs/LIMITS.md     honest limits & capacity docs
```

## Limits you should know

- 10,000 neurons/day/account → ~800 messages/day on the default model.
  Details: [docs/LIMITS.md](docs/LIMITS.md).
- Each deployment uses **its own** account quota — this template rides on
  nobody's quota.
- You are responsible for your own deployment's usage
  (read Cloudflare's Acceptable Use).

## License

MIT.
