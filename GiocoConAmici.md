# 🎮 Gioco Con Amici — Piano di Implementazione

## Visione

Permettere agli utenti di giocare insieme in due modalità:
1. **Lobby con codice/QR** → mini classifica tra amici
2. **Sfida 1v1 Blind** → stesse squadre sorteggiate, chi fa più punti vince

---

## Architettura

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Crea     │  │ Unisciti │  │ Lobby Room    │  │
│  │ Lobby    │  │ Lobby    │  │ (attesa +     │  │
│  │          │  │          │  │  classifica)  │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │               │           │
│  ┌────┴──────────────┴───────────────┴───────┐  │
│  │           Supabase Realtime               │  │
│  │  (canali + presence + database)           │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Perché Supabase Realtime?**
- Già integrato nel progetto (leaderboard)
- Presence tracking (chi è online nella lobby)
- Broadcast in tempo reale (aggiornamenti classifica)
- Nessun server custom necessario

---

## Database Schema

```sql
-- ═══════════════════════════════════════════════
-- TABELLE LOBBY
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lobbies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,          -- codice 6 caratteri (es. "ABC123")
  host_id       TEXT NOT NULL,                 -- uid dell'host
  host_name     TEXT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'league', -- 'league' | '1v1_blind'
  status        TEXT NOT NULL DEFAULT 'waiting',-- 'waiting' | 'playing' | 'finished'
  max_players   INT DEFAULT 8,
  config        JSONB NOT NULL DEFAULT '{}',    -- SetupConfig condiviso
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

CREATE INDEX idx_lobbies_code ON lobbies (code);
CREATE INDEX idx_lobbies_status ON lobbies (status);

CREATE TABLE IF NOT EXISTS lobby_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id      UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL,                 -- uid del giocatore
  player_name   TEXT NOT NULL,
  is_host       BOOLEAN DEFAULT FALSE,
  is_ready      BOOLEAN DEFAULT FALSE,
  -- Risultati della simulazione
  final_position INT,
  final_points  INT,
  final_score   BIGINT,                        -- punteggio leaderboard
  slots_json    JSONB,                         -- DraftSlot[] serializzato
  overall_json  JSONB,                         -- TeamOverall serializzato
  submitted_at  TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, player_id)
);

CREATE INDEX idx_lobby_players_lobby ON lobby_players (lobby_id);

-- ═══════════════════════════════════════════════
-- TABELLA SFIDE 1v1 (storia/snapshot)
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id        UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  challenger_id   TEXT NOT NULL,
  challenger_name TEXT NOT NULL,
  opponent_id     TEXT NOT NULL,
  opponent_name   TEXT NOT NULL,
  shared_spin     JSONB NOT NULL,              -- SpinResult condiviso
  challenger_score BIGINT,
  opponent_score  BIGINT,
  winner_id       TEXT,
  status          TEXT DEFAULT 'pending',      -- 'pending' | 'playing' | 'finished'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════

ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobbies_read" ON lobbies FOR SELECT USING (true);
CREATE POLICY "lobbies_insert" ON lobbies FOR INSERT WITH CHECK (true);
CREATE POLICY "lobbies_update_host" ON lobbies FOR UPDATE USING (true);

CREATE POLICY "lp_read" ON lobby_players FOR SELECT USING (true);
CREATE POLICY "lp_insert" ON lobby_players FOR INSERT WITH CHECK (true);
CREATE POLICY "lp_update_self" ON lobby_players FOR UPDATE USING (true);

CREATE POLICY "challenges_read" ON challenges FOR SELECT USING (true);
CREATE POLICY "challenges_insert" ON challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "challenges_update" ON challenges FOR UPDATE USING (true);
```

---

## Flusso Utente

### Modalità 1: Lobby League (mini classifica)

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Home   │────▶│ Crea     │────▶│  Lobby   │────▶│  Gioca   │
│  Page   │     │  Lobby   │     │  Room    │     │  Draft   │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
                     │                │                 │
                     ▼                ▼                 ▼
               Genera codice    Condividi codice   Simula stagione
               + QR code        / QR code           individualmente
                                    │                 │
                                    ▼                 ▼
                              Amici si uniscono  Risultati inviati
                              (max 8)            alla lobby
                                                   │
                                                   ▼
                                              Classifica finale
                                              tra amici
