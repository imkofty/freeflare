#!/bin/bash
# deploy.sh — one-command deploy freeflare to YOUR Cloudflare account.
# No API token needed, no account ID needed: auth is OAuth via browser.
set -e
cd "$(dirname "$0")"

echo "== freeflare one-click deploy =="
echo

# 1. node
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ required. Install from https://nodejs.org then retry."
  exit 1
fi

# 2. wrangler (local, no global install needed)
if ! npx --yes wrangler@latest --version >/dev/null 2>&1; then
  echo "Failed to set up wrangler."
  exit 1
fi
W="npx --yes wrangler@latest"

# 3. auth — user PILIH jalur (interaktif); env var = otomasi/non-interaktif
#     VPS non-interaktif: export CLOUDFLARE_API_TOKEN=xxxx && ./deploy.sh < /dev/null
MODE=""
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
  MODE=token
elif [ ! -t 0 ]; then
  echo "Non-interactive run and CLOUDFLARE_API_TOKEN is not set."
  echo "Create a token at dash.cloudflare.com → My Profile → API Tokens"
  echo "(template 'Edit Cloudflare Workers' + D1 Edit permission), then:"
  echo "  export CLOUDFLARE_API_TOKEN=<token> && ./deploy.sh"
  exit 1
else
  echo "Choose deploy path:"
  echo "  1) Laptop — browser login, NO API token  [default]"
  echo "  2) VPS/headless — use an API token"
  read -r -p "Choice [1/2]: " PICK
  case "$PICK" in 2) MODE=token;; *) MODE=oauth;; esac
  echo
fi

if [ "$MODE" = "token" ]; then
  if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "Create a token at dash.cloudflare.com → My Profile → API Tokens"
    echo "(template 'Edit Cloudflare Workers' + D1 Edit permission)."
    read -r -s -p "Paste API token: " CLOUDFLARE_API_TOKEN; echo
    export CLOUDFLARE_API_TOKEN
  fi
  echo "→ API token mode."
  if ! $W whoami >/dev/null 2>&1; then echo "Invalid token."; exit 1; fi
  if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    ACCTS=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts?per_page=10")
    N=$(printf '%s' "$ACCTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).result.length)}catch{console.log(0)}})")
    if [ "$N" = "1" ]; then
      export CLOUDFLARE_ACCOUNT_ID=$(printf '%s' "$ACCTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).result[0].id))")
      echo "→ Account ID auto-detected."
    elif [ "$N" = "0" ]; then
      echo "Token has no account access."; exit 1
    else
      echo "Token can access $N accounts — set CLOUDFLARE_ACCOUNT_ID manually and retry."
      exit 1
    fi
  fi
else
  if ! $W whoami >/dev/null 2>&1; then
    echo "→ Opening Cloudflare login in your browser…"
    $W login
  fi
fi
echo "→ Auth OK: $($W whoami 2>/dev/null | head -1)"

# 4. D1 for durable quotas (idempotent)
if ! grep -q '\[\[d1_databases\]\]' wrangler.toml; then
  echo "→ Creating D1 database for daily quotas…"
  OUT=$($W d1 create freeflare-quota --json 2>/dev/null || true)
  DBID=$(echo "$OUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.uuid||j.database_id||'')}catch{}})" || true)
  if [ -z "$DBID" ]; then
    echo "D1 creation failed — continuing without D1 (quota-lite mode)."
  else
    cat >> wrangler.toml <<EOF

[[d1_databases]]
binding = "DB"
database_name = "freeflare-quota"
database_id = "$DBID"
EOF
    $W d1 execute freeflare-quota --file=./schema.sql --remote >/dev/null
    echo "→ D1 ready."
  fi
else
  echo "→ D1 already configured, skipping."
fi

# 5. Optional Turnstile (Enter = lewati)
if ! $W secret list 2>/dev/null | grep -q TURNSTILE_SECRET; then
  echo
  read -r -p "Turnstile site key (optional, Enter to skip): " TSKEY
  if [ -n "$TSKEY" ]; then
    # inject/update var in wrangler.toml
    if grep -q '^TURNSTILE_SITE_KEY' wrangler.toml; then
      sed -i.bak 's|^TURNSTILE_SITE_KEY.*|TURNSTILE_SITE_KEY = "'"$TSKEY"'"|' wrangler.toml && rm -f wrangler.toml.bak
    else
      printf '\nTURNSTILE_SITE_KEY = "%s"\n' "$TSKEY" >> wrangler.toml
    fi
    echo "Paste Turnstile SECRET key (hidden input, Enter to skip): "
    read -r -s TSSEC; echo
    if [ -n "$TSSEC" ]; then
      printf '%s' "$TSSEC" | $W secret put TURNSTILE_SECRET >/dev/null
      echo "→ Turnstile enabled."
    fi
  else
    echo "→ Turnstile skipped (quota-only mode)."
  fi
fi

# 6. deploy
echo "→ Deploying…"
$W deploy

echo
echo "== Done! Open the workers.dev URL above to try it. =="
echo "Tip: rename the worker & SYSTEM_PROMPT in wrangler.toml as you like,"
echo "then run ./deploy.sh again to update."
