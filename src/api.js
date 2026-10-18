// Accès à Supabase par appels HTTP directs (Auth + API REST), sans bibliothèque.
// Les écritures passent par une file d'attente : sans réseau, elles sont gardées
// sur le téléphone et envoyées dès que la connexion revient.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const stock = {
  lire(cle, defaut = null) { try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch { return defaut; } },
  ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  effacer(cle) { try { localStorage.removeItem(cle); } catch { /* idem */ } },
};

export class HorsLigne extends Error { constructor() { super('Pas de réseau'); } }
export class SessionExpiree extends Error { constructor() { super('Session expirée'); } }
export class ErreurApi extends Error { constructor(status, message) { super(message); this.status = status; } }

let session = stock.lire('session');
const abonnesSession = new Set();
export const lireSession = () => session;
export const surSession = (fn) => { abonnesSession.add(fn); return () => abonnesSession.delete(fn); };

function enregistrerSession(s) {
  session = s ? {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    email: (s.user?.email || session?.email || '').toLowerCase(),
  } : null;
  if (session) stock.ecrire('session', session); else stock.effacer('session');
  abonnesSession.forEach((fn) => fn(session));
}

async function appel(chemin, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const h = { apikey: SUPABASE_KEY, ...headers };
  if (auth && session) h.Authorization = `Bearer ${session.access_token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  try {
    return await fetch(SUPABASE_URL + chemin, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new HorsLigne();
  }
}

async function messageErreur(res) {
  try {
    const j = await res.json();
    return j.error_code || j.msg || j.message || j.error_description || j.error || res.statusText;
  } catch { return res.statusText; }
}

export async function connexion(email, motDePasse) {
  const res = await appel('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email.trim(), password: motDePasse }, auth: false });
  if (!res.ok) throw new ErreurApi(res.status, await messageErreur(res));
  enregistrerSession(await res.json());
  return session;
}

let renouvellement = null;
async function renouveler() {
  if (!session?.refresh_token) throw new SessionExpiree();
  renouvellement ??= (async () => {
    const res = await appel('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false });
    if (!res.ok) {
      if (res.status >= 400 && res.status < 500) { enregistrerSession(null); throw new SessionExpiree(); }
      throw new ErreurApi(res.status, await messageErreur(res));
    }
    enregistrerSession(await res.json());
  })().finally(() => { renouvellement = null; });
  return renouvellement;
}

export async function deconnexion() {
  try { await appel('/auth/v1/logout', { method: 'POST' }); } catch { /* hors ligne : on oublie la session quand même */ }
  enregistrerSession(null);
}

/** Requête vers l'API REST (PostgREST) avec renouvellement automatique de la session. */
export async function api(chemin, options = {}) {
  if (!session) throw new SessionExpiree();
  if (session.expires_at - 60 < Date.now() / 1000) await renouveler();
  let res = await appel(`/rest/v1/${chemin}`, options);
  if (res.status === 401) { await renouveler(); res = await appel(`/rest/v1/${chemin}`, options); }
  if (!res.ok) throw new ErreurApi(res.status, await messageErreur(res));
  const texte = res.status === 204 ? '' : await res.text();
  return texte ? JSON.parse(texte) : null;
}

// ---------- File d'attente des écritures ----------
let file = stock.lire('file-attente', []);
const abonnesFile = new Set();
export const fileAttente = () => file;
export const surFile = (fn) => { abonnesFile.add(fn); return () => abonnesFile.delete(fn); };
const publierFile = () => { stock.ecrire('file-attente', file); abonnesFile.forEach((fn) => fn(file)); };

/** Ajoute une écriture { genre, moisId, data, chemin, method, body, headers } et tente l'envoi. */
export function ecrire(entree) {
  file = [...file, { ...entree, cle: crypto.randomUUID() }];
  publierFile();
  return envoyerFile();
}

let envoi = null;
export function envoyerFile() {
  envoi ??= (async () => {
    const refusees = [];
    while (file.length) {
      const e = file[0];
      try {
        await api(e.chemin, { method: e.method, body: e.body, headers: e.headers });
      } catch (err) {
        if (err instanceof HorsLigne || err instanceof SessionExpiree || (err.status >= 500)) break;
        refusees.push({ entree: e, erreur: err });
      }
      file = file.slice(1);
      publierFile();
    }
    return refusees;
  })().finally(() => { envoi = null; });
  return envoi;
}