```

**Dettagli:**

1. **Crea Lobby:**
   - Host configura le regole (difficulty, era, formation, etc.)
   - Sistema genera codice 6 caratteri (es. "ABC123") + QR code
   - Host entra nella lobby room

2. **Unisciti:**
   - Amico inserisce codice o scansiona QR
   - Inserisce il suo nickname
   - Entra nella lobby room, appare nella lista giocatori

3. **Lobby Room:**
   - Lista giocatori con stato (pronto/non pronto)
   - Host può avviare quando tutti sono pronti (o almeno 2)
   - Countdown prima dell'inizio

4. **Gioca:**
   - Ogni giocatore fa il draft INDIPENDENTEMENTE
   - Stesse regole per tutti (config condivisa)
   - Simula la stagione

5. **Classifica:**
   - Risultati inviati a Supabase
   - Classifica in tempo reale tra i partecipanti
   - Posizione, punti, overall

### Modalità 2: Sfida 1v1 Blind

```
┌─────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────┐
│  Home   │────▶│ Crea     │────▶│  Attesa      │────▶│  Stesso  │
│  Page   │     │  Sfida   │     │  Avversario  │     │  Sorteggio│
└─────────┘     └──────────┘     └──────────────┘     └──────────┘
                     │                                      │
                     ▼                                      ▼
               Genera codice                         Entrambi vedono
               + QR code                             stessi giocatori
                                                      sorteggiati
                                                         │
                                                         ▼
                                                    Draft blind
                                                    (showRatings: off)
                                                         │
                                                         ▼
                                                    Simula stagione
                                                         │
                                                         ▼
                                                    Chi ha più
                                                    punti vince!
```

**Dettagli:**

1. **Crea Sfida:**
   - Host configura: difficulty=hard, showRatings=off (blind obbligatorio)
   - Genera codice + QR
   - Primo sorteggio condiviso (stessa squadra per entrambi)

2. **Sorteggio Condiviso:**
   - Sistema sorteggia UNA squadra (club+stagione)
   - Entrambi i giocatori vedono gli stessi giocatori
   - Ognuno compone la formazione INDIPENDENTEMENTE in blind mode

3. **Draft Blind:**
   - I giocatori NON vedono i rating (??)
   - Scelgono solo in base a nome, club, ruolo
   - Più tardi si rivelano i rating

4. **Risultato:**
   - Entrambi simulano la stagione
   - Chi finisce più in alto nella classifica vince
   - Opzione: chi ha più punti in classifica generale

---

## Struttura File

```
src/
├── lib/
│   ├── lobby.ts            # Logica lobby (crea, unisciti, stato)
│   ├── lobbyRealtime.ts     # Canali Supabase Realtime
│   └── challenge.ts        # Logica sfide 1v1
├── pages/
│   ├── LobbyPage.tsx       # Crea/Unisciti lobby
│   ├── LobbyRoomPage.tsx   # Sala d'attesa + classifica
│   └── ChallengePage.tsx   # Sfida 1v1
├── components/
│   ├── LobbyQRCode.tsx     # Genera QR code
│   ├── LobbyPlayerList.tsx # Lista giocatori in lobby
│   ├── LobbyChat.tsx       # Chat testuale in lobby
│   └── ChallengeResult.tsx # Risultato sfida 1v1
└── context/
    └── LobbyContext.tsx    # Stato globale lobby
```

---

## Implementazione Lobby (`lib/lobby.ts`)

```typescript
import { supabase } from './supabase';
import type { SetupConfig } from '../pages/GamePage';

// ─── Tipi ───────────────────────────────────────

export interface Lobby {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  mode: 'league' | '1v1_blind';
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  config: SetupConfig;
  createdAt: string;
}

export interface LobbyPlayer {
  id: string;
  lobbyId: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  isReady: boolean;
  finalPosition?: number;
  finalPoints?: number;
  finalScore?: number;
}

// ─── Codice lobby ───────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1

export function generateLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ─── CRUD ───────────────────────────────────────

