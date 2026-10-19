# Budget Guillaume & Anne

Appli de budget familial pour téléphone Android (Galaxy S22+ et Galaxy A31), qui remplace le classeur
`Budget_Guillaume-Anne.xlsx`. Elle s'installe comme une vraie appli depuis Chrome, fonctionne sans réseau
et se synchronise entre les deux téléphones.

Adresse : **https://gday82-oss.github.io/budget-famille/**

## Ce que fait l'appli

- **Accueil du mois** : reste à dépenser, solde du mois, solde avec le report du mois précédent, et une barre par poste
  (vert foncé : dans le budget, rouge : dépassé). Sur les dépenses variables, un trait marque le jour du mois.
- **Ajouter une dépense** : pavé numérique, raccourcis vers les lignes les plus utilisées, note (magasin, pour qui…), date.
  Le bouton « Courses » range l'achat dans la bonne semaine selon la date (semaine 1 = du 1er au 7, etc.).
- **Rentrée d'argent** : même écran, onglet « Rentrée d'argent ».
- **Détail d'une ligne** : toutes les opérations, qui les a saisies, modification ou suppression, montant prévu modifiable.
- **Hors ligne** : ce qui est saisi sans réseau est gardé sur le téléphone et envoyé dès que la connexion revient.
- **Mois suivant** : menu ⋯ › « Préparer novembre » recopie les lignes et montants prévus, et reporte le solde.
- **Export Excel** : menu ⋯ › « Exporter en Excel » produit un fichier dans la mise en page du classeur d'origine
  (montants réels sous forme de formule `=a+b+c`, sous-totaux, imprévus, solde).

Les calculs reprennent ceux du classeur : Imprévus = 3,5 % des dépenses fixes et variables prévues ;
Total général = fixes + variables + imprévus + économies + divers ; Solde = revenus − total général.

## Synchronisation avec le fichier Excel du PC

Le classeur `Budget_Guillaume-Anne.xlsx` du PC et l'appli restent identiques, dans les deux sens :

- **Excel → téléphones** : à chaque enregistrement du fichier, les changements partent vers l'appli ;
  les téléphones les affichent tout seuls en une dizaine de secondes.
- **Téléphones → Excel** : une dépense saisie sur un téléphone s'ajoute à la formule du « Coût réel »
  (`=a+b+c`), sa note va dans « Commentaires ».
- Si une même valeur a changé des deux côtés, **l'Excel l'emporte**.
- Si le fichier est **ouvert** dans LibreOffice, les changements venus des téléphones attendent sa fermeture
  (rien n'est perdu).
- Les lignes se créent et se renomment **dans Excel** ; une nouvelle feuille « Budget mensuel décembre 2026 »
  crée le mois dans l'appli, et un mois préparé sur le téléphone crée sa feuille dans Excel.
- Une sauvegarde du classeur est faite avant chaque écriture (`~/.local/share/budget-sync/sauvegardes`).

Installation sur le PC (Linux Mint), dans un terminal :

```bash
wget -qO /tmp/installer-budget.sh https://raw.githubusercontent.com/Gday82-oss/budget-famille/main/synchro/installer.sh
bash /tmp/installer-budget.sh
```

Le script installe les outils, demande l'e-mail et le mot de passe (non enregistré), montre un essai
à blanc, puis lance la synchronisation automatique à chaque démarrage du PC.

Commandes utiles : `systemctl --user status budget-sync` (état), `tail -f ~/.local/share/budget-sync/journal.log`
(journal), `systemctl --user disable --now budget-sync` (arrêter).

## Installer sur le téléphone

1. Ouvrir l'adresse ci-dessus dans **Chrome** sur le Samsung.
2. Se connecter avec son e-mail et son mot de passe.
3. Menu ⋯ de l'appli › « Installer l'appli sur ce téléphone » (ou menu ⋮ de Chrome › « Ajouter à l'écran d'accueil »).

## Comptes et sécurité

- Les données sont dans le projet Supabase **budget-famille** (région Paris).
- Seules les adresses inscrites dans la table `membres` voient les chiffres (règles d'accès RLS dans la base).
  Un autre compte connecté ne voit rien.
- Les comptes se créent dans le tableau de bord Supabase : *Authentication › Users › Add user › Create new user*,
  avec « Auto Confirm User » coché. Il est conseillé de désactiver les inscriptions libres
  (*Authentication › Sign In / Providers › Allow new users to sign up*).
- La clé présente dans `src/config.js` est la clé publique (publishable) : elle est faite pour être visible.

## Développer

```bash
npm install
npm run build   # construit l'appli dans dist/
npm run serve   # la sert sur http://localhost:4173/
```

Chaque `git push` sur `main` reconstruit et remet l'appli en ligne (GitHub Actions › GitHub Pages).

Organisation du code :

| Fichier | Rôle |
|---|---|
| `src/api.js` | Connexion Supabase (Auth + API REST) et file d'attente hors ligne |
| `src/store.js` | État de l'appli et synchronisation |
| `src/calc.js` | Calculs du budget (mêmes règles que le classeur) |
| `src/xlsx.js` | Export Excel |
| `src/ui/` | Écrans : accueil, saisie, détail d'une ligne, réglages, connexion |
| `src/sw.js` | Service worker (ouverture hors ligne) |
| `synchro/budget_sync.py` | Synchronisation du classeur Excel du PC avec l'appli |
| `synchro/installer.sh` | Installation de la synchronisation sur le PC |
