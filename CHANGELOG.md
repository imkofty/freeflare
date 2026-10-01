# Changelog

All notable changes to FreeFlare are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.0.0] — 2026-10-01

### Added
- ChatGPT-style web UI (mobile-first, dark), bilingual ID/EN with auto-detect
- 7 free Workers AI models with in-worker fallback chain
- Streaming responses (SSE), Markdown rendering, code copy button
- localStorage history, Markdown export, configurable system prompt
- `./deploy.sh` one-command deploy: laptop (OAuth) or VPS (API token) path
- Abuse protection: Cache API burst limiter + D1 daily quotas + global circuit breaker
- Optional Cloudflare Turnstile with 24h IP-bound HMAC session
- `/api/usage` estimate meter (clearly labeled, not official Cloudflare numbers)
- Bilingual docs: README + LIMITS in English and Indonesian
- Repo polish: banner, live badges, CONTRIBUTING / SECURITY / CHANGELOG

[Unreleased]: https://github.com/imkofty/freeflare/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/imkofty/freeflare/releases/tag/v1.0.0
