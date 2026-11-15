// Abos und laufende Käufe: was das System gebucht hat, was es kostet, bis wann es bezahlt ist
// und wie man es kündigt. Der Leitstand führt nur Buch; gekündigt wird nichts von selbst.
import { state, changed, id, httpError, findProject } from './store.js';

const INTERVALS = {
  einmalig: 'einmalig', einmal: 'einmalig', once: 'einmalig',
  monat: 'monat', monatlich: 'monat', month: 'monat',
  jahr: 'jahr', 'jährlich': 'jahr', jaehrlich: 'jahr', year: 'jahr',
  woche: 'woche', 'wöchentlich': 'woche', woechentlich: 'woche',
};

// Nimmt 2027-01-14 oder 14.01.2027 an.
export function parseDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const date = german ? new Date(Number(german[3]), Number(german[2]) - 1, Number(german[1])) : new Date(text);
  if (Number.isNaN(date.getTime())) throw httpError(400, `„${text}“ ist kein Datum. Erwartet: JJJJ-MM-TT oder TT.MM.JJJJ.`);
  return date.getTime();
}

function yesNo(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  return /^(ja|yes|true|1|auto)/i.test(String(value).trim());
}

// Was ein Eintrag umgerechnet im Monat kostet.
export function monthlyCost(sub) {
  if (sub.status !== 'aktiv') return 0;
  return { monat: sub.cost, jahr: sub.cost / 12, woche: sub.cost * 4.33, einmalig: 0 }[sub.interval] || 0;
}

export const findSubscription = (name) =>
  state.subscriptions.find((s) => s.name.toLowerCase() === String(name).trim().toLowerCase());

// Legt einen Eintrag an oder ergänzt ihn. Nur übergebene Felder werden geändert.
export function upsertSubscription(fields, by = {}) {
  const name = String(fields.name ?? '').trim().slice(0, 80);
  if (!name) throw httpError(400, 'Der Eintrag braucht einen Namen (den Dienst oder Anbieter).');
  let sub = fields.id ? state.subscriptions.find((s) => s.id === fields.id) : findSubscription(name);
  if (!sub) {
    sub = {
      id: id(), name, cost: 0, currency: state.settings.wallet.currency, interval: 'monat', paidUntil: null,
      autoRenew: null, cancel: '', purpose: '', login: '', status: 'aktiv',
      projectId: by.projectId || null, chatId: by.chatId || null, createdAt: Date.now(),
    };
    state.subscriptions.push(sub);
  }
  sub.name = name;
  if (fields.cost !== undefined && fields.cost !== '') {
    const cost = Number(String(fields.cost).replace(',', '.'));
    if (!(cost >= 0)) throw httpError(400, 'Die Kosten müssen eine Zahl sein, etwa 4 oder 37.27.');
    sub.cost = cost;
  }
  if (fields.currency) sub.currency = String(fields.currency).trim().toUpperCase().slice(0, 3);
  if (fields.interval) {
    const interval = INTERVALS[String(fields.interval).trim().toLowerCase()];
    if (!interval) throw httpError(400, 'Das Intervall ist monat, jahr, woche oder einmalig.');
    sub.interval = interval;
  }
  if (fields.paidUntil !== undefined) sub.paidUntil = parseDate(fields.paidUntil);
  if (fields.autoRenew !== undefined) sub.autoRenew = yesNo(fields.autoRenew);
  if (fields.cancel !== undefined) sub.cancel = String(fields.cancel).trim().slice(0, 400);
  if (fields.purpose !== undefined) sub.purpose = String(fields.purpose).trim().slice(0, 300);
  if (fields.login !== undefined) sub.login = String(fields.login).trim().slice(0, 80);
  if (fields.status === 'aktiv' || fields.status === 'beendet') sub.status = fields.status;
  sub.updatedAt = Date.now();
  changed('settings');
  return sub;
}

export function removeSubscription(sub) {
  state.subscriptions = state.subscriptions.filter((s) => s.id !== sub.id);
  changed('settings');
}

const day = (ts) => new Date(ts).toLocaleDateString('de-DE');

// Die Liste so, wie ein Agent sie zu lesen bekommt.
export function describeSubscriptions() {
  if (!state.subscriptions.length) return '(noch keine Abos oder laufenden Käufe)';
  return state.subscriptions
    .map((s) => {
      const parts = [
        `${s.name}: ${s.status === 'aktiv' ? 'aktiv' : 'beendet'}`,
        `${s.cost.toFixed(2)} ${s.currency} ${s.interval === 'einmalig' ? 'einmalig' : `je ${s.interval}`}`,
        s.paidUntil ? `bezahlt bis ${day(s.paidUntil)}` : '',
        s.autoRenew === null ? '' : s.autoRenew ? 'verlängert sich von selbst' : 'verlängert sich nicht von selbst',
        s.purpose ? `wofür: ${s.purpose}` : '',
        s.projectId ? `Projekt: ${findProject(s.projectId)?.name || '?'}` : '',
        s.login ? `Zugang im Tresor: ${s.login}` : '',
        s.cancel ? `kündigen: ${s.cancel}` : '',
      ];
      return parts.filter(Boolean).join(' · ');
    })
    .join('\n');
}
