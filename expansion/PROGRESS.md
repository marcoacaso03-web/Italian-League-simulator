# 📊 Progresso Estrazione Dati

## Stato Generale

| Step | Stato | Note |
|------|:---:|------|
| ~~1. Download dataset Kaggle~~ | ✅ | Tutti i 5 dataset Kaggle scaricati |
| ~~2. Fonte FIFA 05-20~~ | ✅ | Repo `lbenz730/fifa_model` clonato — 168K righe, FIFA 05-20 |
| ~~3. Download dataset FIFA 17-23 (BryanB)~~ | ✅ | 7 file CSV scaricati |
| ~~4. Download dataset FIFA 24 (Rehan)~~ | ✅ | player_stats.csv scaricato |
| ~~5. Download dataset FC 25 (Aniss7)~~ | ✅ | player-data-full-2025-june.csv scaricato |
| ~~6. Download dataset FC 26 (rovnez)~~ | ✅ | FC26_20250921.csv scaricato |
| ~~7. Download Transfermarkt 2000-2004~~ | ✅ | 13 file CSV scaricati (~800MB) |
| ~~8. Creare mapping club → campionato~~ | ✅ | ~400 mappature club name → (league_id, club_id) |
| ~~9. Script estrazione~~ | ✅ | `scripts/generate_multi_league_data.py` + `scripts/merge_transfermarkt_2000_2004.py` |
| ~~10. Generazione players.json~~ | ✅ | 5 legge generate |
| ~~11. Validazione dati~~ | ✅ | Distribuzioni rating ok (47-57% in 70-85) |
| ~~12. Migrazione Serie A~~ | ✅ | `leagues/serie-a/players.json` creato con club IDs normalizzati |
| ~~13. Creazione data.json~~ | ✅ | Tutti i 5 league hanno `data.json` per il loader |
| ~~14. Integrazione game engine~~ | ✅ | `setActiveLeague()` popola legacy state, typecheck passa |
| 15. Test gameplay | ⬜ Non iniziato | Una partita per campionato |
| 16. Deploy | ⬜ Non iniziato | Push + Vercel |

## Dati Estratti Per Campionato

| Campionato | 2000-04 | FIFA 05-20 | FIFA 17-23 | FIFA 24 | FC 25 | FC 26 | Totale |
|------------|:-------:|:----------:|:----------:|:-------:|:-----:|:-----:|:------:|
| Serie A | ✅ CSV esistenti | ✅ generate-data.ts | ✅ generate-data.ts | ✅ | ✅ | ✅ | FATTO |
| Premier League | ✅ Transfermarkt (140 stagioni) | ✅ 9,629 players | ✅ incluso | ✅ incluso | ✅ incluso | ✅ incluso | ✅ |
| La Liga | ✅ Transfermarkt (98 stagioni) | ✅ 5,539 players | ✅ incluso | ✅ incluso | ✅ incluso | ✅ incluso | ✅ |
| Ligue 1 | ✅ Transfermarkt (128 stagioni) | ✅ 6,136 players | ✅ incluso | ✅ incluso | ✅ incluso | ✅ incluso | ✅ |
| Bundesliga | ✅ Transfermarkt (93 stagioni) | ✅ 6,985 players | ✅ incluso | ✅ incluso | ✅ incluso | ✅ incluso | ✅ |

## Statistiche Dati Generati

| Lega | Players | Stagioni totali | Avg Rating | Rating 70-85 |
|------|---------|-----------------|------------|:------------:|
| Serie A | 6,526 | ~19,030 | ~72 | ~55% |
| Premier League | 9,629 | ~27,908 | 69.8 | 51.9% |
| La Liga | 5,539 | ~14,788 | 71.4 | 56.7% |
| Ligue 1 | 6,136 | ~15,344 | 68.7 | 47.5% |
| Bundesliga | 6,985 | ~18,149 | 70.1 | 52.3% |

## Fonti Dati

| Fonte | Periodo | Link | Stato |
|-------|---------|------|:-----:|
| Transfermarkt (Kaggle davidcariboo) | 2000-2004 | https://www.kaggle.com/datasets/davidcariboo/player-scores/ | ✅ Scaricato e processato |
| FIFA Model Repo (lbenz730) | FIFA 05-20 | https://github.com/lbenz730/fifa_model | ✅ Clonato e usato |
| BryanB (Kaggle) | FIFA 17-23 | https://www.kaggle.com/datasets/bryanb/fifa-player-stats-database | ✅ Scaricato |
| Rehan Ahmed (Kaggle) | FIFA 24 | https://www.kaggle.com/datasets/rehandl23/fifa-24-player-stats-dataset | ✅ Scaricato |
| Aniss7 (Kaggle) | FC 25 | https://www.kaggle.com/datasets/aniss7/fifa-player-data-from-sofifa-2025-06-03 | ✅ Scaricato |
| rovnez (Kaggle) | FC 26 | https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data | ✅ Scaricato |

## Architettura Dati

```
public/data/leagues/<leagueId>/
├── meta.json      # Nome, paese, colori, numSquadre, numGiornate
├── clubs.json     # Lista club con id, name, rating
├── players.json   # Giocatori con stagioni e rating
└── data.json      # Unico file con meta+clubs+players (per loader)
```

## Note Sourcing

### Cambiamento fonte FIFA 05-16
- **Piano originale:** scraping da fifaindex.com
- **Decisione effettuata:** uso repo GitHub `lbenz730/fifa_model` che contiene già i dati FIFA 05-20 pronti (168K righe, 1,726 club)
- **Motivazione:** più veloce, nessun scraping necessario, copre anche FIFA 17-20 (overlap con BryanB utile per validazione)

### Conversione nomi giocatori
- Il dataset FIFA model contiene prefissi numerici nei nomi (es. "07 E. Howe") — puliti con `clean_player_name()`

### Periodo 2000-2004 (Transfermarkt)
- 601 entries mappate su 1089 valori di mercato nel range 2000-2004
- Formula conversione MV → rating: `rating = 55 + (38 * MV) / (MV + 1_280_000)`, clamp [50, 95]

### FIFA 24 (Rehan)
- Dataset non ha overall rating nativo — calcolato come media pesata delle stats

### Integrazione Game Engine
- `setActiveLeague(leagueId)` in `data.ts` popola sia il nuovo state (`_activeLeagueData`) che il legacy state (`_players`, `_clubs`, `_clubsBySeason`)
- Questo permette al draft esistente di funzionare senza modifiche
- `GamePage.tsx` ha già il selettore di lega (corretto `laliga` → `la-liga`)
- `SimScreen.tsx` passa `leagueId` a `simulateSeason`
- Typecheck passa senza errori ✅

## Prossimi Passi

1. ~~Scaricare tutti i dataset~~ ✅
2. ~~Creare mapping club → campionato~~ ✅
3. ~~Scrivere ed eseguire script estrazione~~ ✅
4. ~~Validare distribuzione rating~~ ✅
5. ~~Processare Transfermarkt 2000-2004~~ ✅
6. ~~Migrare Serie A in `leagues/serie-a/`~~ ✅
7. ~~Creare data.json per tutte le leghe~~ ✅
8. ~~Integrare game engine (data.ts, simulation.ts)~~ ✅
9. **Test gameplay completo** — Verificare che il draft e la simulazione funzionino per ogni lega
10. **Deploy** — Push su GitHub + Vercel

---

*Ultimo aggiornamento: 2026-06-22*
