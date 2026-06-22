# Context — Stato implementazione multi-lega

Data: 22 giugno 2026  
Branch: main  
Repo: Italian-League-simulator

## Dove siamo arrivati

- Typecheck pulito: niente errori `tsc --noEmit`
- GamePage esteso con selettore campionato (Serie A, Premier League, La Liga, Ligue 1, Bundesliga)
- SetupConfig include ora `leagueId`; propagate a DraftScreen, SimScreen, Lobby pages
- useDraft chiama `setActiveLeague(config.leagueId)` all'avvio del draft
- SimScreen riceve `leagueId` e lo passa a `simulateSeason(..., leagueId)`

## Decisioni confermate

1. **Architettura per-league**: `public/data/leagues/<id>/data.json` (meta + clubs + players)
2. **Serie A invariata** (file legacy `/data/players.json`, `generate-data.ts`)
3. **Selezione lega** in SetupScreen con 5 leghe (default Serie A)
4. **Simulazione async** adattata (SimScreen usa IIFE per `await simulateSeason`)
5. **Data sourcing per era**:
   - 2000/01–2003/04: Kaggle `davidcariboo/player-scores` → richiede conversione marketValue→rating
   - 2004/05–2015/16: FIFA Index scraping
   - 2016/17–2022/23: Kaggle `bryanb/fifa-player-stats-database`
   - 2023/24: Kaggle `rehandl23/fifa-24-player-stats-dataset`
   - 2024/25: Kaggle `aniss7/fifa-player-data-from-sofifa-2025-06-03`
   - 2025/26: Kaggle `rovnez/fc-26-fifa-26-player-data`

## Formula conversione Market Value → Rating (era 2000-04)

Calibrata su distribuzione realistica di Transfermarkt:

```python
def marketValueToRating(mv: float) -> int:
    c = 1_280_000
    r = 55 + (38 * mv) / (mv + c)
    return max(50, min(95, round(r)))
```

- **Verifica** su 4000 valori: **47%** dei rating in fascia 70-85 (soglia >40%) → ✅

## File modificati sinora

- `src/lib/leagues.ts` (aggiunta `marketValueToRating`)
- `src/lib/data.ts` (rifattorizzato, multi-lega)
- `src/lib/simulation.ts` (rifattorizzato, generico)
- `src/lib/useDraft.ts` (aggiunta chiamata `setActiveLeague`)
- `src/pages/GamePage.tsx` (SetupScreen, selettore lega, propagate `leagueId`)
- `src/game/SimScreen.tsx` (async `simulateSeason`, `leagueId`)
- `expansion/PianoEspansione.md` (corretto dataset, formule, checklist)
- `expansion/PROGRESS.md` (riscritto)

## Prossimi passi

1. Implementare pipeline di download e parsing per i 4 nuovi dataset FIFA (PL/LL/L1/BL)
2. Generare `players.json` per Premier League, La Liga, Ligue 1, Bundesliga
3. applicare `marketValueToRating` ai dati Transfermarkt 2000-04 delle 4 leghe
4. Test E2E completo su tutte le 5 leghe
