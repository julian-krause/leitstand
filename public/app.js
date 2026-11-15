// Leitstand: Oberfläche. Kein Framework, der Server schickt Änderungen per SSE.

const S = {
  projects: [],
  chats: new Map(),
  pages: [],
  machines: [],
  accounts: [],
  settings: {},
  secretFlags: {},
  payments: [],
  outbox: [],
  subscriptions: [],
  logins: [],
  vaultSearch: '',
  publicKey: '',
  contextDir: '',
  view: 'overview',
  overview: null,
  mailPreview: null,
  files: { projectId: null, path: '', entries: [], file: null },
  chatId: null,
  chatFilter: 'alle',
  pageName: null,
  pageContent: '',
  pageEdit: false,
  inbox: null,
};

const $ = (sel) => document.querySelector(sel);

// ---------- Hilfen ----------

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Leitstand': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    location.href = '/login';
    throw new Error('Nicht angemeldet');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}
const run = (promise) => promise.catch((err) => alert(err.message));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

// Kleines Markdown: Überschriften, Listen, Code, Absätze. Alles wird vorher maskiert.
function md(text) {
  const out = [];
  const lines = String(text ?? '').split('\n');
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      flushPara();
      flushList();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet || numbered) {
      flushPara();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((bullet || numbered)[1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join('');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function ago(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'jetzt';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} T`;
}
const when = (ts) => (ts ? new Date(ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '');
const money = (amount, currency) => `${Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const projectOf = (chat) => S.projects.find((p) => p.id === chat.projectId);
const machineOf = (project) => S.machines.find((m) => m.id === project?.machineId);
const isSnoozed = (chat) => chat.snoozeUntil && chat.snoozeUntil > Date.now();
const chatList = () => [...S.chats.values()];

function monthSpent() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const currency = S.settings.wallet?.currency || 'EUR';
  return S.payments.filter((p) => p.status === 'freigegeben' && p.currency === currency && p.ts >= start).reduce((sum, p) => sum + p.amount, 0);
}

// Was auf dich wartet: zuerst alles, was eine Entscheidung braucht, danach fertige Ergebnisse.
const needsDecision = (chat) => chat.attention?.kind !== 'fertig';
const pendingPayment = (chat) => S.payments.find((p) => p.chatId === chat.id && p.status === 'wartet');
const rank = (chat) => (chat.assist ? 0 : needsDecision(chat) ? 1 : 2);
const waitingSince = (chat) => chat.assist?.since || chat.attention?.since || 0;
function queue() {
  return chatList()
    .filter((c) => c.assist || (pendingPayment(c) && c.status !== 'archived') || (c.status === 'attention' && !isSnoozed(c)))
    .sort((a, b) => rank(a) - rank(b) || waitingSince(a) - waitingSince(b));
}
const childrenOf = (chat) => chatList().filter((c) => c.parentId === chat.id);

const KIND_LABEL = {
  entscheidung: 'Entscheidung',
  erlaubnis: 'Erlaubnis',
  zahlung: 'Zahlung',
  fertig: 'Fertig',
  blockiert: 'Blockiert',
  antwort: 'Antwort',
  fehler: 'Fehler',
  hilfe: 'Kurz gebraucht',
};

function dotClass(chat) {
  if (chat.assist) return 'attention';
  if (chat.status === 'running') return 'running';
  if (chat.status === 'queued' || chat.status === 'waiting') return 'queued';
  if (chat.status === 'attention') return chat.attention?.kind === 'fehler' ? 'fehler' : isSnoozed(chat) ? '' : 'attention';
  if (chat.status === 'done') return 'done';
  return '';
}

// ---------- Aktionen ----------

const act = (chatId, action, extra = {}) => run(api('POST', `/api/chats/${chatId}/action`, { action, ...extra }));

function selectChat(chatId) {
  // Ein fertiges Ergebnis gilt als erledigt, sobald du es angesehen hast und weitergehst.
  const previous = S.chats.get(S.chatId);
  if (previous && previous.id !== chatId && previous.status === 'attention' && previous.attention?.kind === 'fertig') {
    act(previous.id, 'done');
  }
  S.chatId = chatId;
  setView('chats');
  document.body.classList.toggle('detail', Boolean(chatId));
  buildChat();
  renderAll();
}

function goNext() {
  const q = queue();
  if (!q.length) return;
  const index = q.findIndex((c) => c.id === S.chatId);
  selectChat(q[(index + 1) % q.length].id);
}

const focusComposer = () => $('#composer-input')?.focus();

// ---------- Kopfzeile und Warteschlange ----------

// Ein Limit-Fenster, dessen Rücksetzzeit vorbei ist, steht wieder bei 0, auch wenn seitdem nicht neu gemessen wurde.
function usage(w) {
  if (!w) return 0;
  if (w.resetsAt && w.resetsAt * 1000 <= Date.now()) return 0;
  return w.utilization || 0;
}

function renderMeters() {
  const chats = chatList();
  const runningCount = chats.filter((c) => c.status === 'running').length;
  const queuedCount = chats.filter((c) => c.status === 'queued').length;
  $('#meter-running').textContent = [
    runningCount ? `${runningCount} ${runningCount === 1 ? 'läuft' : 'laufen'}` : '',
    queuedCount ? `${queuedCount} in der Schlange` : '',
  ].filter(Boolean).join(' · ');
  const busiest = S.accounts.filter((a) => a.limits).sort((a, b) => usage(b.limits.five_hour) - usage(a.limits.five_hour) || (b.limits.at || 0) - (a.limits.at || 0))[0];
  const pct = (w) => (w ? `${Math.round(usage(w) * 100)} %` : '–');
  $('#meter-limits').textContent = busiest ? `Abo: 5 h ${pct(busiest.limits.five_hour)} · 7 Tage ${pct(busiest.limits.seven_day)}` : '';
}

function primaryAction(chat) {
  const a = chat.attention;
  if (!a) return null;
  if (a.kind === 'entscheidung' && !a.optionen?.length) return { label: 'Freigeben', go: () => act(chat.id, 'approve') };
  if (a.kind === 'erlaubnis') return { label: 'Erlauben', go: () => act(chat.id, 'allow') };
  if (a.kind === 'fertig') return { label: 'Erledigt', go: () => act(chat.id, 'done') };
  return null;
}

function renderCapsule() {
  const el = $('#capsule');
  const q = queue();
  if (!q.length || S.view !== 'chats') {
    el.hidden = true;
    return;
  }
  // Was einen Handgriff jetzt braucht, steht immer vorn, auch wenn ein anderer Chat offen ist.
  const current = q[0].assist ? q[0] : q.find((c) => c.id === S.chatId) || q[0];
  const selected = current.id === S.chatId;
  const kind = current.assist ? 'hilfe' : current.attention?.kind || 'zahlung';
  const primary = selected && !current.assist ? primaryAction(current) : null;
  el.hidden = false;
  el.innerHTML = `
    <span class="dot ${kind === 'fehler' ? 'fehler' : 'attention'}"></span>
    <span class="where">${esc(projectOf(current)?.name || '')} · ${esc(KIND_LABEL[kind])}</span>
    <span class="what" title="${esc(current.assist?.text || current.attention?.kurz || '')}">${esc(current.assist?.text || current.title)}</span>
    ${selected ? '' : '<button class="primary" data-a="open">Öffnen</button>'}
    ${primary ? `<button class="primary" data-a="primary">${esc(primary.label)}</button>` : ''}
    ${current.assist ? '' : '<button data-a="snooze" title="Für eine Stunde ausblenden">Später</button><button data-a="done" title="Aus der Warteschlange nehmen">Nicht mehr nötig</button>'}
    <span class="count">${[q.filter(needsDecision).length && `${q.filter(needsDecision).length} zu entscheiden`, q.filter((c) => !needsDecision(c)).length && `${q.filter((c) => !needsDecision(c)).length} fertig`].filter(Boolean).join(' · ')}</span>
    <button data-a="next" title="Leertaste">Weiter <kbd>␣</kbd></button>`;
  el.onclick = (event) => {
    const a = event.target.closest('button')?.dataset.a;
    if (a === 'open') selectChat(current.id);
    else if (a === 'primary') primary.go();
    else if (a === 'snooze') act(current.id, 'snooze');
    else if (a === 'done') act(current.id, 'done');
    else if (a === 'next') goNext();
  };
}

// ---------- Übersicht ----------
// Die Startseite: was dich braucht, was läuft, was die Agenten gebaut haben, Postfach,
// Konten und Ausgaben auf einen Blick.

const fileUrl = (projectId, relative) => `/files/${projectId}/${String(relative || '').split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
const topOrders = () => chatList().filter((c) => !c.parentId && c.status !== 'archived').sort((a, b) => b.createdAt - a.createdAt);

async function loadOverview() {
  renderOverview();
  const [overview, mail] = await Promise.all([
    api('GET', '/api/overview').catch(() => null),
    S.secretFlags.mailPassword ? api('GET', '/api/inbox').catch(() => null) : null,
  ]);
  S.overview = overview || { sites: [], recent: [], folders: [], results: [] };
  S.mailPreview = mail;
  if (S.view === 'overview') renderOverview();
}

function overviewLive() {
  const chats = chatList();
  const decisions = queue().filter(needsDecision);
  const running = chats.filter((c) => c.status === 'running').length;
  const currency = S.settings.wallet?.currency || 'EUR';
  const stats = [
    [decisions.length, 'zu entscheiden'],
    [running, running === 1 ? 'Agent arbeitet' : 'Agenten arbeiten'],
    [chats.filter((c) => c.status === 'queued').length, 'in der Schlange'],
    [money(monthSpent(), currency), `von ${money(S.settings.wallet?.monthlyBudget || 0, currency)} diesen Monat`],
  ];
  const needs = decisions.map((c) => {
    const payment = pendingPayment(c);
    const kind = c.assist ? 'hilfe' : payment ? 'zahlung' : c.attention?.kind;
    const text = c.assist?.text || (payment ? `${money(payment.amount, payment.currency)} an ${payment.merchant}` : c.attention?.frage || c.attention?.kurz || '');
    return `<button class="list-row" data-chat="${c.id}"><div class="main"><b>${esc(KIND_LABEL[kind] || '')}: ${esc(c.title)}</b><span>${esc(text)}</span></div><div class="side">${esc(ago(waitingSince(c)))}</div></button>`;
  }).join('');
  const orders = topOrders().slice(0, 8).map((c) => {
    const kids = childrenOf(c);
    const done = kids.filter((k) => k.status === 'done').length;
    const label = {
      running: 'arbeitet', queued: 'in der Schlange', waiting: 'Teilaufträge laufen', done: 'erledigt', idle: 'bereit',
      attention: c.attention?.kind === 'fertig' ? 'fertig' : 'wartet auf dich',
    }[c.status] || c.status;
    const tone = c.status === 'attention' && c.attention?.kind !== 'fertig' ? 'busy' : c.status === 'done' || c.attention?.kind === 'fertig' ? 'ok' : '';
    const moving = [c, ...kids].filter((k) => k.status === 'running').map((k) => k.progress?.text || k.activity).filter(Boolean)[0];
    const last = c.attention?.kurz || moving || c.waitingFor || '';
    return `<button class="list-row" data-chat="${c.id}"><div class="main">
        <b>${esc(c.title)} <span class="badge ${tone}">${esc(label)}</span></b>
        <span>${esc(projectOf(c)?.name || '')}${kids.length ? ` · ${done} von ${kids.length} Teilaufträgen fertig` : ''}${last ? ` · ${esc(last)}` : ''}</span>
        ${kids.length ? bar(done, kids.length) : ''}
      </div><div class="side">${esc(ago(c.createdAt))}</div></button>`;
  }).join('');
  return { stats, needs, orders };
}

const cardLabel = () => (S.secretFlags.card ? `Karte ${S.secretFlags.card}` : 'keine Karte hinterlegt');

function renderOverview() {
  const el = $('#overview');
  const live = overviewLive();
  const ov = S.overview;
  const w = S.settings.wallet || {};

  const sites = (ov?.sites || []).map((site) => `<div class="site">
      <a class="thumb" href="${fileUrl(site.projectId, site.path)}/" target="_blank" rel="noopener" title="In neuem Tab öffnen">
        <iframe src="${fileUrl(site.projectId, site.path)}/" sandbox="allow-scripts" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
      </a>
      <div class="site-meta"><b>${esc(site.title)}</b><span>${esc(site.project)} · ${esc(site.path || 'Projektordner')} · ${esc(ago(site.mtime))}</span></div>
      <div class="row"><a class="button primary" href="${fileUrl(site.projectId, site.path)}/" target="_blank" rel="noopener">Öffnen</a><button data-files="${site.projectId}" data-path="${esc(site.path)}">Dateien</button></div>
    </div>`).join('');
  const results = (ov?.results || []).map((r) => {
    const href = /^https?:\/\//.test(r.target) ? r.target : fileUrl(r.projectId, r.target);
    return `<a class="list-row" href="${esc(href)}" target="_blank" rel="noopener"><div class="main"><b>${esc(r.title)}</b><span>${esc(r.note || r.target)}</span></div><div class="side">${esc(ago(r.ts))}</div></a>`;
  }).join('');
  const folders = (ov?.folders || []).map((f) => `<button class="chip-button" data-files="${f.projectId}" data-path="${esc(f.path)}">${esc(f.path.split('/').pop())} <span>${f.files} Dateien</span></button>`).join('');
  const recent = (ov?.recent || []).slice(0, 8).map((f) => `<button class="list-row" data-files="${f.projectId}" data-path="${esc(f.path.split('/').slice(0, -1).join('/'))}" data-file="${esc(f.path)}"><div class="main"><b>${esc(f.path.split('/').pop())}</b><span>${esc(f.project)} · ${esc(f.path.split('/').slice(0, -1).join('/'))}</span></div><div class="side">${esc(ago(f.mtime))}</div></button>`).join('');

  const mails = (S.mailPreview?.mail || []).slice(0, 5).map((m) => `<button class="list-row" data-mail="${esc(m.id)}"><div class="main"><b>${esc(m.subject || '(kein Betreff)')}</b><span>${esc(m.from)}</span></div><div class="side">${esc(when(m.ts))}</div></button>`).join('');
  const accounts = S.logins.slice(0, 8).map((e) => `<div class="list-row"><div class="main"><b>${esc(e.name)}${e.hasTotp ? ' <span class="badge ok">2FA</span>' : ''}</b><span>${esc(e.user || 'ohne Benutzername')}</span></div><div class="side">${esc(scopeName(e.scope))}</div></div>`).join('');
  const spend = [...S.payments].reverse().slice(0, 5).map((p) => `<div class="list-row"><div class="main"><b>${esc(money(p.amount, p.currency))} · ${esc(p.merchant)}</b><span>${esc(p.reason)}</span></div><div class="side"><span class="badge ${{ freigegeben: 'ok', abgelehnt: 'bad', wartet: 'busy' }[p.status]}">${esc(p.status)}</span></div></div>`).join('');

  el.innerHTML = `<div class="inner wide">
    <div class="head-row"><h1>Übersicht</h1><button class="primary" id="ov-new">Neuer Auftrag</button></div>
    <div class="stats" id="ov-stats">${live.stats.map(([n, label]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(label)}</span></div>`).join('')}</div>
    ${setupCard()}
    <div class="ov-grid">
      <div class="ov-col">
        <div class="card" id="ov-needs" ${live.needs ? '' : 'hidden'}><h2>Braucht dich</h2><div id="ov-needs-list">${live.needs}</div></div>
        <div class="card"><h2>Aufträge</h2><div id="ov-orders">${live.orders || '<p class="note">Noch kein Auftrag. Mit „Neuer Auftrag“ gibst du einem Lead-Agenten ein Vorhaben; er verteilt die Arbeit selbst auf weitere Agenten.</p>'}</div></div>
        <div class="card"><h2>Was die Agenten gebaut haben</h2>
          ${!ov ? '<p class="note">Lädt …</p>' : ''}
          ${sites ? `<div class="sites">${sites}</div>` : ''}
          ${results ? `<h3 class="section-title">Gemeldete Ergebnisse</h3>${results}` : ''}
          ${folders ? `<h3 class="section-title">Ordner</h3><div class="chips">${folders}</div>` : ''}
          ${recent ? `<h3 class="section-title">Zuletzt geändert</h3>${recent}` : ''}
          ${ov && !sites && !results && !folders && !recent ? '<p class="note">Noch nichts. Websites, Dokumente und Listen der Agenten erscheinen hier mit Vorschau.</p>' : ''}
        </div>
      </div>
      <div class="ov-col">
        <div class="card"><div class="head-row"><h2>Postfach</h2><button class="ghost" data-view-go="inbox">Alle</button></div>
          <p class="note" style="margin-top:0">${S.settings.mail?.address ? esc(S.settings.mail.address) : 'Noch kein Postfach eingerichtet.'}</p>
          ${mails || (S.settings.mail?.address ? `<p class="note">${S.mailPreview?.mailError ? esc(S.mailPreview.mailError) : 'Keine Nachrichten.'}</p>` : '')}</div>
        <div class="card"><div class="head-row"><h2>Konten der Agenten</h2><button class="ghost" data-view-go="vault">Tresor</button></div>
          ${accounts || '<p class="note">Noch keine. Legt ein Agent irgendwo ein Konto an, steht es hier und im Tresor.</p>'}</div>
        <div class="card"><div class="head-row"><h2>Abos und Ausgaben</h2><button class="ghost" data-view-go="spend">Alle</button></div>
          <p class="note" style="margin-top:0">${esc(cardLabel())} · ${w.autoApprove > 0 ? `bis ${esc(money(w.autoApprove, w.currency))} ohne Rückfrage` : 'jeder Kauf fragt dich vorher'} · laufend ${esc(money(runRate(), w.currency || 'EUR'))} im Monat</p>
          ${activeSubs().slice(0, 6).map((sub) => `<div class="list-row"><div class="main"><b>${esc(sub.name)}</b><span>${esc(subCost(sub))}${sub.purpose ? ` · ${esc(sub.purpose)}` : ''}</span></div><div class="side">${sub.paidUntil ? `bis ${esc(dayOf(sub.paidUntil))}` : ''}</div></div>`).join('')}
          ${spend ? `<h3 class="section-title">Letzte Zahlungen</h3>${spend}` : '<p class="note">Noch keine Zahlungen.</p>'}</div>
      </div>
    </div>
  </div>`;
  $('#ov-new').onclick = () => newChatDialog();
}

// Nur die beweglichen Teile auffrischen, damit die Vorschauen nicht neu laden.
function refreshOverviewLive() {
  if (S.view !== 'overview' || !$('#ov-stats')) return;
  const live = overviewLive();
  $('#ov-stats').innerHTML = live.stats.map(([n, label]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(label)}</span></div>`).join('');
  $('#ov-needs').hidden = !live.needs;
  $('#ov-needs-list').innerHTML = live.needs;
  if (live.orders) $('#ov-orders').innerHTML = live.orders;
}

$('#overview').addEventListener('click', (event) => {
  const chatId = event.target.closest('[data-chat]')?.dataset.chat;
  if (chatId) return selectChat(chatId);
  const mailId = event.target.closest('[data-mail]')?.dataset.mail;
  if (mailId) return showMail(mailId);
  const go = event.target.closest('[data-view-go]')?.dataset.viewGo;
  if (go) return setView(go);
  const files = event.target.closest('[data-files]');
  if (files) {
    S.files = { ...S.files, projectId: files.dataset.files, path: files.dataset.path || '', file: files.dataset.file || null };
    setView('files');
  }
});

// ---------- Dateien ----------

const TEXT_FILE = /\.(md|txt|csv|json|js|mjs|ts|tsx|jsx|css|py|sh|yml|yaml|toml|xml|env|sql)$/i;
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|svg|ico)$/i;

async function openFiles(projectId, relative = '', file = null) {
  const local = S.projects.filter((p) => machineOf(p)?.kind === 'local');
  const project = local.find((p) => p.id === projectId) || local[0];
  if (!project) {
    $('#files-list').innerHTML = '<p class="hint">Noch kein Projekt mit Ordner auf dieser Maschine.</p>';
    $('#files-preview').innerHTML = '';
    return;
  }
  let entries = [];
  let error = '';
  try {
    entries = await api('GET', `/api/projects/${project.id}/files?path=${encodeURIComponent(relative)}`);
  } catch (err) {
    error = err.message;
  }
  S.files = { projectId: project.id, path: relative, entries, file, error };
  document.body.classList.toggle('detail', Boolean(file));
  renderFiles();
}

function renderFiles() {
  const { projectId, path: relative, entries, file, error } = S.files;
  const local = S.projects.filter((p) => machineOf(p)?.kind === 'local');
  const parts = relative.split('/').filter(Boolean);
  const crumbs = [`<button class="crumb" data-path="">${esc(S.projects.find((p) => p.id === projectId)?.name || '')}</button>`,
    ...parts.map((part, i) => `<button class="crumb" data-path="${esc(parts.slice(0, i + 1).join('/'))}">${esc(part)}</button>`)].join('<span class="sep">/</span>');
  $('#files-list').innerHTML = `
    ${local.length > 1 ? `<select id="files-project">${local.map((p) => `<option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : ''}
    <div class="crumbs">${crumbs}</div>
    ${error ? `<p class="hint">${esc(error)}</p>` : ''}
    ${entries.map((e) => {
      const full = [...parts, e.name].join('/');
      return `<button class="item ${file === full ? 'active' : ''}" data-${e.dir ? 'path' : 'file'}="${esc(full)}"><span class="label">${e.dir ? '▸ ' : ''}${esc(e.name)}</span><span class="meta">${e.dir ? '' : esc(ago(e.mtime))}</span></button>`;
    }).join('') || (error ? '' : '<p class="hint">Leer.</p>')}`;
  const select = $('#files-project');
  if (select) select.onchange = () => openFiles(select.value, '');
  renderFilePreview();
}

async function renderFilePreview() {
  const { projectId, path: relative, entries, file } = S.files;
  const el = $('#files-preview');
  const hasIndex = entries.some((e) => !e.dir && e.name === 'index.html');
  const target = file || (hasIndex ? [relative, 'index.html'].filter(Boolean).join('/') : null);
  if (!target) {
    el.innerHTML = '<div class="empty"><h2>Dateien der Agenten</h2><p>Alles, was im Projektordner entsteht. Websites siehst du direkt als Vorschau, Texte und Tabellen lesbar aufbereitet.</p></div>';
    return;
  }
  const url = fileUrl(projectId, target);
  const head = `<div class="page-head"><button class="ghost back" data-a="back" aria-label="Zurück zur Liste">←</button><h1>${esc(target.split('/').pop())}</h1><a class="button" href="${url}" target="_blank" rel="noopener">In neuem Tab öffnen</a></div>`;
  let body;
  if (/\.html?$/i.test(target)) body = `<iframe class="preview-frame" src="${url}" sandbox="allow-scripts allow-forms allow-popups"></iframe>`;
  else if (IMAGE_FILE.test(target)) body = `<div class="page-body"><img src="${url}" alt="" style="max-width:100%"></div>`;
  else if (/\.pdf$/i.test(target)) body = `<iframe class="preview-frame" src="${url}"></iframe>`;
  else if (TEXT_FILE.test(target)) {
    const text = await fetch(url).then((r) => r.text()).catch(() => '');
    if (S.files.file !== file) return; // inzwischen etwas anderes gewählt
    if (/\.md$/i.test(target)) body = `<div class="page-body"><div class="doc msg agent">${md(text)}</div></div>`;
    else if (/\.csv$/i.test(target)) {
      const rows = parseCsv(text).slice(0, 2000);
      body = `<div class="page-body"><table class="grid"><thead><tr>${(rows[0] || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    } else body = `<div class="page-body"><pre><code>${esc(text.slice(0, 300000))}</code></pre></div>`;
  } else body = `<div class="empty"><p>Für diesen Dateityp gibt es keine Vorschau.</p><a class="button primary" href="${url}" target="_blank" rel="noopener">Öffnen</a></div>`;
  el.innerHTML = head + body;
  el.querySelector('[data-a="back"]').onclick = () => {
    S.files.file = null;
    document.body.classList.remove('detail');
    renderFiles();
  };
}

$('#files-list').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-path], button[data-file]');
  if (!button) return;
  if (button.dataset.file !== undefined) {
    S.files.file = button.dataset.file;
    document.body.classList.add('detail');
    renderFiles();
  } else {
    openFiles(S.files.projectId, button.dataset.path);
  }
});

// ---------- Vorbereitete Aufträge ----------

const TASKS = {
  mailbox: {
    title: 'Postfach bei mailbox.org anlegen',
    browser: true,
    text: `Leg bei mailbox.org ein neues E-Mail-Postfach an. Es wird die eigene Adresse aller Agenten des Leitstands: für Anmeldungen bei Diensten, Bestätigungscodes und Schriftverkehr. Ich beauftrage dich, dieses Konto anzulegen; das Akzeptieren der Nutzungsbedingungen von mailbox.org gehört dazu.

So gehst du vor:
1. Adresse: neutral und ohne Personennamen, etwa agent-leitstand, bei Bedarf mit ein paar Ziffern. Prüf im Registrierungsformular, was frei ist.
2. Bevor du das Formular abschickst: \`leitstand tresor neu mailbox.org ADRESSE https://login.mailbox.org\`. Registriere dich mit genau dem Passwort, das du dabei bekommst.
3. Tarif: Standard, falls du wählen musst. Bezahl noch nichts und hinterleg kein Zahlungsmittel.
4. Nach der Registrierung: Schau in den Einstellungen unter Sicherheit, ob es E-Mail-App-Passwörter gibt. Wenn ja, erzeug eines für IMAP und SMTP und leg es mit \`leitstand tresor setzen "mailbox.org IMAP" ADRESSE imap.mailbox.org\` ab (Passwort über die Standardeingabe). Wenn nein, notier, ob IMAP mit dem normalen Passwort geht.

Grenzen:
- Name im Formular: Vorname „Agent“, Nachname „Leitstand“ (das Formular erlaubt ausdrücklich einen frei gewählten Namen). Land: Deutschland. Verlangt ein Pflichtfeld eine Anschrift oder eine Telefonnummer, hör auf und frag mich.
- Die Prüfung gegen Roboter am Ende bestehst du nicht selbst: Mach die Registrierung im sichtbaren Browser, füll alles aus und hol mich für den einen Klick mit \`leitstand hilfe\`. Danach schickst du das Formular ab und machst weiter.
- Wenn der Browser nicht startet, sag mir die genaue Fehlermeldung.

Am Ende will ich wissen: die Adresse, den Stand des Kontos (Testphase bis wann, was im Testzeitraum eingeschränkt ist), was die Freischaltung kostet und welche Zahlungswege es gibt.`,
  },
};

// ---------- Einrichtung ----------

// Was noch fehlt, in der Reihenfolge, in der es sich lohnt. Jeder Punkt führt dorthin,
// wo er erledigt wird.
function setupSteps() {
  const f = S.secretFlags;
  const w = S.settings.wallet || {};
  const servers = S.machines.filter((m) => m.kind === 'ssh');
  const steps = [
    {
      done: S.projects.length > 0,
      title: 'Erstes Projekt anlegen',
      hint: 'Damit arbeitest du sofort: auf diesem Rechner, mit deiner vorhandenen Claude-Anmeldung. Ein Server ist dafür nicht nötig.',
      go: 'project',
      button: 'Projekt anlegen',
    },
    {
      done: f.mailPassword,
      title: 'Postfach der Agenten',
      hint: 'Ein Agent legt das Konto bei mailbox.org selbst an und speichert den Zugang im Tresor. Danach im Tresor bei diesem Zugang auf „Als Postfach nutzen“ klicken. Bezahlt wird später (3 € im Monat); bis dahin läuft das Konto als Testzugang.',
      go: 'mail',
      button: 'Selbst eintragen',
      task: 'mailbox',
      taskButton: 'Agent anlegen lassen',
    },
    {
      done: Boolean(f.card),
      title: 'Karte der Agenten',
      hint: `In Revolut eine virtuelle Karte anlegen, Monatslimit setzen, nur das Budget aufladen. Dann die Kartendaten eintragen. Voreingestellt: ohne Rückfrage bis ${money(w.autoApprove || 0, w.currency || 'EUR')} je Zahlung, ${money(w.monthlyBudget || 0, w.currency || 'EUR')} im Monat.`,
      go: 'wallet',
      button: 'Eintragen',
    },
    {
      done: Boolean(S.settings.sms?.number),
      title: 'Telefonnummer für SMS-Codes (kann warten)',
      hint: 'Prepaid-SIM in einem alten Android-Handy, das SMS mit der App SMS2Email an das Postfach der Agenten weiterleitet. Die meisten Anmeldungen kommen mit dem Postfach aus.',
      go: 'sms',
      button: 'Nummer eintragen',
    },
  ];
  if (servers.length) {
    steps.push({
      done: S.accounts.some((a) => !a.builtin),
      title: `Abo für ${servers.map((m) => m.name).join(', ')} freigeben`,
      hint: 'Nur für Agenten auf dem Server nötig. Im Finder im Ordner des Leitstands die Datei „Leitstand einrichten.command“ doppelklicken; sie sorgt auch dafür, dass der Leitstand von selbst startet.',
    });
  }
  return steps;
}

function setupCard() {
  const steps = setupSteps();
  if (steps.every((s) => s.done)) return '';
  const open = steps.filter((s) => !s.done).length;
  return `<div class="card setup">
    <h2>Einrichtung <span class="badge">${open} offen</span></h2>
    ${steps.map((s) => `<div class="setup-step ${s.done ? 'done' : ''}">
      <span class="check" aria-hidden="true">${s.done ? '✓' : ''}</span>
      <div class="main"><b>${esc(s.title)}</b>${s.done ? '' : `<span>${esc(s.hint)}</span>`}</div>
      ${!s.done && s.task ? `<button class="primary" data-task="${s.task}">${esc(s.taskButton)}</button>` : ''}
      ${!s.done && s.go ? `<button data-go="${s.go}">${esc(s.button)}</button>` : ''}
    </div>`).join('')}
  </div>`;
}

document.addEventListener('click', (event) => {
  const task = event.target.closest('[data-task]')?.dataset.task;
  if (task) return newChatDialog(TASKS[task]);
  const go = event.target.closest('[data-go]')?.dataset.go;
  if (!go) return;
  if (go === 'project') {
    setView('projects');
    newProjectDialog();
  } else {
    setView('settings');
    renderSettings();
    const form = $(`#settings [data-section="${go}"]`);
    form?.scrollIntoView({ block: 'start' });
    form?.querySelector('input:not([value]), input[value=""]')?.focus({ preventScroll: true });
  }
});

// ---------- Chat-Liste ----------

function renderChatList() {
  const all = chatList().filter((c) => c.status !== 'archived');
  const counts = {
    alle: all.length,
    warten: all.filter((c) => c.status === 'attention' && !isSnoozed(c)).length,
    laufen: all.filter((c) => ['running', 'queued', 'waiting'].includes(c.status)).length,
  };
  $('#chat-filter').innerHTML = [['alle', 'Alle'], ['warten', 'Warten auf dich'], ['laufen', 'Laufen']]
    .map(([key, label]) => `<button data-filter="${key}" class="${S.chatFilter === key ? 'active' : ''}">${label} ${counts[key]}</button>`)
    .join('');

  const el = $('#chat-list');
  if (!S.projects.length) {
    el.innerHTML = '<p class="hint">Leg zuerst unter „Projekte“ ein Projekt an. Jedes Projekt bekommt einen eigenen Lead-Agenten.</p>';
    return;
  }
  const visible = (c) =>
    S.chatFilter === 'alle' ||
    (S.chatFilter === 'warten' && c.status === 'attention' && !isSnoozed(c)) ||
    (S.chatFilter === 'laufen' && ['running', 'queued', 'waiting'].includes(c.status));
  const html = [];
  for (const project of S.projects) {
    const mine = all.filter((c) => c.projectId === project.id && visible(c));
    const isChild = (c) => c.parentId && mine.some((p) => p.id === c.parentId);
    // Neueste Aufträge oben, darunter jeweils ihre Teilaufträge in der Reihenfolge der Vergabe.
    const chats = mine
      .filter((c) => !isChild(c))
      .sort((a, b) => b.createdAt - a.createdAt)
      .flatMap((c) => [c, ...mine.filter((k) => k.parentId === c.id).sort((a, b) => a.createdAt - b.createdAt)]);
    if (!chats.length && S.chatFilter !== 'alle') continue;
    html.push(`<div class="group-title"><span>${esc(project.name)}</span><span>${esc(machineOf(project)?.kind === 'ssh' ? machineOf(project).name : '')}</span></div>`);
    if (!chats.length) html.push('<p class="hint">Noch kein Auftrag.</p>');
    for (const chat of chats) {
      const meta =
        chat.assist ? 'braucht dich'
        : chat.status === 'running' ? (chat.crew ? `Crew ${chat.crew}` : 'läuft')
        : chat.status === 'queued' ? 'Schlange'
        : chat.status === 'waiting' ? 'wartet'
        : isSnoozed(chat) ? 'später'
        : ago(chat.attention?.since || chat.createdAt);
      html.push(`<button class="item ${chat.id === S.chatId ? 'active' : ''} ${chat.status === 'done' ? 'dim' : ''} ${isChild(chat) ? 'child' : ''}" data-chat="${chat.id}">
        <span class="dot ${dotClass(chat)}"></span>
        <span class="label">${esc(chat.title)}</span>
        <span class="meta">${esc(meta)}</span>
      </button>`);
    }
  }
  el.innerHTML = html.join('') || '<p class="hint">Nichts in dieser Ansicht.</p>';
}

// ---------- Chat ----------

function buildChat() {
  closeLive();
  const el = $('#chat');
  const chat = S.chats.get(S.chatId);
  if (!chat) {
    document.body.classList.remove('detail');
    el.innerHTML = `<div class="welcome">${setupCard()}<div class="empty"><h2>Kein Auftrag ausgewählt</h2>
      <p>Gib einem Lead-Agenten einen Auftrag. Er arbeitet selbstständig und meldet sich hier, wenn er fertig ist oder eine Entscheidung braucht. Mit der Leertaste springst du zum nächsten Chat, der dich braucht.</p></div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="chat-head" id="chat-head"></div>
    <div class="messages" id="messages"><div class="messages-inner" id="messages-inner"></div></div>
    <div id="ask"></div>
    <form class="composer" id="composer">
      <textarea id="composer-input" rows="1" placeholder="Nachricht an deinen Lead-Agenten (Enter sendet, Umschalt+Enter für neue Zeile)"></textarea>
      <button class="primary" type="submit">Senden</button>
    </form>`;
  const input = $('#composer-input');
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await api('POST', `/api/chats/${chat.id}/message`, { text });
    } catch (err) {
      input.value = text;
      alert(err.message);
    }
  };
  $('#composer').onsubmit = (event) => {
    event.preventDefault();
    send();
  };
  input.onkeydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send();
    }
  };
  updateChat(true);
}

