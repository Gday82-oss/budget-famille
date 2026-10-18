// Petites icônes dessinées en SVG (aucune police d'icônes à télécharger).
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const Plus = (p) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const Gauche = (p) => <svg {...base} {...p}><path d="m15 18-6-6 6-6" /></svg>;
export const Droite = (p) => <svg {...base} {...p}><path d="m9 18 6-6-6-6" /></svg>;
export const Bas = (p) => <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>;
export const Menu = (p) => <svg {...base} {...p}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
export const Effacer = (p) => <svg {...base} {...p}><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" /><path d="m17 9-6 6M11 9l6 6" /></svg>;
export const Fermer = (p) => <svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const Nuage = (p) => <svg {...base} {...p}><path d="M2 2l20 20" /><path d="M5.8 8.6A5 5 0 0 0 7 18h10a4 4 0 0 0 1.6-.3M21.3 15A4 4 0 0 0 17 10h-.3A6 6 0 0 0 9.6 6.1" /></svg>;
export const Calendrier = (p) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
export const Actualiser = (p) => <svg {...base} {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" /><path d="M21 3v5h-5" /></svg>;
