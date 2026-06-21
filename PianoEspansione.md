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
| **Framework** | Next.js 16 + React 19 + Tailwind 4 | Solido, nessun cambiamento necessario |
| **Dati** | `data/clubs.json` (50 club Serie A storici) + `data/players.json` (~4000 giocatori, solo Serie A) | Vincolati alla Serie A |
| **Data Layer** | `lib/data.ts` — helper per club, giocatori, squad+season pool | Hardcoded "Serie A" implicito |
| **Landing** | `app/page.tsx` — hero "38-0 Serie A", FAQ, sfide | Testi hardcoded "Serie A" |
| **Game** | `app/game/page.tsx` — setup, draft, simulazione, risultato | Flusso completo ma Serie A-only |
| **Componenti** | `FormationSelector`, `DifficultySelector`, `DraftWheel`, `Pitch`, `PlayerCard`, `SeasonSimulator` | Riusabili, nessun refactoring necessario |
| **Deploy** | Vercel, dominio `38-0-serie-a.vercel.app` | Configurato e funzionante |
| **Nessun backend** | Tutto client-side, niente Firebase/auth in runtime | ✅ Vantaggio: niente migrazione DB |

### Cosa è hardcoded "Serie A"

1. **`clubs.json`** — 50 club, tutti italiani
2. **`players.json`** — giocatori con stagioni solo in club italiani
3. **`page.tsx`** — titoli "38-0 Serie A", "Serie A" in testi/FAQ
4. **`game/page.tsx`** — simulazione usa `clubs.slice(0, 20)` → 20 squadre fisse, 38 giornate
5. **`game/page.tsx`** — `DIFFICULTY_REROLLS` e `POSITION_COMPATIBILITY` sono OK (generici)
6. **`SeasonSimulator.tsx`** — `teamName = "La Mia Squadra"` → OK (generico)

### Cosa è già generico (riusabile)

- Formazioni (`FORMATIONS` record) — 7 formazioni, già parametriche
- `POSITION_COMPATIBILITY` — generico
- `DifficultySelector` — generico
- `FormationSelector` — generico
- `SeasonSimulator` — accetta props, non lega a lega specifica
- `DraftWheel` — generico
- `PlayerCard` — generico
- `Pitch` — generico

---

## Decisioni Architetturali

> **Queste decisioni bloccano lo sviluppo. Prenderle ora.**

### D1 — Struttura dati: JSON statici per league

**Decisione:** Ogni lega ha il suo file JSON in `data/leagues/<leagueId>/`.
Nessuna API esterna per v1. I dati vengono da dataset open (fonte: football.json.org, FBref scraping, o manuale).

```
data/
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
├── clubs.json                # DEPRECATED — rimuovere in Fase 5
└── players.json              # DEPRECATED — rimuovere in Fase 5
```

**Motivazione:** Zero dipendenze esterne, build deterministica, performance massime. API live = Fase stretch.

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
}

export interface LeaguePlayerSeason {
  club: string;   // club id
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
| `clubs.json` | 18-20 club della lega | Manuale o scraping |
| `players.json` | Giocatori con stagione migliore per club | FBref / manuale |

**Approccio pragmatico per v1:**
- **Serie A:** Replicare i dati esistenti in `data/leagues/serie-a/` (copia da `data/clubs.json` + `data/players.json`, filtrando per club Serie A)
- **Altre 4 leghe:** Creare dataset minimi ma funzionanti:
  - 18-20 club per lega (quelli principali)
  - 11-15 giocatori per club (sufficienti per il draft)
  - Rating realistici (top player 85-95, media 65-75)

**Checklist per ogni lega:**
- [ ] `meta.json` creato con colori ufficiali
- [ ] `clubs.json` con 18-20 club (formato `LeagueClub`)
- [ ] `players.json` con almeno 150 giocatori totali (sufficiente per draft variegato)
- [ ] Dati validati: ogni giocatore ha almeno una stagione, ogni stagione riferisce un club esistente

### 1.2 — League Loader

Creare `lib/leagues.ts`:

```typescript
// lib/leagues.ts
import type { LeagueDataSource, LeagueMeta } from "@/types/league";

// Static imports — tutti i dati sono nel bundle
import serieAMeta from "@/data/leagues/serie-a/meta.json";
import serieAClubs from "@/data/leagues/serie-a/clubs.json";
import serieAPlayers from "@/data/leagues/serie-a/players.json";
// ... import per ogni lega

const LEAGUES: Record<string, LeagueDataSource> = {
  "serie-a": { meta: serieAMeta, clubs: serieAClubs, players: serieAPlayers },
  // ...
};

export function getLeague(leagueId: string): LeagueDataSource {
  const league = LEAGUES[leagueId];
  if (!league) throw new Error(`Unknown league: ${leagueId}`);
  return league;
}

export function listLeagues(): LeagueMeta[] {
  return Object.values(LEAGUES).map(l => l.meta);
}
```

### 1.3 — Migrazione dati Serie A esistente

- [ ] Copiare `data/clubs.json` → `data/leagues/serie-a/clubs.json` (stesso formato)
- [ ] Copiare `data/players.json` → `data/leagues/serie-a/players.json` (stesso formato)
- [ ] Creare `data/leagues/serie-a/meta.json`
- [ ] Verificare che i `club` nei player seasons corrispondano agli `id` in clubs

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

function getClubSeasonPool(leagueId: string): ClubSeasonEntry[] {
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
- [ ] Selezionare top 4 da ogni lega
- [ ] Generare tabellone Champions (fase a gironi + knockout)
- [ ] Simulare con motore esistente

**Non blocca il release.** Gate: se non è fatto, si sposta a v2.

---

## Fase 5 — Polish & Deploy

**Durata:** 3-4 giorni
**Obiettivo:** Rifinitura e pubblicazione.

### 5.1 — Performance

- [ ] Verificare bundle size con 5 leghe di dati (`npm run build` → analizzare output)
- [ ] Se `players.json` totale > 5MB: valutare lazy loading per lega
- [ ] Memoizzazione di `getLeague()` e `getClubSeasonPool()`
- [ ] Lighthouse audit: target Performance > 80

### 5.2 — Responsive

- [ ] Test League Selector su mobile (griglia 2x3 o scroll orizzontale)
- [ ] Test game flow su mobile con ogni lega
- [ ] Test su Safari iOS (se possibile)

### 5.3 — Error handling

- [ ] Cosa succede se una lega non ha dati? → Fallback a Serie A con messaggio
- [ ] Cosa succede se il draft pool è vuoto? → Messaggio "Nessun dato per questa lega"
- [ ] Boundary: Ligue 1 con 18 squadre → 34 giornate, non 38

### 5.4 — SEO & Meta

- [ ] Meta tag dinamici per lega
- [ ] Open Graph: "Simula la Premier League / Serie A / La Liga / Ligue 1 / Bundesliga"
- [ ] Favicon: valutare se cambiare da Serie A a generico

### 5.5 — Deploy

- [ ] Merge `feat/multi-league` → `main`
- [ ] Deploy su Vercel (automatico)
- [ ] Verificare produzione: test E2E su ogni lega
- [ ] Rimuovere file deprecati (`data/clubs.json`, `data/players.json`) — solo dopo verifica

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

*Documento creato: 2026-06-21*
*Ultimo aggiornamento: 2026-06-21*
*Stato: 🔵 In attesa di inizio*