function updateChat(forceScroll = false) {
  const chat = S.chats.get(S.chatId);
  if (!chat || !$('#chat-head')) return;
  const project = projectOf(chat);
  const machine = machineOf(project);

  const statusText = {
    running: 'arbeitet',
    queued: chat.queued?.reason || 'in der Schlange',
    attention: isSnoozed(chat) ? 'später' : 'wartet auf dich',
    waiting: 'wartet auf Teilaufträge',
    done: 'erledigt',
    idle: 'bereit',
    archived: 'archiviert',
  }[chat.status];
  const kids = childrenOf(chat);
  const kidsOpen = kids.filter((c) => ['running', 'queued'].includes(c.status)).length;
  const parent = chat.parentId && S.chats.get(chat.parentId);
  const sub = [project?.name, machine?.kind === 'ssh' ? machine.name : '', parent ? `Teilauftrag von „${parent.title}“` : 'Lead-Agent', kids.length ? `${kids.length} Teilaufträge, ${kidsOpen} laufen` : '', chat.attention?.naechster_schritt ? `Nächster Schritt: ${chat.attention.naechster_schritt}` : '']
    .filter(Boolean).map(esc).join(' · ');
  $('#chat-head').innerHTML = `
    <button class="ghost back" data-a="back" aria-label="Zurück zur Liste">←</button>
    <div class="grow">
      <h1>${esc(chat.title)}</h1>
      <div class="sub">${sub}</div>
    </div>
    ${chat.crew ? `<span class="badge">Crew ${chat.crew}</span>` : ''}
    <span class="badge"><span class="dot ${dotClass(chat)}"></span>${esc(statusText)}</span>
    ${chat.status === 'running' && project?.browser && !chat.assist ? `<button data-a="live" title="Den Browser des Agenten live ansehen">${S.liveOpen === chat.id ? 'Browser schließen' : 'Browser'}</button>` : ''}
    ${chat.status === 'running' || chat.status === 'queued' ? '<button data-a="stop">Stoppen</button>' : ''}
    <button class="ghost" data-a="archive" title="Aus der Liste entfernen">Archivieren</button>`;
  $('#chat-head').onclick = (event) => {
    const a = event.target.closest('button')?.dataset.a;
    if (a === 'back') selectChat(null);
    if (a === 'stop') act(chat.id, 'stop');
    if (a === 'live') {
      S.liveOpen = S.liveOpen === chat.id ? null : chat.id;
      updateChat();
    }
    if (a === 'archive' && confirm('Diesen Chat archivieren? Ein laufender Agent wird gestoppt.')) {
      act(chat.id, 'archive');
      selectChat(null);
    }
  };

  const box = $('#messages');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const html = chat.messages.map((m) =>
    m.role === 'agent' ? `<div class="msg agent">${md(m.text)}</div>` : `<div class="msg ${m.role}">${esc(m.text)}</div>`,
  );
  if (chat.status === 'running') {
    const lastMove = chat.messages.length ? chat.messages[chat.messages.length - 1].ts : chat.createdAt;
    html.push(`<div class="working"><span class="dot running"></span>${chat.progress ? `<b>${esc(chat.progress.text)}</b> · ` : ''}${esc(chat.activity || 'Arbeitet …')} · letzte Regung ${esc(ago(lastMove))}${chat.pending?.length ? ` · ${chat.pending.length} Nachricht(en) warten` : ''}</div>`);
  } else if (chat.status === 'queued') {
    html.push(`<div class="working"><span class="dot queued"></span>${esc(chat.queued?.reason || 'Startet gleich …')}</div>`);
  } else if (chat.status === 'waiting') {
    html.push(`<div class="working"><span class="dot queued"></span>${esc(chat.waitingFor || 'Wartet auf die Ergebnisse der Teilaufträge.')}</div>`);
  }
  $('#messages-inner').innerHTML = html.join('');
  if (forceScroll || nearBottom) box.scrollTop = box.scrollHeight;

  renderAsk(chat);
}

