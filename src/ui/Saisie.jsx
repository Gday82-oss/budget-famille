// Ajout ou modification d'une opération : pavé numérique, choix de la ligne, note, date.
import { useEffect, useMemo, useState } from 'react';
import { jourDuMois, ligneCourses } from '../calc.js';
import { aujourdhui, dateLisible, euros, lireMontant } from '../format.js';
import { Feuille } from './Feuille.jsx';
import { Calendrier, Effacer } from './icones.jsx';

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'effacer'];

function taper(valeur, touche) {
  if (touche === 'effacer') return valeur.slice(0, -1);
  if (touche === ',') return valeur.includes(',') ? valeur : (valeur || '0') + ',';
  const [ent, dec] = valeur.split(',');
  if (dec !== undefined) return dec.length >= 2 ? valeur : valeur + touche;
  if (ent.length >= 6) return valeur;
  return ent === '0' ? touche : valeur + touche;
}

export function Saisie({ budget, moisId, periode, dernierMois, initial = {}, actions, onFermer }) {
  const op = initial.operation;
  const lignes = budget.lignes;
  const ligneInit = lignes.find((l) => l.id === (op?.ligne_id || initial.ligneId));
  const [sens, setSens] = useState(ligneInit?.bloc === 'revenu' ? 'rentree' : 'depense');
  const [montant, setMontant] = useState(() => {
    if (!op) return '';
    const v = Math.abs(Number(op.montant));
    return (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace('.', ',');
  });
  const [negatif, setNegatif] = useState(op ? Number(op.montant) < 0 : false);
  const dansLaPeriode = periode && jourDuMois(periode, aujourdhui()) >= 1 && jourDuMois(periode, aujourdhui()) <= periode.jours;
  const [date, setDate] = useState(op ? op.date : (dansLaPeriode || moisId === dernierMois ? aujourdhui() : null));
  const [ligneId, setLigneId] = useState(ligneInit?.id || null);
  const [modeCourses, setModeCourses] = useState(false);
  const [note, setNote] = useState(op?.note || '');
  const [toutes, setToutes] = useState(false);
  const [noteActive, setNoteActive] = useState(false);
  const [confirmerSuppr, setConfirmerSuppr] = useState(false);

  const candidates = lignes.filter((l) => (sens === 'rentree' ? l.bloc === 'revenu' : l.bloc !== 'revenu'));
  const ligne = lignes.find((l) => l.id === ligneId);

  // Raccourcis : « Courses » (semaine choisie selon la date) + lignes les plus utilisées ce mois-ci
  const raccourcis = useMemo(() => {
    if (sens === 'rentree') return candidates;
    const autres = candidates.filter((l) => l.groupe !== 'Courses' || !/^Semaine/.test(l.libelle));
    return [...autres].sort((a, b) => b.operations.length - a.operations.length || a.ordre - b.ordre).slice(0, 7);
  }, [sens, candidates]);

  useEffect(() => {
    if (modeCourses) { const l = ligneCourses(lignes, date, periode); if (l) setLigneId(l.id); }
  }, [modeCourses, date, lignes, periode]);

  // Saisie au clavier physique (ordinateur)
  useEffect(() => {
    const surTouche = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (/^[0-9]$/.test(e.key)) setMontant((v) => taper(v, e.key));
      else if (e.key === ',' || e.key === '.') setMontant((v) => taper(v, ','));
      else if (e.key === 'Backspace') setMontant((v) => taper(v, 'effacer'));
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, []);

  const valeur = lireMontant(montant) * (negatif ? -1 : 1);
  const pret = ligne && valeur !== 0;

  function choisir(l, courses = false) {
    setModeCourses(courses);
    setLigneId(l.id);
    setToutes(false);
  }

  async function enregistrer() {
    if (!pret) return;
    const champs = { montant: valeur, ligne_id: ligne.id, note: note.trim() || null, date: date || null };
    onFermer();
    if (op) await actions.modifierOperation(op.id, champs);
    else await actions.ajouterOperation(champs);
  }

  async function supprimer() {
    if (!confirmerSuppr) { setConfirmerSuppr(true); return; }
    onFermer();
    await actions.supprimerOperation(op.id);
  }

  const libelleLigne = ligne ? (ligne.groupe === 'Courses' && /^Semaine/.test(ligne.libelle) ? `Courses, ${ligne.libelle.toLowerCase()}` : ligne.libelle) : null;
  const courseRaccourci = sens === 'depense' && lignes.some((l) => l.groupe === 'Courses' && /^Semaine/.test(l.libelle));

  return (
    <Feuille titre={op ? 'Modifier l’opération' : 'Nouvelle opération'} onFermer={onFermer} className="feuille-saisie">
      <div className="saisie-haut">
        <div className="sens" role="radiogroup" aria-label="Type d’opération">
          <button type="button" role="radio" aria-checked={sens === 'depense'} className={sens === 'depense' ? 'actif' : ''}
            onClick={() => { setSens('depense'); if (ligne?.bloc === 'revenu') setLigneId(null); }}>Dépense</button>
          <button type="button" role="radio" aria-checked={sens === 'rentree'} className={sens === 'rentree' ? 'actif' : ''}
            onClick={() => { setSens('rentree'); setModeCourses(false); if (ligne && ligne.bloc !== 'revenu') setLigneId(null); }}>Rentrée d’argent</button>
        </div>
        <div className="affichage-montant" aria-live="polite">
          <button type="button" className={`signe${negatif ? ' actif' : ''}`} onClick={() => setNegatif(!negatif)}
            aria-pressed={negatif} aria-label="Montant négatif (remboursement, avoir)">±</button>
          <output className={montant ? '' : 'vide'}>{negatif ? '−' : ''}{montant || '0'}<span className="euro"> €</span></output>
        </div>
        <p className="pour">
          {libelleLigne ? <>pour <strong>{libelleLigne}</strong>{negatif && ' (remboursement)'}</> : 'Choisissez la ligne du budget'}
        </p>
      </div>

      <div className="saisie-milieu">
        <div className="puces-tete">
          <span className="discret">{toutes ? 'Toutes les lignes' : 'Lignes fréquentes'}</span>
          <button type="button" className="lien" onClick={() => setToutes(!toutes)} aria-expanded={toutes}>
            {toutes ? 'Revenir au pavé' : 'Toutes les lignes'}
          </button>
        </div>
        {toutes ? (
          <div className="toutes-lignes">
            {[...new Set(candidates.map((l) => l.groupe))].map((g) => (
              <div key={g}>
                <p className="toutes-groupe">{g}</p>
                {candidates.filter((l) => l.groupe === g).map((l) => (
                  <button key={l.id} type="button" className={`choix${ligneId === l.id ? ' active' : ''}`} onClick={() => choisir(l)}>
                    <span>{l.libelle}</span><span className="discret">{euros(l.reel)} / {euros(l.prevu)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="puces" role="listbox" aria-label="Ligne du budget">
            {courseRaccourci && (
              <button type="button" role="option" aria-selected={modeCourses} className={`puce${modeCourses ? ' active' : ''}`}
                onClick={() => { const l = ligneCourses(lignes, date, periode); if (l) choisir(l, true); }}>Courses</button>
            )}
            {raccourcis.map((l) => (
              <button key={l.id} type="button" role="option" aria-selected={!modeCourses && ligneId === l.id}
                className={`puce${!modeCourses && ligneId === l.id ? ' active' : ''}`} onClick={() => choisir(l)}>{l.libelle}</button>
            ))}
          </div>
        )}
        {!toutes && (
          <div className="details">
            <input className="note" type="text" placeholder="Note (magasin, pour qui…)" value={note} onChange={(e) => setNote(e.target.value)}
              onFocus={() => setNoteActive(true)} onBlur={() => setNoteActive(false)} enterKeyHint="done" maxLength={140}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            <label className="date">
              <Calendrier />
              <span>{date ? dateLisible(date) : 'Sans date'}</span>
              <input type="date" value={date || ''} onChange={(e) => setDate(e.target.value || null)} aria-label="Date de l’opération" />
            </label>
          </div>
        )}
      </div>

      <div className="saisie-bas">
        {!toutes && !noteActive && (
          <div className="pave" role="group" aria-label="Pavé numérique">
            {TOUCHES.map((t) => (
              <button key={t} type="button" className="touche" onClick={() => setMontant((v) => taper(v, t))} aria-label={t === 'effacer' ? 'Effacer un chiffre' : t}>
                {t === 'effacer' ? <Effacer /> : t}
              </button>
            ))}
          </div>
        )}
        <div className="saisie-actions">
          {op && (
            <button type="button" className={`bouton ${confirmerSuppr ? 'danger' : 'secondaire'}`} onClick={supprimer}>
              {confirmerSuppr ? 'Confirmer' : 'Supprimer'}
            </button>
          )}
          <button type="button" className="bouton principal" disabled={!pret} onClick={enregistrer} onMouseDown={(e) => e.preventDefault()}>
            {pret ? `Enregistrer ${euros(valeur)}` : 'Enregistrer'}
          </button>
        </div>
      </div>
    </Feuille>
  );
}
