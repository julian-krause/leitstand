// Flotte: Warteschlange, Verteilung auf Maschinen und Abo-Konten, Start und Überwachung der Agenten.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn, execFile, execFileSync } from 'node:child_process';
import {
  state, secrets, ROOT, CONTEXT_DIR, KEY_FILE, KNOWN_HOSTS, AGENT_PORT, TUNNEL_PORT, CLAUDE_BIN,
  save, changed, chatChanged, id, findChat, findProject, findMachine, findAccount, httpError, views,
} from './store.js';
import { leadPrompt, parseStatus, toolLabel, denialPatterns } from './agent.js';
import { BOOTSTRAP } from './bootstrap.js';

const running = new Map(); // chatId -> { child, machineId, accountId, token, remotePid }
const runTokens = new Map(); // Token eines Laufs -> chatId
const tunnels = new Map(); // machineId -> ssh-Prozess für den Rückkanal

// Andere Module können die Meldung am Ende eines Laufs ergänzen (etwa offene Zahlungen).
export const attentionHooks = [];

views.fleet = () => ({
  machines: state.machines.map((m) => ({ ...m, running: runningCount(m.id) })),
  accounts: state.accounts,
});

export const chatForRunToken = (token) => findChat(runTokens.get(token));
export const runningCount = (machineId) => [...running.values()].filter((r) => r.machineId === machineId).length;
export const isRunning = (chatId) => running.has(chatId);

// ---------- SSH ----------

export function publicKey() {
  if (!fs.existsSync(KEY_FILE)) {
    execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', 'leitstand', '-q', '-f', KEY_FILE]);
  }
  return fs.readFileSync(KEY_FILE + '.pub', 'utf8').trim();
}

function sshArgs(machine) {
  publicKey();
  return [
    '-i', KEY_FILE,
    '-p', String(machine.port || 22),
    '-o', 'BatchMode=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', `UserKnownHostsFile="${KNOWN_HOSTS}"`,
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=4',
    '-o', 'ConnectTimeout=12',
    `${machine.user}@${machine.host}`,
  ];
}

const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
// "~/x" soll auf der Zielmaschine aufgelöst werden, nicht hier.
const remotePath = (dir) => (dir.startsWith('~/') ? `"$HOME"/${shq(dir.slice(2))}` : dir === '~' ? '"$HOME"' : shq(dir));

// Die Zeile, die auf der entfernten Maschine einen Agenten startet.
export function remoteCommand({ dir, token, accountId, args, session = '', os = 'linux' }) {
  const target = remotePath(dir);
  return [
    `export LEITSTAND_URL=http://127.0.0.1:${TUNNEL_PORT} LEITSTAND_RUN=${token}`,
    'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"',
    ...(session ? [`export AGENT_BROWSER_SESSION=${session}${os === 'linux' ? ' AGENT_BROWSER_ARGS=--no-sandbox' : ''}`] : []),
    // Auf einem Mac: sichtbares Fenster und ein dauerhaftes Profil, damit Anmeldungen bleiben.
    ...(session && os === 'darwin' ? ['export AGENT_BROWSER_HEADED=1 AGENT_BROWSER_PROFILE="$HOME/.leitstand/browser-profil"'] : []),
    // Nie über einen API-Schlüssel abrechnen, auch wenn auf der Maschine einer gesetzt ist.
    'unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN',
    ...(accountId !== 'lokal' ? [`export CLAUDE_CODE_OAUTH_TOKEN="$(cat "$HOME/.leitstand/tokens/${accountId}")"`] : []),
    `mkdir -p ${target}`,
    `cd ${target}`,
    'echo "__PID__$$" >&2',
    `exec claude ${args.map(shq).join(' ')}`,
  ].join(' && ');
}