// ---------- Browser live im Chat ----------
// Der Browser des Agenten läuft auf seiner Maschine. Der Leitstand reicht dessen Bild als
// WebSocket durch; Klicks, Scrollen und Tasten gehen auf demselben Weg zurück.

let LIVE = null;

function liveHtml() {
  return `<div class="live">
    <div class="live-bar"><span class="live-url"></span><span class="live-state">Verbinde …</span><button type="button" class="ghost" data-live="big" title="Größer oder kleiner">⤢</button></div>
    <div class="live-screen"><canvas tabindex="0" aria-label="Browser des Agenten"></canvas></div>
    <form class="live-type"><input type="text" placeholder="Text eintippen und mit Enter senden (auch zum Einfügen)" autocomplete="off"><button type="submit">Tippen</button></form>
  </div>`;
}

function closeLive() {
  if (!LIVE) return;
  LIVE.closed = true;
  try {
    LIVE.ws?.close();
  } catch {}
  LIVE = null;
}

function openLive(chatId, wrap) {
  closeLive();
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const stateEl = wrap.querySelector('.live-state');
  const urlEl = wrap.querySelector('.live-url');
  const live = { chatId, ws: null, closed: false, w: 1280, h: 720, tries: 0, drawing: false };
  LIVE = live;

  const send = (message) => {
    if (live.ws?.readyState === 1) live.ws.send(JSON.stringify(message));
  };

  const connect = () => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/chats/${chatId}/browser`);
    live.ws = ws;
    ws.onopen = () => {
      live.tries = 0;
      stateEl.textContent = 'live';
      stateEl.classList.add('on');
    };
    ws.onmessage = (message) => {
      let data;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }
      if (data.type === 'frame') {
        const img = new Image();
        img.onload = () => {
          // Die gemeldete Höhe stimmt nicht immer mit dem Fenster überein. Verlässlich ist das
          // Bild selbst: Es zeigt genau das Fenster, höchstens gleichmäßig verkleinert.
          const scale = (data.metadata?.deviceWidth || img.naturalWidth) / img.naturalWidth;
          live.w = img.naturalWidth * scale;
          live.h = img.naturalHeight * scale;
          if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
          }
          ctx.drawImage(img, 0, 0);
          send({ type: 'ack', seq: data.seq });
        };
        img.onerror = () => send({ type: 'ack', seq: data.seq });
        img.src = `data:image/jpeg;base64,${data.data}`;
      } else if (data.type === 'url') {
        urlEl.textContent = data.url || '';
      } else if (data.type === 'tabs') {
        const active = (data.tabs || []).find((t) => t.active);
        if (active?.url) urlEl.textContent = active.url;
      }
    };
    ws.onclose = () => {
      if (live.closed) return;
      stateEl.classList.remove('on');
      if (++live.tries > 20) {
        stateEl.textContent = 'Der Browser ist nicht erreichbar. Ist er noch offen?';
        return;
      }
      stateEl.textContent = 'Verbindung weg, verbinde neu …';
      setTimeout(() => !live.closed && connect(), Math.min(5000, 800 * live.tries));
    };
  };
  connect();

  // Bildschirmposition -> Koordinaten im Browser des Agenten
  const at = (event) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - r.left) / r.width) * live.w),
      y: Math.round(((event.clientY - r.top) / r.height) * live.h),
    };
  };
  const mods = (e) => (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
  const button = (e) => (e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left');
  let lastMove = 0;
  let clicks = { at: 0, count: 0 };

  canvas.oncontextmenu = (e) => e.preventDefault();
  canvas.onpointerdown = (e) => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture?.(e.pointerId);
    const now = performance.now();
    clicks = { at: now, count: now - clicks.at < 400 ? clicks.count + 1 : 1 };
    send({ type: 'input_mouse', eventType: 'mouseMoved', ...at(e), button: 'none', modifiers: mods(e) });
    send({ type: 'input_mouse', eventType: 'mousePressed', ...at(e), button: button(e), clickCount: clicks.count, modifiers: mods(e) });
  };
  canvas.onpointerup = (e) => {
    e.preventDefault();
    send({ type: 'input_mouse', eventType: 'mouseReleased', ...at(e), button: button(e), clickCount: clicks.count, modifiers: mods(e) });
  };
  canvas.onpointermove = (e) => {
    const now = performance.now();
    if (now - lastMove < 40) return;
    lastMove = now;
    send({ type: 'input_mouse', eventType: 'mouseMoved', ...at(e), button: e.buttons ? 'left' : 'none', modifiers: mods(e) });
  };
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    send({ type: 'input_mouse', eventType: 'mouseWheel', ...at(e), deltaX: Math.round(e.deltaX), deltaY: Math.round(e.deltaY), modifiers: mods(e) });
  }, { passive: false });

  const keyEvent = (e, eventType) => {
    const text = eventType === 'keyDown' && !e.ctrlKey && !e.metaKey ? (e.key.length === 1 ? e.key : e.key === 'Enter' ? '\r' : '') : '';
    return { type: 'input_keyboard', eventType, key: e.key, code: e.code, text, modifiers: mods(e), windowsVirtualKeyCode: e.keyCode };
  };
  canvas.onkeydown = (e) => {
    if (e.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    send(keyEvent(e, 'keyDown'));
  };
  canvas.onkeyup = (e) => {
    e.preventDefault();
    e.stopPropagation();
    send(keyEvent(e, 'keyUp'));
  };

  // Text am Stück, etwa vom Handy oder aus der Zwischenablage
  const form = wrap.querySelector('.live-type');
  form.onsubmit = (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    for (const ch of input.value) {
      send({ type: 'input_keyboard', eventType: 'keyDown', key: ch, text: ch });
      send({ type: 'input_keyboard', eventType: 'keyUp', key: ch });
    }
    input.value = '';
  };
  wrap.querySelector('[data-live="big"]').onclick = () => wrap.classList.toggle('big');
}

function renderAsk(chat) {
  const el = $('#ask');
  const a = chat.attention;
  const project = projectOf(chat);
  const watching = S.liveOpen === chat.id && chat.status === 'running';
  if ((chat.assist || watching) && project?.browser) {
    // Das Livebild bleibt bei jeder Aktualisierung stehen, nur der Text darüber ändert sich.
    if (!(LIVE && LIVE.chatId === chat.id && el.querySelector('.live'))) {
      el.onclick = null;
      el.innerHTML = `<div class="ask live-ask"><div class="kind"></div><div class="q"></div><div class="next"></div>${liveHtml()}</div>`;
      openLive(chat.id, el.querySelector('.live'));
    }
    el.querySelector('.kind').textContent = chat.assist ? 'Kurz gebraucht' : 'Browser des Agenten';
    el.querySelector('.q').textContent = chat.assist ? chat.assist.text : 'Live-Ansicht. Du kannst mitklicken, der Agent arbeitet im selben Fenster.';
    el.querySelector('.next').textContent = chat.assist
      ? 'Klick direkt ins Bild. Der Agent merkt von selbst, wenn du fertig bist, und macht weiter.'
      : '';
    return;
  }
  closeLive();
  if (S.liveOpen === chat.id && chat.status !== 'running') S.liveOpen = null;
  if (chat.assist) {
    el.onclick = null;
    el.innerHTML = `<div class="ask"><div class="kind">Kurz gebraucht</div><div class="q">${esc(chat.assist.text)}</div>
      <div class="next">Der Agent wartet darauf und macht danach von selbst weiter.</div></div>`;
    return;
  }
  // Eine Zahlung wartet, während der Agent noch arbeitet
  const payment = pendingPayment(chat);
  const paymentHints = (pay) => {
    const hints = [];
    const running = S.subscriptions.find((sub) => sub.status === 'aktiv' && (pay.merchant.toLowerCase().includes(sub.name.toLowerCase()) || sub.name.toLowerCase().includes(pay.merchant.toLowerCase())));
    if (running) hints.push(`Bei ${running.name} läuft schon etwas: ${subCost(running)}${running.paidUntil ? `, bezahlt bis ${dayOf(running.paidUntil)}` : ''}.`);
    if (/(\d+)\s*Monate|Jahr|jährlich|annual|12\s*M/i.test(pay.reason)) hints.push('Dieser Kauf bindet für länger als einen Monat. Vorgabe ist die kürzeste Laufzeit.');
    return hints.map((h) => `<div class="next warn-text">${esc(h)}</div>`).join('');
  };
  if (payment && a?.kind !== 'zahlung') {
    el.innerHTML = `<div class="ask zahlung"><div class="kind">Zahlung</div>
      <div class="q">${esc(money(payment.amount, payment.currency))} an ${esc(payment.merchant)} zahlen?</div>
      <div class="next">${esc(payment.reason)}</div>
      ${paymentHints(payment)}
      <div class="next">Der Agent arbeitet solange an allem weiter, was nicht davon abhängt. Diesen Monat bisher freigegeben: ${esc(money(monthSpent(), S.settings.wallet?.currency || 'EUR'))}.</div>
      <div class="row"><button class="primary" data-a="pay-approve">Zahlung freigeben</button><button data-a="pay-deny">Ablehnen</button></div></div>`;
    el.onclick = (event) => {
      const action = event.target.closest('button')?.dataset.a;
      if (action) act(chat.id, action, { paymentId: payment.id });
    };
    return;
  }
  if (chat.status !== 'attention' || !a) {
    el.innerHTML = '';
    return;
  }
  const buttons = [];
  if (a.kind === 'entscheidung') {
    if (a.optionen?.length) {
      a.optionen.forEach((option, i) =>
        buttons.push(`<button class="${i === 0 ? 'primary' : ''}" data-a="option" data-i="${i}">${esc(option)}${i === 0 ? '<span class="rec">empfohlen</span>' : ''}</button>`),
      );
    } else {
      buttons.push('<button class="primary" data-a="approve">Freigeben</button>');
    }
    buttons.push('<button data-a="reply">Änderungen anfordern</button>');
  } else if (a.kind === 'erlaubnis') {
    buttons.push('<button class="primary" data-a="allow">Erlauben</button>', '<button data-a="deny">Ablehnen</button>');
  } else if (a.kind === 'zahlung') {
    buttons.push('<button class="primary" data-a="pay-approve">Zahlung freigeben</button>', '<button data-a="pay-deny">Ablehnen</button>');
  } else if (a.kind === 'fertig') {
    buttons.push('<button class="primary" data-a="done">Erledigt</button>', '<button data-a="reply">Nacharbeiten</button>');
  } else if (a.kind === 'fehler') {
    buttons.push('<button class="primary" data-a="retry">Nochmal versuchen</button>', '<button data-a="reply">Antworten</button>');
  } else {
    buttons.push('<button class="primary" data-a="reply">Antworten</button>');
  }
  if (a.requests?.length && a.kind !== 'erlaubnis') buttons.splice(1, 0, '<button data-a="allow">Verweigerte Schritte freigeben</button>');
  buttons.push('<button class="ghost" data-a="snooze">Später</button>');
  if (a.kind !== 'fertig') buttons.push('<button class="ghost" data-a="done">Nicht mehr nötig</button>');

  const requests = (a.requests || []).map((r) => `<pre class="req"><code>${esc(r.tool)}: ${esc(r.detail)}</code></pre>`).join('');
  const notes = [];
  if (a.requests?.length) {
    notes.push(projectOf(chat)?.mode === 'vorsichtig'
      ? `Die Freigabe gilt ab dann für dieses Projekt: ${a.requests.flatMap((r) => r.patterns).join(', ')}`
      : 'Diese Schritte wurden dem Agenten verweigert, und er kommt ohne sie nicht weiter. Die Freigabe gilt nur für genau diese Schritte.');
  }
  const hintHtml = a.kind === 'zahlung' && a.payment ? paymentHints(a.payment) : '';
  if (a.kind === 'zahlung') notes.push(`Nach der Freigabe bekommt der Agent die Kartendaten für diesen Kauf. Diesen Monat bisher freigegeben: ${money(monthSpent(), S.settings.wallet?.currency || 'EUR')}.`);
  const tone = { fertig: 'fertig', fehler: 'fehler', zahlung: 'zahlung' }[a.kind] || '';
  el.innerHTML = `<div class="ask ${tone}">
    <div class="kind">${esc(KIND_LABEL[a.kind] || a.kind)}</div>
    <div class="q">${esc(a.frage || a.kurz)}</div>
    ${a.frage && a.kurz ? `<div class="next">${esc(a.kurz)}</div>` : ''}
    ${hintHtml}${requests}${notes.map((n) => `<div class="next">${esc(n)}</div>`).join('')}
    <div class="row">${buttons.join('')}</div>
  </div>`;
  el.onclick = (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const action = button.dataset.a;
    if (action === 'option') act(chat.id, 'approve', { option: a.optionen[Number(button.dataset.i)] });
    else if (action === 'reply') focusComposer();
    else act(chat.id, action);
  };
}

// ---------- Dialoge ----------

function openDialog(html, onSubmit, submitLabel = 'Anlegen') {
  const dialog = $('#dialog');
  dialog.innerHTML = `<form class="form" method="dialog">${html}<div class="error" id="dialog-error"></div>
    <div class="actions"><button type="button" id="dialog-cancel">Abbrechen</button><button class="primary" type="submit">${esc(submitLabel)}</button></div></form>`;
  $('#dialog-cancel').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const submit = event.target.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(event.target)));
      dialog.close();
    } catch (err) {
      $('#dialog-error').textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  };
  dialog.showModal();
  return dialog;
}

function newChatDialog(preset = null) {
  if (preset instanceof Event) preset = null;
  if (!S.projects.length) {
    setView('projects');
    newProjectDialog();
    return;
  }
  // Ein Auftrag mit Browser gehört auf diesen Rechner: Dort ist Chrome vorhanden.
  const localProject = S.projects.find((p) => machineOf(p)?.kind === 'local')?.id;
  const current = preset?.browser ? localProject : S.chats.get(S.chatId)?.projectId;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const dialog = openDialog(
    `<h2>Neuer Auftrag</h2>
    <label>Projekt<select name="projectId" id="chat-project">${S.projects.map((p) => `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="">+ Neues Projekt</option></select></label>
    <label id="chat-new-project" hidden>Name des neuen Projekts<input name="projectName" maxlength="60"></label>
    <label>Art<select name="kind" id="chat-kind"><option value="auftrag">Auftrag</option><option value="meeting">Gespräch: Aufträge ableiten und zur Freigabe vorlegen</option></select></label>
    <label>Titel (optional)<input name="title" maxlength="80" value="${esc(preset?.title || '')}"></label>
    <label><span id="chat-text-label">Was soll erreicht werden?</span><textarea name="text" id="chat-text" rows="7" required placeholder="Ziel, gewünschtes Ergebnis, Grenzen. Je klarer das fertige Ergebnis beschrieben ist, desto weniger Rückfragen.">${esc(preset?.text || '')}</textarea></label>
    ${preset?.browser ? '<p class="note" style="margin:0">Mit „Starten“ bekommt dieses Projekt den eigenen Browser freigeschaltet. Der Agent öffnet damit fremde Webseiten und füllt dort Formulare aus. Er nutzt ein leeres Browserprofil, nicht deine Anmeldungen.</p>' : ''}
    <div id="record-row" hidden>
      <button type="button" id="record">Gespräch mitschneiden</button>
      <p class="note">${Recognition ? 'Die Spracherkennung macht der Browser. In Chrome geht der Ton dafür an Google.' : 'Dieser Browser kann nicht mitschneiden. Füg das Transkript ein.'}</p>
    </div>`,
    async (data) => {
      recognition?.stop();
      recording = false;
      if (!data.projectId) {
        if (!data.projectName?.trim()) throw new Error('Gib dem neuen Projekt einen Namen.');
        data.projectId = (await createProject({ name: data.projectName, machineId: S.machines.find((m) => m.status === 'bereit')?.id })).id;
      }
      if (preset?.browser) await api('PATCH', `/api/projects/${data.projectId}`, { browser: true });
      const chat = await api('POST', '/api/chats', data);
      S.chats.set(chat.id, chat);
      selectChat(chat.id);
    },
    'Starten',
  );

  // Mitschnitt: Der Browser schreibt mit, der Text landet im Feld.
  let recognition = null;
  let recording = false;
  const textarea = $('#chat-text');
  const button = $('#record');
  $('#chat-project').onchange = (event) => {
    $('#chat-new-project').hidden = event.target.value !== '';
    if (!event.target.value) $('#chat-new-project input').focus();
  };
  $('#chat-kind').onchange = (event) => {
    const meeting = event.target.value === 'meeting';
    $('#record-row').hidden = !meeting;
    $('#chat-text-label').textContent = meeting ? 'Transkript oder Mitschrift' : 'Was soll erreicht werden?';
    textarea.placeholder = meeting ? 'Transkript einfügen oder mitschneiden.' : 'Ziel, gewünschtes Ergebnis, Grenzen.';
  };
  button.disabled = !Recognition;
  button.onclick = () => {
    if (recording) {
      recording = false;
      recognition.stop();
      button.textContent = 'Gespräch mitschneiden';
      return;
    }
    let base = textarea.value ? textarea.value.trimEnd() + '\n' : '';
    recognition = new Recognition();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) base += piece + '\n';
        else interim += piece + ' ';
      }
      textarea.value = base + interim;
      textarea.scrollTop = textarea.scrollHeight;
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      recording = false;
      button.textContent = 'Gespräch mitschneiden';
      $('#dialog-error').textContent = `Mitschnitt nicht möglich: ${event.error}`;
    };
    // Der Browser beendet die Erkennung nach Pausen von selbst: weiterlaufen lassen.
    recognition.onend = () => recording && recognition.start();
    recording = true;
    recognition.start();
    button.textContent = 'Mitschnitt beenden';
  };
  dialog.addEventListener('close', () => {
    recording = false;
    recognition?.stop();
  }, { once: true });
}

