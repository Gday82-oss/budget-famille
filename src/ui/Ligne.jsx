// Détail d'une ligne du budget : prévu, réel, reste, note du mois et liste des opérations.
import { useState } from 'react';
import { dateLisible, euros, lireMontant } from '../format.js';
import { Feuille } from './Feuille.jsx';
import { Jauge } from './Jauge.jsx';
import { Plus } from './icones.jsx';

export function Ligne({ ligne, membres, actions, onFermer, onAjouter, onModifierOperation }) {
  const [editPrevu, setEditPrevu] = useState(false);
  const [prevu, setPrevu] = useState(String(ligne.prevuSaisi ?? '').replace('.', ','));
  const [editNote, setEditNote] = useState(false);
  const [commentaire, setCommentaire] = useState(ligne.commentaire || '');
  const revenu = ligne.bloc === 'revenu';
  const auto = ligne.code === 'imprevus';
  const reste = ligne.prevu - ligne.reel;
  const prenom = (email) => membres?.find((m) => m.email === email)?.prenom;

  const ops = [...ligne.operations].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''));

  return (
    <Feuille titre={ligne.libelle} sousTitre={ligne.groupe} onFermer={onFermer}>
      <dl className="chiffres">
        <div><dt>{revenu ? 'Reçu' : 'Dépensé'}</dt><dd>{euros(ligne.reel)}</dd></div>
        <div>
          <dt>Prévu</dt>
          <dd>
            {editPrevu ? (
              <form className="prevu-edit" onSubmit={(e) => { e.preventDefault(); actions.modifierLigne(ligne.id, { prevu: prevu.trim() === '' ? null : lireMontant(prevu) }); setEditPrevu(false); }}>
                <input autoFocus inputMode="decimal" value={prevu} onChange={(e) => setPrevu(e.target.value)} aria-label="Montant prévu" />
                <button type="submit" className="lien">OK</button>
              </form>
            ) : auto ? euros(ligne.prevu) : (
              <button type="button" className="lien" onClick={() => setEditPrevu(true)}>{euros(ligne.prevu)}</button>
            )}
          </dd>
        </div>
        <div><dt>{revenu ? (reste >= 0 ? 'À recevoir' : 'En plus') : (reste >= 0 ? 'Reste' : 'Dépassé')}</dt>
          <dd className={!revenu && reste < 0 ? 'negatif' : ''}>{euros(Math.abs(reste))}</dd></div>
      </dl>
      <Jauge valeur={ligne.reel} total={ligne.prevu} sens={revenu ? 'revenu' : 'depense'} label={ligne.libelle} />
      {auto && <p className="discret aide">Montant prévu calculé automatiquement (provision sur les dépenses prévues). Le taux se règle dans le menu.</p>}

      <div className="note-ligne">
        {editNote ? (
          <form onSubmit={(e) => { e.preventDefault(); actions.modifierLigne(ligne.id, { commentaire: commentaire.trim() || null }); setEditNote(false); }}>
            <textarea autoFocus rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} aria-label="Note du mois" />
            <button type="submit" className="bouton secondaire petit">Enregistrer la note</button>
          </form>
        ) : (
          <button type="button" className="note-bouton" onClick={() => setEditNote(true)}>
            {ligne.commentaire ? <><span className="discret">Note du mois</span><span>{ligne.commentaire}</span></> : <span className="discret">Ajouter une note pour ce mois</span>}
          </button>
        )}
      </div>

      <h3 className="ops-titre">{ops.length ? `${ops.length} opération${ops.length > 1 ? 's' : ''}` : 'Aucune opération ce mois-ci'}</h3>
      <ul className="operations">
        {ops.map((o) => (
          <li key={o.id}>
            <button type="button" className="operation" onClick={() => onModifierOperation(o)}>
              <span className="op-texte">
                <span className={o.note ? '' : 'discret'}>{o.note || 'Sans note'}</span>
                <span className="discret petit">
                  {[dateLisible(o.date), prenom(o.saisi_par)].filter(Boolean).join(', ') || 'Repris du fichier Excel'}
                  {o._attente && ' (pas encore envoyé)'}
                </span>
              </span>
              <span className={`op-montant${Number(o.montant) < 0 ? ' positif' : ''}`}>{euros(o.montant)}</span>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="bouton principal plein" onClick={() => onAjouter(ligne.id)}><Plus /> Ajouter sur cette ligne</button>
    </Feuille>
  );
}
