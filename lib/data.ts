/**
 * data.ts
 * Fonte dei dati del gioco.
 *
 * Strategia:
 *  - In ambiente server (Next.js SSR / Route Handler): legge i CSV dalla root
 *    tramite lib/csvLoader.ts e costruisce players/clubs in memoria.
 *  - In ambiente client: si affida ai dati già serializzati (passati come props
 *    da un Server Component) oppure li ottiene via /api/data.
 *
 * L'API pubblica (loadClubs, loadPlayers, getSquad, …) rimane invariata
 * per non rompere nessun componente esistente.
 */

// ─── Tipi pubblici ────────────────────────────────────────────────────────────

export interface Club {
  id: string;
  name: string;
}

export interface PlayerSeason {
  club: string;
  season: string;
  rating: number;
  apps?: number;
  goals?: number;
  assists?: number;
}

export interface Player {
  id: string;
  name: string;
  /** Posizione FIFA specifica: GK, CB, LB, RB, CM, CDM, CAM, LM, RM, LW, RW, ST, CF */
  position: string;
  /** Categoria aggregata: GK | DEF | MID | ATT */
  position_category: string;
  seasons: PlayerSeason[];
}

export interface ClubSeasonEntry {
  club: string;
  season: string;
  playerCount: number;
}

export interface SquadPlayer {
  id: string;
  name: string;
  position: string;
  position_category: string;
  apps: number;
  goals: number;
  assists: number;
  rating: number;
  primeRating?: number;
  /** Ruolo originale dal CSV (es. "DC", "CC", "POR") */
  ruolo?: string;
}

// ─── Utility di posizione ─────────────────────────────────────────────────────

/**
 * Determina la categoria dalla posizione FIFA.
 * Supporta stringhe multi-posizione tipo "RW, ST": usa la prima posizione valida.
 */
export function toCategory(pos: string): string {
  const first = pos.split(',')[0].trim();
  if (first === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB'].includes(first)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(first)) return 'MID';
  return 'ATT';
}

// ─── Caricamento dati ─────────────────────────────────────────────────────────

// Lazy-loaded singleton — caricato una volta sola per processo Next.js
let _players: Player[] | null = null;
let _clubs:   Club[]   | null = null;

function ensureLoaded(): void {
  if (_players !== null) return;

  try {
    // Importazione dinamica per evitare che webpack bundli `fs` lato client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadCsvDataset } = require('./csvLoader') as typeof import('./csvLoader');
    const dataset = loadCsvDataset();
    _players = dataset.players;
    _clubs   = dataset.clubs;
  } catch (err) {
    console.error('[data.ts] Impossibile caricare i CSV:', err);
    _players = [];
    _clubs   = [];
  }
}

export function loadClubs(): Club[] {
  ensureLoaded();
  return _clubs!;
}

export function loadPlayers(): Player[] {
  ensureLoaded();
  return _players!;
}

// ─── Query functions ──────────────────────────────────────────────────────────

export function getClubSeasonPool(): ClubSeasonEntry[] {
  const players = loadPlayers();
  const map = new Map<string, number>();
  players.forEach((p) => {
    p.seasons.forEach((s) => {
      const key = `${s.club}|||${s.season}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
  });
  const result: ClubSeasonEntry[] = [];
  map.forEach((count, key) => {
    const [club, season] = key.split('|||');
    result.push({ club, season, playerCount: count });
  });
  return result;
}

export function getSquad(club: string, season: string): SquadPlayer[] {
  const players = loadPlayers();
  return players
    .filter((p) => p.seasons.some((s) => s.club === club && s.season === season))
    .map((p) => {
      const ps = p.seasons.find((s) => s.club === club && s.season === season)!;
      return {
        id:                p.id,
        name:              p.name,
        position:          p.position,
        position_category: p.position_category,
        apps:              ps.apps   ?? 0,
        goals:             ps.goals  ?? 0,
        assists:           ps.assists ?? 0,
        rating:            ps.rating,
      };
    })
    .sort((a, b) => b.rating - a.rating);
}

export function getPrimeRating(playerId: string): number {
  const player = loadPlayers().find((p) => p.id === playerId);
  if (!player || player.seasons.length === 0) return 0;
  return Math.max(...player.seasons.map((s) => s.rating));
}

export function getPrimeSquad(club: string, season: string): SquadPlayer[] {
  return getSquad(club, season).map((sp) => {
    const prime = getPrimeRating(sp.id);
    return { ...sp, rating: prime, primeRating: prime };
  });
}

export function getAvailableSeasons(): string[] {
  const set = new Set<string>();
  loadPlayers().forEach((p) => p.seasons.forEach((s) => set.add(s.season)));
  return Array.from(set).sort();
}

// ─── Helper UI ────────────────────────────────────────────────────────────────

export function ratingColor(rating: number): string {
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 72) return 'text-amber-400';
  return 'text-red-400';
}

export function ratingBg(rating: number): string {
  if (rating >= 85) return 'bg-emerald-500/20 border-emerald-500/30';
  if (rating >= 72) return 'bg-amber-500/20 border-amber-500/30';
  return 'bg-red-500/20 border-red-500/30';
}
