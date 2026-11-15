#!/bin/bash
# Zieht den Leitstand von diesem Mac auf einen Server um, damit er rund um die Uhr läuft.
#
#   deploy/umzug.sh leitstand@adresse          umziehen
#   UMZUG_PROBE=1 deploy/umzug.sh …            nur zeigen, was passieren würde
#
# Der Server muss schon als Maschine in der Flotte stehen (deploy/server-aufnehmen.sh).
# Mitgenommen werden: Programm, Zustand, Geheimnisse, gemeinsamer Kontext, die Ordner der
# Projekte dieses Macs und die Vorgeschichte der Chats. Der Leitstand ist danach nur noch
# aus dem eigenen Tailscale-Netz erreichbar.
set -euo pipefail

TARGET="${1:?Aufruf: $0 leitstand@adresse}"
HOST="${TARGET#*@}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROBE="${UMZUG_PROBE:-}"
cd "$ROOT"

# Schlüssel und Hostliste ohne Leerzeichen im Pfad bereitlegen (rsync und ssh stolpern sonst).
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp data/keys/leitstand_ed25519 data/known_hosts "$TMP/"
chmod 600 "$TMP/leitstand_ed25519"
SSH=(ssh -i "$TMP/leitstand_ed25519" -o BatchMode=yes -o IdentitiesOnly=yes -o "UserKnownHostsFile=$TMP/known_hosts" -o ConnectTimeout=15)
RSH="ssh -i $TMP/leitstand_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=$TMP/known_hosts"

echo "1/7  Server befragen"
read -r RHOME TS_IP TS_NAME < <("${SSH[@]}" "$TARGET" 'echo "$HOME $(ip -4 addr show tailscale0 2>/dev/null | awk "/inet /{print \$2}" | cut -d/ -f1) $(tailscale status --self --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)[\"Self\"][\"DNSName\"].rstrip(\".\"))" 2>/dev/null)"')
[ -n "$TS_IP" ] || { echo "Auf dem Server läuft kein Tailscale. Ohne das wäre der Leitstand dort nicht erreichbar."; exit 1; }
echo "     Home $RHOME, Tailscale $TS_IP ${TS_NAME:-}"

if [ -z "$PROBE" ]; then
  BUSY="$(curl -fsS http://127.0.0.1:4747/api/state 2>/dev/null | python3 -c 'import sys, json; print(sum(1 for c in json.load(sys.stdin)["chats"] if c["status"] in ("running", "queued")))' 2>/dev/null || echo 0)"
  if [ "$BUSY" != "0" ] && [ -z "${UMZUG_TROTZDEM:-}" ]; then
    echo "Es laufen noch $BUSY Agenten. Der Umzug würde sie abbrechen (mit UMZUG_TROTZDEM=1 trotzdem umziehen; sie machen danach auf dem Server weiter)."
    exit 1
  fi
  echo "2/7  Leitstand auf diesem Mac anhalten"
  lsof -ti tcp:4747 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 2
else
  echo "2/7  (Probe: der Leitstand läuft weiter)"
fi

echo "3/7  Zustand für den Server umschreiben"
cp -R data "$TMP/data"
rm -f "$TMP/data/hub.lock" "$TMP/data/leitstand.log"
python3 - "$TMP" "$HOST" "$RHOME" "$TS_IP" "${TS_NAME:-}" <<'PY'
import json, re, sys, time

tmp, host, rhome, ts_ip, ts_name = sys.argv[1:6]
path = f'{tmp}/data/state.json'
st = json.load(open(path))
now = int(time.time() * 1000)

server = next((m for m in st['machines'] if m.get('kind') == 'ssh' and m.get('host') == host), None)
if not server:
    sys.exit(f'Der Server {host} steht nicht als Maschine in der Flotte.')
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-') or 'projekt'

# Projekte: Was auf dem Mac lag, bekommt einen Ordner auf dem Server. Was schon auf dem Server
# lag, gehört jetzt zur eigenen Maschine des Leitstands.
folders = []
notes = {}
context = f'{rhome}/leitstand/data/kontext'
for p in st['projects']:
    if p['machineId'] == 'lokal':
        old = p['dir']
        p['dir'] = f"{rhome}/projekte/{slug(p['name'])}"
        p['personal'] = False
        folders.append((old, p['dir']))
        notes[p['id']] = (
            f"Hinweis des Leitstands: Der Leitstand und dieses Projekt sind auf einen Server umgezogen. "
            f"Dein Projektordner liegt jetzt unter {p['dir']} (vorher {old}), der gemeinsame Kontext unter {context}. "
            f"Pfade aus früheren Nachrichten gelten entsprechend. Für den Browser nutzt du hier das Kommando agent-browser."
        )
    elif p['machineId'] == server['id']:
        p['dir'] = rhome + p['dir'][1:] if p['dir'].startswith('~') else p['dir']
        p['machineId'] = 'lokal'

