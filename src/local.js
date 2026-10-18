// Applique une écriture en attente aux données affichées (affichage immédiat, même hors ligne).
export function appliquer(donnees, e) {
  if (!donnees || donnees.moisId !== e.moisId) return donnees;
  const lignes = donnees.lignes.map((l) => ({ ...l, operations: [...(l.operations || [])] }));
  let mois = donnees.mois;
  const d = e.data;
  switch (e.genre) {
    case 'operation-ajout': {
      const l = lignes.find((x) => x.id === d.ligne_id);
      if (l && !l.operations.some((o) => o.id === d.id)) l.operations.push({ ...d, _attente: true });
      break;
    }
    case 'operation-modif': {
      let op = null;
      for (const l of lignes) {
        const i = l.operations.findIndex((o) => o.id === d.id);
        if (i >= 0) { op = l.operations[i]; l.operations.splice(i, 1); }
      }
      const cible = lignes.find((x) => x.id === (d.ligne_id || op?.ligne_id));
      if (op && cible) cible.operations.push({ ...op, ...d, _attente: true });
      break;
    }
    case 'operation-suppr':
      for (const l of lignes) l.operations = l.operations.filter((o) => o.id !== d.id);
      break;
    case 'ligne-modif': {
      const l = lignes.find((x) => x.id === d.id);
      if (l) Object.assign(l, d);
      break;
    }
    case 'ligne-ajout':
      if (!lignes.some((l) => l.id === d.id)) lignes.push({ ...d, operations: [] });
      break;
    case 'mois-modif':
      mois = { ...mois, ...d };
      break;
    default:
  }
  return { ...donnees, lignes, mois };
}
