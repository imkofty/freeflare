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

# 3. auth — fleksibel: lokal (OAuth via browser, tanpa token) atau VPS/headless (API token)
#     VPS:  export CLOUDFLARE_API_TOKEN=xxxx && ./deploy.sh
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  echo "→ Mode headless: pakai CLOUDFLARE_API_TOKEN."
  if ! $W whoami >/dev/null 2>&1; then echo "Token tidak valid."; exit 1; fi
  if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    ACCTS=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts?per_page=10")
    N=$(printf '%s' "$ACCTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).result.length)}catch{console.log(0)}})")
    if [ "$N" = "1" ]; then
      export CLOUDFLARE_ACCOUNT_ID=$(printf '%s' "$ACCTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).result[0].id))")
      echo "→ Account ID terdeteksi otomatis."
    elif [ "$N" = "0" ]; then
      echo "Token tidak punya akses ke akun mana pun."; exit 1
    else
      echo "Token punya akses ke $N akun — set CLOUDFLARE_ACCOUNT_ID manual lalu ulangi."
      exit 1
    fi
  fi
elif ! $W whoami >/dev/null 2>&1; then
  if [ ! -t 0 ]; then
    echo "Headless terdeteksi tapi CLOUDFLARE_API_TOKEN belum di-set."
    echo "Buat token di dash.cloudflare.com → My Profile → API Tokens"
    echo "(template 'Edit Cloudflare Workers' + izin D1 Edit), lalu:"
    echo "  export CLOUDFLARE_API_TOKEN=<token> && ./deploy.sh"
    exit 1
  fi
  echo "→ Membuka login Cloudflare di browser…"
  $W login
fi
echo "→ Auth OK: $($W whoami 2>/dev/null | head -1)"

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
