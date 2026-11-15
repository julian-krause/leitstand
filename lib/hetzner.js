// Hetzner Cloud: Server für die Flotte anlegen und wieder löschen.
import { execFile } from 'node:child_process';
import { state, secrets, KNOWN_HOSTS, changed, findMachine, httpError } from './store.js';
import { publicKey, addMachine, setupMachine, sshExec, agentSlots } from './runs.js';
import { BOOTSTRAP, READY_FLAG } from './bootstrap.js';

const API = 'https://api.hetzner.cloud/v1';
const IMAGE = 'ubuntu-24.04';
const KEY_NAME = 'leitstand';

async function hetzner(method, path, body) {
  if (!secrets.hetzner.token) throw httpError(400, 'Es ist kein Hetzner-API-Token hinterlegt (Einstellungen → Hetzner).');
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${secrets.hetzner.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = Object.assign(httpError(502, `Hetzner: ${data.error?.message || res.status}`), { code: data.error?.code });
    throw error;
  }
  return data;
}

// Servertypen, die am gewählten Standort bestellbar sind, günstigste zuerst.
export async function listTypes() {
  const location = state.settings.hetzner.location;
  const types = [];
  for (let page = 1; page; ) {
    const data = await hetzner('GET', `/server_types?per_page=50&page=${page}`);
    types.push(...(data.server_types || []));
    page = data.meta?.pagination?.next_page || 0;
  }
  return types
    .map((t) => {
      const price = (t.prices || []).find((p) => p.location === location);
      const site = (t.locations || []).find((l) => l.name === location);
      if (!price || !site || site.available === false || site.deprecation) return null;
      return {
        name: t.name,
        cores: t.cores,
        memoryGb: t.memory,
        diskGb: t.disk,
        cpu: t.cpu_type,
        arch: t.architecture,
        monthly: Number(price.price_monthly.gross),
        hourly: Number(price.price_hourly.gross),
        agents: agentSlots(t.memory * 1024),
      };
    })
    .filter((t) => t && t.memoryGb >= 4) // Claude Code braucht mindestens 4 GB
    .sort((a, b) => a.monthly - b.monthly);
}

async function ensureSshKey() {
  const existing = await hetzner('GET', `/ssh_keys?name=${KEY_NAME}`);
  const key = publicKey();
  const match = (existing.ssh_keys || []).find((k) => k.public_key.trim().split(' ').slice(0, 2).join(' ') === key.split(' ').slice(0, 2).join(' '));
  if (match) return match.id;
  const name = existing.ssh_keys?.length ? `${KEY_NAME}-${Date.now()}` : KEY_NAME;
  return (await hetzner('POST', '/ssh_keys', { name, public_key: key })).ssh_key.id;
}

export async function createServer({ name, type }) {
  name = String(name || '').trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$/.test(name)) {
    throw httpError(400, 'Der Servername darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.');
  }
  if (!/^[a-z0-9-]{2,20}$/.test(String(type))) throw httpError(400, 'Servertyp fehlt');
  const keyId = await ensureSshKey();
  const { server } = await hetzner('POST', '/servers', {
    name,
    server_type: type,
    image: IMAGE,
    location: state.settings.hetzner.location,
    ssh_keys: [keyId],
    user_data: BOOTSTRAP,
    labels: { leitstand: '1' },
    start_after_create: true,
  });
  const ip = server.public_net?.ipv4?.ip;
  if (!ip) throw httpError(502, 'Hetzner hat keine IPv4-Adresse geliefert.');
  // Hetzner vergibt Adressen neu: ein alter Hostschlüssel zu dieser IP würde SSH blockieren.
  execFile('ssh-keygen', ['-R', ip, '-f', KNOWN_HOSTS], () => {});
  const machine = addMachine({ name, host: ip, user: 'agent', hetznerId: server.id });
  machine.serverType = type;
  machine.status = 'Server startet';
  changed('fleet');
  waitUntilReady(machine.id);
  return machine;
}

async function waitUntilReady(machineId) {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    const machine = findMachine(machineId);
    if (!machine) return;
    const probe = await sshExec(machine, `test -f ${READY_FLAG} && echo READY`, 25_000);
    if (probe.stdout.includes('READY')) {
      await setupMachine(machine);
      return;
    }
    if (machine.status !== 'Server wird eingerichtet') {
      machine.status = 'Server wird eingerichtet';
      changed('fleet');
    }
  }
  const machine = findMachine(machineId);
  if (machine) {
    machine.status = 'fehler';
    machine.error = 'Der Server ist nach 15 Minuten nicht bereit. „Prüfen“ versucht es erneut.';
    changed('fleet');
  }
}

export async function deleteServer(hetznerId) {
  try {
    await hetzner('DELETE', `/servers/${hetznerId}`);
  } catch (err) {
    if (err.code !== 'not_found') throw err;
  }
}