export async function createLobby(
  hostId: string,
  hostName: string,
  mode: 'league' | '1v1_blind',
  config: SetupConfig,
  maxPlayers = 8
): Promise<Lobby> {
  const code = generateLobbyCode();

  const { data, error } = await supabase
    .from('lobbies')
    .insert({
      code,
      host_id: hostId,
      host_name: hostName,
      mode,
      config,
      max_players: maxPlayers,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function joinLobby(
  code: string,
  playerId: string,
  playerName: string
): Promise<{ lobby: Lobby; player: LobbyPlayer }> {
  // Trova la lobby
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (lobbyError) throw new Error('Lobby non trovata');
  if (lobby.status !== 'waiting') throw new Error('Lobby già in corso');

  // Controlla posti
  const { count } = await supabase
    .from('lobby_players')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', lobby.id);

  if (count && count >= lobby.max_players) {
    throw new Error('Lobby piena');
  }

  // Unisciti
  const { data: player, error: playerError } = await supabase
    .from('lobby_players')
    .insert({
      lobby_id: lobby.id,
      player_id: playerId,
      player_name: playerName,
      is_host: false,
    })
    .select()
    .single();

  if (playerError) throw playerError;
  return { lobby, player };
}

export async function submitResult(
  lobbyId: string,
  playerId: string,
  result: {
    finalPosition: number;
    finalPoints: number;
    finalScore: number;
    slots: unknown;
    overall: unknown;
  }
): Promise<void> {
  await supabase
    .from('lobby_players')
    .update({
      final_position: result.finalPosition,
      final_points: result.finalPoints,
      final_score: result.finalScore,
      slots_json: result.slots,
      overall_json: result.overall,
      submitted_at: new Date().toISOString(),
    })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);
}

export async function getLobbyLeaderboard(
  lobbyId: string
): Promise<LobbyPlayer[]> {
  const { data, error } = await supabase
    .from('lobby_players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .not('final_position', 'is', null)
    .order('final_points', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
```

---

## Implementazione Realtime (`lib/lobbyRealtime.ts`)

```typescript
import { supabase } from './supabase';
import type { Lobby, LobbyPlayer } from './lobby';

type LobbyCallback = (players: LobbyPlayer[]) => void;
type StatusCallback = (status: Lobby['status']) => void;

export function subscribeToLobby(
  lobbyId: string,
  onPlayersChange: LobbyCallback,
  onStatusChange: StatusCallback
) {
  // Ascolta cambiamenti sui giocatori
  const playersChannel = supabase
    .channel(`lobby-players-${lobbyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lobby_players',
        filter: `lobby_id=eq.${lobbyId}`,
      },
      (payload) => {
        // Ricarica la lista completa
        supabase
          .from('lobby_players')
          .select('*')
          .eq('lobby_id', lobbyId)
          .order('joined_at', { ascending: true })
          .then(({ data }) => {
            if (data) onPlayersChange(data);
          });
      }
    )
    .subscribe();

  // Ascolta cambiamenti di status della lobby
  const statusChannel = supabase
    .channel(`lobby-status-${lobbyId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'lobbies',
        filter: `id=eq.${lobbyId}`,
      },
      (payload) => {
        onStatusChange(payload.new.status);
      }
    )
    .subscribe();

  // Cleanup
  return () => {
    supabase.removeChannel(playersChannel);
    supabase.removeChannel(statusChannel);
  };
}

export function subscribeToPresence(
  lobbyId: string,
  playerId: string,
  playerName: string,
  onPresenceChange: (online: string[]) => void
) {
  const presenceChannel = supabase
    .channel(`lobby-presence-${lobbyId}`, {
      config: {
        presence: {
          key: playerId,
        },
      },
    })
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const online = Object.values(state)
        .flat()
        .map((p: any) => p.playerName);
      onPresenceChange([...new Set(online)]);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          playerId,
          playerName,
          online_at: new Date().toISOString(),
        });
      }
    });

  return () => {
    supabase.removeChannel(presenceChannel);
  };
}
```

---

## UI Components

### LobbyPage (Crea/Unisciti)

```
┌─────────────────────────────────────┐
│         🎮 GIOCO CON AMICI          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🏠 Crea Lobby              │    │
│  │  Configura regole e crea    │    │
│  │  una lobby per amici        │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📱 Unisciti a Lobby        │    │
│  │  Inserisci codice o scansiona│   │
│  │  QR code                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ⚔️ Sfida 1v1 Blind         │    │
│  │  Stesse squadre, chi fa     │    │
│  │  più punti vince!           │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### LobbyRoomPage