export function sshExec(machine, script, timeout = 180_000) {
  return new Promise((resolve) => {
    const child = spawn('ssh', [...sshArgs(machine), 'bash -s'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('error', (err) => (stderr += err.message));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(script);
  });
}

// ---------- Maschinen ----------

const HOST_RE = /^[A-Za-z0-9][A-Za-z0-9.:-]{0,252}$/;
const USER_RE = /^[a-z_][a-z0-9_-]{0,31}$/i;

export function addMachine({ name, host, user, port, slots, hetznerId }) {
  host = String(host || '').trim();
  user = String(user || '').trim();
  if (!HOST_RE.test(host)) throw httpError(400, 'Ungültiger Hostname');
  if (!USER_RE.test(user)) throw httpError(400, 'Ungültiger Benutzername');
  const machine = {
    id: id(),
    name: String(name || host).trim().slice(0, 60),
    kind: 'ssh',
    host,
    user,
    port: Number(port) || 22,
    slots: Math.max(1, Number(slots) || 4),
    slotsManual: Boolean(slots),
    status: 'ungeprüft',
    accountId: 'auto',
    hetznerId: hetznerId || null,
  };
  state.machines.push(machine);
  changed('fleet');
  return machine;
}

export function removeMachine(machine) {
  if (machine.kind === 'local') throw httpError(400, 'Der eigene Rechner bleibt');
  if (state.projects.some((p) => p.machineId === machine.id)) {
    throw httpError(400, 'Auf dieser Maschine liegen noch Projekte. Verschieb sie zuerst.');
  }
  tunnels.get(machine.id)?.kill();
  state.machines = state.machines.filter((m) => m.id !== machine.id);
  changed('fleet');
}

// Skript, das Abo-Tokens und das Kommando `leitstand` auf eine Maschine bringt und sie vermisst.
export function setupScript() {
  const accounts = state.accounts.filter((a) => !a.builtin && secrets.accounts[a.id]);
  const cli = fs.readFileSync(path.join(ROOT, 'bin', 'leitstand'), 'utf8');
  return `set -e
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$HOME/.leitstand/tokens" "$HOME/.local/bin"
chmod 700 "$HOME/.leitstand" "$HOME/.leitstand/tokens"
if ! command -v claude >/dev/null 2>&1; then
  curl -fsSL https://claude.ai/install.sh | bash >/dev/null 2>&1 || true
fi
if command -v npm >/dev/null 2>&1 && ! command -v agent-browser >/dev/null 2>&1; then
  (npm config set prefix "$HOME/.local" && npm install -g agent-browser@0.43.0 && agent-browser install) >/dev/null 2>&1 || true
fi
rm -f "$HOME"/.leitstand/tokens/*
${accounts.map((a) => `cat > "$HOME/.leitstand/tokens/${a.id}" <<'LEITSTAND_EOF'\n${secrets.accounts[a.id]}\nLEITSTAND_EOF`).join('\n')}
chmod 600 "$HOME"/.leitstand/tokens/* 2>/dev/null || true
cat > "$HOME/.local/bin/leitstand" <<'LEITSTAND_EOF'
${cli}
LEITSTAND_EOF
chmod +x "$HOME/.local/bin/leitstand"
mem=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || true)
[ -n "$mem" ] || mem=$(( $(sysctl -n hw.memsize) / 1048576 ))
cpus=$(nproc 2>/dev/null || sysctl -n hw.ncpu)
echo "__INFO__ $(uname -m) $cpus $mem $(uname -s) $(claude --version 2>/dev/null | head -1)"
`;
}

// Faustregel für parallele Agenten: 1,2 GB je Agent. Ein wartender Agent braucht rund
// 200 MB, der Rest ist Platz für Tests und Builds. Der Wert lässt sich je Maschine ändern.
export const agentSlots = (memMb) => Math.min(60, Math.max(1, Math.floor(memMb / 1200)));

// Richtet eine entfernte Maschine ein: Claude Code, Abo-Tokens, das Kommando `leitstand`.
// Lässt sich beliebig oft wiederholen und dient auch als Verbindungstest.
// Je Maschine läuft immer nur eine Einrichtung. Kommt währenddessen eine weitere Anfrage
// (etwa weil ein Abo-Konto dazukam), läuft sie danach noch einmal mit dem neuen Stand.
const setups = new Map(); // machineId -> { again, promise }

export function setupMachine(machine) {
  if (machine.kind === 'local') return Promise.resolve(machine);
  const current = setups.get(machine.id);
  if (current) {
    current.again = true;
    return current.promise;
  }
  const entry = { again: false, promise: null };
  entry.promise = (async () => {
    try {
      do {
        entry.again = false;
        await runSetup(machine);
      } while (entry.again && findMachine(machine.id));
    } finally {
      setups.delete(machine.id);
    }
    return machine;
  })();
  setups.set(machine.id, entry);
  return entry.promise;
}

async function runSetup(machine) {
  machine.error = null;

  // Frischer Server mit root-Zugang: erst die Ersteinrichtung, danach arbeitet der
  // Leitstand nur noch als Nutzer „agent“.
  if (machine.user === 'root') {
    machine.status = 'Server wird eingerichtet';
    changed('fleet');
    const boot = await sshExec(machine, BOOTSTRAP, 20 * 60_000);
    if (!findMachine(machine.id)) return machine;
    if (!boot.stdout.includes('__BOOTSTRAP_DONE__')) {
      machine.status = 'fehler';
      machine.error = (boot.stderr.trim().split('\n').filter((l) => !l.startsWith('+')).pop() || 'Die Ersteinrichtung als root ist fehlgeschlagen.').slice(0, 300);
      changed('fleet');
      return machine;
    }
    machine.user = 'agent';
  }

  machine.status = 'wird eingerichtet';
  changed('fleet');

  const script = setupScript();
  const result = await sshExec(machine, script);
  const info = result.stdout.match(/__INFO__ (\S+) (\d+) (\d+) (\S+) ?(.*)/);
  if (!findMachine(machine.id)) return machine; // inzwischen gelöscht
  if (result.code !== 0 || !info) {
    machine.status = 'fehler';
    machine.error = (result.stderr.trim().split('\n').pop() || `Verbindung fehlgeschlagen (Code ${result.code})`).slice(0, 300);
  } else if (!info[5]) {
    machine.status = 'fehler';
    machine.error = 'Claude Code ließ sich dort nicht installieren.';
  } else {
    machine.status = 'bereit';
    machine.info = { arch: info[1], cpus: Number(info[2]), memMb: Number(info[3]), os: info[4].toLowerCase(), claude: info[5].trim() };
    if (!machine.slotsManual) machine.slots = agentSlots(Number(info[3]));
    ensureTunnel(machine);
  }
  changed('fleet');
  pump();
  return machine;
}

export function pushTokens() {
  for (const machine of state.machines) {
    if (machine.kind === 'ssh' && (machine.status === 'bereit' || setups.has(machine.id))) setupMachine(machine);
  }
}

// Rückkanal: Agenten auf entfernten Maschinen erreichen über einen SSH-Tunnel den Port
// für das Kommando `leitstand`, und nur den. Der Leitstand steht nie offen im Netz, und
// die Steuerung der Oberfläche ist von den Servern aus nicht erreichbar.
function ensureTunnel(machine) {
  if (machine.kind !== 'ssh' || tunnels.has(machine.id)) return;
  const child = spawn(
    'ssh',
    ['-N', '-o', 'ExitOnForwardFailure=yes', '-R', `127.0.0.1:${TUNNEL_PORT}:127.0.0.1:${AGENT_PORT}`, ...sshArgs(machine)],
    { stdio: 'ignore' },
  );
  tunnels.set(machine.id, child);
  child.on('error', () => {});
  child.on('close', () => {
    tunnels.delete(machine.id);
    setTimeout(() => {
      const current = findMachine(machine.id);
      if (current?.status === 'bereit') ensureTunnel(current);
    }, 10_000).unref();
  });
}

// ---------- Konten ----------

function utilization(account) {
  return account.limits?.five_hour?.utilization || 0;
}

function pickAccount(machine) {
  let candidates;
  if (machine.accountId && machine.accountId !== 'auto') {
    candidates = [findAccount(machine.accountId)];
  } else {
    const withToken = state.accounts.filter((a) => !a.builtin && secrets.accounts[a.id]);
    // Ohne hinterlegtes Token bleibt nur die Anmeldung, die auf der Maschine selbst besteht.
    const ownLogin = machine.kind === 'local' && process.env.LEITSTAND_NO_LOCAL_LOGIN !== '1';
    candidates = ownLogin || !withToken.length ? [...withToken, findAccount('lokal')] : withToken;
  }
  const load = (account) => [...running.values()].filter((r) => r.accountId === account.id).length;
  return candidates
    .filter((a) => a && !(a.limitedUntil > Date.now()))
    .sort((a, b) => utilization(a) - utilization(b) || load(a) - load(b))[0];
}

// ---------- Warteschlange ----------

export function addMessage(chat, role, text, extra = {}) {
  chat.messages.push({ id: id(), role, text, ts: Date.now(), ...extra });
}

export function newChat(project, title, extra = {}) {
  const chat = {
    id: id(),
    projectId: project.id,
    title: String(title).trim().slice(0, 80) || 'Auftrag',
    sessionId: null,
    status: 'idle',
    attention: null,
    snoozeUntil: null,
    crew: 0,
    activity: null,
    pending: [],
    messages: [],
    createdAt: Date.now(),
    ...extra,
  };
  state.chats.push(chat);
  return chat;
}

function enqueue(chat, text) {
  // Hatte ein pausierter oder gestoppter Lauf noch eine Nachricht offen, geht sie mit.
  if (chat.held) text = `${text}\n\nDiese Nachricht war beim Anhalten noch offen:\n\n${chat.held}`;
  chat.held = null;
  chat.paused = null;
  chat.stopped = null;
  chat.waitingFor = null;
  chat.queued = { text, at: Date.now(), reason: '' };
  chat.status = 'queued';
  chat.attention = null;
  chat.snoozeUntil = null;
  chatChanged(chat);
  pump();
}

// Ein Lauf hält seine Eingabe offen (stream-json). Nachrichten des Menschen und anderer Agenten
// gehen sofort hinein; Claude Code nimmt sie beim nächsten Schritt auf, nicht erst am Ende.
// Jede angenommene Nachricht meldet Claude Code zurück (--replay-user-messages). Erst wenn alle
// angenommen sind und ein Zug endet, schließt der Leitstand die Eingabe, und der Lauf ist fertig.
function deliver(run, text) {
  if (!run.inputOpen) return false;
  try {
    run.child.stdin.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`);
  } catch {
    return false;
  }
  run.unacked += 1;
  return true;
}

function closeInput(run) {
  if (!run.inputOpen) return;
  run.inputOpen = false;
  try {
    run.child.stdin.end();
  } catch {}
}

// „Unterbrechen“: bricht den laufenden Schritt ab, die Sitzung bleibt. Eine mitgeschickte
// Nachricht bearbeitet der Agent direkt danach.
export function interruptRun(chat, text = '') {
  const run = running.get(chat.id);
  if (!run?.inputOpen) throw httpError(409, 'Der Agent läuft gerade nicht.');
  run.interrupted = true;
  run.child.stdin.write(`${JSON.stringify({ type: 'control_request', request_id: `int-${Date.now()}`, request: { subtype: 'interrupt' } })}\n`);
  addMessage(chat, 'system', 'Unterbrochen.');
  if (text.trim()) sendMessage(chat, text.trim());
  else chatChanged(chat);
}

// `text` geht an den Agenten, `shown` steht im Chat.
export function sendMessage(chat, text, shown = text) {
  addMessage(chat, 'user', shown);
  const run = running.get(chat.id);
  if (run && deliver(run, text)) {
    chatChanged(chat);
  } else if (run) {
    // Der Lauf schließt gerade ab: Die Nachricht startet gleich danach einen neuen.
    chat.pending = [...(chat.pending || []), text];
    chatChanged(chat);
  } else if (chat.status === 'queued' && chat.queued) {
    chat.queued.text += `\n\n${text}`;
    chatChanged(chat);
  } else {
    enqueue(chat, text);
  }
}

function setWaitReason(chat, reason) {
  if (chat.queued.reason === reason) return;
  chat.queued.reason = reason;
  chatChanged(chat);
}

export function pump() {
  const waiting = state.chats
    .filter((c) => c.status === 'queued' && c.queued && !running.has(c.id))
    .sort((a, b) => a.queued.at - b.queued.at);
  for (const chat of waiting) {
    const project = findProject(chat.projectId);
    const machine = project && findMachine(project.machineId);
    if (!machine) {
      chat.queued = null;
      finishRun(chat, { kind: 'fehler', kurz: 'Das Projekt oder seine Maschine gibt es nicht mehr.' });
    } else if (machine.status !== 'bereit') {
      setWaitReason(chat, `Maschine „${machine.name}“ ist nicht bereit`);
    } else if (runningCount(machine.id) >= machine.slots) {
      setWaitReason(chat, `wartet auf einen freien Platz auf „${machine.name}“`);
    } else {
      const account = pickAccount(machine);
      if (!account) setWaitReason(chat, 'alle Abo-Konten sind am Limit');
      else startRun(chat, project, machine, account);
    }
  }
}
setInterval(pump, 15_000).unref();

// ---------- Ein Lauf ----------

function startRun(chat, project, machine, account) {
  // Ein Hinweis des Leitstands (etwa neue Pfade nach einem Umzug) geht einmal mit.
  const text = chat.note ? `${chat.note}\n\n${chat.queued.text}` : chat.queued.text;
  chat.note = null;
  const token = crypto.randomBytes(24).toString('hex');
  const local = machine.kind === 'local';

  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--replay-user-messages',
    '--verbose',
    '--setting-sources', 'project,local',
    '--append-system-prompt', leadPrompt(project, machine),
  ];
  if (chat.sessionId) args.push('--resume', chat.sessionId);
  if (project.model) args.push('--model', project.model);
  if (project.effort) args.push('--effort', project.effort);
  // Der Browser ist auf jeder Maschine das Kommando `agent-browser`, ein eigener je Chat.
  // Braucht der Agent einen Klick des Menschen, zeigt der Leitstand diesen Browser live im Chat.
  // Computer Use (nur auf Macs): Peekaboo als MCP-Server. Die Rechte für Bildschirm und
  // Bedienung kommen von der Peekaboo-App auf dem Mac (Bridge), nicht von der SSH-Sitzung.
  if (project.computerUse) {
    // Fest auf die Bridge der App: Sonst startet Peekaboo für Aufnahmen einen eigenen Dienst,
    // der unter SSH keine Rechte hat.
    const peekaboo = 'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; exec npx -y @steipete/peekaboo@4.9.8 mcp --bridge-socket "$HOME/Library/Application Support/Peekaboo/bridge.sock"';
    args.push('--mcp-config', JSON.stringify({ mcpServers: { peekaboo: { command: '/bin/sh', args: ['-c', peekaboo] } } }));
  }
  if (project.mode === 'autonom') {
    args.push('--dangerously-skip-permissions');
  } else {
    // Immer frei: das eigene Kommando, Lesen im Web, der eigene Browser. Dafür soll nie
    // ein Mensch gefragt werden.
    const allowed = [
      'Bash(leitstand *)', 'Bash(echo *)', 'Bash(printf *)', 'WebSearch', 'WebFetch',
      ...(project.browser ? ['Bash(agent-browser *)'] : []),
      ...(project.computerUse ? ['mcp__peekaboo'] : []),
      ...(project.allow || []),
    ];
    // „selbststaendig“: Claude Code entscheidet Alltägliches selbst und blockt nur, was seine
    // Sicherheitsprüfung für riskant hält. „vorsichtig“: alles außer Dateiänderungen wird vorgelegt.
    const mode = project.mode === 'vorsichtig' ? 'acceptEdits' : 'auto';
    args.push('--permission-mode', mode, `--allowedTools=${[...new Set(allowed)].join(',')}`);
  }

  let child;
  try {
    if (local) {
      // Claude Code lädt die persönliche ~/.claude/CLAUDE.md auch mit --setting-sources project,
      // sobald der Projektordner unter dem Home-Ordner liegt. Agenten bekommen sie nur,
      // wenn das Projekt es ausdrücklich erlaubt.
      if (!project.personal) {
        args.push('--settings', JSON.stringify({ claudeMdExcludes: [path.join(os.homedir(), '.claude', 'CLAUDE.md')] }));
      }
      args.push('--add-dir', CONTEXT_DIR);
      const env = {
        ...process.env,
        PATH: `${path.join(ROOT, 'bin')}:${process.env.PATH}`,
        LEITSTAND_URL: `http://127.0.0.1:${AGENT_PORT}`,
        LEITSTAND_RUN: token,
        // Kommando `agent-browser`: ein eigener Browser je Chat, damit parallele Agenten
        // sich nicht in die Quere kommen.
        AGENT_BROWSER_SESSION: `chat-${chat.id}`,
        ...(process.platform === 'linux' ? { AGENT_BROWSER_ARGS: '--no-sandbox' } : {}),
      };
      // Agenten laufen immer über ein Claude-Abo, nie über einen API-Schlüssel mit Abrechnung
      // nach Verbrauch. Ein gesetzter Schlüssel hätte sonst Vorrang vor dem Abo.
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;
      if (account.id !== 'lokal') env.CLAUDE_CODE_OAUTH_TOKEN = secrets.accounts[account.id];
      fs.mkdirSync(project.dir, { recursive: true });
      child = spawn(CLAUDE_BIN, args, { cwd: project.dir, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      const command = remoteCommand({ dir: project.dir, token, accountId: account.id, args, session: `chat-${chat.id}`, os: machine.info?.os });
      child = spawn('ssh', [...sshArgs(machine), command], { stdio: ['pipe', 'pipe', 'pipe'] });
    }
  } catch (err) {
    chat.queued = null;
    finishRun(chat, { kind: 'fehler', kurz: `Agent konnte nicht starten: ${err.message}` });
    return;
  }

  const run = { child, machineId: machine.id, accountId: account.id, token, remotePid: null, limited: false, inputOpen: true, unacked: 0, interrupted: false };
  running.set(chat.id, run);
  runTokens.set(token, chat.id);
  chat.queued = null;
  chat.status = 'running';
  chat.attention = null;
  chat.handoff = null;
  chat.crew = 0;
  chat.activity = 'Startet …';
  chat.machineId = machine.id;
  chat.accountId = account.id;
  chatChanged(chat);
  changed('fleet');

  const openTasks = new Set();
  let lastAgentText = '';
  let result = null;
  let stderr = '';
  let buffer = '';

  child.stdin.on('error', () => {
    run.inputOpen = false;
  });
  deliver(run, text);
  child.stderr.on('data', (chunk) => {
    const pid = String(chunk).match(/__PID__(\d+)/);
    if (pid) run.remotePid = pid[1];
    stderr = (stderr + chunk).slice(-2000);
  });
  child.on('error', (err) => {
    stderr += `\n${err.message}`;
  });

  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        handleEvent(JSON.parse(line));
      } catch {
        // Zeilen, die kein JSON sind (etwa Meldungen der Login-Shell), überspringen
      }
    }
  });

  function handleEvent(event) {
    if (event.type === 'system' && event.subtype === 'init') {
      chat.sessionId = event.session_id;
      save();
    } else if (event.type === 'rate_limit_event') {
      const info = event.rate_limit_info || {};
      if (info.unifiedWindows) account.limits = { ...info.unifiedWindows, at: Date.now() };
      if (info.status && !String(info.status).startsWith('allowed')) {
        account.limitedUntil = info.resetsAt ? info.resetsAt * 1000 : Date.now() + 15 * 60_000;
        run.limited = true;
      }
      changed('fleet');
    } else if (event.type === 'assistant') {
      const fromSubagent = Boolean(event.parent_tool_use_id);
      for (const block of event.message?.content || []) {
        if (block.type === 'text' && block.text.trim() && !fromSubagent) {
          lastAgentText = block.text;
          const parsed = parseStatus(block.text);
          if (parsed.text) addMessage(chat, 'agent', parsed.text);
        } else if (block.type === 'tool_use') {
          if (block.name === 'Task' || block.name === 'Agent') openTasks.add(block.id);
          chat.activity = toolLabel(block);
          if (!fromSubagent) addMessage(chat, 'tool', chat.activity);
        }
      }
      chat.crew = openTasks.size;
      chatChanged(chat);
    } else if (event.type === 'user') {
      if (event.isReplay) {
        run.unacked = Math.max(0, run.unacked - 1);
        return;
      }
      const content = event.message?.content;
      if (!Array.isArray(content)) return;
      for (const block of content) {
        if (block.type === 'tool_result') openTasks.delete(block.tool_use_id);
      }
      if (chat.crew !== openTasks.size) {
        chat.crew = openTasks.size;
        chatChanged(chat);
      }
    } else if (event.type === 'result') {
      // Ein abgebrochener Schritt nach „Unterbrechen“ ist kein Fehler: Es geht mit der Nachricht weiter.
      if (run.interrupted && event.subtype === 'error_during_execution') {
        run.interrupted = false;
        if (run.unacked === 0) {
          result = { ...event, subtype: 'success', is_error: false, interruptedOnly: true };
          closeInput(run);
        }
        return;
      }
      result = event;
      // Zug zu Ende und keine Nachricht mehr offen: Eingabe schließen, der Lauf endet.
      if (run.unacked === 0) closeInput(run);
    }
  }

  child.on('close', (code) => {
    if (running.get(chat.id) !== run) return; // gestoppt, schon abgeschlossen
    if (result?.total_cost_usd) chat.cost = (chat.cost || 0) + result.total_cost_usd;

    if (result?.interruptedOnly) {
      finishRun(chat, { kind: 'antwort', kurz: 'Du hast den Agenten unterbrochen. Schreib ihm, wie es weitergehen soll.' });
      return;
    }
    const failed = !result || result.is_error || result.subtype !== 'success';
    const errorText = result
      ? String(result.result || result.subtype || 'Unbekannter Fehler')
      : stderr.replace(/__PID__\d+\s*/, '').trim().split('\n').slice(-3).join(' ') || `Exit-Code ${code}`;

    if (failed && (run.limited || /hit your (session|weekly) limit|usage limit reached/i.test(errorText))) {
      // Abo-Limit: Konto sperren, Auftrag zurück in die Warteschlange. Ein anderes Konto
      // übernimmt, oder es geht weiter, sobald das Limit zurückgesetzt ist.
      if (!(account.limitedUntil > Date.now())) {
        const reset = account.limits?.five_hour?.resetsAt;
        account.limitedUntil = reset && reset * 1000 > Date.now() ? reset * 1000 : Date.now() + 15 * 60_000;
      }
      releaseRun(chat, run);
      addMessage(chat, 'system', `Abo-Limit bei „${account.name}“ erreicht. Der Auftrag läuft weiter, sobald ein Konto frei ist.`);
      enqueue(chat, `Dein letzter Lauf wurde durch ein Abo-Limit unterbrochen. Prüf kurz den Stand und mach dort weiter. Die Nachricht, an der du gearbeitet hast:\n\n${text}`);
      changed('fleet');
      return;
    }
    if (failed && chat.sessionId && /no conversation found/i.test(`${errorText} ${stderr}`)) {
      // Die Vorgeschichte dieses Chats liegt auf dieser Maschine nicht vor: neu beginnen.
      releaseRun(chat, run);
      chat.sessionId = null;
      addMessage(chat, 'system', 'Die Vorgeschichte dieses Chats liegt auf dieser Maschine nicht vor. Der Agent beginnt neu und stützt sich auf die Dateien und den gemeinsamen Kontext.');
      enqueue(chat, text);
      changed('fleet');
      return;
    }
    if (failed) {
      finishRun(chat, { kind: 'fehler', kurz: `Der Agent ist abgebrochen: ${errorText}`.slice(0, 500) });
      return;
    }

    const { status } = parseStatus(lastAgentText || String(result.result || ''));
    const kind = ['fertig', 'entscheidung', 'blockiert', 'wartet'].find((k) => status?.zustand?.toLowerCase().startsWith(k));
    const attention = {
      kind: kind || 'antwort',
      kurz: status?.kurz || 'Der Agent hat geantwortet.',
      frage: status?.frage,
      optionen: status?.optionen ? status.optionen.split('|').map((o) => o.trim()).filter(Boolean) : [],
      naechster_schritt: status?.naechster_schritt,
    };
    // Verweigerte Schritte: Hat der Agent sein Ziel trotzdem erreicht, sind sie erledigt und
    // kosten den Menschen keinen Klick. Nur wenn er nicht fertig geworden ist, kommen sie mit
    // auf den Tisch, zusammen mit seiner eigentlichen Frage.
    const seen = new Set();
    const requests = (result.permission_denials || [])
      .map((denial) => ({
        tool: denial.tool_name,
        detail: String(denial.tool_input?.command || denial.tool_input?.url || denial.tool_input?.file_path || denial.tool_input?.query || ''),
        patterns: denialPatterns(denial),
      }))
      .filter((r) => !seen.has(r.tool + r.detail) && seen.add(r.tool + r.detail));
    if (requests.length && kind !== 'fertig') {
      attention.requests = requests;
      if (!kind) {
        attention.kind = 'erlaubnis';
        attention.kurz = status?.kurz || 'Der Agent kommt ohne eine Erlaubnis nicht weiter.';
      }
    }
    // Übergabe: Der Mensch erledigt einen Schritt im eigenen Browser, etwa eine Kasse mit Captcha.
    if (chat.handoff && attention.kind !== 'fertig') {
      attention.kind = 'uebergabe';
      attention.frage = chat.handoff.text;
      attention.url = chat.handoff.url;
    }
    chat.handoff = null;
    finishRun(chat, attention);
  });
}

