import { useState } from 'react';
import { connexion, deconnexion, ErreurApi, HorsLigne } from '../api.js';

export function Connexion({ refus }) {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function valider(e) {
    e.preventDefault();
    setErreur(null); setEnvoi(true);
    try {
      await connexion(email, mdp);
    } catch (err) {
      if (err instanceof HorsLigne) setErreur('Pas de réseau. La première connexion demande internet.');
      else if (err instanceof ErreurApi && err.status === 400) setErreur('E-mail ou mot de passe incorrect.');
      else if (err instanceof ErreurApi && err.status === 429) setErreur('Trop d’essais. Réessayez dans quelques minutes.');
      else setErreur(`Connexion impossible (${err.message}).`);
    } finally { setEnvoi(false); }
  }

  return (
    <main className="connexion">
      <div className="connexion-marque" aria-hidden="true">€</div>
      <h1>Budget<br />Guillaume &amp; Anne</h1>
      {refus ? (
        <div className="connexion-form">
          <p className="alerte">Ce compte ({refus}) n’a pas encore accès au budget. Guillaume doit l’ajouter à la liste du foyer.</p>
          <button type="button" className="bouton secondaire" onClick={() => deconnexion()}>Changer de compte</button>
        </div>
      ) : (
        <form className="connexion-form" onSubmit={valider}>
          <label className="champ">
            <span>E-mail</span>
            <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="champ">
            <span>Mot de passe</span>
            <input type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
          </label>
          {erreur && <p className="alerte" role="alert">{erreur}</p>}
          <button type="submit" className="bouton principal" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      )}
    </main>
  );
}
