# ⚽ Italian League Simulator (38-0 Serie A)

Replica di [38-0.app](https://38-0.app/) con i dati della **Serie A italiana** 🇮🇹

Un gioco web di draft calcio: scegli formazione, drafti giocatori one-by-one (slot machine), costruisci la tua XI e simuli un'intera stagione di 38 giornate.

## 📋 Struttura

```
scripts/          → FBref scraper (genera clubs.json + players.json)
  scrape_serie_a_v2.py   ← script principale
  requirements.txt
  README.md
data/             → Output JSON (generato dallo scraper)
  clubs.json
  players.json
```

## 🚀 Setup scraper

```bash
cd scripts
pip install -r requirements.txt
python scrape_serie_a_v2.py
```

Vedi `scripts/README.md` per i dettagli.

## 📐 Formule Rating

| Posizione | Formula |
|-----------|---------|
| **ATT** | (gol×3 + assist×1.5 + apps×0.5) / 1.05 × 100 + min_bonus |
| **MID** | (gol×2 + assist×2 + apps×0.5 + key_passes×1) / 1.455 × 100 + min_bonus |
| **DEF** | (apps×1 + tackles×0.5 + clean_sheets×1.5 - errors×2) / 0.875 × 100 + min_bonus |
| **GK** | (clean_sheets×2 + save_pct×0.3 - goals_against×0.3) / 0.435 × 100 + min_bonus |

`min_bonus = min(minutes / 3420, 1.0) × 10` — Rating clamp: **1-99**
