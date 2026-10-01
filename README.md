# GratisChat — chatbot AI 100% gratis di Cloudflare

ChatGPT-style web app yang jalan **sepenuhnya di paket gratis Cloudflare**.
Tanpa API key AI. Tanpa kartu kredit. Satu perintah untuk deploy.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/USERNAME/cf-free-chat)

> Ganti `USERNAME` dengan username GitHub kamu setelah fork.

## Cara deploy (pilih satu)

**Opsi A — script satu perintah (disarankan, kuota D1 penuh):**
```bash
./deploy.sh
```
Script akan: login Cloudflare via browser (OAuth — **tanpa API token,
tanpa account ID**), buatkan D1 untuk kuota harian, lalu deploy.
Selesai.

**Opsi B — tombol Deploy di atas:** klik → login → pilih akun → jadi.
Tanpa D1 (jalan dalam mode quota-lite: burst limiter saja), tapi nol langkah manual.

## Fitur

- **Multi-model picker + fallback otomatis** — 7 model Workers AI gratis
  (Llama 3.1 8B, Llama 3.2 3B, Qwen3 30B, GLM 4.7 Flash, Llama 4 Scout,
  GPT-OSS 20B, Granite 4 Micro). Model utama error → pindah sendiri.
- **Streaming SSE** — jawaban mengalir token demi token.
- **Markdown + code block + tombol copy**, mobile-first, dark UI.
- **Bilingual ID/EN** — toggle di sidebar, otomatis ikut bahasa browser.
- **Riwayat di localStorage** — tanpa login, tanpa database user.
- **Export chat ke Markdown** sekali klik.
- **System prompt per-deployment** — ubah `SYSTEM_PROMPT` di `wrangler.toml`,
  tanpa sentuh kode (mis. jadi CS toko, tutor, dll).
- **Anti-abuse berlapis**: burst limiter (Cache API, gratis) + kuota harian
  per-IP + circuit breaker global (D1) + Turnstile opsional.
- **Meter pemakaian jujur** — estimasi yang diberi label jelas, bukan angka
  resmi Cloudflare. Lihat [docs/LIMITS.md](docs/LIMITS.md).

## Konfigurasi (wrangler.toml)

| Var | Default | Arti |
|---|---|---|
| `SYSTEM_PROMPT` | helpful assistant | Kepribadian bot |
| `DEFAULT_MODEL` | Llama 3.1 8B | Model awal |
| `MAX_TOKENS` | 600 | Panjang jawaban maks |
| `MAX_TURNS` | 20 | Riwayat yang dikirim ke model |
| `DAILY_PER_IP` | 60 | Pesan/hari per IP |
| `GLOBAL_DAILY_CAP` | 700 | Pesan/hari seluruh deployment |
| `TURNSTILE_SITE_KEY` | — | Opsional, lihat bawah |

**Turnstile** (opsional): bikin widget di dashboard Cloudflare
(Turnstile → Add site), isi `TURNSTILE_SITE_KEY`, lalu
`wrangler secret put TURNSTILE_SECRET`. Tanpa ini app tetap jalan
dalam mode quota-only. Challenge cukup sekali per 24 jam (session HMAC,
IP-bound) — user normal hampir tidak pernah lihat captcha.

## Struktur

```
src/worker.js      API + kuota + fallback + Turnstile
public/            UI vanilla (tanpa build step)
schema.sql         tabel kuota D1
deploy.sh          one-click deploy
docs/LIMITS.md     dokumentasi batas & kapasitas (jujur)
```

## Batasan yang perlu kamu tahu

- Kuota 10.000 neurons/hari/akun → ±800 pesan/hari untuk model default.
  Detail: [docs/LIMITS.md](docs/LIMITS.md).
- Tiap deployment pakai kuota akun **masing-masing** — template ini tidak
  menumpang kuota siapa pun.
- Kamu bertanggung jawab atas pemakaian deployment-mu
  (baca Acceptable Use Cloudflare).

## Lisensi

MIT.
