#!/bin/bash
# Startet den Leitstand auf dem Server neu, etwa nach einem Update.
# Laufende Agenten werden kurz unterbrochen und machen danach von selbst weiter.
#   deploy/neustart.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Server-Adressen stehen lokal in data/server.env (nicht im Repo)
[ -f "$ROOT/data/server.env" ] && . "$ROOT/data/server.env"
TARGET="${LEITSTAND_SERVER:?LEITSTAND_SERVER setzen, etwa leitstand@<server-ip>}"
URL="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["url"])' "$ROOT/data/umgezogen.json" 2>/dev/null || echo "http://${LEITSTAND_TAILSCALE_IP:-127.0.0.1}:4747")"

KEY="$( (ls "$ROOT"/data.vor-umzug-*/keys/leitstand_ed25519 "$ROOT"/data/keys/leitstand_ed25519 2>/dev/null || true) | head -1)"
[ -n "$KEY" ] || { echo "SSH-Schlüssel des Leitstands nicht gefunden."; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$KEY" "$TMP/key" && chmod 600 "$TMP/key"

echo "Leitstand auf dem Server anhalten …"
# Nur den Prozess, der auf Port 4747 lauscht. Der Cronjob startet ihn innerhalb einer Minute neu.
ssh -i "$TMP/key" -o BatchMode=yes -o IdentitiesOnly=yes "$TARGET" \
  'PID=$(ss -ltnp | grep "127.0.0.1:4747" | grep -o "pid=[0-9]*" | cut -d= -f2); [ -n "$PID" ] && kill -TERM "$PID"; sleep 3; cd ~/leitstand && (nohup setsid deploy/hub-server.sh >/dev/null 2>&1 </dev/null &)'

printf "Warte auf den Neustart"
for _ in $(seq 1 30); do
  sleep 3
  printf "."
  if [ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' "$URL/")" = 200 ]; then
    echo
    echo "Leitstand läuft wieder: $URL (Seite neu laden)"
    exit 0
  fi
done
echo
echo "Der Leitstand antwortet noch nicht. Der Cronjob versucht es jede Minute erneut."
exit 1
