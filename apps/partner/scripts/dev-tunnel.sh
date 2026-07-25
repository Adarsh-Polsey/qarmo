#!/usr/bin/env bash
# Start Expo dev server + ngrok tunnel for phone testing
# Usage: ./scripts/dev-tunnel.sh [port]
set -e
NGROK_BIN="/opt/data/home/.local/bin/ngrok"
PORT="${1:-8085}"
NGROK_DOMAIN="automated-jeep-elephant.ngrok-free.dev"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $EXPO_PID 2>/dev/null || true
  kill $NGROK_PID 2>/dev/null || true
  wait $EXPO_PID 2>/dev/null || true
  wait $NGROK_PID 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

# ── Kill ALL stale processes (not just on the port) ──
echo "🧹 Cleaning up stale processes..."
pkill -9 -f "expo start" 2>/dev/null || true
pkill -9 -f "ngrok" 2>/dev/null || true
sleep 2

# Also nuke anything still on our port
for pid in $(ls /proc/ 2>/dev/null | grep -E '^[0-9]+$'); do
  ls -l /proc/$pid/fd 2>/dev/null | grep -q "socket:" && {
    ss -tlnp 2>/dev/null | grep -q "pid=$pid.*:$PORT " && kill -9 $pid 2>/dev/null
  }
done
sleep 1

# ── Start Expo first ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Qarmo Partner — Expo Dev Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
export EXPO_PACKAGER_PROXY_URL="https://${NGROK_DOMAIN}"
export EXPO_USE_METRO_WORKSPACE_ROOT=0
npx expo start --clear --port "$PORT" &
EXPO_PID=$!

# Wait for Metro to be ready before starting ngrok
echo "⏳ Waiting for Metro bundler..."
for i in $(seq 1 60); do
  sleep 2
  if curl -s -o /dev/null "http://localhost:${PORT}/apps/partner/index.bundle?platform=android&dev=true" 2>/dev/null; then
    echo "✅ Metro ready"
    break
  fi
  [ $i -eq 60 ] && echo "⚠️  Metro may not be fully ready yet..."
done

# ── Start ngrok ──
echo "⏳ Starting ngrok tunnel..."
"$NGROK_BIN" http "$PORT" \
  --url="$NGROK_DOMAIN" \
  --request-header-add "ngrok-skip-browser-warning:true" \
  --log=stdout &
NGROK_PID=$!

# Wait for ngrok API
for i in $(seq 1 15); do
  sleep 1
  URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null) || true
  if [ -n "$URL" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✅  TUNNEL READY"
    echo ""
    echo "  📱  exp://${NGROK_DOMAIN}"
    echo ""
    echo "  Open in Expo Go on your phone to test"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Press Ctrl+C to stop"
    break
  fi
done

if [ -z "$URL" ]; then
  echo "❌ ngrok failed to start."
  exit 1
fi

# Keep running until Ctrl+C
wait
