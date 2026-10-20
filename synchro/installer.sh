#!/usr/bin/env bash
# Installe la synchronisation Excel <-> appli Budget sur un PC Linux Mint / Ubuntu.
# Usage : bash installer.sh
set -euo pipefail

DEPOT="https://raw.githubusercontent.com/Gday82-oss/budget-famille/main/synchro"
DOSSIER="$HOME/.local/share/budget-sync"
SERVICE="$HOME/.config/systemd/user/budget-sync.service"

echo "== Synchronisation du budget : fichier Excel <-> appli des téléphones =="
echo

# 1. Outils nécessaires (lecture/écriture des fichiers Excel, notifications)
if ! python3 -c "import openpyxl, PIL" 2>/dev/null || ! command -v notify-send >/dev/null; then
  echo "Installation des outils nécessaires (votre mot de passe de session peut être demandé)…"
  sudo apt-get update -qq
  sudo apt-get install -y python3-openpyxl python3-pil libnotify-bin
fi

# 2. Le programme
mkdir -p "$DOSSIER"
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$ICI/budget_sync.py" ]; then
  cp "$ICI/budget_sync.py" "$DOSSIER/budget_sync.py"
elif command -v curl >/dev/null; then
  curl -fsSL "$DEPOT/budget_sync.py" -o "$DOSSIER/budget_sync.py"
else
  wget -qO "$DOSSIER/budget_sync.py" "$DEPOT/budget_sync.py"
fi
echo "Programme installé dans $DOSSIER"
echo

# Déjà installé et connecté : simple mise à jour du programme
if [ -f "$HOME/.config/budget-sync/config.json" ] && systemctl --user is-enabled --quiet budget-sync.service 2>/dev/null; then
  systemctl --user restart budget-sync.service
  echo "Mise à jour faite : la synchronisation a redémarré avec la nouvelle version."
  exit 0
fi

# 3. Connexion de ce PC (le mot de passe n'est pas enregistré)
python3 "$DOSSIER/budget_sync.py" connexion
echo

# 4. Essai à blanc : on montre ce qui serait synchronisé, sans rien modifier
echo "== Essai : voici ce que la synchronisation ferait (rien n'est modifié) =="
python3 "$DOSSIER/budget_sync.py" essai
echo
read -r -p "Lancer la synchronisation automatique maintenant ? (o/n) " reponse
if [[ ! "$reponse" =~ ^[oOyY] ]]; then
  echo "D'accord, rien n'est lancé. Relancez ce script quand vous voulez."
  exit 0
fi

# 5. Service lancé automatiquement à chaque ouverture de session
mkdir -p "$(dirname "$SERVICE")"
cat > "$SERVICE" <<UNIT
[Unit]
Description=Synchronisation Budget (Excel <-> appli)
After=graphical-session.target network-online.target

[Service]
ExecStart=/usr/bin/python3 %h/.local/share/budget-sync/budget_sync.py
Restart=always
RestartSec=20

[Install]
WantedBy=default.target
UNIT
systemctl --user import-environment DISPLAY DBUS_SESSION_BUS_ADDRESS 2>/dev/null || true
systemctl --user daemon-reload
systemctl --user enable --now budget-sync.service
sleep 2
if systemctl --user is-active --quiet budget-sync.service; then
  echo
  echo "C'est en place. La synchronisation tourne et se relancera à chaque démarrage du PC."
  echo "Journal :  tail -f $DOSSIER/journal.log"
  echo "Sauvegardes du classeur : $DOSSIER/sauvegardes"
else
  echo "Le service n'a pas démarré. Détails : journalctl --user -u budget-sync -n 30"
  exit 1
fi
