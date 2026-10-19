// État de l'appli : session, membres, liste des mois, mois affiché, synchronisation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ecrire, envoyerFile, fileAttente, HorsLigne, lireSession, SessionExpiree, stock, surFile, surSession } from './api.js';
import { appliquer } from './local.js';
import { calculer } from './calc.js';
import { eurosSigne, moisCourant, nomMois } from './format.js';

const cleCache = (moisId) => `cache-mois-${moisId}`;

/** Mois à ouvrir : le mois en cours (même s'il reste à préparer), sinon le dernier mois connu. */
function choisirMois(liste) {
  const courant = moisCourant();
  if (!liste?.length) return null;
  const dernier = liste[liste.length - 1].id;
  if (liste.some((m) => m.id === courant) || courant > dernier) return courant;
  return (liste.filter((m) => m.id <= courant).pop() || liste[liste.length - 1]).id;
}

const serveurInitialLe = () => { const id = choisirMois(stock.lire('cache-liste-mois', [])); return id ? stock.lire(cleCache(id))?.le || null : null; };

export function useBudget() {
  const [session, setSession] = useState(lireSession());
  const [membres, setMembres] = useState(stock.lire('cache-membres'));
  const [listeMois, setListeMois] = useState(stock.lire('cache-liste-mois', []));
  const [moisId, setMoisId] = useState(() => choisirMois(stock.lire('cache-liste-mois', [])));
  const [serveur, setServeur] = useState(() => { const id = choisirMois(stock.lire('cache-liste-mois', [])); return id ? stock.lire(cleCache(id)) : null; }); // { moisId, mois, lignes } reçu ou en cache
  const [file, setFile] = useState(fileAttente());
  const [reseau, setReseau] = useState(navigator.onLine ? 'ok' : 'hors-ligne');
  const [majLe, setMajLe] = useState(() => serveurInitialLe());
  const [message, setMessage] = useState(null);
  const moisRef = useRef(moisId);
  moisRef.current = moisId;

  useEffect(() => surSession(setSession), []);
  useEffect(() => surFile(setFile), []);

  const signaler = useCallback((texte, ton = 'info') => setMessage({ texte, ton, id: Date.now() }), []);

  const traiterErreur = useCallback((err) => {
    if (err instanceof HorsLigne) { setReseau('hors-ligne'); return; }
    if (err instanceof SessionExpiree) return; // l'écran de connexion s'affiche
    signaler(`Le serveur a refusé la demande : ${err.message}`, 'erreur');
  }, [signaler]);

  const chargerListe = useCallback(async () => {
    const [m, l] = await Promise.all([
      api('membres?select=email,prenom'),
      api('mois?select=*&order=id.asc'),
    ]);
    setMembres(m); stock.ecrire('cache-membres', m);
    setListeMois(l); stock.ecrire('cache-liste-mois', l);
    return { membres: m, liste: l };
  }, []);

  const chargerMois = useCallback(async (id) => {
    const lignes = await api(`lignes?mois_id=eq.${id}&select=*,operations(*)&order=ordre.asc`);
    const [mois] = await api(`mois?id=eq.${id}&select=*`);
    const d = { moisId: id, mois, lignes, le: new Date().toISOString() };
    stock.ecrire(cleCache(id), d);
    if (moisRef.current === id) { setServeur(d); setMajLe(d.le); }
    return d;
  }, []);

  /** Envoie la file d'attente puis recharge depuis le serveur. */
  const synchroniser = useCallback(async () => {
    if (!lireSession()) return;
    try {
      const refusees = await envoyerFile();
      refusees.forEach((r) => signaler(`Une modification n'a pas pu être enregistrée : ${r.erreur.message}`, 'erreur'));
      const { liste } = await chargerListe();
      setReseau('ok');
      let id = moisRef.current;
      if (!id) {
        id = choisirMois(liste) || moisCourant();
        setMoisId(id);
        moisRef.current = id;
      }
      if (liste.some((m) => m.id === id)) await chargerMois(id);
      else setServeur({ moisId: id, mois: null, lignes: [] });
    } catch (err) { traiterErreur(err); }
  }, [chargerListe, chargerMois, signaler, traiterErreur]);

  // Premier chargement et resynchronisation au retour dans l'appli / du réseau
  useEffect(() => {
    if (!session) return undefined;
    synchroniser();
    const auRetour = () => { if (document.visibilityState === 'visible') synchroniser(); };
    const enLigne = () => { setReseau('ok'); synchroniser(); };
    const horsLigne = () => setReseau('hors-ligne');
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('online', enLigne);
    window.addEventListener('offline', horsLigne);
    return () => {
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('online', enLigne);
      window.removeEventListener('offline', horsLigne);
    };
  }, [session, synchroniser]);

  // Actualisation automatique : toutes les 10 s, on lit le petit compteur de modifications ;
  // si le mois affiché a changé (téléphone d'Anne, fichier Excel du PC…), on le recharge.
  const versionsRef = useRef(null);
  useEffect(() => {
    if (!session) return undefined;
    versionsRef.current = null;
    let actif = true;
    const regarder = async () => {
      if (!actif || document.visibilityState !== 'visible' || !navigator.onLine) return;
      try {
        const liste = await api('versions_mois?select=mois_id,version');
        const v = Object.fromEntries(liste.map((x) => [x.mois_id, x.version]));
        const avant = versionsRef.current;
        versionsRef.current = v;
        if (!avant) return;
        if (Object.keys(v).some((k) => !(k in avant))) await chargerListe();
        const id = moisRef.current;
        if (id && v[id] !== avant[id] && !fileAttente().length) await chargerMois(id);
      } catch { /* réseau absent : on réessaiera */ }
    };
    regarder();
    const minuterie = setInterval(regarder, 10000);
    return () => { actif = false; clearInterval(minuterie); };
  }, [session, chargerListe, chargerMois]);

  // Sans session : choisir un mois depuis le cache pour l'affichage hors ligne
  const changerMois = useCallback((id) => {
    setMoisId(id);
    moisRef.current = id;
    const cache = stock.lire(cleCache(id));
    setServeur(cache || { moisId: id, mois: listeMois.find((m) => m.id === id) || null, lignes: [] });
    setMajLe(cache?.le || null);
    if (listeMois.some((m) => m.id === id)) chargerMois(id).catch(traiterErreur);
  }, [chargerMois, listeMois, traiterErreur]);

  // Données affichées = serveur + écritures en attente
  const donnees = useMemo(() => {
    let d = serveur;
    if (!d && moisId) d = stock.lire(cleCache(moisId));
    if (!d) return null;
    for (const e of file) d = appliquer(d, e);
    return d;
  }, [serveur, file, moisId]);

  const budget = useMemo(() => (donnees?.mois ? calculer(donnees.mois, donnees.lignes) : null), [donnees]);

  /** Enregistre une écriture : affichée tout de suite, envoyée maintenant ou plus tard. */
  const enregistrer = useCallback(async (entree, confirmation) => {
    const p = ecrire({ moisId: moisRef.current, ...entree });
    const refusees = await p.catch(() => []);
    if (refusees?.length) refusees.forEach((r) => signaler(`Pas enregistré : ${r.erreur.message}`, 'erreur'));
    else if (fileAttente().length) { setReseau('hors-ligne'); signaler(`${confirmation}. Envoi dès le retour du réseau.`); }
    else {
      signaler(confirmation, 'ok');
      chargerMois(moisRef.current).catch(traiterErreur);
    }
  }, [chargerMois, signaler, traiterErreur]);

  const actions = useMemo(() => ({
    ajouterOperation(op) {
      const data = { id: crypto.randomUUID(), saisi_par: lireSession()?.email, ...op };
      const { saisi_par: _ignore, ...corps } = data;
      return enregistrer({
        genre: 'operation-ajout', data,
        chemin: 'operations', method: 'POST', body: corps,
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      }, 'Enregistré');
    },
    modifierOperation(id, champs) {
      return enregistrer({
        genre: 'operation-modif', data: { id, ...champs },
        chemin: `operations?id=eq.${id}`, method: 'PATCH', body: champs, headers: { Prefer: 'return=minimal' },
      }, 'Modifié');
    },
    supprimerOperation(id) {
      return enregistrer({
        genre: 'operation-suppr', data: { id },
        chemin: `operations?id=eq.${id}`, method: 'DELETE', headers: { Prefer: 'return=minimal' },
      }, 'Supprimé');
    },
    modifierLigne(id, champs) {
      return enregistrer({
        genre: 'ligne-modif', data: { id, ...champs },
        chemin: `lignes?id=eq.${id}`, method: 'PATCH', body: champs, headers: { Prefer: 'return=minimal' },
      }, 'Ligne mise à jour');
    },
    ajouterLigne(ligne) {
      const data = { id: crypto.randomUUID(), mois_id: moisRef.current, ...ligne };
      return enregistrer({
        genre: 'ligne-ajout', data,
        chemin: 'lignes', method: 'POST', body: data, headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      }, 'Ligne ajoutée');
    },
    modifierMois(champs) {
      const id = moisRef.current;
      return enregistrer({
        genre: 'mois-modif', data: champs,
        chemin: `mois?id=eq.${id}`, method: 'PATCH', body: champs, headers: { Prefer: 'return=minimal' },
      }, 'Réglage enregistré');
    },
    async preparerMois(sourceId, cibleId) {
      try {
        // Le solde du mois source (report compris) devient le report du nouveau mois
        const [srcMois] = await api(`mois?id=eq.${sourceId}&select=*`);
        const srcLignes = await api(`lignes?mois_id=eq.${sourceId}&select=*,operations(*)&order=ordre.asc`);
        const report = calculer(srcMois, srcLignes).soldeAvecReport;
        const note = `Solde fin ${nomMois(sourceId).toLowerCase()} (${eurosSigne(report)})`;
        await api('rpc/preparer_mois', { method: 'POST', body: { source_id: sourceId, cible_id: cibleId, report, note } });
        await chargerListe();
        moisRef.current = cibleId;
        setMoisId(cibleId);
        await chargerMois(cibleId);
        signaler('Mois préparé', 'ok');
        return true;
      } catch (err) {
        if (err instanceof HorsLigne) signaler('Il faut du réseau pour préparer un nouveau mois.', 'erreur');
        else traiterErreur(err);
        return false;
      }
    },
  }), [enregistrer, chargerListe, chargerMois, signaler, traiterErreur]);

  const enAttente = file.length;
  return {
    session, membres, listeMois, moisId, donnees, budget, reseau, majLe, enAttente, message,
    fermerMessage: () => setMessage(null), changerMois, synchroniser, actions, signaler,
  };
}
