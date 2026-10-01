#!/bin/bash
# deploy.sh — one-command deploy cf-free-chat to YOUR Cloudflare account.
# No API token needed, no account ID needed: auth is OAuth via browser.
set -e
cd "$(dirname "$0")"

echo "== cf-free-chat one-click deploy =="
echo

# 1. node
if ! command -v node >/dev/null 2>&1; then
  echo "Butuh Node.js 18+. Install dulu dari https://nodejs.org lalu ulangi."
  exit 1
fi

# 2. wrangler (local, no global install needed)
if ! npx --yes wrangler@latest --version >/dev/null 2>&1; then
  echo "Gagal menyiapkan wrangler."
  exit 1
fi
W="npx --yes wrangler@latest"

# 3. login (OAuth via browser — no API token)
if ! $W whoami >/dev/null 2>&1; then
  echo "→ Membuka login Cloudflare di browser…"
  $W login
fi
echo "→ Login OK: $($W whoami 2>/dev/null | head -1)"

# 4. D1 for durable quotas (idempotent)
if ! grep -q '\[\[d1_databases\]\]' wrangler.toml; then
  echo "→ Membuat D1 database untuk kuota harian…"
  OUT=$($W d1 create cf-free-chat-quota --json 2>/dev/null || true)
  DBID=$(echo "$OUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.uuid||j.database_id||'')}catch{}})" || true)
  if [ -z "$DBID" ]; then
    echo "D1 gagal dibuat — lanjut tanpa D1 (mode quota-lite)."
  else
    cat >> wrangler.toml <<EOF

[[d1_databases]]
binding = "DB"
database_name = "cf-free-chat-quota"
database_id = "$DBID"
EOF
    $W d1 execute cf-free-chat-quota --file=./schema.sql --remote >/dev/null
    echo "→ D1 siap."
  fi
else
  echo "→ D1 sudah terkonfigurasi, lewati."
fi

# 5. Optional Turnstile (Enter = lewati)
if ! $W secret list 2>/dev/null | grep -q TURNSTILE_SECRET; then
  echo
  read -r -p "Turnstile site key (opsional, Enter untuk lewati): " TSKEY
  if [ -n "$TSKEY" ]; then
    # inject/update var in wrangler.toml
    if grep -q '^TURNSTILE_SITE_KEY' wrangler.toml; then
      sed -i.bak 's|^TURNSTILE_SITE_KEY.*|TURNSTILE_SITE_KEY = "'"$TSKEY"'"|' wrangler.toml && rm -f wrangler.toml.bak
    else
      printf '\nTURNSTILE_SITE_KEY = "%s"\n' "$TSKEY" >> wrangler.toml
    fi
    echo "Paste Turnstile SECRET key (input tersembunyi, Enter untuk lewati): "
    read -r -s TSSEC; echo
    if [ -n "$TSSEC" ]; then
      printf '%s' "$TSSEC" | $W secret put TURNSTILE_SECRET >/dev/null
      echo "→ Turnstile aktif."
    fi
  else
    echo "→ Turnstile dilewati (mode quota-only)."
  fi
fi

# 6. deploy
echo "→ Deploying…"
$W deploy

echo
echo "== Selesai! Buka URL workers.dev di atas untuk coba. =="
echo "Catatan: ganti nama worker & SYSTEM_PROMPT di wrangler.toml sesukamu,"
echo "lalu jalankan ./deploy.sh lagi untuk update."
