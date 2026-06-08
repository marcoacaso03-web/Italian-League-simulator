# ⚽ 38-0 Serie A — FBref Scraper v3

Script per scaricare tutti i dati Serie A da FBref e generare i file JSON per il gioco.

## 🚀 Come usare

### 1. Installa dipendenze
```bash
pip install -r requirements.txt
```

### 2. Esegui lo scraping
```bash
# Con SeleniumBase (consigliato - bypassa Cloudflare)
python scrape_serie_a_v3.py --selenium

# Oppure solo con requests (se non hai Cloudflare block)
python scrape_serie_a_v3.py

# Solo alcune stagioni (per test)
python scrape_serie_a_v3.py --selenium --seasons 2023-2024 2024-2025

# Con debug logging
python scrape_serie_a_v3.py --selenium --debug
```

### 3. Output

**`data/clubs.json`**
```json
[{"id": "juventus", "name": "Juventus"}, ...]
```

**`data/players.json`**
```json
[{
  "id": "p00001",
  "name": "Francesco Totti",
  "position": "ATT",
  "seasons": [
    {"club": "Roma", "season": "2004-2005", "rating": 95.2, "apps": 35, "goals": 18, "assists": 6}
  ]
}]
```

## 🔧 Bug fixati nella v3

- **Table IDs**: FBref usa `stats_standard_11` (con comp_id), non solo `stats_standard`
- **squad vs team**: nelle tabelle player FBref usa `data-stat="squad"`, non `"team"`
- **Commenti HTML**: estratti con `html.parser` (non `lxml` che li droppa)
- **Defense errors**: `data-stat="errors"` non `errors_leading_to_goal`
- **Passing key_passes**: `assisted_shots` come key_passes, fallback `progressive_passes`

## 📐 Formule Rating

| Posizione | Formula |
|-----------|---------|
| **ATT** | (gol×3 + assist×1.5 + apps×0.5) / 1.05 × 100 + min_bonus |
| **MID** | (gol×2 + assist×2 + apps×0.5 + key_passes×1) / 1.455 × 100 + min_bonus |
| **DEF** | (apps×1 + tackles×0.5 + clean_sheets×1.5 - errors×2) / 0.875 × 100 + min_bonus |
| **GK** | (clean_sheets×2 + save_pct×0.3 - goals_against×0.3) / 0.435 × 100 + min_bonus |

Rating clamp: **1-99**
