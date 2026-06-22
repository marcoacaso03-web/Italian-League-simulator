#!/usr/bin/env bash
set -euo pipefail

# Scarica i dataset FIFA necessari per completare le 4 leghe mancanti.
# Richiede: Kaggle CLI configurato (kaggle.json in ~/.kaggle/)
#   pip install kaggle && kaggle config set-up

BASE="$HOME/.hermes/cron/artifacts/italian-league-simulator"
RAW="$BASE/.migration-backup/sofifa_raw"
mkdir -p "$RAW"
cd "$BASE"

echo "📥 Scaricamento dataset FIFA da Kaggle..."

# Dataset principale: stefanoleone992 EA Sports FC
# Copre FIFA 15-25 con tutte le leghe
kaggle datasets download -d stefanoleone992/ea-sports-fc-24-complete-player-dataset \
  -p "$RAW" --unzip

echo "✅ Download completato in $RAW"
echo "File scaricati:"
ls -lh "$RAW"
