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

export function calculer(mois, lignesBrutes) {
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
  const report = r2(mois?.report_solde || 0);
  const soldeReel = r2(revenusReel - depensesReel);

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
    soldeAvecReport: r2(soldeReel + report),
  };
}

/** Ligne « Courses » correspondant à la date : semaine 1 = jours 1-7, …, semaine 5 = 29-31. */
export function ligneCourses(lignes, date) {
  const jour = date ? Number(date.slice(8, 10)) : new Date().getDate();
  const n = Math.min(5, Math.ceil(jour / 7));
  return lignes.find((l) => l.groupe === 'Courses' && l.libelle === `Semaine ${n}`)
      || lignes.find((l) => l.groupe === 'Courses' && /^Semaine/.test(l.libelle));
}
