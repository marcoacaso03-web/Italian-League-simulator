import type { SetupConfig } from '@/app/game/page';
import { getClubSeasonPool, getSquad } from '@/lib/data';
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
  rating: number;
}

export interface DraftSlot {
  formationSlot: FormationSlot;
  player: DraftedPlayer | null;
}

export interface SpinResult {
  club: string;
  season: string;
  players: DraftedPlayer[];   // già filtrati per posizioni compatibili (position_first) o tutti (squad_first)
}

export interface DraftState {
  slots: DraftSlot[];
  currentSpin: SpinResult | null;
  rerollsLeft: number;
  phase: 'idle' | 'spinning' | 'picking' | 'complete';
  // position_first: quale slot l'utente ha selezionato
  activeSlotId: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Costruisce i DraftSlot iniziali per la formazione scelta */
export function buildSlots(formation: string): DraftSlot[] {
  const slots = FORMATION_SLOTS[formation];
  if (!slots) throw new Error(`Formazione sconosciuta: ${formation}`);
  return slots.map((fs) => ({ formationSlot: fs, player: null }));
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

/** Pesca club+stagione casuali dal pool, escludendo combo già usate */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Esegue uno spin.
 * - positionFilter: array di acceptedPositions da usare come filtro (position_first)
 *   oppure [] per nessun filtro (squad_first)
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
  const allPlayers = getSquad(entry.club, entry.season);

  const players: DraftedPlayer[] = allPlayers
    .filter((p) =>
      positionFilter.length === 0
        ? true
        : positionFilter.includes(p.position)
    )
    .map((p) => ({
      ...p,
      position_category:
        p.position === 'GK' ? 'GK'
        : ['CB','RB','LB','WB','LWB','RWB'].includes(p.position) ? 'DEF'
        : ['CDM','CM','CAM','LM','RM'].includes(p.position) ? 'MID'
        : 'ATT',
      club: entry.club,
      season: entry.season,
    }));

  return { club: entry.club, season: entry.season, players };
}

/**
 * Trova lo slot vuoto più compatibile per un giocatore (squad_first).
 * Priorità: exact match posizione → categoria compatibile
 */
export function findBestSlot(
  slots: DraftSlot[],
  player: DraftedPlayer
): DraftSlot | null {
  const empty = slots.filter((s) => s.player === null);
  // 1. Slot che accetta esattamente la posizione specifica
  const exact = empty.find((s) =>
    s.formationSlot.acceptedPositions.includes(player.position)
  );
  if (exact) return exact;
  // 2. Nessun match esatto → null (l'UI chiederà all'utente)
  return null;
}

/**
 * Assegna un giocatore a uno slot specifico (per id).
 * Restituisce i nuovi slots.
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

/** Rerolls iniziali per difficoltà */
export function initialRerolls(difficulty: SetupConfig['difficulty']): number {
  return difficulty === 'easy' ? 3 : difficulty === 'normal' ? 1 : 0;
}

/** Slot ancora vuoti */
export function emptySlots(slots: DraftSlot[]): DraftSlot[] {
  return slots.filter((s) => s.player === null);
}

/** Rating da mostrare (hard mode → nascosto) */
export function displayRating(
  rating: number,
  showRatings: SetupConfig['showRatings']
): string {
  return showRatings === 'off' ? '??' : String(rating);
}

/** Colore rating */
export function ratingColorClass(rating: number): string {
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 72) return 'text-amber-400';
  return 'text-red-400';
}
