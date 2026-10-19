// Menu : mois suivant, export Excel, réglages du mois, ajout d'une ligne, compte.
import { useState } from 'react';
import { deconnexion } from '../api.js';
import { euros, eurosSigne, lireMontant, moisDecale, nomMois, pourcent } from '../format.js';
import { Feuille } from './Feuille.jsx';

export function Reglages({ etat, onFermer, onPreparer, onExporter, installation }) {
  const { budget, donnees, moisId, listeMois, session, actions, synchroniser, enAttente } = etat;
  const mois = donnees?.mois;
  const suivant = moisDecale(moisId, 1);
  const suivantExiste = listeMois.some((m) => m.id === suivant);
  const [edition, setEdition] = useState(null);
  const [valeur, setValeur] = useState('');
  const [nouvelle, setNouvelle] = useState({ groupe: '', libelle: '', prevu: '' });

  const groupes = budget ? [...new Map(budget.lignes.map((l) => [`${l.bloc}|${l.groupe}`, { bloc: l.bloc, groupe: l.groupe }])).values()] : [];

  function editer(champ, initial) { setEdition(champ); setValeur(initial); }
  function valider(e) {
    e.preventDefault();
    if (edition === 'report') actions.modifierMois({ report_solde: lireMontant(valeur) });
    if (edition === 'taux') actions.modifierMois({ taux_imprevus: Math.max(0, Math.min(100, lireMontant(valeur))) / 100 });
    setEdition(null);
  }
  function ajouterLigne(e) {
    e.preventDefault();
    const g = groupes.find((x) => `${x.bloc}|${x.groupe}` === nouvelle.groupe);
    if (!g || !nouvelle.libelle.trim()) return;
    const ordre = Math.max(0, ...budget.lignes.filter((l) => l.bloc === g.bloc && l.groupe === g.groupe).map((l) => l.ordre)) + 1;
    actions.ajouterLigne({ bloc: g.bloc, groupe: g.groupe, libelle: nouvelle.libelle.trim(), prevu: nouvelle.prevu ? lireMontant(nouvelle.prevu) : null, ordre });
    setNouvelle({ groupe: '', libelle: '', prevu: '' });
    setEdition(null);
  }

  return (
    <Feuille titre={nomMois(moisId)} sousTitre="Réglages et export" onFermer={onFermer}>
      <ul className="menu-liste">
        {budget && !suivantExiste && (
          <li>
            <button type="button" className="menu-item" onClick={() => onPreparer(moisId, suivant)}>
              <span>Préparer {nomMois(suivant, false).toLowerCase()}</span>
              <span className="discret">Recopie les lignes et les montants prévus. Solde reporté : {eurosSigne(budget.soldeAvecReport)}</span>
            </button>
          </li>
        )}
        {budget && (
          <li>
            <button type="button" className="menu-item" onClick={onExporter}>
              <span>Exporter en Excel</span>
              <span className="discret">Fichier au format de votre classeur, dans Téléchargements</span>
            </button>
          </li>
        )}
        {mois && (
          <li>
            {edition === 'report' ? (
              <form className="menu-form" onSubmit={valider}>
                <label className="champ"><span>Solde de fin du mois précédent, avec un moins s’il était négatif (par exemple -585,04)</span>
                  <input autoFocus inputMode="text" value={valeur} onChange={(e) => setValeur(e.target.value)} /></label>
                <button type="submit" className="bouton principal petit">Enregistrer</button>
              </form>
            ) : (
              <button type="button" className="menu-item" onClick={() => editer('report', String(mois.report_solde ?? 0).replace('.', ','))}>
                <span>Solde reporté du mois précédent</span>
                <span className="discret">{eurosSigne(Number(mois.report_solde || 0))}</span>
              </button>
            )}
          </li>
        )}
        {mois && (
          <li>
            {edition === 'taux' ? (
              <form className="menu-form" onSubmit={valider}>
                <label className="champ"><span>Provision imprévus, en % des dépenses prévues</span>
                  <input autoFocus inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} /></label>
                <button type="submit" className="bouton principal petit">Enregistrer</button>
              </form>
            ) : (
              <button type="button" className="menu-item" onClick={() => editer('taux', String(Math.round(Number(mois.taux_imprevus) * 1000) / 10).replace('.', ','))}>
                <span>Provision imprévus</span>
                <span className="discret">{pourcent(Number(mois.taux_imprevus || 0))}, soit {euros(budget?.imprevusPrevu || 0)}</span>
              </button>
            )}
          </li>
        )}
        {budget && (
          <li>
            {edition === 'ligne' ? (
              <form className="menu-form" onSubmit={ajouterLigne}>
                <label className="champ"><span>Groupe</span>
                  <select value={nouvelle.groupe} onChange={(e) => setNouvelle({ ...nouvelle, groupe: e.target.value })} required>
                    <option value="">Choisir…</option>
                    {groupes.map((g) => <option key={`${g.bloc}|${g.groupe}`} value={`${g.bloc}|${g.groupe}`}>{g.groupe}</option>)}
                  </select></label>
                <label className="champ"><span>Nom de la ligne</span>
                  <input value={nouvelle.libelle} onChange={(e) => setNouvelle({ ...nouvelle, libelle: e.target.value })} required maxLength={80} /></label>
                <label className="champ"><span>Montant prévu</span>
                  <input inputMode="decimal" value={nouvelle.prevu} onChange={(e) => setNouvelle({ ...nouvelle, prevu: e.target.value })} /></label>
                <button type="submit" className="bouton principal petit">Ajouter la ligne</button>
              </form>
            ) : (
              <button type="button" className="menu-item" onClick={() => setEdition('ligne')}>
                <span>Ajouter une ligne au budget</span>
                <span className="discret">Pour ce mois et les suivants</span>
              </button>
            )}
          </li>
        )}
        {installation && (
          <li>
            <button type="button" className="menu-item" onClick={installation}>
              <span>Installer l’appli sur ce téléphone</span>
              <span className="discret">Ajoute une icône sur l’écran d’accueil</span>
            </button>
          </li>
        )}
        <li>
          <button type="button" className="menu-item" onClick={() => { synchroniser(); onFermer(); }}>
            <span>Actualiser</span>
            <span className="discret">{enAttente ? `${enAttente} modification${enAttente > 1 ? 's' : ''} en attente d’envoi` : 'Tout est enregistré'}</span>
          </button>
        </li>
        <li>
          <button type="button" className="menu-item" onClick={() => { onFermer(); deconnexion(); }}>
            <span>Se déconnecter</span>
            <span className="discret">{session?.email}</span>
          </button>
        </li>
      </ul>
    </Feuille>
  );
}