```
┌─────────────────────────────────────┐
│  🏠 Lobby: ABC123        [QR Code]  │
│  ─────────────────────────────────  │
│  👑 Marco (Host)        ✅ Pronto   │
│  👤 Luca                ⏳...       │
│  👤 Giulia              ✅ Pronto   │
│  👤 Sara                ⏳...       │
│  ─────────────────────────────────  │
│  💬 Chat                             │
│  Marco: Pronti?                     │
│  Giulia: Sì!                        │
│  ─────────────────────────────────  │
│  Regole: Normal · 4-3-3 · 1996-2026 │
│                                     │
│  [🚀 Avvia Partita]  (solo host)    │
└─────────────────────────────────────┘
```

### Classifica Finale

```
┌─────────────────────────────────────┐
│  🏆 CLASSIFICA FINALE               │
│  ─────────────────────────────────  │
│  🥇 Marco    · 78pts · 1° · OVR 84 │
│  🥈 Giulia   · 72pts · 3° · OVR 81 │
│  🥉 Luca     · 68pts · 5° · OVR 79 │
│  4. Sara     · 61pts · 8° · OVR 76 │
│  ─────────────────────────────────  │
│  [🔄 Gioca Ancora]  [🏠 Home]       │
└─────────────────────────────────────┘
```

---

## QR Code

```typescript
// components/LobbyQRCode.tsx
import QRCode from 'qrcode';

export async function generateQRCode(lobbyCode: string): Promise<string> {
  const url = `${window.location.origin}/lobby/join?code=${lobbyCode}`;
  return QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    color: { dark: '#10b981', light: '#0a0a0f' },
  });
}
```

Dipendenza: `npm install qrcode @types/qrcode`

---

## Fasi di Implementazione

### Fase 1: Base (Sprint 1)
- [ ] Creare tabelle Supabase (lobbies, lobby_players, challenges)
- [ ] Implementare `lib/lobby.ts` (CRUD base)
- [ ] Pagina `LobbyPage.tsx` (crea + unisciti)
- [ ] Pagina `LobbyRoomPage.tsx` (sala d'attesa)

### Fase 2: Realtime (Sprint 2)
- [ ] Implementare `lib/lobbyRealtime.ts`
- [ ] Presence tracking (chi è online)
- [ ] Aggiornamento classifica in tempo reale
- [ ] QR code generation

### Fase 3: Gameplay (Sprint 3)
- [ ] Integrazione draft in lobby
- [ ] Submit risultati → classifica
- [ ] Pagina classifica finale
- [ ] Gestione stati (waiting → playing → finished)

### Fase 4: 1v1 Blind (Sprint 4)
- [ ] Logica sfide 1v1
- [ ] Sorteggio condiviso
- [ ] Draft blind mode
- [ ] Confronto risultati

### Fase 5: Polish (Sprint 5)
- [ ] Chat in lobby
- [ ] Notifiche (suono quando inizia)
- [ ] Animazioni transizioni
- [ ] Responsive/mobile
- [ ] Test e bugfix

---

## Note Tecniche

### Auth per multiplayer
- Usare auth anonima di Supabase per identificare i giocatori
- Ogni dispositivo genera un UUID unico salvato in localStorage
- Necessario per tracciare chi è chi nella lobby

```typescript
function getPlayerId(): string {
  let id = localStorage.getItem('player_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('player_id', id);
  }
  return id;
}
```

### Gestione disconnessione
- Presence tracking di Supabase rimuove automaticamente chi si disconnette
- Se l'host si disconnette, promuovi il giocatore più vecchio
- Se tutti si disconnettono, la lobby scade dopo 5 minuti

### Rate Limiting
- Max 5 lobby create per ora per IP
- Max 3 tentativi di join con codice sbagliato
- Cooldown 30s tra un gioco e l'altro nella stessa lobby
