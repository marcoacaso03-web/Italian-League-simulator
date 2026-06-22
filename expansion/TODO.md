# TODO — Espansione multi-lega

## Stato generale
- [x] **PianoEspansione.md** — decisioni dataset corrette, formula market value→rating, analisi distribuzione (47% in 70-85 ✅), traduzioni verificate
- [x] **PROGRESS.md** — aggiornato con stato coding layer multi-lega
- [x] **context.md** — creato in `expansion/`
- [x] **Fix typecheck** — `tsc --noEmit` pulito
- [x] **Multi-lega code** — `leagues.ts`, `data.ts`, `simulation.ts` adattati
- [x] **Script download dataset** — `scripts/download_kaggle_datasets.sh` creato
- [x] **Script processing multi-lega** — `scripts/generate_multi_league_data.py` creato
- [x] **TODO.md** — creato

## Bloccante
- **Dataset FIFA completi per Premier League, La Liga, Ligue 1, Bundesliga**
  - Servono i CSV Kaggle di Stefanoleone992 (`players_15.csv` … `players_25.csv`)
  - Posizione attesa: `.migration-backup/sofifa_raw/` (o cartella configurata nello script)
  - Per FIFA 05-14: serve scraping da FifaIndex (script da creare)

## Prossimi passi (in ordine)
1. Scaricare dataset Kaggle e posizionarli in `sofifa_raw/`
2. Lanciare `scripts/generate_multi_league_data.py --clean` per generare `data.json` per ogni lega
3. Copiare i `data.json` nelle cartelle `public/data/leagues/<id>/`
4. Verificare `npx tsc --noEmit` e testare il gioco con ogni lega
5. Per FIFA 05-14 (non in Kaggle): creare scraper FifaIndex
