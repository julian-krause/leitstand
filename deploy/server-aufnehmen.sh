#!/bin/bash
# Nimmt einen vorhandenen Server in die Flotte auf, ohne dessen Einrichtung anzufassen.
# Gedacht für Server, auf denen schon etwas läuft: SSH-Einstellungen, Firewall und
# vorhandene Dienste bleiben unverändert.
#
#   deploy/server-aufnehmen.sh root@adresse [name] [plätze]
#
# Legt auf dem Server den Nutzer „leitstand“ ohne sudo-Rechte an, hinterlegt den Schlüssel
# des Leitstands und trägt die Maschine ein. Claude Code und das Kommando `leitstand`
# installiert der Leitstand danach selbst in dessen Home-Ordner.
set -euo pipefail

TARGET="${1:?Aufruf: $0 root@adresse [name] [plätze]}"
HOST="${TARGET#*@}"
NAME="${2:-$HOST}"
SLOTS="${3:-4}"
HUB="http://127.0.0.1:${LEITSTAND_PORT:-4747}"

KEY="$(curl -fsS "$HUB/api/state" | python3 -c 'import sys, json; print(json.load(sys.stdin)["publicKey"])')"

ssh "$TARGET" bash -s <<EOF
set -e
id leitstand >/dev/null 2>&1 || useradd -m -s /bin/bash leitstand
install -d -m 700 -o leitstand -g leitstand /home/leitstand/.ssh
touch /home/leitstand/.ssh/authorized_keys
grep -qxF '$KEY' /home/leitstand/.ssh/authorized_keys || echo '$KEY' >> /home/leitstand/.ssh/authorized_keys
chown leitstand:leitstand /home/leitstand/.ssh/authorized_keys
chmod 600 /home/leitstand/.ssh/authorized_keys
chmod 750 /home/leitstand
echo "Nutzer auf dem Server: \$(id leitstand)"
EOF

BODY="$(python3 -c 'import sys, json; print(json.dumps({"name": sys.argv[1], "host": sys.argv[2], "user": "leitstand", "slots": int(sys.argv[3])}))' "$NAME" "$HOST" "$SLOTS")"
curl -fsS -H 'Content-Type: application/json' -H 'X-Leitstand: 1' -X POST "$HUB/api/machines" -d "$BODY" >/dev/null
echo "Eingetragen als „${NAME}“ mit ${SLOTS} Plätzen. Der Leitstand richtet die Maschine jetzt ein; der Stand steht unter „Flotte“."
