import type { SetupConfig } from '@/app/game/page';
import { getClubSeasonPool, getSquad, getPrimeSquad, toCategory } from '@/lib/data';
import { FORMATION_SLOTS, type FormationSlot } from '@/lib/formations';

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
  phase: 'idle' | 'spinning' | 'picking' | 'complete';
  activeSlotId: string | null;
}

export const REROLLS_BY_DIFFICULTY: Record<SetupConfig['difficulty'], number> = {
  easy: 3, normal: 1, hard: 0,
};

/** Parsa una stringa di posizioni tipo "RW, ST" in un array ["RW", "ST"] */
function parsePositions(position: string): string[] {
  return position.split(',').map((p) => p.trim()).filter(Boolean);
}

export function buildSlots(formation: string): DraftSlot[] {
  const fs = FORMATION_SLOTS[formation];
  if (!fs) throw new Error(`Formazione sconosciuta: ${formation}`);
  return fs.map((f) => ({ formationSlot: f, player: null }));
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

export function findCompatibleSlots(slots: DraftSlot[], player: DraftedPlayer): DraftSlot[] {
  const empty = slots.filter((s) => s.player === null);
  // Supporta posizioni multiple: "RW, ST" → ["RW", "ST"]
  const positions = parsePositions(player.position);

  return empty.filter((s) =>
    positions.some((pos) => s.formationSlot.acceptedPositions.includes(pos))
  );
}

export function findBestSlot(slots: DraftSlot[], player: DraftedPlayer): DraftSlot | null {
  const c = findCompatibleSlots(slots, player);
  return c.length === 1 ? c[0] : null;
}

export function assignToSlot(slots: DraftSlot[], slotId: string, player: DraftedPlayer): DraftSlot[] {
  return slots.map((s) => s.formationSlot.id === slotId ? { ...s, player } : s);
}

export function initialRerolls(difficulty: SetupConfig['difficulty']): number {
  return REROLLS_BY_DIFFICULTY[difficulty];
}

export function emptySlots(slots: DraftSlot[]): DraftSlot[] {
  return slots.filter((s) => s.player === null);
}

export function spin(
  config: SetupConfig,
  usedCombos: Set<string>,
  positionFilter: string[],
): SpinResult | null {
  const pool = filteredPool(config).filter((e) => !usedCombos.has(`${e.club}|||${e.season}`));
  if (pool.length === 0) return null;
  const entry = pickRandom(pool);
  const rawSquad = config.ratingsMode === 'prime'
    ? getPrimeSquad(entry.club, entry.season)
    : getSquad(entry.club, entry.season);
  const draftedPlayers: DraftedPlayer[] = rawSquad
    .filter((p) => {
      if (positionFilter.length === 0) return true;
      // Supporta posizioni multiple nel filtro
      return parsePositions(p.position).some((pos) => positionFilter.includes(pos));
    })
    .map((p) => ({
      ...p,
      position_category: toCategory(p.position),
      club: entry.club,
      season: entry.season,
    }));
  return { club: entry.club, season: entry.season, players: draftedPlayers };
}

export function displayRating(
  rating: number,
  showRatings: SetupConfig['showRatings'],
  difficulty: SetupConfig['difficulty'],
): string {
  if (difficulty === 'hard' || showRatings === 'off') return '??';
  return String(rating);
}

export function ratingColorClass(rating: number): string {
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 72) return 'text-amber-400';
  return 'text-red-400';
}