// Ein neues Projekt übernimmt die Einstellungen des zuletzt angelegten, damit nichts neu
// zusammengeklickt werden muss.
async function createProject(data) {
  const template = S.projects[S.projects.length - 1];
  const project = await api('POST', '/api/projects', data);
  if (template) {
    await api('PATCH', `/api/projects/${project.id}`, {
      mode: template.mode, model: template.model, effort: template.effort || '',
      identity: template.identity, browser: Boolean(template.browser),
    });
  }
  return project;
}

function newProjectDialog() {
  const ready = S.machines.filter((m) => m.status === 'bereit');
  openDialog(
    `<h2>Neues Projekt</h2>
    <label>Name<input name="name" required maxlength="60"></label>
    ${ready.length > 1
      ? `<label>Maschine<select name="machineId">${ready.map((m) => `<option value="${m.id}">${esc(m.name)}${m.kind === 'ssh' ? ` (${esc(m.host)})` : ''}</option>`).join('')}</select></label>`
      : `<input type="hidden" name="machineId" value="${ready[0]?.id || 'lokal'}">`}
    <p class="note" style="margin:0">Mehr braucht es nicht. Den Ordner legt der Leitstand selbst an; Modell, Modus und was die Agenten nutzen dürfen, übernimmt er vom letzten Projekt und lässt sich unter „Projekte“ ändern.</p>`,
    (data) => createProject(data),
  );
}

