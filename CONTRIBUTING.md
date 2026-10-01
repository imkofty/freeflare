# Contributing to FreeFlare

Thanks for wanting to help! A few ground rules:

## How to contribute

1. Fork the repo and create a branch from `main`.
2. Keep it zero-dependency and 100% free-tier. If your change needs a paid
   Cloudflare plan, an API key, or `npm install`, it doesn't belong here —
   open an issue first to discuss.
3. Match the existing code style: vanilla JS, no build step, comments in English.
4. Test before you PR:
   - `node --check src/worker.js && node --check public/app.js`
   - `bash -n deploy.sh`
   - `wrangler deploy --dry-run` (optional, needs wrangler)
5. Update docs if behavior changes — both `README.md` (English) and
   `README.id.md` (Indonesian) when user-facing text is involved.

## What we're looking for

- New free Workers AI models in the fallback list
- Better abuse protection that stays free-tier
- UI polish (mobile-first, no heavy frameworks)
- More languages for the README (copy the flag-picker pattern at the top)

## What we won't merge

- Anything requiring payment, API keys, or signup beyond a Cloudflare account
- Minified/vendored third-party code without a clear reason
- Changes that break the one-command `./deploy.sh` flow

## License

By contributing, you agree your work is released under the MIT License.
