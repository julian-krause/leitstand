#!/bin/bash
# Hält den Leitstand auf einem Server am Laufen. Wird von cron beim Hochfahren und jede Minute
# aufgerufen; läuft er schon, passiert nichts.
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/bin:$PATH"
mkdir -p data

# Nur eine Instanz: Die Sperre hält der laufende Leitstand selbst.
exec 9> data/hub.lock
flock -n 9 || exit 0

# Erreichbar nur aus dem eigenen Tailscale-Netz. Nach dem Hochfahren kurz warten, bis es steht.
for _ in $(seq 1 30); do
  TS_IP="$(ip -4 addr show tailscale0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1)"
  [ -n "$TS_IP" ] && break
  sleep 2
done

export LEITSTAND_BIND="127.0.0.1${TS_IP:+,$TS_IP}"
# Auf diesem Server arbeiten auch die Agenten: Vom Server selbst aus ist die Steuerung gesperrt,
# offen ist sie nur für die anderen Geräte des Tailscale-Netzes.
export LEITSTAND_TRUST_LOCAL=0
export LEITSTAND_TRUST_TAILNET=1
# Hier gibt es keine eigene Claude-Anmeldung, nur die hinterlegten Abos.
export LEITSTAND_NO_LOCAL_LOGIN=1
exec node server.js >> data/leitstand.log 2>&1
