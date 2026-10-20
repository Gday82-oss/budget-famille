import { useState } from 'react';
import { stock } from '../api.js';
import { BLOCS, jourDuMois } from '../calc.js';
import { aujourdhui, dateLisible, euros, eurosRond, eurosSigne, moisDecale, nomMois, pourcent } from '../format.js';
import { Jauge } from './Jauge.jsx';
import { Actualiser, Bas, Droite, Gauche, Menu, Nuage, Plus } from './icones.jsx';

/** Jour du mois de budget aujourd'hui, ou null si aujourd'hui est hors de sa période. */
function jourEnCours(periode) {
  if (!periode) return null;
  const j = jourDuMois(periode, aujourdhui());
  return j >= 1 && j <= periode.jours ? j : null;
}

export function Accueil({ etat, onAjouter, onLigne, onMenu, onPreparer }) {
  const { budget, moisId, listeMois, reseau, enAttente, majLe, changerMois, synchroniser, periode } = etat;
  const jour = jourEnCours(periode);
  const [ouverts, setOuverts] = useState(() => new Set(stock.lire('groupes-ouverts', [])));
  const basculer = (cle) => {
    const n = new Set(ouverts);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    setOuverts(n); stock.ecrire('groupes-ouverts', [...n]);
  };

  const premier = listeMois[0]?.id;
  const dernier = listeMois[listeMois.length - 1]?.id;
  const precedent = moisId && premier && moisId > premier ? moisDecale(moisId, -1) : null;
  const suivantId = moisId ? moisDecale(moisId, 1) : null;
  const suivant = suivantId && dernier && suivantId <= moisDecale(dernier, 1) ? suivantId : null;

  return (
    <div className="accueil">
      <header className="barre-mois">
        <button type="button" className="icone" onClick={() => precedent && changerMois(precedent)} disabled={!precedent} aria-label="Mois précédent"><Gauche /></button>
        <h1 className="titre-mois">{moisId ? nomMois(moisId) : 'Budget'}</h1>
        <button type="button" className="icone" onClick={() => suivant && changerMois(suivant)} disabled={!suivant} aria-label="Mois suivant"><Droite /></button>
        <button type="button" className="icone menu" onClick={onMenu} aria-label="Réglages et export"><Menu /></button>
      </header>

      {(reseau === 'hors-ligne' || enAttente > 0) && (
        <div className="bandeau" role="status">
          <Nuage />
          <span>
            {reseau === 'hors-ligne' ? 'Hors ligne' : 'Envoi en cours'}
            {enAttente > 0 && `, ${enAttente} modification${enAttente > 1 ? 's' : ''} à envoyer`}
            {reseau === 'hors-ligne' && majLe && `. Chiffres du ${new Date(majLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </span>
          <button type="button" className="icone petite" onClick={synchroniser} aria-label="Réessayer"><Actualiser /></button>
        </div>
      )}

      {!budget ? (
        moisId && (listeMois.some((m) => m.id === moisId) || !listeMois.length
          ? <p className="chargement discret" role="status">Chargement des chiffres…</p>
          : <APreparer moisId={moisId} listeMois={listeMois} onPreparer={onPreparer} />)
      ) : (
        <>
          <Synthese budget={budget} />
          {BLOCS.map((b) => (
            <Bloc key={b.id} bloc={b} donnees={budget.parBloc[b.id]} ouverts={ouverts} basculer={basculer} onLigne={onLigne}
              repere={b.id === 'variable' && jour ? jour / periode.jours : null} jour={jour} periode={periode} />
          ))}
          <p className="pied discret">
            {Number(etat.donnees?.mois?.taux_imprevus) > 0
              ? `Provision imprévus : ${pourcent(Number(etat.donnees.mois.taux_imprevus))} des dépenses fixes et variables prévues.`
              : 'Pas de provision imprévus ce mois-ci.'}
          </p>
        </>
      )}

      {budget && (
        <div className="barre-action">
          <button type="button" className="bouton ajouter" onClick={() => onAjouter()}>
            <Plus /> Ajouter une dépense
          </button>
        </div>
      )}
    </div>
  );
}

function Synthese({ budget }) {
  const depasse = budget.resteADepenser < 0;
  return (
    <section className="synthese" aria-label="Synthèse du mois">
      <p className="synthese-libelle">{depasse ? 'Budget dépassé de' : 'Reste à dépenser'}</p>
      <p className={`synthese-montant${depasse ? ' negatif' : ''}`}>{euros(Math.abs(budget.resteADepenser))}</p>
      <Jauge grande valeur={budget.depensesReel} total={budget.depensesPrevu} label="Dépenses du mois" />
      <p className="synthese-rythme">{eurosRond(budget.depensesReel)} dépensés sur {eurosRond(budget.depensesPrevu)} prévus.</p>
      <dl className="soldes">
        <div><dt>Solde du mois</dt><dd className={budget.soldeReel < 0 ? 'negatif' : 'positif'}>{eurosSigne(budget.soldeReel)}</dd></div>
        <div><dt>{budget.report ? 'Solde avec report' : 'Solde prévu'}</dt>
          <dd className={(budget.report ? budget.soldeAvecReport : budget.soldePrevu) < 0 ? 'negatif' : 'positif'}>
            {eurosSigne(budget.report ? budget.soldeAvecReport : budget.soldePrevu)}
          </dd></div>
      </dl>
    </section>
  );
}

function Bloc({ bloc, donnees, ouverts, basculer, onLigne, repere, jour, periode }) {
  if (!donnees.groupes.length) return null;
  const revenu = bloc.id === 'revenu';
  return (
    <section className={`bloc bloc-${bloc.id}`}>
      <h2 className="bloc-titre">
        <span>{bloc.titre}</span>
        <span className="bloc-total">{eurosRond(donnees.reel)}<span className="discret"> / {eurosRond(donnees.prevu)}</span></span>
      </h2>
      {repere != null && <p className="bloc-aide discret">Le trait sur chaque barre marque le jour {jour} sur {periode.jours} du mois de budget (commencé le {dateLisible(periode.debut).toLowerCase()}).</p>}
      {donnees.groupes.length === 1 ? (
        // Un seul groupe dans ce bloc (épargne, revenus) : on montre directement ses lignes
        <ul className="groupes">
          {donnees.groupes[0].lignes.map((l) => (
            <li key={l.id} className="groupe">
              <button type="button" className="groupe-tete" onClick={() => onLigne(l.id)}>
                <span className="groupe-nom">{l.libelle}</span>
                <span className={`montants${!revenu && l.reel > l.prevu + 0.004 ? ' negatif' : ''}`}>{euros(l.reel)}<span className="discret"> / {eurosRond(l.prevu)}</span></span>
                <Jauge valeur={l.reel} total={l.prevu} sens={revenu ? 'revenu' : 'depense'} label={l.libelle} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="groupes">
          {donnees.groupes.map((g) => {
            const ouvert = ouverts.has(g.cle);
            const unique = g.lignes.length === 1;
            return (
              <li key={g.cle} className={`groupe${ouvert ? ' ouvert' : ''}`}>
                <button type="button" className="groupe-tete" aria-expanded={unique ? undefined : ouvert}
                  onClick={() => (unique ? onLigne(g.lignes[0].id) : basculer(g.cle))}>
                  <span className="groupe-nom">{g.nom}</span>
                  <span className="montants">{euros(g.reel)}<span className="discret"> / {eurosRond(g.prevu)}</span></span>
                  {!unique && <Bas className="chevron" />}
                  <Jauge valeur={g.reel} total={g.prevu} sens={revenu ? 'revenu' : 'depense'} label={g.nom} repere={repere} />
                </button>
                {ouvert && !unique && (
                  <ul className="lignes">
                    {g.lignes.map((l) => (
                      <li key={l.id}>
                        <button type="button" className="ligne" onClick={() => onLigne(l.id)}>
                          <span className="ligne-nom">{l.libelle}</span>
                          <span className={`montants${!revenu && l.reel > l.prevu + 0.004 ? ' negatif' : ''}`}>
                            {euros(l.reel)}<span className="discret"> / {eurosRond(l.prevu)}</span>
                          </span>
                          <Jauge valeur={l.reel} total={l.prevu} sens={revenu ? 'revenu' : 'depense'} label={l.libelle} repere={repere} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function APreparer({ moisId, listeMois, onPreparer }) {
  const source = [...listeMois].reverse().find((m) => m.id < moisId);
  return (
    <section className="a-preparer">
      <h2>{nomMois(moisId)} n’est pas encore préparé</h2>
      {source ? (
        <>
          <p>Les lignes et les montants prévus de {nomMois(source.id, false).toLowerCase()} seront recopiés. Vous pourrez ensuite les ajuster.</p>
          <button type="button" className="bouton principal" onClick={() => onPreparer(source.id, moisId)}>Préparer {nomMois(moisId, false).toLowerCase()}</button>
        </>
      ) : <p>Aucun mois précédent à recopier.</p>}
    </section>
  );
}
