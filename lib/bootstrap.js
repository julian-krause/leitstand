// Ersteinrichtung eines frischen Linux-Servers, läuft dort als root.
// Legt den Nutzer „agent“ ohne Root-Rechte an (Claude Code verweigert den autonomen
// Modus als root), erlaubt SSH nur per Schlüssel, schaltet die Firewall ein und
// installiert Claude Code. Lässt sich gefahrlos wiederholen.
export const READY_FLAG = '/var/lib/leitstand-ready';

// Browser der Agenten: Playwright-MCP-Server von Microsoft, fest auf eine Version gesetzt,
// damit kein Agent ungeprüft eine neuere lädt. PLAYWRIGHT_VERSION ist die Playwright-Version,
// von der diese MCP-Version abhängt; damit wird auf Servern der passende Chrome installiert.
export const BROWSER_MCP = '@playwright/mcp@0.0.85';
const PLAYWRIGHT_VERSION = '1.66.0-alpha-2026-11-09';

export const BOOTSTRAP = `#!/bin/bash
set -ux
export DEBIAN_FRONTEND=noninteractive
id agent >/dev/null 2>&1 || useradd -m -s /bin/bash agent
echo 'agent ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-agent
chmod 440 /etc/sudoers.d/90-agent
install -d -m 700 -o agent -g agent /home/agent/.ssh
cp /root/.ssh/authorized_keys /home/agent/.ssh/authorized_keys
chown agent:agent /home/agent/.ssh/authorized_keys
chmod 600 /home/agent/.ssh/authorized_keys
cat > /etc/ssh/sshd_config.d/10-leitstand.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin no
MaxSessions 100
MaxStartups 100:30:200
EOF
systemctl restart ssh || systemctl restart sshd
if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get update
apt-get install -y git curl ca-certificates jq ripgrep unzip build-essential python3-venv python3-pip ufw unattended-upgrades nodejs npm
ufw allow OpenSSH
ufw --force enable
sudo -iu agent bash -c 'command -v claude >/dev/null 2>&1 || curl -fsSL https://claude.ai/install.sh | bash'
# Chrome für den Browser der Agenten (nur x86_64; schlägt das fehl, läuft alles andere weiter)
npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chrome || true
touch ${READY_FLAG}
echo __BOOTSTRAP_DONE__
`;
