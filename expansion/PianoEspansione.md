# 🏗️ Piano di Espansione: Serie A → Top 5 European Leagues

> **Progetto:** 38-0 Serie A → 38-0 European Leagues
> **Obiettivo:** Espandere il simulatore da lega singola (Serie A) a piattaforma multi-liga con **Premier League, La Liga, Serie A, Ligue 1, Bundesliga**.
> **Filosofia:** Ogni fase è shippable indipendentemente. Si parte dall'esistente, si aggiunge, non si riscrive da zero.

---

## 📋 Indice

1. [Stato dell'Arte](#stato-dellarte)
2. [Decisioni Architetturali](#decisioni-architetturali)
3. [Fase 0 — Audit & Setup](#fase-0--audit--setup)
4. [Fase 1 — Data Layer Multi-Liga](#fase-1--data-layer-multi-liga)
5. [Fase 2 — Motore di Simulazione Generico](#fase-2--motore-di-simulazione-generico)
6. [Fase 3 — UI Multi-Liga](#fase-3--ui-multi-liga)
7. [Fase 4 — Funzionalità Cross-Liga](#fase-4--funzionalità-cross-liga)
8. [Fase 5 — Polish & Deploy](#fase-5--polish--deploy)
9. [Rischi & Mitigazione](#rischi--mitigazione)
10. [Timeline Riepilogativa](#timeline-riepilogativa)

---

## Stato dell'Arte

### Cosa abbiamo ora

| Aspetto | Stato | Note |
|---------|-------|------|
|| **Framework** | Vite + React 19 + Tailwind CSS (via `@tailwindcss/vite`) | Solido, nessun cambiamento necessario |
| **Build Tool** | Vite con `pnpm` workspace mono-repo | `scripts/generate-data.ts` genera JSON statici in `public/data/` |
| **Dati** | `public/data/players.json` (~4000 giocatori, solo Serie A) | Vincolati alla Serie A; generati da script in `scripts/src/` |
| **Data Layer** | `lib/data.ts` — helper per club, giocatori, squad+season pool | Hardcoded "Serie A" implicito |
| **Landing** | `src/pages/HomePage.tsx` — hero "38-0 Serie A", FAQ, sfide | Testi hardcoded "Serie A" |
| **Game** | `src/pages/GamePage.tsx` — setup, draft, simulazione, risultato | Flusso completo ma Serie A-only; wouter per routing |
| **Componenti** | `FormationSelector`, `SlotMachine`, `Pitch`, `PlayerCard` | Riusabili, nessun refactoring necessario |
| **Routing** | `wouter` (non Next.js Router) | Route: `/`, `/game`, `/leaderboard` |
| **Deploy** | Vercel, dominio `38-0-serie-a.vercel.app` | Configurato e funzionante |
| **Nessun backend** | Tutto client-side; Firebase solo per leaderboard (Firestore) | ✅ Vantaggio: niente migrazione DB |

### Cosa è hardcoded "Serie A"

1. **`public/data/players.json`** — giocatori con stagioni solo in club italiani
2. **`src/pages/HomePage.tsx`** — titoli "38-0 Serie A", "Serie A" in testi/FAQ
3. **`src/pages/GamePage.tsx`** — simulazione usa `SERIE_A_2526` (20 squadre fisse), 38 giornate hardcoded
4. **`src/lib/simulation.ts`** — `SERIE_A_2526` array hardcoded, `simulateSeason` usa `slice(0, 20)` e loop `md < 38`

### Cosa è già generico (riusabile)

- Formazioni (`FORMATION_SLOTS` in `lib/formations.ts`) — 5 formazioni, già parametriche
- `DraftScreen` — accetta `SetupConfig`, non lega a lega specifica
- `SquadPreviewScreen` — generico
- `SimScreen` — accetta `DraftSlot[]`, generico
- `ResultsScreen` — accetta `SeasonResult`, generico
- `SlotMachine` — generico
- `FormationSelector` — generico
- `PlayerCard` — generico (in `DraftScreen`)

---

## Decisioni Architetturali

> **Queste decisioni bloccano lo sviluppo. Prenderle ora.**

### D1 — Struttura dati: JSON statici per league

**Decisione:** Ogni lega ha il suo file JSON in `public/data/leagues/<leagueId>/`.
Nessuna API esterna per v1. I dati vengono da dataset open (fonte: football.json.org, FBref scraping, o manuale).

```
public/data/
├── leagues/
│   ├── serie-a/
│   │   ├── clubs.json
│   │   ├── players.json
│   │   └── meta.json        # nome, paese, numSquadre, stagione, colori
│   ├── premier-league/
│   │   ├── clubs.json
│   │   ├── players.json
│   │   └── meta.json
│   ├── la-liga/
│   ├── ligue-1/
│   └── bundesliga/
├── players.json              # DEPRECATED — re-export temporaneo (Fase 1), rimuovere in Fase 5
└── clubs-by-season.json      # DEPRECATED — re-export temporaneo (Fase 1), rimuovere in Fase 5
```

**Motivazione:** Zero dipendenze esterne, build deterministica, performance massime. API live = Fase stretch.

**Nota sui path:** In Vite, i file statici serviti da `public/` sono accessibili come `/data/...`. Il loader in `lib/leagues.ts` usa `fetch('/data/leagues/<id>/players.json')` con dynamic `import()` per lazy loading.

### D2 — Identificatore lega

**Decisione:** `leagueId` = slug ISO: `premier-league`, `la-liga`, `serie-a`, `ligue-1`, `bundesliga`.

### D3 — Numero squadre e giornate

| Lega | Squadre | Giornate | Formato |
|------|---------|----------|---------|
| Premier League | 20 | 38 | Andata/ritorno |
| La Liga | 20 | 38 | Andata/ritorno |
| Serie A | 20 | 38 | Andata/ritorno |
| Ligue 1 | 18 | 34 | Andata/ritorno |
| Bundesliga | 18 | 34 | Andata/ritorno |

**Decisione:** Il motore di simulazione prende `numTeams` e `numMatchdays` da `meta.json`. Niente hardcoded "38".

### D4 — Champions League

**Decisione:** Out di scope per v1. Stretch goal per v2. Non blocca il release.

### D5 — Tema UI per lega

**Decisione:** Ogni `meta.json` include colori primario/secondario. Il tema si applica a header, accenti, glow. Layout unico.

```json
// meta.json
{
  "id": "premier-league",
  "name": "Premier League",
  "country": "Inghilterra",
  "countryCode": "gb",
  "numTeams": 20,
  "numMatchdays": 38,
  "season": "2024-2025",
  "colors": {
    "primary": "#3D195B",
    "secondary": "#FF2882",
    "accent": "#00FF87"
  }
}
```

---

## Fase 0 — Audit & Setup

**Durata:** 1 giorno
**Obiettivo:** Capire esattamente cosa c'è, preparare lo senza toccare il codice di produzione.

### 0.1 — Verifica stato deploy

- [ ] Controllare che `https://38-0-serie-a.vercel.app` funzioni
- [ ] Verificare l'ultimo commit su `main`
- [ ] Creare un branch `feat/multi-league` per tutto il lavoro

### 0.2 — Scrivere i types condivisi

Creare `types/league.ts` — il contratto dati per tutto il progetto:

```typescript
// types/league.ts

export interface LeagueMeta {
  id: string;           // "premier-league"
  name: string;         // "Premier League"
  country: string;      // "Inghilterra"
  countryCode: string;  // "gb"
  numTeams: number;     // 20
  numMatchdays: number; // 38
  season: string;       // "2024-2025"
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface LeagueClub {
  id: string;    // "manchester-united"
  name: string;  // "Manchester United"
  rating: number; // 60-95, forza del club nella simulazione
}

/**
 * Entry del pool draft per una combinazione club+stagione.
 * `club` deve matchare un `LeagueClub.id` nella stessa lega.
 */
export interface LeagueClubSeasonEntry {
  club: string;   // LeagueClub.id
  season: string; // "2024-2025"
  playerCount: number;
}

export interface LeaguePlayerSeason {
  club: string;   // Deve matchare un LeagueClub.id nella stessa lega (vincolo runtime, non tipografico)
  season: string; // "2024-2025"
  rating: number;
  apps: number;
  goals: number;
  assists: number;
}

export interface LeaguePlayer {
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  seasons: LeaguePlayerSeason[];
}

export interface LeagueDataSource {
  meta: LeagueMeta;
  clubs: LeagueClub[];
  players: LeaguePlayer[];
}
```

**Gate:** Types definiti, compilano con `npx tsc --noEmit`.

---

## Fase 1 — Data Layer Multi-Liga

**Durata:** 3-5 giorni
**Obiettivo:** I dati delle 5 leghe esistono e sono caricabili.

### 1.1 — Sourcing dati

Per ogni lega, creare `data/leagues/<leagueId>/` con:

| File | Contenuto | Fonte |
|------|-----------|-------|
| `meta.json` | Nome, paese, colori, num squadre/giornate | Manuale |
| `clubs.json` | 18-20 club della lega | Manuale |
| `players.json` | Giocatori con rating per club/stagione | Vedi matrice fonti sotto |

#### Matrice Fonti Dati per Periodo

La strategia corretta usa **fonti diverse per periodo**, con i dataset FIFA come fonte primaria (hanno già i rating) e Transfermarkt solo per il gap 2000-2004:

| Periodo | Fonte | Link | Note |
|---------|-------|------|------|
| **2000/01 → 2003/04** | Kaggle Transfermarkt Player Scores | https://www.kaggle.com/datasets/davidcariboo/player-scores/ | Unire tabelle players, clubs, appearances, valuations. Creare dataset con nomi, squadre, valori → convertire in rating. **Solo per questo periodo.** |
| **FIFA 05 → FIFA 20** | GitHub lbenz730/fifa_model | https://github.com/lbenz730/fifa_model | Rating già presenti. 168K righe. Copre 05-20 (overlap 17-20 con BryanB). |
| **FIFA 17 → FIFA 23** | Kaggle BryanB FIFA Player Stats | https://www.kaggle.com/datasets/bryanb/fifa-player-stats-database | Rating già presenti. 7 versioni × 5 leghe. |
| **FIFA 24** | Kaggle Rehan Ahmed | https://www.kaggle.com/datasets/rehandl23/fifa-24-player-stats-dataset | Rating già presenti. |
| **FIFA 25 (FC 25)** | Kaggle Aniss7 Sofifa | https://www.kaggle.com/datasets/aniss7/fifa-player-data-from-sofifa-2025-06-03 | Rating già presenti. Include `club_league_name`. |
| **FIFA 26 (FC 26)** | Kaggle rovnez | https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data | Rating già presenti. Include `club_league_name`. |

#### Dettaglio per periodo

**2000/01 → 2003/04 — Transfermarkt (Kaggle Player Scores) + Serie A CSV esistenti**
- Dataset: `https://www.kaggle.com/datasets/davidcariboo/player-scores/`
- Contiene: nome giocatore, club, valore di mercato, presenze, gol, assist per stagione
- **Conversione necessaria**: valore di mercato → rating FIFA-style (1-99) tramite curva logistica
- Applicazione: **4 leghe non-Serie A** per il periodo 2000-2004
- **Serie A: ✅ GIÀ FATTO** — CSV `Stagione 2000-01.csv` → `Stagione 2003-04.csv` con rating già pronti

**FIFA 05 → FIFA 20 — lbenz730/fifa_model (GitHub)**
- Repo: `https://github.com/lbenz730/fifa_model`
- File: `player_stats.csv` — 168,147 righe, FIFA 05-20
- Dati: nome, stagione, rating, club, nazionalità, posizione, tutte le stats
- **Nessuna conversione necessaria** — rating già presenti
- **Nessun scraping necessario** — dati già estratti da FifaIndex
- Copre il range FIFA 05-16 del piano + extra (FIFA 17-20, overlap con BryanB per validazione)

**FIFA 17 → FIFA 23 — Kaggle BryanB**
- Dataset: `https://www.kaggle.com/datasets/bryanb/fifa-player-stats-database`
- Dati: nome, club, overall, posizione, attributi
- **Nessuna conversione necessaria**

**FIFA 24 — Kaggle Rehan Ahmed**
- Dataset: `https://www.kaggle.com/datasets/rehandl23/fifa-24-player-stats-dataset`
- **Nessuna conversione necessaria**

**FIFA 25 — Kaggle Aniss7**
- Dataset: `https://www.kaggle.com/datasets/aniss7/fifa-player-data-from-sofifa-2025-06-03`
- Include `club_league_name` per filtro diretto per campionato
- **Nessuna conversione necessaria**

**FIFA 26 — Kaggle rovnez**
- Dataset: `https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data`
- Include `club_league_name` per filtro diretto per campionato
- **Nessuna conversione necessaria**

#### Conversione rating (solo per dati Transfermarkt 2000-2004)

Solo il periodo Transfermarkt (2000-2004) richiede conversione da valore di mercato a rating. Per tutti i dataset FIFA il rating è già presente.

```typescript
/**
 * Converte un valore di mercato (€) in un rating FIFA-style (1-99).
 * Usato SOLO per i dati Transfermarkt 2000-2004.
 * Formula iperbolica calibrata per distribuzione >= 40% in 70-85.
 */
export function marketValueToRating(marketValue: number): number {
  if (marketValue <= 0) return 45;
  const c = 1_280_000; // punto di flesso empirico
  const r = 55 + (38 * marketValue) / (marketValue + c);
  return Math.max(50, Math.min(95, Math.round(r)));
}
```

**Criteri di accettanza per la distribuzione rating (solo Transfermarkt):**
- Range 70-85: **≥40%** dei giocatori (soglia minima)
- Range 50-69: 25-40%
- Range 86-95: 5-15%
- Range <50 o >95: <10%
- Media attesa: **65-75**
- Deviazione standard attesa: **12-18**

**Verifica:** 4000 valori simulati → 47% in 70-85 ✅

**Approccio pragmatico per v1:**
- **Serie A:** ✅ GIÀ FATTO — `generate-data.ts` genera `players.json` corretto con tutti i rating
- **Altre 4 leghe FIFA 05-26:** Script `scripts/generate_multi_league_data.py` — fonti: lbenz730/fifa_model (05-20) + BryanB (17-23) + Rehan (24) + Aniss7 (25) + rovnez (26)
- **Altre 4 leghe 2000-2004:** Transfermarkt Kaggle → conversione rating (DA FARE)

**Checklist per ogni lega:**
- [x] **Serie A**: ✅ completata — `generate-data.ts` genera `players.json` corretto, migrato in `leagues/serie-a/`
- [x] **Premier League**: ✅ completata — 9,629 giocatori, FIFA 05-26 + Transfermarkt 2000-04
- [x] **La Liga**: ✅ completata — 5,539 giocatori, FIFA 05-26 + Transfermarkt 2000-04
- [x] **Ligue 1**: ✅ completata — 6,136 giocatori, FIFA 05-26 + Transfermarkt 2000-04
- [x] **Bundesliga**: ✅ completata — 6,985 giocatori, FIFA 05-26 + Transfermarkt 2000-04
- [x] `meta.json` creato con colori ufficiali
- [x] `clubs.json` con 18-20 club (formato `LeagueClub`)
- [x] `players.json` con almeno 150 giocatori totali
- [x] `data.json` unificato per il loader
- [x] Dati validati: ogni giocatore ha almeno una stagione
- [x] Rating distribution validata: concentrazione 70-85 ≥ 40%

### 1.1b — Download e processing Kaggle

```bash
# Setup Kaggle API (key già in .env)
pip install kaggle
export KAGGLE_KEY=$(grep KAGGLE_KEY .env | cut -d= -f2)

# Scarica dataset Player Scores
kaggle datasets download -d davidcariboo/player-scores -p data/kaggle-raw/ --unzip

# Struttura file attesa:
# data/kaggle-raw/
# ├── players.csv          # Anagrafica giocatori
# ├── clubs.csv            # Anagrafica club
# ├── competitions.csv     # Anagrafia competizioni
# ├── appearances.csv      # Presenze/gol/assist per stagione
# ├── player_valuations.csv # Valori di mercato per stagione
# └── game_events.csv      # Eventi di gioco (dettaglio)
```

**Script di processing** (`scripts/src/process-kaggle-data.ts`):
1. Leggi `player_valuations.csv` + `appearances.csv` + `clubs.csv`
2. Filtra per competizioni top 5 legue (Premier League, La Liga, Serie A, Bundesliga, Ligue 1)
3. Per ogni giocatore × stagione × club:
   - Prendi il valore di mercato più recente
   - Calcola rating con `marketValueToRating()`
   - Estrai presenze, gol, assist
4. Genera `players.json` per ogni lega nel formato `LeaguePlayer`
5. Esegui `validateRatingDistribution()` e stampa report
6. Se la distribuzione non rispetta i criteri, calibra i parametri `k` e `x0` della curva logistica

### 1.2 — League Loader

Creare `lib/leagues.ts` con **dynamic import** per lazy loading:

```typescript
// lib/leagues.ts
import type { LeagueDataSource, LeagueMeta } from "@/types/league";

type LeagueModule = {
  meta: LeagueMeta;
  clubs: LeagueClub[];
  players: LeaguePlayer[];
};

// Dynamic imports — ogni lega viene caricata solo quando serve
const leagueLoaders: Record<string, () => Promise<LeagueModule>> = {
  "serie-a":      () => import("@/data/leagues/serie-a/module.json"),
  "premier-league": () => import("@/data/leagues/premier-league/module.json"),
  "la-liga":      () => import("@/data/leagues/la-liga/module.json"),
  "ligue-1":      () => import("@/data/leagues/ligue-1/module.json"),
  "bundesliga":   () => import("@/data/leagues/bundesliga/module.json"),
};

// Cache dopo il primo caricamento
const cache: Record<string, LeagueDataSource> = {};

export async function getLeague(leagueId: string): Promise<LeagueDataSource> {
  if (cache[leagueId]) return cache[leagueId];
  const loader = leagueLoaders[leagueId];
  if (!loader) {
    // Errore esplicito — niente fallback silenzioso
    throw new Error(`Lega non trovata: "${leagueId}". Leghe disponibili: ${Object.keys(leagueLoaders).join(", ")}`);
  }
  const mod = await loader();
  const ds: LeagueDataSource = { meta: mod.meta, clubs: mod.clubs, players: mod.players };
  cache[leagueId] = ds;
  return ds;
}

export function listLeagues(): LeagueMeta[] {
  // Ritorna solo i meta (leggeri) senza caricare i dati completi
  return Object.values(leagueLoaders).map(() => {
    // I meta sono noti a compile-time tramite un elenco statico
    // per evitare di caricare tutto solo per elencare le leghe
  });
}

/** Elenco statico dei meta per il selector (non richiede caricamento dati) */
export const LEAGUE_META_STATIC: LeagueMeta[] = [
  { id: "serie-a",        name: "Serie A",        country: "Italia",       countryCode: "it", numTeams: 20, numMatchdays: 38, season: "2024-2025", colors: { primary: "#02448E", secondary: "#00C200", accent: "#FFFFFF" } },
  { id: "premier-league",  name: "Premier League",  country: "Inghilterra",  countryCode: "gb", numTeams: 20, numMatchdays: 38, season: "2024-2025", colors: { primary: "#3D195B", secondary: "#FF2882", accent: "#00FF87" } },
  { id: "la-liga",         name: "La Liga",         country: "Spagna",       countryCode: "es", numTeams: 20, numMatchdays: 38, season: "2024-2025", colors: { primary: "#000000", secondary: "#FFFFFF", accent: "#FF0000" } },
  { id: "ligue-1",         name: "Ligue 1",         country: "Francia",      countryCode: "fr", numTeams: 18, numMatchdays: 34, season: "2024-2025", colors: { primary: "#091C3E", secondary: "#DA020E", accent: "#FFD700" } },
  { id: "bundesliga",      name: "Bundesliga",      country: "Germania",     countryCode: "de", numTeams: 18, numMatchdays: 34, season: "2024-2025", colors: { primary: "#D20515", secondary: "#FFFFFF", accent: "#000000" } },
];
```

**Nota:** In Vite, `import()` su file JSON genera un chunk separato per ogni lega. Il bundle iniziale contiene solo i meta statici (~1KB). I dati completi (~2-3MB per lega) vengono caricati on-demand quando l'utente seleziona una lega.

### 1.3 — Migrazione dati Serie A esistente

- [ ] Creare `public/data/leagues/serie-a/module.json` (unico file con meta+clubs+players)
- [ ] Creare `public/data/leagues/serie-a/meta.json` (re-export di `module.json` per compatibilità)
- [ ] Creare `public/data/players.json` come re-export che punta ai dati Serie A (deprecato, mantiene compatibilità con `lib/data.ts` esistente)
- [ ] Creare `public/data/clubs-by-season.json` come re-export (deprecato)
- [ ] Verificare che i `club` nei player seasons corrispondano agli `id` in clubs

**Pattern deprecazione (Fase 1 → Fase 5):**
```
Fase 1: I file vecchi (players.json, clubs-by-season.json) diventano re-export
        che puntano ai nuovi dati. Nessuna rottura.
Fase 5: Dopo verifica in produzione, rimuovere i file deprecati.
```

**Gate:** `getLeague("serie-a")` restituisce gli stessi dati di prima. `getLeague("premier-league")` restituisce i nuovi dati.

---

## Fase 2 — Motore di Simulazione Generico

**Durata:** 3-4 giorni
**Obiettivo:** Il motore di simulazione legge da `LeagueDataSource`, niente hardcoded.

### 2.1 — Refactor `game/page.tsx`

Il cuore del refactor: la funzione `simulateSeason` deve ricevere `LeagueDataSource` invece di usare `clubs` globale.

**Prima (attuale):**
```typescript
const clubs = useMemo(() => loadClubs(), []);
// ...
const leagueTeams = clubs.slice(0, 20).map((c, i) => ({
  name: c.name,
  rating: i === 0 ? teamRating : 40 + Math.random() * 40,
}));
for (let md = 1; md <= 38; md++) { ... }
```

**Dopo:**
```typescript
const league = getLeague(leagueId);
const numTeams = league.meta.numTeams;
const numMatchdays = league.meta.numMatchdays;

const leagueTeams = league.clubs.slice(0, numTeams).map((c, i) => ({
  name: c.name,
  rating: i === 0 ? teamRating : 40 + Math.random() * 40,
}));
for (let md = 1; md <= numMatchdays; md++) { ... }
```

### 2.2 — Draft pool per lega

Il draft pool (club+season) deve essere filtrato per lega:

```typescript
// Prima: getClubSeasonPool() — tutti i dati globali
// Dopo: getClubSeasonPool(leagueId) — filtrato per league

function getClubSeasonPool(leagueId: string): LeagueClubSeasonEntry[] {
  const league = getLeague(leagueId);
  const clubIds = new Set(league.clubs.map(c => c.id));
  // Filtra i player seasons per club appartenenti alla lega
  // ...
}
```

### 2.3 — Regression test

- [ ] Simulare una stagione Serie A con il nuovo codice
- [ ] Confrontare risultati con il codice vecchio (stessa seed → stessi risultati)
- [ ] Verificare che Ligue 1 e Bundesliga producano 34 giornate (non 38)

**Gate:** Il gioco funziona identico a prima per Serie A. Le altre leghe producono simulazioni complete.

---

## Fase 3 — UI Multi-Liga

**Durata:** 4-5 giorni
**Obiettivo:** L'utente sceglie la lega, la UI si adatta.

### 3.1 — League Selector

Creare `components/LeagueSelector.tsx`:

```typescript
// Mostra 5 card, una per lega
// Ogni card: nome, bandiera paese, colori ufficiali
// Click → seleziona la lega → salva in localStorage
```

**Design:**
```
┌─────────────────────────────────────────────┐
│           Scegli la tua Lega                │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ 🏴󠁧󠁢󠁥󠁮󠁧󠁿  │ │ 🇪🇸    │ │ 🇮🇹    │       │
│  │Premier  │ │La Liga  │ │Serie A  │       │
│  │League   │ │         │ │         │       │
│  └─────────┘ └─────────┘ └─────────┘       │
│  ┌─────────┐ ┌─────────┐                   │
│  │ 🇫🇷    │ │ 🇩🇪    │                   │
│  │Ligue 1  │ │Bundesliga│                  │
│  └─────────┘ └─────────┘                   │
└─────────────────────────────────────────────┘
```

### 3.2 — Setup page (`game/page.tsx`)

Aggiungere la selezione lega come **primo step** del flusso:

```
Setup Flow:
1. Scegli Liga     ← NUOVO
2. Scegli Formazione
3. Scegli Difficoltà
4. Scegli Era
5. Inizia Draft
```

### 3.3 — Tema dinamico per lega

Creare un contesto React per il tema:

```typescript
// contexts/LeagueTheme.tsx
const LeagueThemeContext = createContext<LeagueMeta | null>(null);

// Usare i colori da league.meta.colors per:
// - Glow del pulsante "Gioca"
// - Accenti nel titolo
// - Bordi delle card
// - Colore della progress bar
```

### 3.4 — Landing page (`page.tsx`)

Aggiornare la landing:
- [ ] Titolo: "38-0 European Leagues" (o mantenere "38-0" con sottotitolo)
- [ ] Stats: aggiungere "5 Leghe" / "20.000+ Giocatori"
- [ ] FAQ: aggiornare risposte per menzionare le 5 leghe
- [ ] CTA: "Scegli la tua lega e gioca"

### 3.5 — Persistenza scelta lega

```typescript
// localStorage
const LAST_LEAGUE_KEY = "38-0-last-league";

// Default: "serie-a" (backward compatibilità)
// Al cambio lega: salva in localStorage
// Al caricamento: legge da localStorage
```

**Gate:** L'utente può selezionare una delle 5 leghe, il tema cambia, il draft usa i dati della lega scelta.

### 3.6 — i18n per contenuti multi-lega

Il progetto supporta EN/IT/ES/FR/DE/PT. Nuove stringhe da tradurre:

| Key | EN | IT | ES | FR | DE | PT |
|-----|----|----|----|----|----|-----|
| `league_select_title` | Choose Your League | Scegli la tua Lega | Elige tu Liga | Choisis ta Liga | Wähge deine Liga | Escolha a sua Liga |
| `league_5_leagues` | 5 Leagues | 5 Leghe | 5 Ligas | 5 Ligues | 5 Ligen | 5 Ligas |
| `league_x_players` | 20,000+ Players | 20.000+ Giocatori | 20.000+ Jugadores | 20.000+ Joueurs | 20.000+ Spieler | 20.000+ Jogadores |
| `league_country_it` | Italy | Italia | Italia | Italie | Italien | Itália |
| `league_country_gb` | England | Inghilterra | Inglaterra | Angleterre | England | Inglaterra |
| `league_country_es` | Spain | Spagna | España | Espagne | Spanien | Espanha |
| `league_country_fr` | France | Francia | Francia | France | Frankreich | França |
| `league_country_de` | Germany | Germania | Alemania | Allemagne | Deutschland | Alemanha |
| `simulate_league` | Simulate {{league}} | Simula {{league}} | Simula {{league}} | Simule {{league}} | Simuliere {{league}} | Simule {{league}} |
| `result_in_league` | in {{league}} con | in {{league}} con | en {{league}} con | en {{league}} con | in {{league}} con | na {{league}} com |
| `finish_league_completed` | {{league}} completed | {{league}} completata | {{league}} completada | {{league}} terminée | {{league}} abgeschlossen | {{league}} concluída |

**Nota:** I nomi delle leghe (Serie A, Premier League, ecc.) sono nomi propri e **non vanno tradotti**. Usare `league.meta.name` direttamente.

Aggiungere le chiavi sopra in tutti i 6 file di traduzione (`en`, `it`, `es`, `fr`, `de`, `pt`).

---

## Fase 4 — Funzionalità Cross-Liga

**Durata:** 5-7 giorni
**Obiettivo:** Funzionalità che sfruttano la presenza di più leghe.

### 4.1 — Confronto tra leghe

Creare pagina `/compare`:

```
┌─────────────────────────────────────────────┐
│          Confronta le Leghe                 │
│                                             │
│  Media gol/partita:                         │
│  Premier League ████████████ 2.8            │
│  Serie A        █████████ 2.5               │
│  La Liga        ██████████ 2.6              │
│  Bundesliga     █████████████ 3.1           │
│  Ligue 1        ████████ 2.3                │
│                                             │
│  Competitività (dev. std. rating):          │
│  Premier League ██████████ 8.2              │
│  Bundesliga     ████████ 10.1               │
│  ...                                        │
└─────────────────────────────────────────────┘
```

Calcolare dai dati statici:
- Media rating per lega
- Distribuzione rating (quanto è "stretta" la lega)
- Top 5 giocatori per lega

### 4.2 — Cronologia simulazioni per lega

Salvare in `localStorage` le ultime N simulazioni per lega:

```typescript
interface SavedSimulation {
  leagueId: string;
  date: string;
  position: number;
  points: number;
  teamRating: number;
  formation: string;
}
```

### 4.3 — Champions League (STRETCH)

Se c'è tempo:
- [ ] Selezionare top N da ogni lega (top 4 per leghe da 20 squadre, top 3 per leghe da 18 — **non hardcoded "top 4"**)
- [ ] Generare tabellone Champions (fase a gironi + knockout)
- [ ] Simulare con motore esistente

**Non blocca il release.** Gate: se non è fatto, si sposta a v2.

**Nota qualificazione:** Le leghe da 18 squadre (Ligue 1, Bundesliga) hanno meno squadre. La qualificazione deve essere proporzionale: `Math.round(4 * league.meta.numTeams / 20)` → 4 per 20 squadre, 3 per 18.

---

## Fase 5 — Polish & Deploy

**Durata:** 3-4 giorni
**Obiettivo:** Rifinitura e pubblicazione.

### 5.1 — Performance

- [ ] Verificare bundle size con 5 leghe di dati (`pnpm run build` → analizzare output)
- [ ] ✅ Lazy loading già implementato in Fase 1 (dynamic `import()` per lega)
- [ ] Memoizzazione di `getLeague()` (cache dopo primo caricamento, già in Fase 1)
- [ ] Lighthouse audit: target Performance > 80

### 5.2 — Responsive

- [ ] Test League Selector su mobile (griglia 2x3 o scroll orizzontale)
- [ ] Test game flow su mobile con ogni lega
- [ ] Test su Safari iOS (se possibile)

### 5.3 — Error handling

- [ ] Se una lega non ha dati → **errore esplicito** con messaggio chiaro, niente fallback silenzioso a Serie A
  ```typescript
  // ❌ SBAGLIATO — fallback silenzioso
  const league = getLeague(leagueId) ?? getLeague("serie-a");

  // ✅ CORRETTO — errore esplicito
  const league = await getLeague(leagueId); // throw se non trovata
  // Nel UI: mostra toast "Lega non trovata. Seleziona una lega valida."
  ```
- [ ] Se il draft pool è vuoto → Messaggio "Nessun dato per questa lega. Prova un'altra lega o era."
- [ ] Boundary: Ligue 1 con 18 squadre → 34 giornate, non 38 (già gestito da `meta.json`)
- [ ] Limite localStorage: max 20 simulazioni salvate. Le più vecchie vengono eliminate (FIFO).
  ```typescript
  const MAX_SAVED_SIMS = 20;
  function saveSimulation(sim: SavedSimulation) {
    const saved = JSON.parse(localStorage.getItem("38-0-sims") || "[]");
    saved.push(sim);
    if (saved.length > MAX_SAVED_SIMS) saved.shift(); // rimuovi la più vecchia
    localStorage.setItem("38-0-sims", JSON.stringify(saved));
  }
  ```

### 5.4 — SEO & Meta

- [ ] Meta tag dinamici per lega
- [ ] Open Graph: "Simula la Premier League / Serie A / La Liga / Ligue 1 / Bundesliga"
- [ ] Favicon: valutare se cambiare da Serie A a generico

### 5.5 — Deploy

- [ ] Merge `feat/multi-league` → `main`
- [ ] Deploy su Vercel (automatico)
- [ ] Verificare produzione: test E2E su ogni lega
- [ ] **Fase 1 (ora):** I file deprecati (`public/data/players.json`, `public/data/clubs-by-season.json`) diventano re-export che puntano ai nuovi dati
- [ ] **Fase 5 (dopo 2 settimane in produzione):** Rimuovere i file deprecati una volta confermato che nessun import diretti rimane

---

## Rischi & Mitigazione

| Rischio | Prob | Impatto | Mitigazione |
|---------|------|---------|-------------|
| Dati inconsistenti tra leghe | Alta | Medio | Validazione schema in CI, script di check |
| Bundle size troppo grande | Medio | Alto | Lazy loading per lega, compressione JSON |
| Scope creep (Champions, transfer, etc.) | Alta | Alto | Champions = stretch, tutto il resto = v2 |
| Perdita utenti Serie A | Basso | Alto | Default a Serie A, nessuna feature rimossa |
| Dati sbagliati (rating irrealistici) | Medio | Medio | Playtest con 2-3 persone per lega |
| Refactoring rompe Serie A | Medio | Alto | Regression test in Fase 2, feature flag |

---

## Timeline Riepilogativa

| Fase | Descrizione | Durata | Dipendenze | Parallelizzabile |
|------|-------------|--------|------------|-----------------|
| **0** | Audit & Types | 1 gg | Nessuna | No |
| **1** | Data Layer + Dati 5 leghe | 3-5 gg | Fase 0 | No |
| **2** | Motore Generico | 3-4 gg | Fase 1 | No |
| **3** | UI Multi-Liga | 4-5 gg | Fase 2 | No |
| **4** | Cross-Liga Features | 5-7 gg | Fase 3 | Parziale (4.1 indipendente) |
| **5** | Polish & Deploy | 3-4 gg | Tutte | No |

**Stima totale: 19-26 giorni lavorativi** (1 sviluppatore)

### Milestone chiave

| Giorno | Milestone |
|--------|-----------|
| 1 | Types pronti, branch creato |
| 6 | Dati di tutte le 5 leghe pronti |
| 10 | Motore generico funzionante, Serie A identica a prima |
| 15 | UI completa, 5 leghe selezionabili e giocabili |
| 22 | Confronto leghe + Champions (se stretch) |
| 26 | Deploy in produzione |

---

## Note di Produzione

### Convenzione branch
- `feat/multi-league` — branch principale
- `feat/multi-league-data` — solo dati (parallelizzabile)
- `feat/multi-league-ui` — solo UI (dopo Fase 2)

### Convenzione commit
```
feat(league): add Premier League data (18 clubs, 200 players)
feat(sim): make matchdays configurable per league
fix(draft): filter pool by leagueId
refactor(data): extract LeagueDataSource type
```

### Definition of Done per fase
- [ ] Codice compila (`npx tsc --noEmit`)
- [ ] Build passa (`npm run build`)
- [ ] Test manuale: giocare una partita completa per ogni lega
- [ ] Nessun regression su Serie A

---

---

## 📦 Estrazione Dati — Piano Dettagliato

> **Obiettivo:** Estrarre giocatori da FIFA 05 a FIFA 26 per 5 campionati (Serie A, Premier League, La Liga, Ligue 1, Bundesliga) con rating, posizione, squadra e stagione.
> **Output:** File JSON strutturati pronti per il game engine.

---

### 🔍 Valutazione Fonti Dati

#### Fonte 1: Kaggle — Transfermarkt Player Scores (davidcariboo)
- **URL:** https://www.kaggle.com/datasets/davidcariboo/player-scores/
- **Copertura:** 2000/01 → 2024/25
- **Uso nel progetto:** **SOLO 2000/01 → 2003/04** per le 4 leghe non-Serie A (Serie A usa CSV esistenti)
- **Dati:** Nome, club, valore di mercato, presenze, gol, assist
- **Conversione:** Valore di mercato → rating FIFA-style (curva logistica)
- **Verdetto:** ✅ **Usato SOLO per 2000-2004, non come fonte primaria generale**

#### Fonte 2: FifaIndex (web scraping)
- **URL:** https://fifaindex.com/players/fifa05 → https://fifaindex.com/players/fifa16
- **Copertura:** FIFA 05 → FIFA 16
- **Dati:** Nome, Overall, Potential, Club, Nationality, Age, tutti gli skill attributes
- **Pro:** Copre il range FIFA 05-16. Dati ufficiali sofifa.
- **Contro:** Richiede scraping. Il club name è testuale (non normalizzato).
- **Verdetto:** ✅ **Fonte primaria per FIFA 05-16**

#### Fonte 3: Kaggle — FIFA Player Stats Database (BryanB)
- **URL:** https://www.kaggle.com/datasets/bryanb/fifa-player-stats-database
- **Copertura:** FIFA 17 → FIFA 23
- **Dati:** Nome, Overall, Club, posizione, attributi
- **Verdetto:** ✅ **Fonte primaria per FIFA 17-23**

#### Fonte 4: Kaggle — FIFA 24 Player Stats Dataset (Rehan Ahmed)
- **URL:** https://www.kaggle.com/datasets/rehandl23/fifa-24-player-stats-dataset
- **Copertura:** FIFA 24
- **Verdetto:** ✅ **Fonte per FIFA 24**

#### Fonte 5: Kaggle — FC 25 Player Data from Sofifa (Aniss7)
- **URL:** https://www.kaggle.com/datasets/aniss7/fifa-player-data-from-sofifa-2025-06-03
- **Copertura:** FC 25
- **Pro:** Include `club_league_name` per filtro diretto per campionato
- **Verdetto:** ✅ **Fonte per FC 25**

#### Fonte 6: Kaggle — FC 26 (FIFA 26) Player Data (rovnez)
- **URL:** https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data
- **Copertura:** FC 26
- **Pro:** Dataset più completo (110 colonne), include `club_league_name`
- **Verdetto:** ✅ **Fonte per FC 26**

---

### 🗺️ Matrice di Copertura Campionato × Fonte

| Campionato | 2000-04 | FIFA 05-16 | FIFA 17-23 | FIFA 24 | FC 25 | FC 26 |
|------------|:-------:|:----------:|:----------:|:-------:|:-----:|:-----:|
| **Serie A** | CSV esistenti (rating già pronti) | ✅ FifaIndex | ✅ BryanB | ✅ Rehan | ✅ Aniss7 | ✅ rovnez |
| **Premier League** | ✅ Transfermarkt → conversione | ✅ FifaIndex | ✅ BryanB | ✅ Rehan | ✅ Aniss7 | ✅ rovnez |
| **La Liga** | ✅ Transfermarkt → conversione | ✅ FifaIndex | ✅ BryanB | ✅ Rehan | ✅ Aniss7 | ✅ rovnez |
| **Ligue 1** | ✅ Transfermarkt → conversione | ✅ FifaIndex | ✅ BryanB | ✅ Rehan | ✅ Aniss7 | ✅ rovnez |
| **Bundesliga** | ✅ Transfermarkt → conversione | ✅ FifaIndex | ✅ BryanB | ✅ Rehan | ✅ Aniss7 | ✅ rovnez |

---

### 📊 Valutazione Completezza Dati per il Gioco

Il game engine ha bisogno di questi dati per ogni giocatore:

| Campo | Necessario | Presente nei dataset | Note |
|-------|:---:|:---:|------|
| **Nome giocatore** | ✅ | ✅ Tutti i dataset | ✅ OK |
| **Rating (Overall)** | ✅ | ✅ FIFA: già presente. Transfermarkt: da convertire | ✅ OK |
| **Posizione** | ✅ | ✅ FIFA: presente. Transfermarkt: non presente (da inferire) | ⚠️ Transfermarkt richiede mapping ruolo |
| **Squadra (Club)** | ✅ | ✅ Tutti i dataset | ✅ OK |
| **Stagione** | ✅ | ✅ Derivato dal nome file/version | ✅ OK |
| **Campionato (Lega)** | ✅ | ⚠️ Mappato via club | ✅ OK con club-mapping.json |
| **Goal/Assist** | ❌ Opzionale | ✅ Transfermarkt, FIFA | ✅ Utile per RA statistiche |
| **Apps (Presenze)** | ❌ Opzionale | ✅ Transfermarkt, FIFA | ✅ Utile per filtro |
| **Valutazione Potenziale** | ❌ Nice-to-have | ✅ FIFA | ✅ Per draft mode avanzata |
| **Età** | ❌ Nice-to-have | ✅ FIFA | ✅ Per mode "career" future |

**Conclusione:** Tutte le fonti coprono i campi necessari. L'unico dato che richiede conversione è il rating da valore di mercato (solo Transfermarkt 2000-2004).

---

### 🏗️ Architettura Dati: players_nomecampionato.json

**Decisione architetturale:** Creare **un file JSON per campionato** in `public/data/leagues/<leagueId>/players.json`.

**Perché NON un unico players.json:**
1. **Lazy loading Vite** — ogni lega si carica on-demand, non serve scaricare 80k+ giocatori per giocare una singola lega
2. **Bundle splitting** — Vite crea chunk separati per ogni dynamic import
3. **Manutenibilità** — aggiornare un campionato non tocca gli altri
4. **Dimensione** — ogni campionato ha ~2000-4000 giocatori (filtrati da 18k totali), ~200-500KB per file

**Struttura dati per campionato:**

```json
// public/data/leagues/premier-league/players.json
{
  "leagueId": "premier-league",
  "season": "fifa-26",
  "totalPlayers": 3200,
  "scrapedAt": "2026-06-21",
  "players": [
    {
      "id": "mohamed-salah-2026",
      "name": "Mohamed Salah",
      "position": "RW",
      "club": "liverpool",
      "rating": 91,
      "season": "fifa-26"
    }
  ]
}
```

**Struttura semplificata** — solo i 5 campi necessari per il gioco (id, name, position, club, rating, season). Gli attributi avanzati (skill, potential) vanno in un file separato `players-detailed.json` solo se servono in futuro.

---

### 📋 Piano Estrazione — Step Dettagliati

#### Step 1: Download Dataset Kaggle

```bash
# Installare kaggle CLI
pip install kaggle

# Configurare API key (da kaggle.com → Settings → API)

# Scaricare tutti i dataset necessari
kaggle datasets download -d davidcariboo/player-scores -p data/raw/transfermarkt/ --unzip
kaggle datasets download -d bryanb/fifa-player-stats-database -p data/raw/fifa-17-23/ --unzip
kaggle datasets download -d rehandl23/fifa-24-player-stats-dataset -p data/raw/fifa-24/ --unzip
kaggle datasets download -d aniss7/fifa-player-data-from-sofifa-2025-06-03 -p data/raw/fc-25/ --unzip
kaggle datasets download -d rovnez/fc-26-fifa-26-player-data -p data/raw/fc-26/ --unzip
```

Per FIFA 05-16: scraping da fifaindex.com (CSV salvati in `data/raw/fifa-05-16/`).

#### Step 2: Creare Mapping Club → Campionato

Creare `expansion/club-mapping.json` — mapping normalizzato per ogni fonte dati:

```json
{
  "transfermarkt": {
    "premier-league": ["manchester-city", "arsenal", "liverpool", ...],
    "la-liga": ["real-madrid", "barcelona", ...],
    "serie-a": ["juventus", "inter", "milan", "roma", "napoli", ...],
    "ligue-1": ["paris-saint-germain", "marseille", ...],
    "bundesliga": ["bayern-munich", "borussia-dortmund", ...]
  },
  "fifa-05-16": {
    "premier-league": ["Manchester City", "Arsenal", ...],
    ...
  },
  "fifa-26": {
    "premier-league": ["manchester-city", "arsenal", ...],
    ...
  }
}
```

**Nota:** Ogni fonte usa nomi club diversi. Il mapping deve essere specifico per fonte.

#### Step 3: Script di Estrazione

Creare `scripts/expansion/extract-players.ts`:

```
Logica:
1. Per ogni fonte (Transfermarkt, FifaIndex, BryanB, FIFA24, FC25, FC26):
   a. Leggi CSV da data/raw/<fonte>/
   b. Per ogni riga, normalizza nome club
   c. Filtra per campionato usando club-mapping.json della fonte
   d. Per Transfermarkt: converti valore mercato → rating
   e. Per FIFA: usa rating diretto
   f. Genera id unico: `${slugify(name)}-${season}`
   g. Estrai: id, name, position, club, rating, season, apps, goals, assists
2. Unisci tutti i dati per campionato
3. Scrivi JSON in public/data/leagues/<leagueId>/players.json
```

#### Step 4: Validazione

Creare `scripts/expansion/validate.ts`:

```
Per ogni campionato (5 totali):
- [ ] Numero giocatori tra 150 e 5000
- [ ] Ogni giocatore ha tutti i campi obbligatori
- [ ] Nomi club matchano clubs.json del campionato
- [ ] Rating tra 40 e 99
- [ ] Posizioni valide (GK, DEF, MID, ATT)
- [ ] Niente duplicati per id
- [ ] Distribuzione rating coerente (media 60-72, std dev 10-15)
```

#### Step 5: Integrazione nel Game Engine

1. Aggiornare `lib/leagues.ts` per caricare `players.json` per campionato
2. Aggiornare `lib/data.ts` per usare i nuovi dati
3. Aggiornare `scripts/generate-data.ts` per includere i nuovi dati
4. Verificare che `simulateSeason` funzioni con 18 squadre (Ligue 1, Bundesliga) e 20 squadre (Premier, LaLiga, Serie A)

---

### 📁 Struttura File Finale

```
expansion/
├── PianoEspansione.md              ← Questo documento
├── club-mapping.json               ← Mapping club → campionato per ogni fonte
├── PROGRESS.md                     ← Tracking progresso estrazione
scripts/expansion/
├── extract-players.ts              ← Script estrazione dati
├── validate.ts                     ← Script validazione
data/raw/                           ← Dataset scaricati (gitignore)
├── transfermarkt/                  ← Kaggle Player Scores (2000-2004)
├── fifa-05-16/                     ← FifaIndex scraping (FIFA 05-16)
├── fifa-17-23/                     ← Kaggle BryanB (FIFA 17-23)
├── fifa-24/                        ← Kaggle Rehan (FIFA 24)
├── fc-25/                          ← Kaggle Aniss7 (FC 25)
└── fc-26/                          ← Kaggle rovnez (FC 26)
public/data/leagues/
├── serie-a/
│   ├── players.json
│   ├── clubs.json
│   └── meta.json
├── premier-league/
│   ├── players.json
│   ├── clubs.json
│   └── meta.json
├── la-liga/
│   ├── players.json
│   ├── clubs.json
│   └── meta.json
├── ligue-1/
│   ├── players.json
│   ├── clubs.json
│   └── meta.json
└── bundesliga/
    ├── players.json
    ├── clubs.json
    └── meta.json
```

---

### ⚠️ Rischi e Mitigazione

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| Nomi club nei dataset FIFA non matchano la lista ufficiale | Alto | Fuzzy matching + mapping manuale per i casi mancanti |
| FifaIndex scraping bloccato / rate limited | Alto | Usare CSV già scaricati come fallback; eventualmente cachare pagine |
| FIFA 05-10 hanno meno colonne (no positions) | Medio | Inferire posizione da attributi o usare "UNK" come fallback |
| Duplicati tra FIFA 17-23 (stesso giocatore, stagioni diverse) | Medio | Prendere solo la versione più recente per campionato |
| Dati Kaggle non aggiornati (trasferimenti mancanti) | Basso | Per v1 va bene, per v2 usare sofifa live scraping |
| Licenza dataset | Nessuno | Tutte le licenze permettono uso commerciale |

---

### 📊 Stima Volume Dati

| Campionato | 2000-04 | FIFA 05-26 | Totale stimato | Note |
|------------|:-------:|:----------:|:--------------:|------|
| **Serie A** | ✅ Già fatto | ✅ Già fatto | ✅ FATTO | `generate-data.ts` |
| Premier League | ~200 (Transfermarkt) | ~4,400 | ~4,600 | Da estrarre |
| La Liga | ~200 (Transfermarkt) | ~4,400 | ~4,600 | Da estrarre |
| Ligue 1 | ~180 (Transfermarkt) | ~3,300 | ~3,480 | Da estrarre |
| Bundesliga | ~180 (Transfermarkt) | ~3,300 | ~3,480 | Da estrarre |
| **Totale da estrarre** | **~760** | **~15,400** | **~16,160** | Solo 4 leghe |

**Raccomandazione v1:** Usare **solo FC 26** per tutte le 4 leghe mancanti (~2,000-3,000 giocatori per campionato). La Serie A è già completa con tutte le stagioni. Aggiungere le altre stagioni/mode "era" in v2.

---

### 🎯 Decisione Finale: Un file per campionato

**Formato:** `public/data/leagues/<leagueId>/players.json`

**Perché questa struttura:**
1. ✅ Coerente con l'architettura esistente (`public/data/leagues/<leagueId>/`)
2. ✅ Lazy loading — ogni lega carica solo i propri dati
3. ✅ Vite dynamic import — chunk separati, bundle iniziale leggero
4. ✅ Manutenibile — aggiornare un campionato = aggiornare un file
5. ✅ Scalabile — aggiungere nuovi campionati = nuova cartella
6. ✅ Compatibile con il game engine — `lib/leagues.ts` carica `players.json` per leagueId

---

*Documento creato: 2026-06-21*
*Ultimo aggiornamento: 2026-06-22*
*Stato: 🟢 Dati generati per tutte e 5 le leghe, game engine integrato, typecheck OK. Attesa test gameplay.*

---

### 🚀 Prossimi Passi — Azioni Concrete

#### ✅ Completato
- [x] Download tutti i dataset Kaggle
- [x] Clonare repo `lbenz730/fifa_model` per FIFA 05-20
- [x] Creare mapping club → campionato (~400 mappature)
- [x] Scrivere ed eseguire `scripts/generate_multi_league_data.py`
- [x] Scrivere ed eseguire `scripts/merge_transfermarkt_2000_2004.py`
- [x] Generare `players.json` per tutte e 5 le leghe
- [x] Creare `data.json` unificato per ogni lega
- [x] Migrare Serie A in `leagues/serie-a/`
- [x] Integrare game engine (`data.ts`, `simulation.ts`, `leagues.ts`)
- [x] Typecheck passa senza errori

#### 🔜 Prossimi step
1. **Test gameplay** — Gioca una stagione con ogni lega per verificare draft + simulazione
2. **Deploy** — Push su GitHub + Vercel



---

### 📝 Note

- I CSV storici `FIFA 05.csv` … `FIFA 16.csv` in `.migration-backup/` contengono solo dati Serie A. Per le altre leghe serve il dataset completo Kaggle.
- Il dataset di Stefanoleone992 copre FIFA 15-25 e include tutte le leghe. Per FIFA 05-14 servono gli scraper FifaIndex (vedi sezione Fonti Dati nel piano).
- Il file `club-mapping.json` in `expansion/` definisce i nomi canonici dei club per ogni versione FIFA. Estenderlo se un dataset usa nomi diversi.
