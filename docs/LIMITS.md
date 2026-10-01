# Limits & Capacity — honest, not marketing

> **English** | [Bahasa Indonesia](LIMITS.id.md)

This chatbot runs 100% on **Cloudflare's free tier**. That means real
limits. This page states them plainly.

## Workers AI: 10,000 neurons/day

Source: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
(accessed 2026-10-01). No credit card. Resets at **00:00 UTC**.
When it's gone: requests fail (hard stop, no surprise bill).

**Neurons are not tokens.** Each model has its own neuron rate per
1M input/output tokens, and *output* tokens cost far more (±4–8×).
That's why `MAX_TOKENS` is capped (default 600).

## Estimated messages/day per model

Assumes ±500 input + ±300 output tokens per message (history included).
Longer outputs / longer history = fewer messages. This is an **estimate**,
not a guarantee.

| Model | Est. messages/day |
|---|---|
| Granite 4 Micro (cheapest) | ~2,600 |
| Llama 3.2 3B | ~870 |
| Qwen3 30B | ~870 |
| Llama 3.1 8B (default) | ~800 |
| GLM 4.7 Flash | ~730 |
| GPT-OSS 20B | ~400 |
| Llama 4 Scout | ~300 |

## Other free-tier limits

| Limit | Value | Impact |
|---|---|---|
| Workers requests | 100,000/day | overall ceiling |
| Workers AI | 300 req/min (text) | app burst limiter: 12/min/IP |
| D1 writes | 100,000/day | 1 write/message → fine |
| KV writes | 1,000/day | **not used** for counters (deliberate) |

## What happens when a limit is hit

- **Per-IP / global quota exhausted** → friendly "daily quota reached"
  message, not a technical error. Resets 00:00 UTC.
- **Primary model fails** → automatic fallback to another model
  (the `X-Served-By` header shows which model answered).
- **All models fail** → honest error message, no fake answers.

## In-app usage meter

The sidebar number is an **estimate from this server**, not official
Cloudflare figures. It's shown so users understand why quotas sometimes
run out — not to pretend the app is broken.