function newPageDialog() {
  openDialog(
    `<h2>Neue Seite</h2>
    <label>Name<input name="name" required maxlength="70" placeholder="Zielkunden"></label>
    <label>Art<select name="type"><option value="md">Seite (.md)</option><option value="csv">Tabelle (.csv)</option></select></label>`,
    async (data) => {
      const name = `${data.name.trim()}.${data.type}`;
      await api('PUT', `/api/pages/${encodeURIComponent(name)}`, { content: data.type === 'md' ? `# ${data.name.trim()}\n\n` : 'Spalte A,Spalte B\n' });
      await openPage(name, true);
    },
  );
}

// ---------- Seiten ----------

function renderPageList() {
  $('#page-list').innerHTML = S.pages.length
    ? S.pages.map((p) => `<button class="item ${p.name === S.pageName ? 'active' : ''}" data-page="${esc(p.name)}"><span class="label">${esc(p.name)}</span><span class="meta">${ago(p.mtime)}</span></button>`).join('')
    : '<p class="hint">Noch keine Seiten. Agenten legen hier ab, was über einen Chat hinaus gilt.</p>';
}

async function openPage(name, edit = false) {
  const page = await api('GET', `/api/pages/${encodeURIComponent(name)}`);
  S.pageName = name;
  S.pageContent = page.content;
  S.pageEdit = edit;
  document.body.classList.add('detail');
  renderPageList();
  renderPage();
}