// „Kurz gebraucht“: Der Agent läuft weiter und braucht genau einen Handgriff des Menschen,
// etwa einen Klick im sichtbaren Browserfenster. Das steht ganz oben in der Warteschlange,
// dazu kommt eine Mitteilung des Betriebssystems.
export function requestAssist(chat, text) {
  chat.assist = text ? { text: String(text).slice(0, 300), since: Date.now() } : null;
  chatChanged(chat);
  if (text && process.platform === 'darwin') {
    spawn('osascript', ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title "Leitstand: kurz gebraucht" sound name "Glass"', '-e', 'end run', chat.assist.text], { stdio: 'ignore' }).on('error', () => {});
  }
}

// ---------- Browser live im Chat ----------
// Jeder Chat hat seinen eigenen `agent-browser`. Dessen Bild gibt es als WebSocket-Stream, der
// nur auf der Maschine selbst erreichbar ist (127.0.0.1). Der Leitstand reicht ihn an die
// Oberfläche weiter, bei entfernten Maschinen über eine SSH-Weiterleitung.

const streams = new Map(); // chatId -> { port, remotePort, forward } für entfernte Maschinen

function streamPortOf(output) {
  try {
    const data = JSON.parse(String(output).trim().split('\n').pop());
    return Number((data.data || data).port) || null;
  } catch {
    return null;
  }
}

function agentBrowserLocal(chat, args) {
  const env = {
    ...process.env,
    PATH: `${path.join(os.homedir(), '.local', 'bin')}:${process.env.PATH}`,
    AGENT_BROWSER_SESSION: `chat-${chat.id}`,
    ...(process.platform === 'linux' ? { AGENT_BROWSER_ARGS: '--no-sandbox' } : {}),
  };
  return new Promise((resolve) => {
    execFile('agent-browser', args, { env, timeout: 20_000 }, (err, stdout) => resolve(err ? '' : stdout));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForPort(port, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const open = await new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
    if (open) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function closeStream(chatId) {
  const stream = streams.get(chatId);
  if (!stream) return;
  streams.delete(chatId);
  stream.forward.kill();
}

// Port auf diesem Rechner, unter dem der Stream des Chat-Browsers erreichbar ist.
export async function browserStream(chat) {
  const project = findProject(chat.projectId);
  if (!project?.browser) throw httpError(404, 'Dieses Projekt hat keinen Browser.');
  const machine = findMachine(chat.machineId || project.machineId);
  if (!machine) throw httpError(404, 'Die Maschine dieses Chats gibt es nicht mehr.');
  const closed = httpError(404, 'Der Browser dieses Agenten ist gerade nicht offen.');

  if (machine.kind === 'local') {
    let port = streamPortOf(await agentBrowserLocal(chat, ['stream', 'status', '--json']));
    if (!port) {
      await agentBrowserLocal(chat, ['stream', 'enable']);
      port = streamPortOf(await agentBrowserLocal(chat, ['stream', 'status', '--json']));
    }
    if (!port) throw closed;
    return port;
  }

  const linux = (machine.info?.os || 'linux') === 'linux';
  const result = await sshExec(machine, [
    `export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" AGENT_BROWSER_SESSION=chat-${chat.id}${linux ? ' AGENT_BROWSER_ARGS=--no-sandbox' : ''}`,
    `agent-browser stream status --json 2>/dev/null | grep -q '"port":[0-9]' || agent-browser stream enable >/dev/null 2>&1`,
    'agent-browser stream status --json',
  ].join('\n'), 30_000);
  const remotePort = streamPortOf(result.stdout);
  if (!remotePort) throw closed;
  const known = streams.get(chat.id);
  if (known && known.remotePort === remotePort && known.forward.exitCode === null) return known.port;

  closeStream(chat.id);
  const port = await freePort();
  const forward = spawn('ssh', ['-N', '-o', 'ExitOnForwardFailure=yes', '-L', `127.0.0.1:${port}:127.0.0.1:${remotePort}`, ...sshArgs(machine)], { stdio: 'ignore' });
  forward.on('error', () => {});
  forward.on('close', () => {
    if (streams.get(chat.id)?.forward === forward) streams.delete(chat.id);
  });
  streams.set(chat.id, { port, remotePort, forward });
  if (!(await waitForPort(port, 8000))) {
    closeStream(chat.id);
    throw httpError(502, 'Die Verbindung zum Browser auf der Maschine ließ sich nicht aufbauen.');
  }
  return port;
}

function releaseRun(chat, run) {
  running.delete(chat.id);
  closeStream(chat.id);
  if (run) runTokens.delete(run.token);
  if (run && findMachine(run.machineId)?.kind === 'local' && findProject(chat.projectId)?.browser) {
    // Der Browser dieses Chats bleibt sonst offen und belegt Speicher.
    spawn('agent-browser', ['close'], { stdio: 'ignore', env: { ...process.env, AGENT_BROWSER_SESSION: `chat-${chat.id}` } }).on('error', () => {});
  }
  chat.crew = 0;
  chat.activity = null;
  chat.assist = null;
  chat.progress = null;
}

// ---------- Teilaufträge ----------
// Ein Lead-Agent kann Teile eines großen Auftrags an eigene Agenten vergeben. Die laufen als
// eigene Chats parallel, und ihr Ergebnis geht als Nachricht an ihn zurück, nicht an den Menschen.

const MAX_OPEN_CHILDREN = 8;
const MAX_CHILDREN = 24;
export const childrenOf = (chat) => state.chats.filter((c) => c.parentId === chat.id);
const isOpen = (chat) => chat.status === 'running' || chat.status === 'queued';

// Auftrag an den Laptop: ein Teilauftrag im Laptop-Projekt. Sein Ergebnis kommt wie bei jedem
// Teilauftrag als Nachricht zurück, Entscheidungen gehen an den Menschen.
export function orderLaptop(parent, title, text) {
  const laptop = state.projects.find((p) => p.laptop);
  if (!laptop) throw httpError(404, 'Es gibt kein Laptop-Projekt. Der Mensch richtet es im Reiter „Projekte“ ein.');
  if (laptop.id === parent.projectId) throw httpError(400, 'Du arbeitest selbst auf dem Laptop. Erledige es direkt.');
  const open = state.chats.filter((c) => c.projectId === laptop.id && c.parentId === parent.id && isOpen(c));
  if (open.length >= 3) throw httpError(429, 'Es laufen schon drei Laptop-Aufträge aus diesem Chat. Warte auf ihre Ergebnisse.');
  const child = newChat(laptop, title, { parentId: parent.id });
  const from = findProject(parent.projectId);
  sendMessage(
    child,
    `Auftrag für den Laptop vom Agenten im Projekt „${from?.name || '?'}“ (Chat „${parent.title}“). Er arbeitet auf einem Server und braucht dafür den Mac des Menschen: seine Anmeldungen, seine Programme, seinen Internetanschluss. Dein Ergebnis geht direkt an ihn zurück; deine letzte Antwort muss für sich stehen (was erledigt ist, Ergebnisse, Daten, offene Punkte). Was Geld kostet, im Namen des Menschen nach außen geht oder sich nicht rückgängig machen lässt, legst du dem Menschen als Entscheidung vor.\n\nAuftrag „${title}“:\n${text}`,
    text,
  );
  return child;
}

export function spawnChild(parent, title, text) {
  if (parent.parentId) throw httpError(403, 'Ein Teilauftrag kann keine weiteren Teilaufträge vergeben. Erledige die Arbeit selbst oder mit Unter-Agenten.');
  const children = childrenOf(parent);
  if (children.filter(isOpen).length >= MAX_OPEN_CHILDREN) throw httpError(429, `Es laufen schon ${MAX_OPEN_CHILDREN} Teilaufträge. Warte auf Ergebnisse, bevor du weitere vergibst.`);
  if (children.length >= MAX_CHILDREN) throw httpError(429, 'Für diesen Auftrag sind schon sehr viele Teilaufträge vergeben. Mach mit den vorhandenen Ergebnissen weiter.');
  const project = findProject(parent.projectId);
  const child = newChat(project, title, { parentId: parent.id });
  sendMessage(
    child,
    `Du bearbeitest einen Teilauftrag aus dem größeren Auftrag „${parent.title}“. Dein Auftraggeber ist der Lead-Agent dieses Auftrags, nicht der Mensch: Dein Ergebnis geht direkt an ihn zurück. Er kennt deinen Chat nicht, also muss deine letzte Antwort für sich stehen und alles enthalten, was er zum Weiterarbeiten braucht (Ergebnis, Pfade der Dateien, offene Punkte).\n\nTeilauftrag „${title}“:\n${text}`,
    text,
  );
  return child;
}

// Ergebnis eines Teilauftrags zurück an den Auftraggeber. Gibt true zurück, wenn der Mensch
// damit nichts mehr zu tun hat.
function reportToParent(chat, attention) {
  const parent = chat.parentId && findChat(chat.parentId);
  if (!parent || parent.status === 'archived') return false;
  if (!['fertig', 'antwort'].includes(attention.kind)) return false; // echte Entscheidungen gehen an den Menschen
  const last = [...chat.messages].reverse().find((m) => m.role === 'agent');
  chat.status = 'done';
  chat.attention = null;
  chatChanged(chat);
  sendMessage(
    parent,
    `Ergebnis des Teilauftrags „${chat.title}“:\n\n${last?.text || attention.kurz}`,
    `Teilauftrag fertig: ${chat.title}`,
  );
  return true;
}

function finishRun(chat, attention) {
  releaseRun(chat, running.get(chat.id));
  if (attention.kind === 'fehler') addMessage(chat, 'system', attention.kurz);
  for (const hook of attentionHooks) attention = hook(chat, attention) || attention;

  // Der Agent wartet auf seine Teilaufträge: kein Fall für den Menschen. Läuft keiner mehr,
  // ist das Warten ein Irrtum und wird wie eine normale Antwort behandelt.
  if (attention.kind === 'wartet') {
    if (childrenOf(chat).some((c) => isOpen(c) || c.paused?.until) || chat.pending?.length) attention.waiting = true;
    else attention.kind = 'antwort';
  }

  // Nachrichten, die während des Laufs kamen, gehen direkt weiter.
  if (chat.pending?.length && attention.kind !== 'fehler') {
    const next = chat.pending.join('\n\n');
    chat.pending = [];
    enqueue(chat, next);
  } else if (attention.waiting) {
    chat.pending = [];
    chat.status = 'waiting';
    chat.attention = null;
    chat.waitingFor = attention.kurz;
    chatChanged(chat);
  } else if (!reportToParent(chat, attention)) {
    chat.pending = [];
    chat.status = 'attention';
    chat.attention = { ...attention, since: Date.now() };
    chatChanged(chat);
  }
  changed('fleet');
  pump();
}

function killRun(chat, run) {
  if (!run) return;
  const machine = findMachine(run.machineId);
  if (machine?.kind === 'ssh' && run.remotePid) {
    spawn('ssh', [...sshArgs(machine), `kill -TERM ${run.remotePid}`], { stdio: 'ignore' }).on('error', () => {});
  }
  run.child.kill('SIGTERM');
}

// Was der Agent noch nicht bekommen hat (Warteschlange, Nachrichten während des Laufs).
const heldText = (chat) => [chat.held, chat.queued?.text, ...(chat.pending || [])].filter(Boolean).join('\n\n') || null;

// by: 'mensch' (Knopf in der Oberfläche), 'auftrag' (mit dem übergeordneten Auftrag), 'lead' (vom Lead-Agenten)
export function stopRun(chat, note = 'Lauf gestoppt.', { byParent = false, by = byParent ? 'auftrag' : 'mensch', withId = null } = {}) {
  const run = running.get(chat.id);
  const openChildren = childrenOf(chat).filter((c) => isOpen(c) || c.status === 'waiting');
  if (!run && chat.status !== 'queued' && chat.status !== 'waiting' && !openChildren.length) return;
  // Wer einen Auftrag stoppt, stoppt auch seine laufenden, wartenden und pausierten Teilaufträge.
  for (const child of openChildren) {
    stopRun(child, `Gestoppt, weil der Auftrag „${chat.title}“ gestoppt wurde.`, { byParent: true, withId: chat.id });
  }
  killRun(chat, run);
  releaseRun(chat, run);
  chat.held = heldText(chat);
  chat.queued = null;
  chat.pending = [];
  chat.waitingFor = null;
  chat.paused = null;
  chat.stopped = { since: Date.now(), by, withId };
  // Mitgestoppte Teilaufträge landen nicht einzeln beim Menschen, sie gelten als erledigt.
  chat.status = byParent ? 'done' : 'attention';
  chat.attention = byParent ? null : {
    kind: 'antwort',
    kurz: openChildren.length ? `Du hast den Lauf gestoppt, mit ${openChildren.length === 1 ? 'einem Teilauftrag' : `${openChildren.length} Teilaufträgen`}.` : 'Du hast den Lauf gestoppt.',
    since: Date.now(),
  };
  addMessage(chat, 'system', openChildren.length ? `${note} Mitgestoppt: ${openChildren.map((c) => `„${c.title}“`).join(', ')}.` : note);
  chatChanged(chat);
  if (by === 'mensch' && chat.parentId) tellParentStopped(chat, 'Der Mensch hat ihn gestoppt.');
  changed('fleet');
  pump();
}

// ---------- Teilaufträge steuern: Lead-Agenten stoppen, pausieren und setzen fort ----------

const RESUME_CHILD = 'Dein Lauf war angehalten und geht jetzt weiter. Prüf kurz den Stand (Dateien, deinen Browser mit `agent-browser get url`, falls du einen offen hattest) und mach dort weiter, wo du warst. Wiederhol nichts, was schon erledigt ist, vor allem keine Zahlungen, Käufe oder Nachrichten nach außen.';

// Der Lead erfährt, dass ein Teilauftrag nicht mehr läuft. Geweckt wird er nur, wenn er sonst
// für immer warten würde; sonst bekommt er es mit seiner nächsten Nachricht.
function tellParentStopped(chat, why) {
  const parent = chat.parentId && findChat(chat.parentId);
  if (!parent || parent.status === 'archived' || parent.stopped) return;
  const text = `Der Teilauftrag „${chat.title}“ [${chat.id}] läuft nicht mehr: ${why} Vergib ihn nicht neu, das kostet die Arbeit doppelt. Fortsetzen mit seiner Vorgeschichte geht mit \`leitstand auftraege weiter ${chat.id}\`, aber nur, wenn der Mensch das will; frag ihn dann mit zustand: entscheidung. Sonst mach mit den vorhandenen Ergebnissen weiter.`;
  const stillOpen = childrenOf(parent).some((c) => c.id !== chat.id && (isOpen(c) || c.paused?.until));
  if (running.has(parent.id) || parent.status === 'queued' || (parent.status === 'waiting' && !stillOpen)) {
    sendMessage(parent, text, `Teilauftrag angehalten: ${chat.title}`);
  } else {
    parent.note = parent.note ? `${parent.note}\n\n${text}` : text;
  }
}

export function stopChild(child, lead) {
  if (child.status === 'attention') {
    // Wartet auf den Menschen: nichts mehr zu stoppen, nur ablegen.
    child.held = heldText(child);
    child.status = 'done';
    child.attention = null;
    child.stopped = { since: Date.now(), by: 'lead', withId: null };
    addMessage(child, 'system', `Vom Lead-Agenten („${lead.title}“) beendet.`);
    chatChanged(child);
    changed('fleet');
    return true;
  }
  if (!isOpen(child) && child.status !== 'waiting') return false;
  stopRun(child, `Vom Lead-Agenten („${lead.title}“) gestoppt.`, { byParent: true, by: 'lead' });
  return true;
}

export function pauseChild(child, lead, until = null) {
  if (child.status === 'waiting' && child.paused) {
    child.paused.until = until;
    child.waitingFor = pausedLabel(until);
    chatChanged(child);
    return true;
  }
  if (!isOpen(child)) return false;
  const run = running.get(child.id);
  killRun(child, run);
  releaseRun(child, run);
  child.held = heldText(child);
  child.queued = null;
  child.pending = [];
  child.status = 'waiting';
  child.attention = null;
  child.paused = { since: Date.now(), until, by: lead.id };
  child.waitingFor = pausedLabel(until);
  addMessage(child, 'system', `Vom Lead-Agenten („${lead.title}“) pausiert${until ? `, geht ${fmtTime(until)} von selbst weiter` : ''}.`);
  chatChanged(child);
  changed('fleet');
  pump();
  return true;
}

const fmtTime = (ts) => new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const pausedLabel = (until) => `Pausiert vom Lead-Agenten${until ? `, geht ${fmtTime(until)} weiter` : ''}.`;

export const isResumable = (c) => (c.status === 'waiting' && c.paused) || (c.stopped && ['done', 'attention'].includes(c.status));

export function resumeChat(chat, shown) {
  if (!isResumable(chat)) return false;
  chat.attention = null;
  // Ohne Vorgeschichte beginnt der Agent mit der offenen Nachricht neu.
  const first = chat.messages.find((m) => m.role === 'user')?.text;
  const fresh = chat.held || (first && `Du bearbeitest diesen Auftrag (ein früherer Anlauf wurde abgebrochen; prüf zuerst, was davon schon in den Dateien steht):\n\n${first}`);
  const text = chat.sessionId || !fresh ? RESUME_CHILD : fresh;
  if (!chat.sessionId) chat.held = null;
  sendMessage(chat, text, shown);
  return true;
}

// Pausen mit Uhrzeit laufen von selbst ab.
setInterval(() => {
  const due = state.chats.filter((c) => c.status === 'waiting' && c.paused?.until && c.paused.until <= Date.now());
  for (const c of due) resumeChat(c, 'Pause vorbei, geht von selbst weiter.');
}, 30_000).unref();

// ---------- Abo-Kontingent für die Agenten ----------

// Ein Fenster, dessen Rücksetzzeit vorbei ist, steht wieder bei 0.
const windowUse = (w, now) => (!w ? null : w.resetsAt && w.resetsAt * 1000 <= now ? 0 : w.utilization || 0);

export function budget(chat) {
  const now = Date.now();
  const project = findProject(chat.projectId);
  const machine = findMachine(chat.machineId || project?.machineId);
  const withToken = state.accounts.filter((a) => !a.builtin && secrets.accounts[a.id]);
  let accounts = machine?.accountId && machine.accountId !== 'auto' ? [findAccount(machine.accountId)].filter(Boolean) : withToken;
  if (!accounts.length) accounts = state.accounts.filter((a) => a.id === 'lokal');
  const mine = running.get(chat.id)?.accountId;
  const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)} %`);
  const reset = (w) => (w?.resetsAt && w.resetsAt * 1000 > now ? `, frei ab ${fmtTime(w.resetsAt * 1000)}` : '');
  const rows = accounts.map((a) => {
    const l = a.limits || {};
    const five = windowUse(l.five_hour, now);
    const seven = windowUse(l.seven_day, now);
    const blocked = a.limitedUntil > now;
    const age = l.at ? Math.round((now - l.at) / 60_000) : null;
    return {
      a, five, seven, blocked,
      line: `- ${a.name}${a.id === mine ? ' (dein Lauf)' : ''}: 5 h ${pct(five)}${reset(l.five_hour)} · 7 Tage ${pct(seven)}${reset(l.seven_day)}${blocked ? ` · GESPERRT bis ${fmtTime(a.limitedUntil)}` : ''}${age != null ? ` · gemessen vor ${age} min` : ' · noch nicht gemessen'}`,
    };
  });
  // Neue Läufe gehen an das am wenigsten belastete freie Konto; danach richtet sich die Stufe.
  const free = rows.filter((r) => !r.blocked);
  const best = free.length ? Math.min(...free.map((r) => Math.max(r.five || 0, r.seven || 0))) : 1;
  const level = !free.length ? 'gesperrt' : best >= 0.95 ? 'sehr knapp' : best >= 0.8 ? 'knapp' : 'normal';
  const advice = {
    normal: 'Normal arbeiten.',
    knapp: 'Keine neuen Teilaufträge vergeben, Unter-Agenten sparsam einsetzen, laufende Teilaufträge zu Ende bringen lassen.',
    'sehr knapp': 'Eigene Teilaufträge bis zum Rücksetzen pausieren (`leitstand auftraege pause alle bis=reset`), nur noch Nötiges selbst erledigen und den Zug bald beenden.',
    gesperrt: 'Alle Konten am Limit: Neue Läufe warten in der Schlange, bis ein Konto frei ist. Teilaufträge pausieren (`leitstand auftraege pause alle bis=reset`).',
  }[level];
  const all = state.chats;
  const runningN = all.filter((c) => c.status === 'running').length;
  const queuedN = all.filter((c) => c.status === 'queued').length;
  const mineOpen = childrenOf(chat).filter(isOpen).length;
  return [
    `Kontingent: ${level.toUpperCase()}. ${advice}`,
    ...rows.map((r) => r.line),
    `Leitstand: ${runningN} laufen, ${queuedN} in der Schlange${machine ? `, ${machine.slots} Plätze auf „${machine.name}“` : ''}. Deine offenen Teilaufträge: ${mineOpen}.`,
  ].join('\n');
}

export function nextReset(chat) {
  const now = Date.now();
  const resets = state.accounts.filter((a) => !a.builtin && secrets.accounts[a.id]).map((a) => a.limits?.five_hour?.resetsAt * 1000).filter((t) => t > now);
  return resets.length ? Math.min(...resets) : null;
}

export function stopAll() {
  for (const run of running.values()) run.child.kill('SIGTERM');
  for (const tunnel of tunnels.values()) tunnel.kill();
  for (const chatId of [...streams.keys()]) closeStream(chatId);
}

// ---------- Start: Zustand nach einem Neustart aufräumen ----------
// Ein Lauf, den ein Neustart abgebrochen hat, geht mit seiner Vorgeschichte von selbst weiter.
// Nachrichten, die während des Laufs noch gewartet haben, gehen mit.

const RESUME = 'Der Leitstand wurde neu gestartet, dein letzter Lauf wurde dabei unterbrochen. Prüf kurz den Stand (Dateien, offene Teilaufträge, deinen Browser mit `agent-browser get url`, falls du einen offen hattest) und mach dort weiter, wo du warst. Wiederhol nichts, was schon erledigt ist, vor allem keine Zahlungen, Käufe oder Nachrichten nach außen. Hattest du auf den Menschen gewartet, frag erneut nach, und zwar so, wie deine Anweisungen es jetzt vorsehen (Captchas und Kassen mit Bot-Schutz per `leitstand uebergabe`).';

const abortedChildren = [];
for (const chat of state.chats) {
  if (chat.status !== 'running') continue;
  chat.crew = 0;
  chat.activity = null;
  chat.assist = null;
  if (chat.sessionId) {
    const pending = chat.pending || [];
    chat.pending = [];
    chat.status = 'queued';
    chat.attention = null;
    chat.queued = { text: [RESUME, ...pending].join('\n\n'), at: Date.now(), reason: '' };
    addMessage(chat, 'system', 'Der Leitstand wurde neu gestartet. Der Agent macht von selbst dort weiter, wo er war.');
  } else {
    chat.status = 'attention';
    chat.attention = {
      kind: 'fehler',
      kurz: 'Der Leitstand wurde neu gestartet, der Lauf wurde dabei abgebrochen.',
      since: Date.now(),
    };
    chat.stopped = { since: Date.now(), by: 'neustart', withId: null };
    if (chat.parentId) abortedChildren.push(chat);
  }
}
setTimeout(() => {
  for (const chat of abortedChildren) tellParentStopped(chat, 'Ein Neustart des Leitstands hat ihn abgebrochen, bevor er angefangen hatte.');
}, 400).unref();
for (const machine of state.machines) {
  // Einrichtungen, die ein Neustart unterbrochen hat, stößt „Prüfen“ wieder an.
  if (machine.kind === 'ssh' && !['bereit', 'fehler'].includes(machine.status)) machine.status = 'ungeprüft';
  if (machine.kind === 'ssh' && machine.status === 'bereit') ensureTunnel(machine);
}
setTimeout(pump, 500).unref();
