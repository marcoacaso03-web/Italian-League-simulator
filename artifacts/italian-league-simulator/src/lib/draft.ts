import type { SetupConfig } from '../pages/GamePage';
import { getClubSeasonPool, getClubSeasonPositions, toCategory } from './data';
import { FORMATION_SLOTS, type FormationSlot } from './formations';

export interface DraftedPlayer {
  id: string;
  name: string;
  position: string;
  position_category: string;
  all_positions: string[];
  all_categories: string[];
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
  loading?: boolean;
}

export const REROLLS_BY_DIFFICULTY: Record<SetupConfig['difficulty'], number> = {
  easy: 3, normal: 1, hard: 0,
};

function parsePositions(position: string): string[] {
  return position.split(',').map((p) => p.trim()).filter(Boolean);
}

/** Mappa una posizione specifica alla sua categoria */
function posToCategory(pos: string): string {
  if (pos === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB', 'SW'].includes(pos)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  if (['ST', 'CF', 'LW', 'RW', 'LF', 'RF', 'LS', 'RS'].includes(pos)) return 'ATT';
  return pos; // fallback: la posizione è già una categoria
}

/** Verifica se una posizione del giocatore matcha una posizione richiesta dello slot.
 *  Supporta sia posizioni specifiche che categorie.
 *  Es: playerPos="ATT" matcha slotPos="ST" perché posToCategory("ST") === "ATT"
 *  Es: playerPos="ST" matcha slotPos="ST" (match esatto)
 *  Es: playerPos="ST" NON matcha slotPos="CB" (categorie diverse)
 */
function positionMatches(playerPos: string, slotPos: string): boolean {
  if (playerPos === slotPos) return true;
  // Se il giocatore ha una categoria generica (es "ATT"), matcha qualsiasi posizione della stessa categoria
  const playerCat = posToCategory(playerPos);
  const slotCat = posToCategory(slotPos);
  // Match per categoria: se il giocatore è "ATT" e lo slot è "ST", match
  if (playerCat === slotCat) return true;
  return false;
}

export function buildSlots(formation: string): DraftSlot[] {
  const fs = FORMATION_SLOTS[formation];
  if (!fs) throw new Error(`Formazione sconosciuta: ${formation}`);
  return fs.map((f) => ({ formationSlot: f, player: null }));
}

export function seasonYear(season: string): number {
  const separator = season.includes('/') ? '/' : '-';
  return parseInt(season.split(separator)[0], 10);
}

/**
 * Filtra il pool per era e, se vengono passati gli slot liberi della formazione,
 * esclude le combo club+stagione che non hanno almeno un giocatore per ciascuno
 * degli slot richiesti (ovvero non potrebbero coprire nemmeno uno slot aperto).
 */
function filteredPool(config: SetupConfig, emptyFormationSlots: FormationSlot[] = []) {
  const positions = getClubSeasonPositions();
  return getClubSeasonPool().filter((e) => {
    const y = seasonYear(e.season);
    if (y < config.eraFrom || y > config.eraTo) return false;
    if (emptyFormationSlots.length === 0) return true;
    const available = positions.get(`${e.club}|||${e.season}`);
    if (!available) return false;
    // Tieni la combo solo se copre almeno uno slot aperto
    // Supporta sia posizioni specifiche che categorie (es "ATT" matcha "ST", "LW", ecc.)
    return emptyFormationSlots.some((fs) =>
      fs.acceptedPositions.some((slotPos) =>
        available.has(slotPos) || available.has(posToCategory(slotPos))
      )
    );
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fisher-Yates shuffle — restituisce un nuovo array con elementi in ordine casuale. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Restituisce true quando il rating dei giocatori deve essere nascosto. */
export function isBlindMode(config: Pick<SetupConfig, 'showRatings' | 'difficulty'>): boolean {
  return config.difficulty === 'hard' || config.showRatings === 'off';
}

export function findCompatibleSlots(slots: DraftSlot[], player: DraftedPlayer): DraftSlot[] {
  const empty = slots.filter((s) => s.player === null);
  const positions = player.all_positions?.length ? player.all_positions : parsePositions(player.position);
  return empty.filter((s) =>
    positions.some((pos) => s.formationSlot.acceptedPositions.some((slotPos) => positionMatches(pos, slotPos)))
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

export async function spin(
  config: SetupConfig,
  usedCombos: Set<string>,
  positionFilter: string[],
  formationSlots: FormationSlot[] = [],
): Promise<SpinResult | null> {
  const pool = filteredPool(config, formationSlots)
    .filter((e) => !usedCombos.has(`${e.club}|||${e.season}`));
  if (pool.length === 0) return null;
  const entry = pickRandom(pool);
  
  // Carica la squadra on-demand
  const { loadSquadForLeague } = await import('./data');
  const rawSquad = await loadSquadForLeague(config.leagueId, entry.club, entry.season);
  
  const draftedPlayers: DraftedPlayer[] = rawSquad
    .filter((p) => {
      if (positionFilter.length === 0) return true;
      const allPos = p.all_positions?.length ? p.all_positions : parsePositions(p.position);
      return allPos.some((pos) => positionFilter.includes(pos));
    })
    .map((p) => ({
      ...p,
      position_category: toCategory(p.position),
      club: entry.club,
      season: entry.season,
    }));
  // In blind mode l'ordine per overall svelerebbe il rating migliore: randomizza.
  const players = isBlindMode(config) ? shuffle(draftedPlayers) : draftedPlayers;
  return { club: entry.club, season: entry.season, players };
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
