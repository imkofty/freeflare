# Security Policy

## Supported versions

FreeFlare is a rolling-release side project. Only the latest `main` is supported.

## Reporting a vulnerability

Open a **private** report via GitHub Security Advisories on this repo
(`Security` tab → `Report a vulnerability`). Please include:

- What you did, step by step
- What you expected vs what happened
- The Worker URL or commit hash, if relevant

We aim to acknowledge within 72 hours. Please don't open a public issue for
security problems.

## Scope notes

- The usage meter (`/api/usage`) is explicitly an **estimate**, not a security boundary.
- Rate limits and quotas are abuse *mitigation*, not bulletproof protection —
  a determined attacker with many IPs can still burn your free Workers AI
  neurons. For a public deployment under attack, put Cloudflare Turnstile in
  front (see README) and monitor usage in your Cloudflare dashboard.
- Never commit API tokens or account IDs. `deploy.sh` reads them from the
  environment or hidden prompts and never writes them to disk.
