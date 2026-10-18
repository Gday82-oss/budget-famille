// Panneau qui monte du bas de l'écran. Se ferme par le fond, la croix, Échap
// ou le bouton « retour » d'Android (seul le panneau du dessus se ferme).
import { useEffect, useRef } from 'react';
import { Fermer } from './icones.jsx';

const pile = [];
let retoursAIgnorer = 0;
window.addEventListener('popstate', () => {
  if (retoursAIgnorer > 0) { retoursAIgnorer -= 1; return; }
  pile[pile.length - 1]?.();
});

export function Feuille({ titre, sousTitre, onFermer, children, actions, className = '' }) {
  const ref = useRef(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    let parRetour = false;
    const surRetour = () => { parRetour = true; fermer.current?.(); };
    history.pushState({ feuille: pile.length + 1 }, '');
    pile.push(surRetour);
    const touche = (e) => { if (e.key === 'Escape' && pile[pile.length - 1] === surRetour) fermer.current?.(); };
    document.addEventListener('keydown', touche);
    document.body.classList.add('fige');
    ref.current?.focus({ preventScroll: true });
    return () => {
      pile.splice(pile.indexOf(surRetour), 1);
      document.removeEventListener('keydown', touche);
      if (!pile.length) document.body.classList.remove('fige');
      if (!parRetour) { retoursAIgnorer += 1; history.back(); }
    };
  }, []);

  return (
    <div className="voile" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <section ref={ref} tabIndex={-1} className={`feuille ${className}`} role="dialog" aria-modal="true" aria-label={titre}>
        <header className="feuille-tete">
          <div className="feuille-titres">
            <h2>{titre}</h2>
            {sousTitre && <p className="discret">{sousTitre}</p>}
          </div>
          <div className="feuille-actions">
            {actions}
            <button type="button" className="icone" onClick={() => onFermer()} aria-label="Fermer"><Fermer /></button>
          </div>
        </header>
        <div className="feuille-corps">{children}</div>
      </section>
    </div>
  );
}
