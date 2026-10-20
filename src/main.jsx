import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { useBudget } from './store.js';
import { telechargerMois } from './xlsx.js';
import { Accueil } from './ui/Accueil.jsx';
import { Connexion } from './ui/Connexion.jsx';
import { Ligne } from './ui/Ligne.jsx';
import { Reglages } from './ui/Reglages.jsx';
import { Saisie } from './ui/Saisie.jsx';
import './styles.css';

function Message({ message, onFermer }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onFermer, message.ton === 'erreur' ? 7000 : 2600);
    return () => clearTimeout(t);
  }, [message, onFermer]);
  if (!message) return null;
  return <div className={`message ${message.ton}`} role={message.ton === 'erreur' ? 'alert' : 'status'} onClick={onFermer}>{message.texte}</div>;
}

function App() {
  const etat = useBudget();
  const { session, membres, budget, donnees, moisId, actions } = etat;
  const [saisie, setSaisie] = useState(null);   // { ligneId?, operation? }
  const [ligneOuverte, setLigneOuverte] = useState(null);
  const [menu, setMenu] = useState(false);
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    const surInvite = (e) => { e.preventDefault(); setInvite(e); };
    window.addEventListener('beforeinstallprompt', surInvite);
    return () => window.removeEventListener('beforeinstallprompt', surInvite);
  }, []);

  if (!session) return <Connexion />;
  if (membres && !membres.length) return <Connexion refus={session.email} />;

  const ligne = budget?.lignes.find((l) => l.id === ligneOuverte);
  const preparer = async (source, cible) => { setMenu(false); await actions.preparerMois(source, cible); };

  return (
    <>
      <Accueil etat={etat} onAjouter={(ligneId) => setSaisie({ ligneId })} onLigne={setLigneOuverte}
        onMenu={() => setMenu(true)} onPreparer={preparer} />
      {ligne && (
        <Ligne ligne={ligne} membres={membres} actions={actions} onFermer={() => setLigneOuverte(null)}
          onAjouter={(id) => setSaisie({ ligneId: id })} onModifierOperation={(operation) => setSaisie({ operation })} />
      )}
      {saisie && budget && (
        <Saisie budget={budget} moisId={moisId} initial={saisie} actions={actions} onFermer={() => setSaisie(null)} />
      )}
      {menu && (
        <Reglages etat={etat} onFermer={() => setMenu(false)} onPreparer={preparer}
          onExporter={() => { telechargerMois(donnees.mois, donnees.lignes, etat.soldes?.[moisId]?.report_effectif); setMenu(false); }}
          installation={invite ? async () => { invite.prompt(); await invite.userChoice; setInvite(null); setMenu(false); } : null} />
      )}
      <Message message={etat.message} onFermer={etat.fermerMessage} />
    </>
  );
}

createRoot(document.getElementById('racine')).render(<App />);

// Service worker : appli disponible hors ligne ; une nouvelle version s'installe en arrière-plan
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
