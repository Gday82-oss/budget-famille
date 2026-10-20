// Menu : mois suivant, export Excel, réglages du mois, ajout d'une ligne, compte.
import { useState } from 'react';
import { deconnexion } from '../api.js';
import { euros, eurosSigne, lireMontant, moisDecale, nomMois, pourcent } from '../format.js';
import { Feuille } from './Feuille.jsx';

export function Reglages({ etat, onFermer, onPreparer, onExporter, installation }) {
  const { budget, donnees, moisId, listeMois, session, actions, synchroniser, enAttente } = etat;
  const mois = donnees?.mois;
  const suivant = moisDecale(moisId, 1);
  const precedent = moisDecale(moisId, -1);
  const suivantExiste = listeMois.some((m) => m.id === suivant);
  const [edition, setEdition] = useState(null);
  const [valeur, setValeur] = useState('');

  function editer(champ, initial) { setEdition(champ); setValeur(initial); }
  function valider(e) {
    e.preventDefault();
    if (edition === 'report') actions.modifierMois({ report_solde: lireMontant(valeur), report_auto: false, solde_fin: null });
    if (edition === 'fin') actions.modifierMois({ solde_fin: lireMontant(valeur), report_auto: false });
    if (edition === 'debut') actions.modifierMois({ debut: valeur || null });
    if (edition === 'taux') actions.modifierMois({ taux_imprevus: Math.max(0, Math.min(100, lireMontant(valeur))) / 100 });
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
        {mois && etat.periode && (
          <li>
            {edition === 'debut' ? (
              <form className="menu-form" onSubmit={valider}>
                <label className="champ"><span>Date du premier revenu encaissé pour ce mois de budget</span>
                  <input autoFocus type="date" value={valeur} onChange={(e) => setValeur(e.target.value)} /></label>
                <button type="submit" className="bouton principal petit">Enregistrer</button>
              </form>
            ) : (
              <button type="button" className="menu-item" onClick={() => editer('debut', etat.periode.debut)}>
                <span>Début du mois de budget</span>
                <span className="discret">{new Date(`${etat.periode.debut}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{mois.debut ? '' : ' (premier revenu noté)'}, jusqu’au {new Date(`${etat.periode.fin}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
              </button>
            )}
          </li>
        )}
        {mois && budget?.soldeFin != null && (
          <li>
            {edition === 'fin' ? (
              <form className="menu-form" onSubmit={valider}>
                <label className="champ"><span>Solde réel de fin de mois (relevé bancaire), avec un moins s’il est négatif</span>
                  <input autoFocus inputMode="text" value={valeur} onChange={(e) => setValeur(e.target.value)} /></label>
                <button type="submit" className="bouton principal petit">Enregistrer</button>
              </form>
            ) : (
              <button type="button" className="menu-item" onClick={() => editer('fin', String(budget.soldeFin).replace('.', ','))}>
                <span>Solde réel de fin de mois</span>
                <span className="discret">{eurosSigne(budget.soldeFin)}, saisi tel quel (le report de {eurosSigne(budget.report)} s’en déduit)</span>
              </button>
            )}
          </li>
        )}
        {mois && budget?.soldeFin == null && (
          <li>
            {edition === 'report' ? (
              <form className="menu-form" onSubmit={valider}>
                <label className="champ"><span>Solde de fin du mois précédent, avec un moins s’il était négatif (par exemple -585,04). Le report ne suivra plus automatiquement {nomMois(precedent, false).toLowerCase()}.</span>
                  <input autoFocus inputMode="text" value={valeur} onChange={(e) => setValeur(e.target.value)} /></label>
                <button type="submit" className="bouton principal petit">Enregistrer</button>
              </form>
            ) : (
              <button type="button" className="menu-item" onClick={() => editer('report', String(budget?.report ?? mois.report_solde ?? 0).replace('.', ','))}>
                <span>Solde reporté du mois précédent</span>
                <span className="discret">{eurosSigne(budget?.report ?? Number(mois.report_solde || 0))}
                  {budget?.reportAuto ? `, suit automatiquement ${nomMois(precedent, false).toLowerCase()}` : ', saisi à la main'}</span>
              </button>
            )}
          </li>
        )}
        {mois && !budget?.reportAuto && budget?.soldeFin == null && listeMois.some((m) => m.id === precedent) && (
          <li>
            <button type="button" className="menu-item" onClick={() => actions.modifierMois({ report_auto: true })}>
              <span>Suivre automatiquement {nomMois(precedent, false).toLowerCase()}</span>
              <span className="discret">Le report reprendra le solde avec report de {nomMois(precedent, false).toLowerCase()}, comme la formule du classeur</span>
            </button>
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
      <p className="discret aide">Les lignes du budget se créent et se renomment dans le fichier Excel du PC : l’appli suit automatiquement.</p>
    </Feuille>
  );
}
