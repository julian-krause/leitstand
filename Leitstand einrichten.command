#!/bin/bash
# Einmal doppelklicken, danach braucht der Leitstand kein Terminal mehr:
#   1. Der Leitstand startet künftig von selbst (bei der Anmeldung und nach einem Absturz).
#   2. Dein Claude-Abo wird für die Server der Flotte freigegeben.
cd "$(dirname "$0")" || exit 1
HUB="http://127.0.0.1:4747"

echo "1/2  Leitstand dauerhaft einrichten"
# Eine von Hand gestartete Instanz würde den Port blockieren.
lsof -ti tcp:4747 2>/dev/null | xargs kill 2>/dev/null
sleep 1
if ! deploy/autostart.sh install; then
  echo "Das hat nicht geklappt. Die Meldung oben hilft bei der Fehlersuche."
  read -r -p "Eingabetaste zum Schließen."
  exit 1
fi
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS -o /dev/null "$HUB/" 2>/dev/null && break
  sleep 1
done
if ! curl -fsS -o /dev/null "$HUB/"; then
  echo "Der Leitstand antwortet nicht. Protokoll: $(pwd)/data/leitstand.log"
  read -r -p "Eingabetaste zum Schließen."
  exit 1
fi

# Ist schon ein Abo eingetragen, ist hier Schluss.
if curl -fsS "$HUB/api/state" | python3 -c 'import sys, json; sys.exit(0 if any(not a.get("builtin") for a in json.load(sys.stdin)["accounts"]) else 1)'; then
  echo
  echo "Fertig. Der Leitstand startet ab jetzt von selbst: $HUB"
  open "$HUB"
  read -r -p "Eingabetaste zum Schließen."
  exit 0
fi

echo
echo "2/2  Claude-Abo für die Server freigeben"
echo "     Gleich öffnet sich der Browser. Melde dich dort mit deinem Claude-Konto an."
echo
RECORD="$(mktemp)"
chmod 600 "$RECORD"
trap 'rm -f "$RECORD"' EXIT
# Breite Zeilen, damit das Token nicht umbrochen wird.
stty cols 250 2>/dev/null
script -q "$RECORD" claude setup-token

TOKEN="$(python3 - "$RECORD" <<'PY'
import re, sys
text = open(sys.argv[1], 'rb').read().decode('utf-8', 'ignore')
# Die Ausgabe setzt Abstände und Zeilenwechsel über Cursor-Sprünge. Die werden zu Leerraum,
# sonst klebt das nächste Wort am Token.
text = re.sub(r'\x1b\[[0-9;]*[A-HJKSTdf]', ' ', text)
text = re.sub(r'\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\r', ' ', text)
found = re.findall(r'sk-ant-oat\d\d-[A-Za-z0-9_-]{20,}', text)
print(found[-1] if found else '')
PY
)"
if [ -z "$TOKEN" ]; then
  echo
  echo "Das Token ließ sich nicht automatisch lesen."
  read -r -s -p "Kopier es aus der Ausgabe oben, füg es hier ein und drück die Eingabetaste: " TOKEN
  echo
fi

NAME="Abo $(date +%d.%m.%Y)"
BODY="$(python3 -c 'import sys, json; print(json.dumps({"name": sys.argv[1], "token": sys.argv[2].strip()}))' "$NAME" "$TOKEN")"
if curl -fsS -H 'Content-Type: application/json' -H 'X-Leitstand: 1' -X POST "$HUB/api/accounts" -d "$BODY" >/dev/null; then
  echo
  echo "Fertig. Das Abo ist als „${NAME}“ eingetragen und wird auf die Server verteilt."
  echo "Ab jetzt läuft alles im Browser: $HUB"
  open "$HUB/#fleet"
else
  echo
  echo "Das Token wurde nicht angenommen. Trag es von Hand ein: $HUB/#fleet → „Konto hinzufügen“."
fi
read -r -p "Eingabetaste zum Schließen."