function renderPage() {
  const el = $('#page');
  if (!S.pageName) {
    el.innerHTML = `<div class="empty"><h2>Gemeinsamer Kontext</h2><p>Seiten und Tabellen, die alle Lead-Agenten lesen und fortschreiben. Ordner: <code>${esc(S.contextDir)}</code></p></div>`;
    return;
  }
  let body;
  if (S.pageEdit) {
    body = `<textarea id="page-text" spellcheck="false">${esc(S.pageContent)}</textarea>`;
  } else if (S.pageName.endsWith('.csv')) {
    const rows = parseCsv(S.pageContent);
    body = `<table class="grid"><thead><tr>${(rows[0] || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  } else {
    body = `<div class="doc msg agent">${md(S.pageContent) || '<p class="hint">Leer.</p>'}</div>`;
  }
  el.innerHTML = `<div class="page-head"><button class="ghost back" data-a="back" aria-label="Zurück zur Liste">←</button><h1>${esc(S.pageName)}</h1>
    ${S.pageEdit ? '<button data-a="cancel">Abbrechen</button><button class="primary" data-a="save">Speichern</button>' : '<button data-a="edit">Bearbeiten</button>'}</div>
    <div class="page-body">${body}</div>`;
  el.querySelector('.page-head').onclick = (event) => {
    const a = event.target.closest('button')?.dataset.a;
    if (a === 'back') { S.pageName = null; document.body.classList.remove('detail'); renderPageList(); renderPage(); }
    if (a === 'edit') { S.pageEdit = true; renderPage(); }
    if (a === 'cancel') run(openPage(S.pageName));
    if (a === 'save') run(api('PUT', `/api/pages/${encodeURIComponent(S.pageName)}`, { content: $('#page-text').value }).then(() => openPage(S.pageName)));
  };
}

// ---------- Projekte ----------

function renderProjects() {
  const cards = S.projects.map((p) => {
    const machine = machineOf(p);
    const i = p.identity || {};
    return `<div class="card" data-project="${p.id}">
      <h2>${esc(p.name)}</h2>
      <div class="path">${esc(machine?.name || 'Maschine fehlt')} · ${esc(p.dir)}</div>
      <div class="fields three">
        <label>Modus<select data-field="mode">
          <option value="selbststaendig" ${p.mode === 'selbststaendig' ? 'selected' : ''}>Selbstständig</option>
          <option value="vorsichtig" ${p.mode === 'vorsichtig' ? 'selected' : ''}>Vorsichtig</option>
          <option value="autonom" ${p.mode === 'autonom' ? 'selected' : ''}>Autonom</option>
        </select></label>
        <label>Modell<select data-field="model">
          ${[['', 'Standard von Claude Code'], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']].map(([v, l]) => `<option value="${v}" ${p.model === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        <label>Gründlichkeit<select data-field="effort">
          ${[['', 'Standard'], ['low', 'Niedrig'], ['medium', 'Mittel'], ['high', 'Hoch'], ['xhigh', 'Sehr hoch'], ['max', 'Maximal']].map(([v, l]) => `<option value="${v}" ${(p.effort || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      ${{
        selbststaendig: '<p class="note">Selbstständig: Der Agent entscheidet Alltägliches selbst (Befehle, Websuche, Installieren, Dateien). Eine Sicherheitsprüfung hält nur Riskantes auf, etwa Löschen außerhalb des Projekts. Dich erreicht das nur, wenn er ohne diesen Schritt nicht weiterkommt.</p>',
        vorsichtig: '<p class="note">Vorsichtig: Der Agent darf Dateien im Projektordner ändern und im Web lesen. Jeden anderen Befehl legt er dir einmal vor; deine Erlaubnis gilt dann für das Projekt. Das führt zu vielen Rückfragen.</p>',
        autonom: '<p class="note warn">Autonom: Der Agent führt alles ohne jede Prüfung aus, auch Löschen und Netzwerkzugriffe. Gedacht für eigene Server der Flotte, nicht für den Rechner mit deinen Daten.</p>',
      }[p.mode] || ''}
      <div class="checks">
        <span class="note" style="margin:0">Der Agent darf nutzen:</span>
        <label><input type="checkbox" data-browser ${p.browser ? 'checked' : ''}>Browser</label>
        ${machine?.kind === 'local' ? `<label title="Deine persönliche ~/.claude/CLAUDE.md, etwa die Regeln zu deinem Second Brain"><input type="checkbox" data-personal ${p.personal ? 'checked' : ''}>Meine CLAUDE.md</label>` : ''}
        <label><input type="checkbox" data-identity="mail" ${i.mail ? 'checked' : ''}>Postfach</label>
        <label><input type="checkbox" data-identity="sms" ${i.sms ? 'checked' : ''}>SMS</label>
        <label><input type="checkbox" data-identity="wallet" ${i.wallet ? 'checked' : ''}>Karte</label>
      </div>
      ${p.allow?.length ? `<div class="chips">${p.allow.map((a, n) => `<span class="chip">${esc(a)}<button data-remove="${n}" title="Erlaubnis entziehen" aria-label="Erlaubnis ${esc(a)} entziehen">×</button></span>`).join('')}</div>` : ''}
    </div>`;
  });
  $('#projects').innerHTML = `<div class="inner">
    <div class="head-row"><h1>Projekte</h1><button class="primary" id="new-project">Neues Projekt</button></div>
    <p class="note">Jedes Projekt hat einen eigenen Ordner auf einer Maschine der Flotte und eigene Lead-Agenten. So kommen Aufträge verschiedener Vorhaben nicht durcheinander.</p>
    ${cards.join('') || '<div class="card"><p class="note">Noch kein Projekt.</p></div>'}
  </div>`;
  $('#new-project').onclick = newProjectDialog;
}

$('#projects').addEventListener('change', (event) => {
  const card = event.target.closest('[data-project]');
  if (!card) return;
  const project = S.projects.find((p) => p.id === card.dataset.project);
  const field = event.target.dataset.field;
  if (field) {
    if (field === 'mode' && event.target.value === 'autonom' && !confirm('Autonom heißt: Der Agent führt in diesem Projekt jeden Befehl ohne Rückfrage aus. Wirklich umstellen?')) {
      renderProjects();
      return;
    }
    run(api('PATCH', `/api/projects/${project.id}`, { [field]: event.target.value }));
  } else if ('personal' in event.target.dataset) {
    run(api('PATCH', `/api/projects/${project.id}`, { personal: event.target.checked }));
  } else if ('browser' in event.target.dataset) {
    run(api('PATCH', `/api/projects/${project.id}`, { browser: event.target.checked }));
  } else if (event.target.dataset.identity) {
    const identity = { ...project.identity, [event.target.dataset.identity]: event.target.checked };
    if (event.target.dataset.identity === 'wallet' && event.target.checked && !confirm('Agenten dieses Projekts dürfen dann Zahlungen mit der hinterlegten Karte anfragen. Einschalten?')) {
      renderProjects();
      return;
    }
    run(api('PATCH', `/api/projects/${project.id}`, { identity }));
  }
});
$('#projects').addEventListener('click', (event) => {
  const index = event.target.dataset.remove;
  const card = event.target.closest('[data-project]');
  if (index === undefined || !card) return;
  const project = S.projects.find((p) => p.id === card.dataset.project);
  run(api('PATCH', `/api/projects/${project.id}`, { allow: project.allow.filter((_, n) => n !== Number(index)) }));
});

// ---------- Abos und Ausgaben ----------
// Was das System gebucht hat, was es laufend kostet und wann etwas ausläuft oder sich
// verlängert. Der Leitstand führt nur Buch; gekündigt wird nichts von selbst.

const dayOf = (ts) => new Date(ts).toLocaleDateString('de-DE');
const daysLeft = (ts) => Math.ceil((ts - Date.now()) / 86_400_000);
const subCost = (sub) => `${money(sub.cost, sub.currency)}${sub.interval === 'einmalig' ? ' einmalig' : ` je ${{ monat: 'Monat', jahr: 'Jahr', woche: 'Woche' }[sub.interval]}`}`;
const activeSubs = () => S.subscriptions.filter((sub) => sub.status === 'aktiv').sort((a, b) => (a.paidUntil || Infinity) - (b.paidUntil || Infinity));
const subMonthly = (sub) => ({ monat: sub.cost, jahr: sub.cost / 12, woche: sub.cost * 4.33, einmalig: 0 }[sub.interval] || 0);
const runRate = () => activeSubs().filter((sub) => sub.currency === (S.settings.wallet?.currency || 'EUR')).reduce((sum, sub) => sum + subMonthly(sub), 0);

function renderSpend() {
  const w = S.settings.wallet || {};
  const currency = w.currency || 'EUR';
  const active = activeSubs();
  const next = active.find((sub) => sub.paidUntil);
  const tiles = [
    [money(runRate(), currency), 'laufende Kosten im Monat'],
    [money(monthSpent(), currency), `ausgegeben diesen Monat, Budget ${money(w.monthlyBudget || 0, currency)}`],
    [active.length, active.length === 1 ? 'aktives Abo' : 'aktive Abos'],
    [next ? dayOf(next.paidUntil) : '–', next ? `nächster Termin: ${next.name}` : 'kein Termin vermerkt'],
  ];
  const subs = [...active, ...S.subscriptions.filter((sub) => sub.status !== 'aktiv')].map((sub) => {
    const left = sub.paidUntil ? daysLeft(sub.paidUntil) : null;
    const soon = sub.status === 'aktiv' && left !== null && left <= 14;
    const renewal = sub.autoRenew === null ? '' : sub.autoRenew
      ? '<span class="badge busy">verlängert sich von selbst</span>'
      : '<span class="badge">läuft von selbst aus</span>';
    const until = sub.paidUntil
      ? `bezahlt bis ${dayOf(sub.paidUntil)}${sub.status === 'aktiv' ? (left >= 0 ? `, noch ${left} ${left === 1 ? 'Tag' : 'Tage'}` : ', abgelaufen') : ''}`
      : 'kein Enddatum vermerkt';
    const details = [
      sub.purpose ? `Wofür: ${sub.purpose}` : '',
      sub.projectId ? `Projekt: ${S.projects.find((p) => p.id === sub.projectId)?.name || '?'}` : '',
      sub.login ? `Zugang im Tresor: ${sub.login}` : '',
      sub.cancel ? `Kündigen: ${sub.cancel}` : '',
    ].filter(Boolean);
    return `<div class="card sub ${sub.status !== 'aktiv' ? 'ended' : ''}" data-sub="${sub.id}">
      <h2>${esc(sub.name)} <span class="badge ${sub.status === 'aktiv' ? 'ok' : ''}">${sub.status === 'aktiv' ? 'aktiv' : 'beendet'}</span> ${sub.status === 'aktiv' ? renewal : ''}</h2>
      <div class="path"><b>${esc(subCost(sub))}</b> · <span class="${soon ? 'warn-text' : ''}">${esc(until)}</span></div>
      ${details.length ? `<p class="note">${details.map(esc).join('<br>')}</p>` : ''}
      <div class="row">
        <button data-a="edit">Bearbeiten</button>
        <button class="ghost" data-a="${sub.status === 'aktiv' ? 'end' : 'reopen'}">${sub.status === 'aktiv' ? 'Als beendet vermerken' : 'Wieder aktiv'}</button>
        <button class="ghost danger" data-a="delete">Eintrag löschen</button>
      </div>
    </div>`;
  }).join('');
  const payments = [...S.payments].reverse().map((p) => {
    const tone = { freigegeben: 'ok', abgelehnt: 'bad', wartet: 'busy' }[p.status];
    return `<div class="list-row"><div class="main"><b>${esc(money(p.amount, p.currency))} · ${esc(p.merchant)} <span class="badge ${tone}">${esc(p.status)}${p.auto ? ' (automatisch)' : ''}</span></b><span>${esc(S.projects.find((x) => x.id === p.projectId)?.name || '')} · ${esc(p.reason)}</span></div>
      <div class="side">${esc(when(p.ts))}${p.status === 'wartet' ? ` <button data-chat="${p.chatId}">Zum Chat</button>` : ''}</div></div>`;
  }).join('');

  $('#spend').innerHTML = `<div class="inner">
    <div class="head-row"><h1>Abos und Ausgaben</h1><button class="primary" id="sub-new">Abo eintragen</button></div>
    <div class="stats">${tiles.map(([n, label]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(label)}</span></div>`).join('')}</div>
    <p class="note">Alles, was die Agenten mit Laufzeit gebucht haben. Sie tragen es nach jedem Kauf selbst ein, buchen die kürzeste Laufzeit und sehen vor einem Kauf hier nach, ob schon etwas läuft. Gekündigt wird nichts von selbst: Dieser Überblick zeigt dir, was ausläuft und was sich verlängert.</p>
    <h3 class="section-title">Abos und laufende Käufe</h3>
    ${subs || '<div class="card"><p class="note" style="margin:0">Noch nichts vermerkt.</p></div>'}
    <h3 class="section-title">Alle Zahlungen</h3>
    <div class="card">${payments || '<p class="note" style="margin:0">Noch keine Zahlungen.</p>'}</div>
  </div>`;
  $('#sub-new').onclick = () => subDialog(null);
}

$('#spend').addEventListener('click', (event) => {
  const chatId = event.target.dataset.chat;
  if (chatId) return selectChat(chatId);
  const button = event.target.closest('button[data-a]');
  const sub = S.subscriptions.find((x) => x.id === event.target.closest('[data-sub]')?.dataset.sub);
  if (!button || !sub) return;
  const action = button.dataset.a;
  if (action === 'edit') subDialog(sub);
  if (action === 'end' || action === 'reopen') run(api('POST', '/api/subscriptions', { id: sub.id, name: sub.name, status: action === 'end' ? 'beendet' : 'aktiv' }));
  if (action === 'delete' && confirm(`Den Eintrag „${sub.name}“ löschen? Das kündigt nichts beim Anbieter, es entfernt nur die Zeile hier.`)) run(api('DELETE', `/api/subscriptions/${sub.id}`));
});

function subDialog(sub) {
  const iso = sub?.paidUntil ? new Date(sub.paidUntil - new Date(sub.paidUntil).getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : '';
  const renew = sub?.autoRenew === null || sub?.autoRenew === undefined ? '' : sub.autoRenew ? 'ja' : 'nein';
  openDialog(
    `<h2>${sub ? 'Abo bearbeiten' : 'Abo eintragen'}</h2>
    <label>Dienst oder Anbieter<input name="name" required maxlength="80" value="${esc(sub?.name || '')}"></label>
    <div class="fields three" style="margin:0">
      <label>Kosten<input name="cost" type="number" min="0" step="0.01" value="${esc(sub?.cost ?? '')}"></label>
      <label>Währung<input name="currency" maxlength="3" value="${esc(sub?.currency || S.settings.wallet?.currency || 'EUR')}"></label>
      <label>Abrechnung<select name="interval">${[['monat', 'monatlich'], ['jahr', 'jährlich'], ['woche', 'wöchentlich'], ['einmalig', 'einmalig']].map(([v, l]) => `<option value="${v}" ${(sub?.interval || 'monat') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="fields" style="margin:0">
      <label>Bezahlt bis<input name="paidUntil" type="date" value="${iso}"></label>
      <label>Verlängert sich von selbst<select name="autoRenew">${[['', 'unbekannt'], ['ja', 'ja'], ['nein', 'nein']].map(([v, l]) => `<option value="${v}" ${renew === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <label>Wofür<input name="purpose" maxlength="300" value="${esc(sub?.purpose || '')}"></label>
    <label>Wie kündigen<input name="cancel" maxlength="400" value="${esc(sub?.cancel || '')}"></label>
    <label>Zugang im Tresor<input name="login" maxlength="80" value="${esc(sub?.login || '')}" placeholder="Name des Tresor-Eintrags"></label>`,
    (data) => api('POST', '/api/subscriptions', { ...data, ...(sub ? { id: sub.id } : {}) }),
    sub ? 'Speichern' : 'Eintragen',
  );
}

// ---------- Flotte ----------

function bar(used, total) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return `<div class="bar ${pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''}"><i style="width:${pct}%"></i></div>`;
}

function renderFleet() {
  if (document.activeElement?.closest('#fleet input, #fleet select')) return; // nicht mitten in einer Eingabe neu zeichnen
  const chats = chatList();
  const ready = S.machines.filter((m) => m.status === 'bereit');
  const stats = [
    [chats.filter((c) => c.status === 'running').length, 'Agenten laufen'],
    [chats.filter((c) => c.status === 'queued').length, 'in der Schlange'],
    [queue().length, 'warten auf dich'],
    [ready.reduce((sum, m) => sum + m.slots, 0), 'Plätze insgesamt'],
  ];

  const machines = S.machines.map((m) => {
    const tone = m.status === 'bereit' ? 'ok' : m.status === 'fehler' ? 'bad' : 'busy';
    const info = m.info ? `${m.info.cpus} Kerne · ${(m.info.memMb / 1024).toFixed(0)} GB · ${esc(m.info.claude)}` : '';
    return `<div class="card" data-machine="${m.id}">
      <h2>${esc(m.name)} <span class="badge ${tone}">${esc(m.status)}</span></h2>
      <div class="path">${m.kind === 'local' ? 'dieser Rechner' : `${esc(m.user)}@${esc(m.host)}${m.serverType ? ` · Hetzner ${esc(m.serverType)}` : ''}`}${info ? ` · ${info}` : ''}</div>
      ${m.error ? `<p class="note warn">${esc(m.error)}</p>` : ''}
      ${bar(m.running || 0, m.slots)}
      <p class="note">${m.running || 0} von ${m.slots} Plätzen belegt</p>
      <div class="fields">
        <label>Plätze (Agenten gleichzeitig)<input type="number" min="1" max="200" value="${m.slots}" data-field="slots"></label>
        <label>Abo-Konto<select data-field="accountId">
          <option value="auto" ${m.accountId === 'auto' ? 'selected' : ''}>Automatisch (das am wenigsten ausgelastete)</option>
          ${S.accounts.map((a) => `<option value="${a.id}" ${m.accountId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select></label>
      </div>
      ${m.kind === 'ssh' ? `<div class="row"><button data-a="setup">Prüfen und einrichten</button><button class="ghost danger" data-a="delete">Entfernen</button></div>` : ''}
    </div>`;
  });

  const accounts = S.accounts.map((a) => {
    const l = a.limits;
    const limited = a.limitedUntil > Date.now();
    return `<div class="list-row" data-account="${a.id}">
      <div class="main"><b>${esc(a.name)}${limited ? ` <span class="badge bad">am Limit bis ${esc(when(a.limitedUntil))}</span>` : ''}</b>
        <span>${l ? `5 Stunden: ${Math.round(usage(l.five_hour) * 100)} % · 7 Tage: ${Math.round(usage(l.seven_day) * 100)} %` : 'noch keine Auslastung gemessen'}</span>
        ${l ? bar(usage(l.five_hour), 1) : ''}
      </div>
      ${a.builtin ? '' : '<button class="ghost danger" data-a="delete-account">Entfernen</button>'}
    </div>`;
  });

  $('#fleet').innerHTML = `<div class="inner">
    <div class="head-row"><h1>Flotte</h1>
      <button id="add-machine">Maschine per SSH hinzufügen</button>
      <button class="primary" id="add-server">Server bei Hetzner erstellen</button></div>
    <div class="stats">${stats.map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`).join('')}</div>
    <h3 class="section-title">Maschinen</h3>
    ${machines.join('')}
    <h3 class="section-title">Abo-Konten</h3>
    <div class="card">
      <div class="head-row"><h2>Claude-Abos</h2><button id="add-account">Konto hinzufügen</button></div>
      <p class="note">Jeder Agent läuft über eines dieser Abos, nie über einen API-Schlüssel mit Abrechnung nach Verbrauch. Ist eines am Limit, übernimmt automatisch das nächste; wartende Aufträge laufen weiter, sobald ein Konto frei ist.</p>
      ${accounts.join('')}
    </div>
    <h3 class="section-title">Schlüssel des Leitstands</h3>
    <div class="card">
      <p class="note" style="margin-top:0">Mit diesem öffentlichen Schlüssel meldet sich der Leitstand auf Maschinen an. Beim Bestellen eines Servers als SSH-Schlüssel eintragen oder auf einem vorhandenen Rechner in <code>~/.ssh/authorized_keys</code> ergänzen.</p>
      <code class="key">${esc(S.publicKey)}</code>
      <div class="row"><button id="copy-key">Kopieren</button></div>
    </div>
  </div>`;
  $('#add-machine').onclick = addMachineDialog;
  $('#add-server').onclick = addServerDialog;
  $('#add-account').onclick = addAccountDialog;
  $('#copy-key').onclick = (event) => navigator.clipboard.writeText(S.publicKey).then(() => (event.target.textContent = 'Kopiert'));
}

$('#fleet').addEventListener('change', (event) => {
  const card = event.target.closest('[data-machine]');
  const field = event.target.dataset.field;
  if (!card || !field) return;
  event.target.blur();
  run(api('PATCH', `/api/machines/${card.dataset.machine}`, { [field]: event.target.value }));
});
$('#fleet').addEventListener('click', (event) => {
  const action = event.target.dataset.a;
  const machine = S.machines.find((m) => m.id === event.target.closest('[data-machine]')?.dataset.machine);
  if (action === 'setup' && machine) run(api('POST', `/api/machines/${machine.id}/setup`));
  if (action === 'delete' && machine) {
    if (!confirm(`„${machine.name}“ aus der Flotte entfernen?`)) return;
    const alsoServer = machine.hetznerId && confirm('Auch den Server bei Hetzner löschen? Sonst läuft die Abrechnung dort weiter. Alle Daten auf dem Server gehen dabei verloren.');
    run(api('DELETE', `/api/machines/${machine.id}${alsoServer ? '?server=1' : ''}`));
  }
  if (action === 'delete-account') {
    const account = S.accounts.find((a) => a.id === event.target.closest('[data-account]').dataset.account);
    if (confirm(`Konto „${account.name}“ entfernen? Das Token wird von allen Maschinen gelöscht.`)) run(api('DELETE', `/api/accounts/${account.id}`));
  }
});

function addMachineDialog() {
  openDialog(
    `<h2>Maschine per SSH hinzufügen</h2>
    <p class="note" style="margin:0">Für gemietete Server (etwa Contabo) und eigene Rechner. Der Schlüssel des Leitstands muss dort hinterlegt sein. Bei einem frischen Linux-Server gibst du <code>root</code> an: Der Leitstand legt dann den Nutzer <code>agent</code> an, sichert SSH ab und installiert Claude Code. Das dauert ein paar Minuten.</p>
    <label>Name<input name="name" required maxlength="60" placeholder="vps-1"></label>
    <label>Adresse (IP oder Hostname)<input name="host" required placeholder="203.0.113.10"></label>
    <div class="fields" style="margin:0"><label>Benutzer<input name="user" required value="root"></label><label>Port<input name="port" type="number" value="22"></label></div>`,
    (data) => api('POST', '/api/machines', data),
    'Hinzufügen',
  );
}

async function addServerDialog() {
  if (!S.secretFlags.hetzner) {
    alert('Hinterleg zuerst ein Hetzner-API-Token unter „Einstellungen“.');
    setView('settings');
    return;
  }
  let types;
  try {
    types = await api('GET', '/api/hetzner/types');
  } catch (err) {
    alert(err.message);
    return;
  }
  if (!types.length) {
    alert('Hetzner bietet an diesem Standort gerade keinen passenden Servertyp an. Versuch einen anderen Standort (Einstellungen → Hetzner).');
    return;
  }
  const label = (t) => `${t.name} · ${t.cores} Kerne${t.cpu === 'dedicated' ? ' (dediziert)' : ''} · ${t.memoryGb} GB · ca. ${t.agents} Agenten · ${money(t.monthly, '€')}/Monat`;
  openDialog(
    `<h2>Server bei Hetzner erstellen</h2>
    <p class="note" style="margin:0">Standort ${esc(S.settings.hetzner?.location)}. Abgerechnet wird stundenweise bis zum Monatspreis, auch wenn der Server ausgeschaltet ist. Zum Beenden den Server hier wieder entfernen und löschen.</p>
    <label>Servertyp<select name="type">${types.map((t) => `<option value="${t.name}">${esc(label(t))}</option>`).join('')}</select></label>
    <label>Name<input name="name" required pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" value="agent-${S.machines.length}" maxlength="40"></label>`,
    async (data) => {
      const type = types.find((t) => t.name === data.type);
      if (!confirm(`Jetzt kostenpflichtig bestellen: ${type.name} für ${money(type.monthly, '€')} pro Monat (${type.hourly.toFixed(4)} € pro Stunde, inkl. MwSt.)?`)) throw new Error('Nicht bestellt.');
      await api('POST', '/api/hetzner/servers', data);
    },
    'Kostenpflichtig erstellen',
  );
}

function addAccountDialog() {
  openDialog(
    `<h2>Abo-Konto hinzufügen</h2>
    <ol class="steps"><li>Im Terminal <code>claude setup-token</code> ausführen und im Browser mit dem gewünschten Claude-Konto anmelden.</li><li>Das angezeigte Token hier einfügen. Es gilt ein Jahr und wird nur auf deinen Maschinen gespeichert.</li></ol>
    <label>Name<input name="name" required maxlength="60" placeholder="Max-Abo 1"></label>
    <label>Token<input name="token" type="password" required autocomplete="off"></label>`,
    (data) => api('POST', '/api/accounts', data),
    'Hinzufügen',
  );
}

// ---------- Posteingang ----------

async function loadInbox(fresh = false) {
  $('#inbox').innerHTML = '<div class="inner"><p class="note">Lädt …</p></div>';
  try {
    S.inbox = await api('GET', `/api/inbox${fresh ? '?fresh=1' : ''}`);
  } catch (err) {
    S.inbox = { mail: [], sms: [], mailError: err.message, smsError: '' };
  }
  renderInbox();
}

function renderInbox() {
  const box = S.inbox || { mail: [], sms: [] };
  const mail = box.mailError
    ? `<p class="note warn">${esc(box.mailError)}</p>`
    : box.mail.map((m) => `<button class="list-row" data-mail="${esc(m.id)}"><div class="main"><b>${esc(m.subject || '(kein Betreff)')}</b><span>${esc(m.from)} · ${esc(m.text.slice(0, 140))}</span></div><div class="side">${esc(when(m.ts))}</div></button>`).join('') || '<p class="note">Keine Nachrichten.</p>';
  const sms = box.smsError
    ? `<p class="note warn">${esc(box.smsError)}</p>`
    : box.smsNote
      ? `<p class="note">${esc(box.smsNote)}</p>`
      : box.sms.map((m) => `<div class="list-row"><div class="main"><b>${esc(m.from)}</b><span>${esc(m.text)}</span></div><div class="side">${esc(when(m.ts))}</div></div>`).join('') || '<p class="note">Keine SMS.</p>';
  const payments = [...S.payments].reverse().slice(0, 40).map((p) => {
    const tone = { freigegeben: 'ok', abgelehnt: 'bad', wartet: 'busy' }[p.status];
    return `<div class="list-row"><div class="main"><b>${esc(money(p.amount, p.currency))} · ${esc(p.merchant)} <span class="badge ${tone}">${esc(p.status)}${p.auto ? ' (automatisch)' : ''}</span></b><span>${esc(S.projects.find((x) => x.id === p.projectId)?.name || '')} · ${esc(p.reason)}</span></div>
      <div class="side">${esc(when(p.ts))}${p.status === 'wartet' ? ` <button data-chat="${p.chatId}">Zum Chat</button>` : ''}</div></div>`;
  }).join('') || '<p class="note">Noch keine Zahlungen.</p>';
  const outbox = [...S.outbox].reverse().slice(0, 20).map((o) => `<div class="list-row"><div class="main"><b>${esc(o.subject)}</b><span>an ${esc(o.to)} · ${esc(S.projects.find((x) => x.id === o.projectId)?.name || '')}</span></div><div class="side">${esc(when(o.ts))}</div></div>`).join('');
  const w = S.settings.wallet || {};
  $('#inbox').innerHTML = `<div class="inner">
    <div class="head-row"><h1>Posteingang der Agenten</h1><button id="inbox-refresh">Aktualisieren</button></div>
    <div class="card"><h2>Postfach ${S.settings.mail?.address ? `<span class="badge">${esc(S.settings.mail.address)}</span>` : ''}</h2>${mail}</div>
    <div class="card"><h2>SMS ${S.settings.sms?.number ? `<span class="badge">${esc(S.settings.sms.number)}</span>` : ''}</h2>${sms}</div>
    <div class="card"><h2>Zahlungen</h2><p class="note" style="margin-top:0">Diesen Monat freigegeben: ${esc(money(monthSpent(), w.currency || 'EUR'))} von ${esc(money(w.monthlyBudget || 0, w.currency || 'EUR'))}</p>${payments}</div>
    ${outbox ? `<div class="card"><h2>Von Agenten gesendet</h2>${outbox}</div>` : ''}
  </div>`;
  $('#inbox-refresh').onclick = () => loadInbox(true);
}

$('#inbox').addEventListener('click', async (event) => {
  const chatId = event.target.dataset.chat;
  if (chatId) return selectChat(chatId);
  const mailId = event.target.closest('[data-mail]')?.dataset.mail;
  if (mailId) showMail(mailId);
});

async function showMail(mailId) {
  try {
    const m = await api('GET', `/api/inbox/mail/${encodeURIComponent(mailId)}`);
    const dialog = $('#dialog');
    dialog.innerHTML = `<h2>${esc(m.subject || '(kein Betreff)')}</h2><p class="note" style="margin:0">${esc(m.from)} · ${esc(when(m.ts))}</p>
      <div class="mail-body">${esc(m.text)}</div><div class="form"><div class="actions"><button id="dialog-cancel">Schließen</button></div></div>`;
    $('#dialog-cancel').onclick = () => dialog.close();
    dialog.showModal();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Tresor ----------

const scopeName = (scope) => (scope === 'alle' ? 'alle Projekte' : S.projects.find((p) => p.id === scope)?.name || 'gelöschtes Projekt');
const reveal = (loginId) => api('POST', `/api/vault/${loginId}/reveal`);

function renderVault() {
  if (document.activeElement?.id === 'vault-search' && $('#vault-list')) return renderVaultList();
  $('#vault').innerHTML = `<div class="inner">
    <div class="head-row"><h1>Tresor</h1>
      <input id="vault-search" type="search" placeholder="Suchen" value="${esc(S.vaultSearch)}" style="width:220px">
      <button class="primary" id="vault-new">Neuer Zugang</button></div>
    <p class="note">Der Passwortmanager der Agenten. Sie legen hier jedes Konto ab, das sie anlegen, mit erzeugtem Passwort und, wo nötig, dem Schlüssel für die Zwei-Faktor-Anmeldung. Codes erzeugt der Leitstand selbst, ohne dein Handy. Zugänge, die du selbst einträgst, können sie genauso nutzen. Hier steht nur, was Agenten anlegen oder du von Hand einträgst; aus deinem Schlüsselbund oder Browser wird nichts übernommen. Alles liegt verschlüsselt auf diesem Rechner.</p>
    <div id="vault-list"></div>
  </div>`;
  $('#vault-new').onclick = () => loginDialog(null);
  $('#vault-search').oninput = (event) => {
    S.vaultSearch = event.target.value;
    renderVaultList();
  };
  renderVaultList();
}

function renderVaultList() {
  const query = S.vaultSearch.trim().toLowerCase();
  const entries = S.logins
    .filter((e) => !query || `${e.name} ${e.user} ${e.url} ${scopeName(e.scope)}`.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  $('#vault-list').innerHTML = entries.map((e) => {
    const link = /^https?:\/\//.test(e.url) ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url.replace(/^https?:\/\//, ''))}</a>` : esc(e.url);
    const trail = e.lastUsedAt
      ? `zuletzt genutzt von ${esc(scopeName(e.lastUsedBy))}, ${esc(ago(e.lastUsedAt))}`
      : `angelegt ${esc(when(e.createdAt))}${e.createdBy === 'mensch' ? ' von dir' : ` von ${esc(scopeName(e.createdBy))}`}`;
    return `<div class="card login" data-login="${e.id}">
      <h2>${esc(e.name)} <span class="badge">${esc(scopeName(e.scope))}</span>${e.hasTotp ? ' <span class="badge ok">2FA</span>' : ''}</h2>
      <div class="path">${[esc(e.user), link].filter(Boolean).join(' · ') || 'ohne Benutzername'} · ${trail}</div>
      <div class="row">
        ${e.user ? '<button data-a="copy-user">Benutzer kopieren</button>' : ''}
        <button class="primary" data-a="copy-password">Passwort kopieren</button>
        ${e.hasTotp ? '<button data-a="copy-code">2FA-Code kopieren</button>' : ''}
        <button data-a="show">Anzeigen</button>
        ${e.user.includes('@') && S.settings.mail?.address !== e.user ? '<button data-a="use-as-mail" title="Adresse und Passwort dieses Zugangs als Postfach der Agenten eintragen">Als Postfach nutzen</button>' : ''}
        <button class="ghost" data-a="edit">Bearbeiten</button>
        <button class="ghost danger" data-a="delete">Löschen</button>
      </div>
      <div class="revealed" hidden></div>
    </div>`;
  }).join('') || `<div class="card"><p class="note" style="margin:0">${query ? 'Nichts gefunden.' : 'Noch keine Zugänge. Sobald ein Agent irgendwo ein Konto anlegt, steht es hier. Über „Neuer Zugang“ gibst du den Agenten ein Konto, das es schon gibt.'}</p></div>`;
}

$('#vault').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-a]');
  const card = event.target.closest('[data-login]');
  if (!button || !card) return;
  const entry = S.logins.find((e) => e.id === card.dataset.login);
  const action = button.dataset.a;
  const flash = (text) => {
    const label = button.textContent;
    button.textContent = text;
    setTimeout(() => (button.textContent = label), 1500);
  };
  try {
    if (action === 'copy-user') {
      await navigator.clipboard.writeText(entry.user);
      flash('Kopiert');
    } else if (action === 'copy-password') {
      await navigator.clipboard.writeText((await reveal(entry.id)).password);
      flash('Kopiert');
    } else if (action === 'copy-code') {
      const { totp } = await reveal(entry.id);
      await navigator.clipboard.writeText(totp.code);
      flash(`${totp.code} · noch ${totp.remaining} s`);
    } else if (action === 'show') {
      const box = card.querySelector('.revealed');
      if (!box.hidden) {
        box.hidden = true;
        box.innerHTML = '';
        button.textContent = 'Anzeigen';
        return;
      }
      const data = await reveal(entry.id);
      box.innerHTML = `<dl>
        <dt>Passwort</dt><dd><code>${esc(data.password)}</code></dd>
        ${data.totp ? `<dt>2FA-Code</dt><dd><code>${esc(data.totp.code)}</code> noch ${data.totp.remaining} s gültig</dd>` : ''}
        ${data.previous ? `<dt>Vorheriges Passwort</dt><dd><code>${esc(data.previous)}</code></dd>` : ''}
        ${data.note ? `<dt>Notiz</dt><dd class="mail-body" style="margin:0;max-height:none">${esc(data.note)}</dd>` : ''}
      </dl>`;
      box.hidden = false;
      button.textContent = 'Verbergen';
    } else if (action === 'use-as-mail') {
      if (!confirm(`„${entry.user}“ als Postfach der Agenten eintragen? Projekte nutzen es erst, wenn du dort „Postfach“ anhakst.`)) return;
      await api('POST', `/api/vault/${entry.id}/use-as-mail`);
      await refreshState();
      renderVault();
      const box = await api('GET', '/api/inbox?fresh=1').catch((err) => ({ mailError: err.message }));
      alert(box.mailError ? `Eingetragen, aber die Verbindung klappt noch nicht: ${box.mailError}` : `Eingetragen. Die Verbindung steht, ${box.mail.length} Nachrichten gelesen.`);
    } else if (action === 'edit') {
      loginDialog(entry, await reveal(entry.id));
    } else if (action === 'delete') {
      if (confirm(`Zugang „${entry.name}“ löschen? Das Konto beim Dienst bleibt bestehen, aber das Passwort ist dann weg.`)) await api('DELETE', `/api/vault/${entry.id}`);
    }
  } catch (err) {
    alert(err.message);
  }
});

function loginDialog(entry, secret = {}) {
  const scopes = [['alle', 'alle Projekte'], ...S.projects.map((p) => [p.id, `nur ${p.name}`])];
  openDialog(
    `<h2>${entry ? 'Zugang bearbeiten' : 'Neuer Zugang'}</h2>
    <label>Name des Dienstes<input name="name" required maxlength="80" value="${esc(entry?.name || '')}" placeholder="GitHub"></label>
    <div class="fields" style="margin:0">
      <label>Benutzername oder E-Mail<input name="user" autocomplete="off" value="${esc(entry?.user || '')}"></label>
      <label>Adresse der Anmeldeseite<input name="url" value="${esc(entry?.url || '')}" placeholder="https://"></label>
    </div>
    <label>Passwort<input name="password" type="password" autocomplete="new-password" placeholder="${entry ? 'leer lassen für unverändert' : 'leer lassen: der Leitstand erzeugt eines'}"></label>
    ${entry ? '<label class="check"><input type="checkbox" name="generate"> Neues Passwort erzeugen (das alte bleibt als Rückfall gespeichert)</label>' : ''}
    <label>2FA-Schlüssel (Einrichtungsschlüssel der Authenticator-App oder otpauth://-Adresse)<input name="totp" autocomplete="off" placeholder="${entry?.hasTotp ? 'gesetzt, leer lassen für unverändert' : 'optional'}"></label>
    <label>Notiz (etwa Wiederherstellungscodes)<textarea name="note" rows="3">${esc(secret.note || '')}</textarea></label>
    <label>Nutzbar für<select name="scope">${scopes.map(([value, label]) => `<option value="${value}" ${(entry?.scope || 'alle') === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`,
    (data) => (entry ? api('PATCH', `/api/vault/${entry.id}`, data) : api('POST', '/api/vault', data)),
    entry ? 'Speichern' : 'Anlegen',
  );
}

// ---------- Einstellungen ----------

function renderSettings() {
  const s = S.settings;
  const f = S.secretFlags;
  const secret = (set) => (set ? 'gesetzt, leer lassen für unverändert' : '');
  const v = (value) => esc(value ?? '');
  $('#settings').innerHTML = `<div class="inner">
    <h1>Einstellungen</h1>
    ${setupCard()}
    <p class="note">Die eigene Identität der Agenten. Welche Projekte sie nutzen dürfen, schaltest du unter „Projekte“ frei. Kennwörter und Kartendaten liegen verschlüsselt auf diesem Rechner (<code>data/secrets.enc</code>) und werden hier nie angezeigt.</p>

    <form class="card" data-section="mail">
      <h2>Postfach ${f.mailPassword ? '<span class="badge ok">eingerichtet</span>' : ''}</h2>
      <p class="note">Ein eigenes Postfach nur für die Agenten, mit einem App-Kennwort für IMAP und SMTP. Empfehlung: mailbox.org Standard.</p>
      <div class="fields">
        <label>Adresse<input name="address" type="email" value="${v(s.mail.address)}" placeholder="agent@mailbox.org"></label>
        <label>Benutzername (meist die Adresse)<input name="user" value="${v(s.mail.user)}"></label>
        <label>IMAP-Server<input name="imapHost" value="${v(s.mail.imapHost)}" placeholder="imap.mailbox.org"></label>
        <label>IMAP-Port<input name="imapPort" type="number" value="${v(s.mail.imapPort)}"></label>
        <label>SMTP-Server<input name="smtpHost" value="${v(s.mail.smtpHost)}" placeholder="smtp.mailbox.org"></label>
        <label>SMTP-Port<input name="smtpPort" type="number" value="${v(s.mail.smtpPort)}"></label>
        <label class="span2">App-Kennwort<input name="password" type="password" autocomplete="off" placeholder="${secret(f.mailPassword)}"></label>
      </div>
      <div class="row"><button class="primary" type="submit">Speichern</button><button type="button" data-a="test-mail">Verbindung testen</button><span class="note" data-result></span></div>
    </form>

    <form class="card" data-section="sms">
      <h2>Telefonnummer für SMS</h2>
      <p class="note">Viele Dienste lehnen Internet-Nummern ab. Am zuverlässigsten ist eine Prepaid-SIM in einem alten Android-Handy, das eingehende SMS an das Postfach der Agenten weiterleitet. Die Codes findet der Agent dann mit <code>leitstand mail codes</code>.</p>
      <div class="fields">
        <label>Empfang über<select name="provider">
          <option value="mail" ${s.sms.provider === 'mail' ? 'selected' : ''}>Weiterleitung ins Postfach (empfohlen)</option>
          <option value="twilio" ${s.sms.provider === 'twilio' ? 'selected' : ''}>Twilio (nur mit Gewerbenachweis)</option>
        </select></label>
        <label>Nummer der Agenten<input name="number" value="${v(s.sms.number)}" placeholder="+49151…"></label>
        <label>Twilio Account SID<input name="accountSid" value="${v(s.sms.accountSid)}"></label>
        <label>Twilio Auth Token<input name="authToken" type="password" autocomplete="off" placeholder="${secret(f.smsToken)}"></label>
      </div>
      <div class="row"><button class="primary" type="submit">Speichern</button><span class="note" data-result></span></div>
    </form>

    <form class="card" data-section="wallet">
      <h2>Karte ${f.card ? `<span class="badge ok">${esc(f.card)}</span>` : ''}</h2>
      <p class="note">Eine virtuelle Karte nur für die Agenten, mit eigenem Limit beim Anbieter. Empfehlung: Revolut, virtuelle Karte mit Monatslimit, nur das Budget aufladen. Die Grenzen hier bestimmen, was ohne deine Freigabe durchgeht; die harte Grenze ist das Limit der Karte selbst.</p>
      <div class="fields three">
        <label>Ohne Rückfrage bis (je Zahlung)<input name="autoApprove" type="number" min="0" step="0.01" value="${v(s.wallet.autoApprove)}"></label>
        <label>Monatsbudget<input name="monthlyBudget" type="number" min="0" step="0.01" value="${v(s.wallet.monthlyBudget)}"></label>
        <label>Währung<input name="currency" maxlength="3" value="${v(s.wallet.currency)}"></label>
        <label class="span2">Kartennummer<input name="number" autocomplete="off" inputmode="numeric" placeholder="${f.card ? `${esc(f.card)}, leer lassen für unverändert` : ''}"></label>
        <label>Gültig bis (MM/JJ)<input name="expiry" autocomplete="off" placeholder="08/29"></label>
        <label>Prüfziffer<input name="cvc" type="password" autocomplete="off"></label>
        <label class="span2">Karteninhaber<input name="holder" autocomplete="off"></label>
        <label class="span2" style="grid-column:1/-1">Rechnungsadresse<input name="address" autocomplete="off"></label>
      </div>
      <div class="row"><button class="primary" type="submit">Speichern</button>${f.card ? '<button type="button" class="ghost danger" data-a="clear-card">Karte entfernen</button>' : ''}<span class="note" data-result></span></div>
    </form>

    <form class="card" data-section="hetzner">
      <h2>Hetzner Cloud ${f.hetzner ? '<span class="badge ok">Token gesetzt</span>' : ''}</h2>
      <p class="note">Mit einem API-Token (Hetzner Console → Projekt → Sicherheit → API-Tokens, Lesen und Schreiben) erstellt und löscht der Leitstand Server unter „Flotte“ auf Knopfdruck.</p>
      <div class="fields">
        <label>API-Token<input name="token" type="password" autocomplete="off" placeholder="${secret(f.hetzner)}"></label>
        <label>Standort<select name="location">${[['nbg1', 'Nürnberg'], ['fsn1', 'Falkenstein'], ['hel1', 'Helsinki (rund 15 % günstiger)']].map(([code, label]) => `<option value="${code}" ${s.hetzner.location === code ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>
      <div class="row"><button class="primary" type="submit">Speichern</button><span class="note" data-result></span></div>
    </form>

    <form class="card" data-section="access">
      <h2>Zugriff vom Handy ${f.access ? '<span class="badge ok">Kennwort gesetzt</span>' : ''}</h2>
      <p class="note">Der Leitstand ist nur von diesem Rechner aus erreichbar. Für unterwegs gibst du ihn in deinem privaten Tailscale-Netz frei:</p>
      <ol class="steps">
        <li>Auf diesem Rechner: <code>tailscale serve --bg 4747</code>. Der Befehl zeigt die Adresse, etwa <code>mein-mac.tail1234.ts.net</code>.</li>
        <li>Diese Adresse und ein Kennwort hier eintragen.</li>
        <li>Auf dem Handy (Tailscale an) <code>https://</code> plus Adresse öffnen, anmelden und zum Home-Bildschirm hinzufügen.</li>
      </ol>
      <div class="fields">
        <label>Erlaubte Adressen (durch Leerzeichen getrennt)<input name="hosts" value="${v((s.access.hosts || []).join(' '))}" placeholder="mein-mac.tail1234.ts.net"></label>
        <label>Zugangskennwort (mindestens 16 Zeichen)<input name="token" type="password" autocomplete="new-password" placeholder="${secret(f.access)}"></label>
      </div>
      <div class="row"><button class="primary" type="submit">Speichern</button><span class="note" data-result></span></div>
    </form>
  </div>`;
}

$('#settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const result = form.querySelector('[data-result]');
  try {
    await api('PUT', `/api/settings/${form.dataset.section}`, Object.fromEntries(new FormData(form)));
    await refreshState();
    renderSettings();
    $(`#settings [data-section="${form.dataset.section}"] [data-result]`).textContent = 'Gespeichert.';
  } catch (err) {
    result.textContent = err.message;
  }
});
$('#settings').addEventListener('click', async (event) => {
  const action = event.target.dataset.a;
  const result = event.target.closest('form')?.querySelector('[data-result]');
  if (action === 'test-mail') {
    result.textContent = 'Prüft …';
    const box = await api('GET', '/api/inbox?fresh=1').catch((err) => ({ mailError: err.message }));
    result.textContent = box.mailError || `Verbindung steht, ${box.mail.length} Nachrichten gelesen.`;
  }
  if (action === 'clear-card' && confirm('Die hinterlegte Karte entfernen?')) {
    await run(api('PUT', '/api/settings/wallet', { ...S.settings.wallet, clearCard: true }));
    await refreshState();
    renderSettings();
  }
});

// ---------- Rahmen ----------

const VIEWS = ['overview', 'chats', 'files', 'pages', 'inbox', 'vault', 'spend', 'fleet', 'projects', 'settings'];

function setView(view) {
  const entering = S.view !== view;
  S.view = view;
  if (location.hash.slice(1).split('/')[0] !== view) history.replaceState(null, '', view === 'overview' ? location.pathname : `#${view}`);
  for (const name of VIEWS) $(`#view-${name}`).hidden = name !== view;
  for (const button of $('#tabs').children) button.classList.toggle('active', button.dataset.view === view);
  document.body.classList.toggle('detail', (view === 'chats' && Boolean(S.chats.get(S.chatId))) || (view === 'pages' && Boolean(S.pageName)) || (view === 'files' && Boolean(S.files.file)));
  renderCapsule();
  if (!entering) return;
  if (view === 'overview') loadOverview();
  if (view === 'files') openFiles(S.files.projectId, S.files.path, S.files.file);
  if (view === 'inbox') loadInbox();
  if (view === 'vault') renderVault();
  if (view === 'spend') renderSpend();
  if (view === 'fleet') renderFleet();
  if (view === 'settings') renderSettings();
  if (view === 'projects') renderProjects();
}

function renderAll() {
  renderMeters();
  renderCapsule();
  renderChatList();
  const waiting = queue().length;
  document.title = waiting ? `(${waiting}) Leitstand` : 'Leitstand';
}

$('#tabs').onclick = (event) => {
  const view = event.target.dataset.view;
  if (view) setView(view);
};
$('#new-chat').onclick = newChatDialog;
$('#new-page').onclick = newPageDialog;
$('#chat-filter').onclick = (event) => {
  const filter = event.target.dataset.filter;
  if (!filter) return;
  S.chatFilter = filter;
  renderChatList();
};
$('#chat-list').onclick = (event) => {
  const chatId = event.target.closest('[data-chat]')?.dataset.chat;
  if (chatId) selectChat(chatId);
};
$('#page-list').onclick = (event) => {
  const name = event.target.closest('[data-page]')?.dataset.page;
  if (name) run(openPage(name));
};

// Leertaste: zum nächsten Chat, der eine Entscheidung braucht.
document.addEventListener('keydown', (event) => {
  if (event.key !== ' ' || event.metaKey || event.ctrlKey || event.altKey) return;
  if ($('#dialog').open || event.target.closest('input, textarea, select, button, [contenteditable]')) return;
  event.preventDefault();
  goNext();
});

function applyState(data) {
  S.projects = data.projects;
  S.chats = new Map(data.chats.map((c) => [c.id, c]));
  S.pages = data.pages;
  S.machines = data.machines;
  S.accounts = data.accounts;
  S.settings = data.settings;
  S.secretFlags = data.secretFlags;
  S.payments = data.payments;
  S.outbox = data.outbox;
  S.subscriptions = data.subscriptions || [];
  S.logins = data.logins;
  S.publicKey = data.publicKey;
  S.contextDir = data.contextDir;
}
const refreshState = async () => applyState(await api('GET', '/api/state'));

function connect() {
  const source = new EventSource('/api/events');
  source.addEventListener('chat', (event) => {
    const chat = JSON.parse(event.data);
    S.chats.set(chat.id, chat);
    renderAll();
    if (chat.id === S.chatId) updateChat();
    if (S.view === 'fleet') renderFleet();
    refreshOverviewLive();
  });
  source.addEventListener('projects', (event) => {
    S.projects = JSON.parse(event.data);
    renderAll();
    renderProjects();
    if (!S.chats.get(S.chatId)) buildChat();
  });
  source.addEventListener('fleet', (event) => {
    Object.assign(S, JSON.parse(event.data));
    renderMeters();
    if (S.view === 'fleet') renderFleet();
    if (!S.chats.get(S.chatId)) buildChat();
  });
  source.addEventListener('settings', (event) => {
    Object.assign(S, JSON.parse(event.data));
    if (S.view === 'inbox' && S.inbox) renderInbox();
    if (S.view === 'vault') renderVault();
    if (S.view === 'spend') renderSpend();
    renderAll();
    if (S.chatId) updateChat();
    if (!S.chats.get(S.chatId)) buildChat();
    refreshOverviewLive();
  });
  source.addEventListener('pages', (event) => {
    S.pages = JSON.parse(event.data);
    renderPageList();
    if (S.pageName && !S.pageEdit && S.pages.some((p) => p.name === S.pageName)) openPage(S.pageName).catch(() => {});
  });
  // Nach einer Unterbrechung (Neustart, Handy war im Hintergrund) den ganzen Stand neu holen.
  let opened = false;
  source.onopen = () => {
    if (opened) refreshState().then(() => { renderAll(); if (S.chatId) updateChat(); });
    opened = true;
  };
}

async function init() {
  await refreshState();
  const narrow = matchMedia('(max-width: 760px)').matches;
  S.chatId = narrow ? null : queue()[0]?.id || null;
  loadOverview();
  setInterval(() => S.view === 'overview' && !document.hidden && loadOverview(), 90_000);
  buildChat();
  renderAll();
  renderPageList();
  renderPage();
  renderProjects();
  const [startView, startSection] = location.hash.slice(1).split('/');
  if (VIEWS.includes(startView)) setView(startView);
  if (startSection) {
    const form = $(`#settings [data-section="${startSection}"]`);
    form?.scrollIntoView({ block: 'start' });
    form?.querySelector('input[name="number"], input:not([value]), input[value=""]')?.focus({ preventScroll: true });
  }
  connect();
  setInterval(() => {
    renderAll();
    if (S.chatId) updateChat();
  }, 30_000);
}

init().catch((err) => {
  document.body.insertAdjacentHTML('beforeend', `<div class="empty"><h2>Leitstand nicht erreichbar</h2><p>${esc(err.message)}</p></div>`);
});
