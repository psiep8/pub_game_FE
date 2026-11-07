#!/usr/bin/env bash
# ============================================================
# 🚇 PubGame — Tunnel Cloudflare (un solo tunnel)
#
# Il frontend chiama sempre la propria origine: /games, /categories,
# /questions e /ws-pubgame vengono inoltrati dal dev-server al backend
# (proxy.conf.mjs). Un tunnel verso la porta del frontend basta quindi per
# TV, admin e per tutti i telefoni: un URL solo, nessun tunnel backend.
#
# Uso:  npm run dev          (in un terminale)
#       ./start-tunnel.sh    (in un altro)
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

env_value() {
    [ -f "$ENV_FILE" ] || return 0

    local value
    value=$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r') || true
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    printf '%s' "$value"
}

FE_PORT="${1:-$(env_value FE_PORT)}"
FE_PORT="${FE_PORT:-4200}"

echo ""
echo "========================================"
echo "  PubGame Tunnel Starter"
echo "========================================"
echo ""

if ! command -v cloudflared &>/dev/null; then
    echo "cloudflared non trovato! Installalo con:"
    echo "  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared"
    echo "  chmod +x /usr/local/bin/cloudflared"
    exit 1
fi

# Fail fast: un tunnel verso una porta spenta risponde 502 e fa perdere minuti.
echo "Verifico il dev-server su http://localhost:$FE_PORT ..."
if ! curl -fsS -m 3 -o /dev/null "http://localhost:$FE_PORT"; then
    echo "  Nessuna risposta su http://localhost:$FE_PORT"
    echo "  Avvia prima il progetto con 'npm run dev' in un altro terminale."
    exit 1
fi
echo "  dev-server attivo"

TUNNEL_LOG="${TMPDIR:-/tmp}/pubgame-tunnel.log"
rm -f "$TUNNEL_LOG"

cleanup() {
    echo ""
    echo "Chiusura tunnel..."
    [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null || true
    rm -f "$TUNNEL_LOG"
    echo "Tunnel chiuso. Arrivederci!"
}
trap cleanup EXIT INT TERM

echo ""
echo "Avvio il tunnel verso il frontend (porta $FE_PORT)..."
cloudflared tunnel --url "http://localhost:$FE_PORT" --no-autoupdate > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

PUBLIC_URL=""
for _ in $(seq 1 60); do
    if [ -f "$TUNNEL_LOG" ]; then
        PUBLIC_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)
        [ -n "$PUBLIC_URL" ] && break
    fi
    sleep 0.5
done

if [ -z "$PUBLIC_URL" ]; then
    echo ""
    echo "Tunnel non avviato. Controlla il log: $TUNNEL_LOG"
    exit 1
fi

echo ""
echo "========================================"
echo "  TUNNEL PRONTO!"
echo "========================================"
echo ""
echo "  TV (schermo):  $PUBLIC_URL/tv"
echo "  Admin:         $PUBLIC_URL/admin"
echo "  Telefoni:      $PUBLIC_URL/play"
echo ""
echo "  Lo stesso URL vale per tutti i telefoni: aprono /play"
echo "  o inquadrano il QR mostrato dalla TV."
echo ""
echo "  Premi CTRL+C per chiudere il tunnel"
echo ""

while true; do
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
        echo "Il tunnel si e' chiuso inaspettatamente!" >&2
        break
    fi
    sleep 5
done
