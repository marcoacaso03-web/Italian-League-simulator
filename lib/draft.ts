import type { SetupConfig } from '@/app/game/page';
import { getClubSeasonPool, getSquad, getPrimeSquad } from '@/lib/data';
import { FORMATION_SLOTS, type FormationSlot } from '@/lib/formations';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

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
  /** Rating effettivo (stagione o prime) */
  rating: number;
  /** Solo in prime mode: conferma che rating == max storico */
  primeRating?: number;
}

export interface DraftSlot {
  formationSlot: FormationSlot;
  player: DraftedPlayer | null;
}

export interface SpinResult {
  club: string;
  season: string;
  players: DraftedPlayer[];
}

export interface DraftState {
  slots: DraftSlot[];
  currentSpin: SpinResult | null;
  rerollsLeft: number;
  /**
   * idle     → aspetta azione utente
   * spinning → animazione club+anno in corso, lista nascosta
   * picking  → animazione finita, lista visibile
   * complete → tutti gli slot riempiti
   */
  phase: 'idle' | 'spinning' | 'picking' | 'complete';
  activeSlotId: string | null;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

/** Mappa difficoltà → reroll. Unica fonte di verità. */
export const REROLLS_BY_DIFFICULTY: Record<SetupConfig['difficulty'], number> = {
  easy:   3,
  normal: 1,
  hard:   0,
};

/**
 * Coppie di posizioni intercambiabili solo quando entrambi gli slot
 * esistono in formazione E sono ancora vuoti.
 * Esempio: un RM può occupare LM se lo slot LM è ancora libero.
 * CB/LB/RB non fanno parte di queste coppie: non si mescolano mai.
 */
const WINGER_PAIRS: ReadonlyArray<[string, string]> = [
  ['LM', 'RM'],
  ['LW', 'RW'],
];

/** Mirror di una posizione nelle coppie intercambiabili, oppure null */
function mirrorPosition(pos: string): string | null {
  for (const [a, b] of WINGER_PAIRS) {
    if (pos === a) return b;
    if (pos === b) return a;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildSlots(formation: string): DraftSlot[] {
  const formationSlots = FORMATION_SLOTS[formation];
  if (!formationSlots) throw new Error(`Formazione sconosciuta: ${formation}`);
  return formationSlots.map((fs) => ({ formationSlot: fs, player: null }));
}

export function seasonYear(season: string): number {
  return parseInt(season.split('/')[0], 10);
}

function filteredPool(config: SetupConfig) {
  return getClubSeasonPool().filter((e) => {
    const y = seasonYear(e.season);
    return y >= config.eraFrom && y <= config.eraTo;
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function toCategory(position: string): string {
  if (position === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB'].includes(position)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return 'MID';
  return 'ATT';
}

// ─── Compatibilità slot ────────────────────────────────────────────────────────

/**
 * Dato un giocatore e i DraftSlot correnti, restituisce tutti gli slot vuoti
 * in cui può giocare secondo le regole:
 *
 * 1. Match diretto: slot.acceptedPositions include player.position
 * 2. Match laterale: player.position ha un mirror (es. RM→LM) e
 *    - lo slot del mirror è vuoto
 *    - lo slot "naturale" del giocatore è ANCHE ancora vuoto in formazione
 *    → in questo caso l'utente sceglie in quale dei due andare.
 *
 * Se solo uno slot è compatibile → auto-assegnazione. Se più di uno → SlotPicker.
 */
export function findCompatibleSlots(
  slots: DraftSlot[],
  player: DraftedPlayer
): DraftSlot[] {
  const emptySlotList = slots.filter((s) => s.player === null);

  // 1. Slot diretti (match esatto)
  const direct = emptySlotList.filter((s) =>
    s.formationSlot.acceptedPositions.includes(player.position)
  );

  // 2. Slot speculari (solo per posizioni WINGER_PAIRS)
  const mirror = mirrorPosition(player.position);
  let mirrorSlots: DraftSlot[] = [];
  if (mirror !== null) {
    // Lo slot specchio è usabile solo se anche almeno un direct slot esiste
    // (il giocatore deve avere il suo slot naturale ancora libero per poter
    // scegliere tra i due lati — altrimenti gioca solo sul lato naturale)
    const naturalHasEmpty = direct.length > 0;
    if (naturalHasEmpty) {
      mirrorSlots = emptySlotList.filter((s) =>
        s.formationSlot.acceptedPositions.includes(mirror)
      );
    }
  }

  // Unione senza duplicati
  const seen = new Set<string>();
  const result: DraftSlot[] = [];
  for (const s of [...direct, ...mirrorSlots]) {
    if (!seen.has(s.formationSlot.id)) {
      seen.add(s.formationSlot.id);
      result.push(s);
    }
  }
  return result;
}

/**
 * Trova il singolo slot migliore in auto-assegnazione:
 * - Se esiste esattamente 1 slot compatibile (diretto o specchio) → lo ritorna
 * - Altrimenti null (l'UI mostrerà SlotPicker)
 */
export function findBestSlot(
  slots: DraftSlot[],
  player: DraftedPlayer
): DraftSlot | null {
  const compatible = findCompatibleSlots(slots, player);
  return compatible.length === 1 ? compatible[0] : null;
}

export function assignToSlot(
  slots: DraftSlot[],
  slotId: string,
  player: DraftedPlayer
): DraftSlot[] {
  return slots.map((s) =>
    s.formationSlot.id === slotId ? { ...s, player } : s
  );
}

export function initialRerolls(difficulty: SetupConfig['difficulty']): number {
  return REROLLS_BY_DIFFICULTY[difficulty];
}

export function emptySlots(slots: DraftSlot[]): DraftSlot[] {
  return slots.filter((s) => s.player === null);
}

// ─── Spin ──────────────────────────────────────────────────────────────────────

/**
 * Esegue il sorteggio club+stagione e prepara la lista giocatori.
 * positionFilter:
 *   - squad_first  → [] (nessun filtro, tutti i giocatori)
 *   - position_first → acceptedPositions dello slot selezionato
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

// ─── Display ──────────────────────────────────────────────────────────────────

/**
 * Ritorna la stringa rating da mostrare.
 * Priorità: hard → sempre '??', poi showRatings='off' → '??', altrimenti valore.
 */
export function displayRating(
  rating: number,
  showRatings: SetupConfig['showRatings'],
  difficulty: SetupConfig['difficulty']
): string {
  if (difficulty === 'hard' || showRatings === 'off') return '??';
  return String(rating);
}

export function ratingColorClass(rating: number): string {
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 72) return 'text-amber-400';
  return 'text-red-400';
}
