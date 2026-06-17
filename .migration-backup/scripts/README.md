# ⚽ 38-0 Serie A — SoFIFA Scraper

> Il vecchio scraper FBref è stato sostituito. Il rating ora usa l’**overall FIFA/EA FC**
> direttamente dal dataset Kaggle (nessuna formula, valore diretto EA Sports).

---

## 📦 Fonte dati

**Kaggle — EA Sports FC Complete Player Dataset** di `stefanoleone992`

- [FIFA 15 → FC 24](https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset)
- [FC 25](https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-25-complete-player-dataset)

Stagioni coperte: **2014-2015 → 2024-2025**

---

## 🚀 Setup

### Step 1 — Scarica i CSV da Kaggle

**Opzione A: Kaggle CLI** (consigliata)
```bash
pip install kaggle
# Configura le credenziali: https://www.kaggle.com/docs/api
kaggle datasets download -d stefanoleone992/ea-sports-fc-24-complete-player-dataset
unzip ea-sports-fc-24-complete-player-dataset.zip -d data/sofifa_raw/

# FC 25 (stagione 2024-2025)
kaggle datasets download -d stefanoleone992/ea-sports-fc-25-complete-player-dataset
unzip ea-sports-fc-25-complete-player-dataset.zip -d data/sofifa_raw/
```

**Opzione B: Download manuale**
1. Vai su https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset
2. Clicca **Download** → scarica lo zip
3. Estrai i CSV in `data/sofifa_raw/`

I file devono chiamarsi: `players_15.csv`, `players_16.csv`, ..., `players_25.csv`

### Step 2 — Esegui lo script

```bash
python scripts/scrape_sofifa.py
```

Output generato:
- `data/players.json`
- `data/clubs.json`

---

## 📅 Mappa versioni FIFA → stagione

| File CSV | Stagione reale |
|----------|---------------|
| `players_15.csv` | 2014-2015 |
| `players_16.csv` | 2015-2016 |
| `players_17.csv` | 2016-2017 |
| `players_18.csv` | 2017-2018 |
| `players_19.csv` | 2018-2019 |
| `players_20.csv` | 2019-2020 |
| `players_21.csv` | 2020-2021 |
| `players_22.csv` | 2021-2022 |
| `players_23.csv` | 2022-2023 |
| `players_24.csv` | 2023-2024 |
| `players_25.csv` | 2024-2025 |

---

## 📄 Struttura output

```json
// players.json
[
  {
    "id": "p00042",
    "name": "Domenico Berardi",
    "position": "RW",
    "position_category": "ATT",
    "nationality": "Italy",
    "seasons": [
      { "club": "Sassuolo", "season": "2016-2017", "rating": 79.0 },
      { "club": "Sassuolo", "season": "2020-2021", "rating": 81.0 }
    ]
  }
]

// clubs.json
[ { "id": "sassuolo", "name": "Sassuolo" } ]
```

---

## ⚠️ Note

- **`apps`, `goals`, `assists` rimossi**: il dataset Kaggle non contiene statistiche
  reali di partita, solo i valori FIFA.
- Solo giocatori con **almeno una stagione in Serie A** vengono inclusi.
- La **posizione** viene presa dall’ultima versione FIFA disponibile per quel giocatore.
- Il **rating** è l’`overall` di EA Sports, range tipico 46–99.
