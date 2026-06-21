# 📊 Progresso Estrazione Dati FIFA

## Stato Generale

| Step | Stato | Note |
|------|:---:|------|
| 1. Download dataset Kaggle | ⬜ Non iniziato | Richiede Kaggle API key |
| 2. Creare mapping club → campionato | ⬜ Non iniziato | 4 campionati × 22 FIFA versions |
| 3. Script estrazione | ⬜ Non iniziato | TypeScript, filtra per campionato |
| 4. Validazione dati | ⬜ Non iniziato | Check completezza |
| 5. Integrazione game engine | ⬜ Non iniziato | lib/leagues.ts, lib/data.ts |
| 6. Test gameplay | ⬜ Non iniziato | Una partita per campionato |
| 7. Deploy | ⬜ Non iniziato | Push + Vercel |

## Dati Estratti Per Campionato

| Campionato | FIFA 05-16 | FC 25 | FC 26 | Totale |
|------------|:---:|:---:|:---:|:---:|
| Premier League | ⬜ | ⬜ | ⬜ | 0 |
| La Liga | ⬜ | ⬜ | ⬜ | 0 |
| Ligue 1 | ⬜ | ⬜ | ⬜ | 0 |
| Bundesliga | ⬜ | ⬜ | ⬜ | 0 |

## Decisioni Prese

- **Formato output:** `public/data/leagues/<leagueId>/players.json`
- **Dati per giocatore:** id, name, position, club, rating, season
- **Fonte primaria:** Kaggle (BryanB per 05-16, Aniss7 per 25, rovnez per 26)
- **Fallback:** FifaIndex web scraping
- **v1 scope:** Solo FIFA 26 per 4 campionati
- **v2 scope:** Tutte le FIFA versions per mode "era"

## Prossimi Passi

1. Ottenere Kaggle API key
2. Scaricare i 3 dataset
3. Creare mapping club → campionato completo
4. Scrivere script estrazione
5. Validare e integrare

---

*Ultimo aggiornamento: 2026-06-21*
