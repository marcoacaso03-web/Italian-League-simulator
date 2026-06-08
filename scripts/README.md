# ⚽ 38-0 Serie A — FBref Scraper

Script per scaricare tutti i dati Serie A da FBref e generare i file JSON per il gioco.

## 🚀 Come usare

### 1. Installa dipendenze
```bash
pip install -r requirements.txt
```

### 2. Esegui lo scraping
```bash
python scrape_serie_a_v2.py
```

Lo script:
- Visita FBref e scopre tutte le stagioni Serie A dal 1992/93 al 2025/26
- Per ogni stagione scarica: standard stats, defensive stats, keeper stats, passing stats
- Calcola il rating per ogni giocatore usando le formule per posizione
- Genera `data/clubs.json` e `data/players.json`

### 3. Output

**`data/clubs.json`**
```json
[
  {"id": "ac-milan", "name": "AC Milan"},
  {"id": "inter", "name": "Inter"},
  ...
]
```

**`data/players.json`**
```json
[
  {
    "id": "p00001",
    "name": "Francesco Totti",
    "position": "ATT",
    "seasons": [
      {"club": "Roma", "season": "2004-2005", "rating": 95.2, "apps": 35, "goals": 18, "assists": 6},
      ...
    ]
  },
  ...
]
```

## 📐 Formule Rating

| Posizione | Formula |
|-----------|---------|
| **ATT** | (gol×3 + assist×1.5 + apps×0.5) / 1.05 × 100 + min_bonus |
| **MID** | (gol×2 + assist×2 + apps×0.5 + key_passes×1) / 1.455 × 100 + min_bonus |
| **DEF** | (apps×1 + tackles×0.5 + clean_sheets×1.5 - errors×2) / 0.875 × 100 + min_bonus |
| **GK** | (clean_sheets×2 + save_pct×0.3 - goals_against×0.3) / 0.435 × 100 + min_bonus |

`min_bonus = min(minutes / 3420, 1.0) × 10` — chi gioca di più ha un bonus fino a +10.

Rating finale: clamp a **1-99**.

## ⚠️ Note

- FBref rate-limita a ~20 req/min. Lo script aspetta 4-6s tra ogni richiesta.
- Se ricevi errore 429, lo script fa backoff automatico (30s, 60s, 90s).
- Le tabelle FBref nascoste nei commenti HTML vengono estratte automaticamente.
- Tempo stimato: ~5-10 minuti per tutte le stagioni (34 stagioni × 4s = ~2.5 min minimo).
- Log salvato in `scrape.log`.
