# Batas & Kapasitas — jujur, bukan marketing

Chatbot ini jalan 100% di **paket gratis Cloudflare**. Artinya ada batas
nyata. Halaman ini menjelaskan semuanya apa adanya.

## Workers AI: 10.000 neurons/hari

Sumber: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
(diakses 2026-10-01). Tanpa kartu kredit. Reset tiap **00:00 UTC**.
Kalau habis: request gagal (hard stop, tidak ada tagihan dadakan).

**Neuron bukan token.** Setiap model punya tarif neuron per 1 juta token
input/output, dan token *output* jauh lebih mahal (±4–8× lipat).
Itulah kenapa `MAX_TOKENS` dibatasi (default 600).

## Estimasi pesan/hari per model

Asumsi: ±500 token input + ±300 token output per pesan (termasuk riwayat).
Output panjang / riwayat panjang = lebih sedikit pesan. Ini **estimasi**,
bukan jaminan.

| Model | Perkiraan pesan/hari |
|---|---|
| Granite 4 Micro (paling hemat) | ~2.600 |
| Llama 3.2 3B | ~870 |
| Qwen3 30B | ~870 |
| Llama 3.1 8B (default) | ~800 |
| GLM 4.7 Flash | ~730 |
| GPT-OSS 20B | ~400 |
| Llama 4 Scout | ~300 |

## Batas lain paket gratis

| Batas | Nilai | Dampak |
|---|---|---|
| Workers requests | 100.000/hari | langit-langit total |
| Workers AI | 300 req/menit (text) | burst limiter app: 12/menit/IP |
| D1 writes | 100.000/hari | 1 write/pesan → aman |
| KV writes | 1.000/hari | **tidak dipakai** untuk counter (sengaja) |

## Yang terjadi saat batas tercapai

- **Kuota per-IP / global habis** → pesan ramah "kuota harian tercapai",
  bukan error teknis. Reset 00:00 UTC.
- **Model utama error** → otomatis fallback ke model lain
  (header `X-Served-By` menunjukkan model yang menjawab).
- **Semua model gagal** → pesan error jujur, tanpa pura-pura jawab.

## Meter pemakaian di aplikasi

Angka di sidebar adalah **estimasi dari server ini**, bukan angka resmi
Cloudflare. Ditampilkan supaya user paham kenapa kadang kuota habis —
bukan supaya dikira aplikasinya rusak.
