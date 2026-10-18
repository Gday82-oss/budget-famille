// Mise en forme des montants, des dates et des mois (français).
const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtRond = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const euros = (n) => fmt.format(r2(n));
export const eurosRond = (n) => fmtRond.format(Math.round(Number(n) || 0));
/** Montant signé : « +84,37 € » ou « −500,67 € » (vrai signe moins). */
export const eurosSigne = (n) => {
  const v = r2(n);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + fmt.format(Math.abs(v));
};
export const pourcent = (x) => `${Math.round(x * 1000) / 10} %`.replace('.', ',');

export const nomMois = (id, avecAnnee = true) => {
  const [a, m] = id.split('-').map(Number);
  const s = new Date(a, m - 1, 1).toLocaleDateString('fr-FR', avecAnnee ? { month: 'long', year: 'numeric' } : { month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const moisDecale = (id, delta) => {
  const [a, m] = id.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const aujourdhui = () => iso(new Date());
export const moisCourant = () => aujourdhui().slice(0, 7);
export const joursDansMois = (id) => { const [a, m] = id.split('-').map(Number); return new Date(a, m, 0).getDate(); };

export const dateLisible = (d) => {
  if (!d) return null;
  if (d === aujourdhui()) return "Aujourd'hui";
  const hier = new Date(); hier.setDate(hier.getDate() - 1);
  if (d === iso(hier)) return 'Hier';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Transforme la saisie du pavé (« 23,4 ») en nombre (23.4). */
export const lireMontant = (s) => {
  const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? r2(n) : 0;
};
