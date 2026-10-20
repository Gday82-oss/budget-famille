// Calculs du budget, identiques à ceux du classeur Excel :
// - réel d'une ligne = somme de ses opérations
// - Imprévus (prévu) = taux × (dépenses fixes + variables prévues), arrondi au centime
// - Total général = fixes + variables + imprévus + économies + divers
// - Solde = revenus − total général ; « avec report » ajoute le solde reporté du mois précédent
import { r2 } from './format.js';

export const BLOCS = [
  { id: 'fixe', titre: 'Dépenses fixes' },
  { id: 'variable', titre: 'Dépenses variables' },
  { id: 'provision', titre: 'Épargne et divers' },
  { id: 'revenu', titre: 'Revenus' },
];

/**
 * reportLie : quand le mois suit automatiquement le précédent (mois.report_auto),
 * c'est le « solde avec report » du mois précédent, calculé par la base (vue soldes_mois).
 */
export function calculer(mois, lignesBrutes, reportLie) {
  const lignes = [...(lignesBrutes || [])].sort((a, b) => a.ordre - b.ordre);
  const base = lignes.filter((l) => l.bloc === 'fixe' || l.bloc === 'variable');
  const prevuBase = r2(base.reduce((s, l) => s + Number(l.prevu || 0), 0));
  const taux = Number(mois?.taux_imprevus || 0);

  const calc = lignes.map((l) => {
    const ops = l.operations || [];
    const reel = r2(ops.reduce((s, o) => s + Number(o.montant), 0));
    const prevu = l.code === 'imprevus' ? r2(prevuBase * taux) : r2(l.prevu || 0);
    return { ...l, operations: ops, reel, prevu, prevuSaisi: l.prevu };
  });

  const groupes = [];
  const index = new Map();
  for (const l of calc) {
    const cle = `${l.bloc}|${l.groupe}`;
    if (!index.has(cle)) { index.set(cle, groupes.length); groupes.push({ cle, bloc: l.bloc, nom: l.groupe, lignes: [], prevu: 0, reel: 0 }); }
    const g = groupes[index.get(cle)];
    g.lignes.push(l);
    g.prevu = r2(g.prevu + l.prevu);
    g.reel = r2(g.reel + l.reel);
  }

  const somme = (blocs, champ) => r2(calc.filter((l) => blocs.includes(l.bloc)).reduce((s, l) => s + l[champ], 0));
  const depensesPrevu = somme(['fixe', 'variable', 'provision'], 'prevu');
  const depensesReel = somme(['fixe', 'variable', 'provision'], 'reel');
  const revenusPrevu = somme(['revenu'], 'prevu');
  const revenusReel = somme(['revenu'], 'reel');
  const soldeReel = r2(revenusReel - depensesReel);
  // Solde réel de fin de mois saisi tel quel (relevé) : il prime, le report s'en déduit
  const soldeFin = mois?.solde_fin == null ? null : r2(mois.solde_fin);
  const auto = soldeFin == null && Boolean(mois?.report_auto);
  const report = soldeFin != null ? r2(soldeFin - soldeReel)
    : r2(auto && reportLie != null ? reportLie : (mois?.report_solde || 0));

  return {
    lignes: calc,
    groupes,
    parBloc: Object.fromEntries(BLOCS.map((b) => [b.id, {
      prevu: somme([b.id], 'prevu'), reel: somme([b.id], 'reel'), groupes: groupes.filter((g) => g.bloc === b.id),
    }])),
    prevuBase,
    imprevusPrevu: r2(prevuBase * taux),
    depensesPrevu, depensesReel, revenusPrevu, revenusReel,
    resteADepenser: r2(depensesPrevu - depensesReel),
    soldePrevu: r2(revenusPrevu - depensesPrevu),
    soldeReel,
    report,
    reportAuto: auto,
    soldeFin,
    soldeAvecReport: r2(soldeReel + report),
  };
}

const jourMs = 86400000;
const enDate = (iso) => new Date(`${iso}T12:00:00`);
const versIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ecart = (a, b) => Math.round((enDate(b) - enDate(a)) / jourMs);

/** Début du mois de budget : date saisie, sinon premier revenu daté, sinon le 1er du mois. */
export function debutDuMois(mois, lignes) {
  if (mois?.debut) return mois.debut;
  const dates = (lignes || []).filter((l) => l.bloc === 'revenu')
    .flatMap((l) => (l.operations || []).map((o) => o.date)).filter(Boolean).sort();
  return dates[0] || `${mois?.id}-01`;
}

/** Période du mois de budget : du premier revenu jusqu'à la veille du mois suivant (ou 31 jours). */
export function periodeDuMois(mois, lignes, debutSuivant) {
  const debut = debutDuMois(mois, lignes);
  let fin;
  if (debutSuivant && debutSuivant > debut) {
    const d = enDate(debutSuivant); d.setDate(d.getDate() - 1); fin = versIso(d);
  } else if (debut.endsWith('-01')) {
    const d = enDate(debut); fin = versIso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  } else {
    const d = enDate(debut); d.setDate(d.getDate() + 30); fin = versIso(d);
  }
  return { debut, fin, jours: ecart(debut, fin) + 1 };
}

/** Jour du mois de budget (1, 2, …) pour une date ; 0 si avant le début. */
export function jourDuMois(periode, date) {
  return ecart(periode.debut, date) + 1;
}

/** Ligne « Courses » correspondant à la date : semaine 1 = 7 premiers jours du mois de budget, …, semaine 5 = le reste. */
export function ligneCourses(lignes, date, periode) {
  const jour = periode ? Math.max(1, jourDuMois(periode, date || versIso(new Date()))) : (date ? Number(date.slice(8, 10)) : new Date().getDate());
  const n = Math.min(5, Math.ceil(jour / 7));
  return lignes.find((l) => l.groupe === 'Courses' && l.libelle === `Semaine ${n}`)
      || lignes.find((l) => l.groupe === 'Courses' && /^Semaine/.test(l.libelle));
}
