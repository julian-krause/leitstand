#!/bin/bash
# Einmal doppelklicken: Der Leitstand zieht von diesem Mac auf den Server um und läuft dort
# rund um die Uhr. Programm, Daten, Projektordner und Chats gehen mit.
cd "$(dirname "$0")" || exit 1
echo "Der Leitstand zieht auf den Server um. Das dauert ein paar Minuten."
echo
if deploy/umzug.sh leitstand@SERVER-IP; then
  URL="$(python3 -c 'import json; print(json.load(open("data/umgezogen.json"))["url"])')"
  echo
  echo "Ab jetzt hier: $URL (Tailscale muss an sein, auch auf dem Handy)"
  open "$URL"
else
  echo
  echo "Der Umzug ist nicht durchgelaufen. Auf dem Mac ist alles unverändert."
  if ! lsof -ti tcp:4747 >/dev/null 2>&1; then
    echo "Ich starte den Leitstand hier wieder."
    nohup node server.js >> data/leitstand.log 2>&1 &
    disown
    sleep 2
    open "http://127.0.0.1:4747"
  fi
fi
read -r -p "Eingabetaste zum Schließen."
