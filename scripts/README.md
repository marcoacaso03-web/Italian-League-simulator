# ⚽ 38-0 Serie A — FBref Scraper

## 🚀 Setup (3 opzioni)

### Opzione 1: Browserless (consigliata ⭐)
```bash
# Avvia Browserless Docker (1 comando)
docker run -p 3000:3000 browserless/chrome

# Test connessione
python test_browserless.py

# Scrape completo
python scrape_serie_a_v5.py --browserless

# Solo alcune stagioni
python scrape_serie_a_v5.py --browserless --seasons 2023-2024 2024-2025
```

Oppure con Browserless Cloud (6h/mese gratuito):
```bash
# Registrati su https://www.browserless.io/ → copia il token
python scrape_serie_a_v5.py --browserless --browserless-token TUO_TOKEN
```

### Opzione 2: SeleniumBase
```bash
pip install seleniumbase
python scrape_serie_a_v5.py --seleniumbase
```

### Opzione 3: Requests (no Cloudflare bypass)
```bash
python scrape_serie_a_v5.py  # funziona solo se non sei bloccato
```

## 📐 Formule Rating

| Pos | Formula |
|-----|---------|
| ATT | (gol×3 + assist×1.5 + apps×0.5) / 1.05 × 100 + min_bonus |
| MID | (gol×2 + assist×2 + apps×0.5 + key_passes×1) / 1.455 × 100 + min_bonus |
| DEF | (apps×1 + tackles×0.5 + clean_sheets×1.5 - errors×2) / 0.875 × 100 + min_bonus |
| GK  | (clean_sheets×2 + save_pct×0.3 - goals_against×0.3) / 0.435 × 100 + min_bonus |

Rating: 1-99 | min_bonus = min(minutes/3420, 1.0) × 10