local = next(m for m in st['machines'] if m['id'] == 'lokal')
local.update(name=f"Server {server['name']}", slots=server.get('slots', 4), info=server.get('info'))
st['machines'] = [m for m in st['machines'] if m['id'] != server['id']]

# Chats: Vorgeschichte mitnehmen, laufende gibt es beim Umzug nicht mehr.
dirs = {p['id']: p['dir'] for p in st['projects']}
sessions = []
for c in st['chats']:
    # Unterbrochene Läufe werden nach dem Umzug fortgesetzt. Wer auf Teilaufträge wartet, wartet weiter.
    if c.get('status') in ('running', 'queued'):
        c.update(status='attention', queued=None, crew=0, activity=None, assist=None,
                 attention={'kind': 'fehler', 'kurz': 'Der Leitstand ist auf den Server umgezogen, der Lauf wurde dabei unterbrochen.', 'since': now})
    if c['projectId'] in notes:
        c['note'] = notes[c['projectId']]
    if c.get('sessionId') and c['projectId'] in dirs:
        sessions.append((c['sessionId'], re.sub(r'[^A-Za-z0-9]', '-', dirs[c['projectId']])))

hosts = set(st['settings']['access'].get('hosts', []))
hosts.update(h for h in (ts_ip, ts_name) if h)
st['settings']['access']['hosts'] = sorted(hosts)

json.dump(st, open(path, 'w'), ensure_ascii=False, indent=1)
open(f'{tmp}/folders.tsv', 'w').write(''.join(f'{a}\t{b}\n' for a, b in folders))
open(f'{tmp}/sessions.tsv', 'w').write(''.join(f'{a}\t{b}\n' for a, b in sessions))
print(f"     Projekte: {[(p['name'], p['dir']) for p in st['projects']]}")
print(f"     Maschinen: {[(m['name'], m['slots']) for m in st['machines']]}")
print(f"     Chats mit Vorgeschichte: {len(sessions)}, Ordner zum Übertragen: {len(folders)}")
PY

if [ -n "$PROBE" ]; then
  echo "Probe beendet. Übertragen und gestartet wurde nichts."
  exit 0
fi

echo "4/7  Programm und Daten übertragen"
"${SSH[@]}" "$TARGET" 'mkdir -p leitstand projekte'
rsync -a --delete --exclude data --exclude node_modules --exclude .git -e "$RSH" "$ROOT/" "$TARGET:leitstand/"
rsync -a -e "$RSH" "$TMP/data/" "$TARGET:leitstand/data/"

echo "5/7  Projektordner und Vorgeschichte der Chats übertragen"
while IFS=$'\t' read -r from to; do
  [ -d "$from" ] || continue
  "${SSH[@]}" "$TARGET" "mkdir -p '$to'" </dev/null
  rsync -a -e "$RSH" "$from/" "$TARGET:$to/" </dev/null
done < "$TMP/folders.tsv"
while IFS=$'\t' read -r session encoded; do
  for found in "$HOME"/.claude/projects/*/"$session".jsonl; do
    [ -f "$found" ] || continue
    "${SSH[@]}" "$TARGET" "mkdir -p '.claude/projects/$encoded'" </dev/null
    rsync -a -e "$RSH" "$found" "$TARGET:.claude/projects/$encoded/" </dev/null
    [ -d "${found%.jsonl}" ] && rsync -a -e "$RSH" "${found%.jsonl}" "$TARGET:.claude/projects/$encoded/" </dev/null
  done
done < "$TMP/sessions.tsv"

echo "6/7  Auf dem Server dauerhaft starten"
"${SSH[@]}" "$TARGET" 'chmod +x leitstand/deploy/*.sh leitstand/bin/leitstand
  ( crontab -l 2>/dev/null | grep -v "leitstand/deploy/hub-server.sh"
    echo "@reboot $HOME/leitstand/deploy/hub-server.sh"
    echo "* * * * * $HOME/leitstand/deploy/hub-server.sh" ) | crontab -
  setsid nohup "$HOME/leitstand/deploy/hub-server.sh" >/dev/null 2>&1 < /dev/null &
  for i in 1 2 3 4 5 6 7 8 9 10; do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4747/api/state)
    [ "$code" = "403" ] && break
    sleep 1
  done
  echo "     Antwort vom Server selbst: $code (403 heißt: läuft, und von dort gesperrt)"
  tail -2 leitstand/data/leitstand.log'

echo "7/7  Dieser Mac zeigt ab jetzt auf den Server"
URL="http://${TS_NAME:-$TS_IP}:4747"
mv data "data.vor-umzug-$(date +%Y%m%d-%H%M)"
mkdir -p data
printf '{"url": "%s"}\n' "$URL" > data/umgezogen.json
echo "Fertig. Der Leitstand läuft jetzt hier: $URL"
