#!/usr/bin/env bash
# ============================================================
# 🚇 PubGame Tunnel Starter (Linux/WSL)
# Avvia 2 tunnel Cloudflare (FE + BE) e aggiorna gli environment
# ============================================================

set -euo pipefail

FE_PORT=${1:-4200}
BE_PORT=${2:-8080}

ENV_FILE="$(dirname "$0")/src/app/environment/environment.tunnel.ts"

echo ""
echo "========================================"
echo "  PubGame Tunnel Starter"
echo "========================================"
echo ""

# Verifica che cloudflared sia installato
if ! command -v cloudflared &>/dev/null; then
    echo "cloudflared non trovato! Installalo con:"
    echo "  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared"
    echo "  chmod +x /usr/local/bin/cloudflared"
    exit 1
fi

cleanup() {
    echo ""
    echo "Chiusura tunnel..."
    [ -n "${BE_PID:-}" ] && kill "$BE_PID" 2>/dev/null || true
    [ -n "${FE_PID:-}" ] && kill "$FE_PID" 2>/dev/null || true
    rm -f /tmp/cloudflared_be.log /tmp/cloudflared_fe.log
    echo "Tunnel chiusi. Arrivederci!"
}
trap cleanup EXIT INT TERM

# --- Avvia tunnel per il Backend ---
echo "Avvio tunnel per Backend (porta $BE_PORT)..."
cloudflared tunnel --url "http://localhost:$BE_PORT" --no-autoupdate > /tmp/cloudflared_be.log 2>&1 &
BE_PID=$!

# --- Avvia tunnel per il Frontend ---
echo "Avvio tunnel per Frontend (porta $FE_PORT)..."
cloudflared tunnel --url "http://localhost:$FE_PORT" --no-autoupdate > /tmp/cloudflared_fe.log 2>&1 &
FE_PID=$!

# --- Attendi che i tunnel siano pronti ---
echo ""
echo "Attendo che i tunnel siano pronti..."

wait_for_url() {
    local log_file=$1
    local name=$2
    local timeout=${3:-30}
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if [ -f "$log_file" ]; then
            local url
            url=$(grep -oP 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com' "$log_file" | head -1)
            if [ -n "$url" ]; then
                echo "  $name tunnel: $url"
                echo "$url"
                return 0
            fi
        fi
        sleep 0.5
        elapsed=$((elapsed + 1))
    done

    echo "  Timeout per il tunnel $name!" >&2
    return 1
}

BE_URL=$(wait_for_url /tmp/cloudflared_be.log "Backend")
FE_URL=$(wait_for_url /tmp/cloudflared_fe.log "Frontend")

if [ -z "$BE_URL" ] || [ -z "$FE_URL" ]; then
    echo ""
    echo "Errore: uno o entrambi i tunnel non sono partiti." >&2
    exit 1
fi

# --- Aggiorna environment.tunnel.ts ---
echo ""
echo "Aggiorno environment.tunnel.ts..."

cat > "$ENV_FILE" << EOF
export const environment = {
  production: false,
  apiUrl: '$BE_URL',
  wsUrl: '$BE_URL/ws-pubgame',
  frontendUrl: '$FE_URL'
};
EOF

echo "  environment.tunnel.ts aggiornato!"
echo ""
echo "========================================"
echo "  TUNNEL PRONTI!"
echo "========================================"
echo ""
echo "  Frontend: $FE_URL"
echo "  Backend:  $BE_URL"
echo ""
echo "  Ora avvia Angular con:"
echo "    ng serve -c tunnel"
echo ""
echo "  Accessi:"
echo "    TV (schermo):       $FE_URL/tv"
echo "    Admin/Votante:      $FE_URL/admin"
echo "    Concorrenti:        $FE_URL/play"
echo ""
echo "  Premi CTRL+C per chiudere i tunnel"
echo ""

# --- Mantieni lo script attivo ---
while true; do
    if ! kill -0 "$BE_PID" 2>/dev/null || ! kill -0 "$FE_PID" 2>/dev/null; then
        echo "Un tunnel si e' chiuso inaspettatamente!" >&2
        break
    fi
    sleep 5
done
