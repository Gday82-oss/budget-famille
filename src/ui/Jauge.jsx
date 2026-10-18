// Barre de consommation d'un budget. « repere » = fraction du mois écoulée (trait vertical).
export function Jauge({ valeur, total, sens = 'depense', repere, grande = false, label }) {
  const ratio = total > 0 ? valeur / total : (valeur > 0 ? 1.0001 : 0);
  const largeur = Math.max(0, Math.min(1, ratio)) * 100;
  const depasse = sens === 'depense' && ratio > 1.0001;
  return (
    <div className={`jauge${grande ? ' grande' : ''}${depasse ? ' depasse' : ''}${sens === 'revenu' ? ' revenu' : ''}`}
      role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label={label}>
      <div className="jauge-rempli" style={{ width: `${largeur}%` }} />
      {repere != null && <div className="jauge-repere" style={{ left: `${Math.min(1, repere) * 100}%` }} />}
    </div>
  );
}
