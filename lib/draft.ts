import type { SetupConfig } from '@/app/game/page';
import { getClubSeasonPool, getSquad, getPrimeSquad } from '@/lib/data';
import { FORMATION_SLOTS, type FormationSlot } from '@/lib/formations';

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface DraftedPlayer {
  id: string;
  name: string;
  position: string;
  position_category: string;
  club: string;
  season: string;
  apps: number;
  goals: number;
  assists: number;
  /** Rating effettivo usato per il gioco (stagione o prime a seconda del config) */
  rating: number;
  /** Presente solo in prime mode: conferma che rating == massimo storico */
  primeRating?: number;
}

export interface DraftSlot {
  formationSlot: FormationSlot;
  player: DraftedPlayer | null;
}

export interface SpinResult {
  club: string;
  season: string;
  /** Già filtrati per posizioni compatibili (position_first) o tutti (squad_first) */
  players: DraftedPlayer[];
}

export interface DraftState {
  slots: DraftSlot[];
  currentSpin: SpinResult | null;
  rerollsLeft: number;
  phase: 'idle' | 'spinning' | 'picking' | 'complete';
  /** position_first: quale slot l'utente ha selezionato */
  activeSlotId: string | null;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

/**
 * Mappa difficoltà → numero di reroll.
 * Unica fonte di verità: usata da initialRerolls() e dall'UI.
 */
export const REROLLS_BY_DIFFICULTY: Record<SetupConfig['difficulty'], number> = {
  easy:   3,
  normal: 1,
  hard:   0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Costruisce i DraftSlot iniziali per la formazione scelta */
export function buildSlots(formation: string): DraftSlot[] {
  const formationSlots = FORMATION_SLOTS[formation];
  if (!formationSlots) throw new Error(`Formazione sconosciuta: ${formation}`);
  return formationSlots.map((fs) => ({ formationSlot: fs, player: null }));
}

/** Anni stagione: '2004/05' → 2004 */
export function seasonYear(season: string): number {
  return parseInt(season.split('/')[0], 10);
}

/** Filtra il pool club+stagione per era */
function filteredPool(config: SetupConfig) {
  return getClubSeasonPool().filter((e) => {
    const y = seasonYear(e.season);
    return y >= config.eraFrom && y <= config.eraTo;
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Calcola position_category dalla posizione specifica */
function toCategory(position: string): string {
  if (position === 'GK') return 'GK';
  if (['CB','RB','LB','WB','LWB','RWB'].includes(position)) return 'DEF';
  if (['CDM','CM','CAM','LM','RM'].includes(position)) return 'MID';
  return 'ATT';
}

/**
 * Esegue uno spin.
 *
 * - `positionFilter`: acceptedPositions dello slot (position_first)
 *   oppure `[]` per nessun filtro (squad_first)
 * - `config.ratingsMode`: 'career' → rating della stagione sorteggiata;
 *   'prime' → rating massimo storico del giocatore (via getPrimeSquad)
 */
export function spin(
  config: SetupConfig,
  usedCombos: Set<string>,
  positionFilter: string[]
): SpinResult | null {
  const pool = filteredPool(config).filter(
    (e) => !usedCombos.has(`${e.club}|||${e.season}`)
  );
  if (pool.length === 0) return null;

  const entry = pickRandom(pool);

  // Prime mode: rating = max storico del giocatore; career: rating della stagione
  const rawSquad =
    config.ratingsMode === 'prime'
      ? getPrimeSquad(entry.club, entry.season)
      : getSquad(entry.club, entry.season);

  const players: DraftedPlayer[] = rawSquad
    .filter((p) =>
      positionFilter.length === 0 ? true : positionFilter.includes(p.position)
    )
    .map((p) => ({
      ...p,
      position_category: toCategory(p.position),
      club: entry.club,
      season: entry.season,
    }));

  return { club: entry.club, season: entry.season, players };
}

/**
 * Trova lo slot vuoto più compatibile per un giocatore (squad_first).
 * Priorità: exact match posizione specifica.
 * Ritorna null se ambiguo (0 o >1 slot) → l'UI mostrerà SlotPicker.
 */
export function findBestSlot(
  slots: DraftSlot[],
  player: DraftedPlayer
): DraftSlot | null {
  const empty = slots.filter((s) => s.player === null);
  const compatible = empty.filter((s) =>
    s.formationSlot.acceptedPositions.includes(player.position)
  );
  return compatible.length === 1 ? compatible[0] : null;
}

/**
 * Assegna un giocatore a uno slot specifico (per id).
 * Restituisce i nuovi slots (immutabile).
 */
export function assignToSlot(
  slots: DraftSlot[],
  slotId: string,
  player: DraftedPlayer
): DraftSlot[] {
  return slots.map((s) =>
    s.formationSlot.id === slotId ? { ...s, player } : s
  );
}

/** Rerolls iniziali per difficoltà — unica fonte di verità */
export function initialRerolls(difficulty: SetupConfig['difficulty']): number {
  return REROLLS_BY_DIFFICULTY[difficulty];
}

/** Slot ancora vuoti */
export function emptySlots(slots: DraftSlot[]): DraftSlot[] {
  return slots.filter((s) => s.player === null);
}

/**
 * Rating da mostrare in UI.
 * Regole (in ordine di priorità):
 *   1. Se difficulty === 'hard' → sempre '??' (indipendentemente da showRatings)
 *   2. Se showRatings === 'off'  → '??'
 *   3. Altrimenti                → valore numerico
 */
export function displayRating(
  rating: number,
  showRatings: SetupConfig['showRatings'],
  difficulty: SetupConfig['difficulty']
): string {
  if (difficulty === 'hard' || showRatings === 'off') return '??';
  return String(rating);
}

/** Classe colore Tailwind per il rating */
export function ratingColorClass(rating: number): string {
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 72) return 'text-amber-400';
  return 'text-red-400';
}
