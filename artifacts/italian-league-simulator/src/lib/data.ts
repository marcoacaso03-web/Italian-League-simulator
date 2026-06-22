// lib/data.ts
// Layer dati multi-lega.
//
// Modalita 1 (legacy): Serie A globale — initData() carica /data/players.json
// Modalita 2 (multi-lega): setActiveLeague(leagueId) carica /data/leagues/<id>/data.json

import type { LeagueMeta, LeagueClub, LeaguePlayer, LeagueDataSource } from '../types/league';
import { loadLeague, getClubsForLeague, getTop11AverageForLeague } from './leagues';

// ---------------------------------------------------------------------------
// Tipi legacy (coerenti con il formato players.json originale)
// ---------------------------------------------------------------------------

export interface Club {
  id: string;
  name: string;
}

export interface PlayerSeason {
  club: string;
  season: string;
  rating: number;
  positions: string[];
  categories: string[];
  apps?: number;
  goals?: number;
  assists?: number;
}

export interface Player {
  id: string;
  name: string;
  position: string;
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
  all_positions: string[];
  all_categories: string[];
  apps: number;
  goals: number;
  assists: number;
  rating: number;
  primeRating?: number;
}

// ===========================================================================
// MODALITA LEGACY (Serie A globale)
// ===========================================================================

let _players: Player[] | null = null;
let _clubs:   Club[]   | null = null;
let _clubsBySeason: Record<string, string[]> = {};
let _initPromise: Promise<void> | null = null;

export async function initData(): Promise<void> {
  if (_players !== null) return;
  // If active league data is already loaded, don't overwrite
  if (_activeLeagueData) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    let json: { players: Player[]; clubs: Club[]; clubsBySeason: Record<string, string[]> } | null = null;
    try {
      const res = await fetch('/data/players.json');
      if (res.ok) json = await res.json();
    } catch { /* fallback */ }
    if (!json) {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error(`initData: HTTP ${res.status}`);
      json = await res.json();
    }
    _players       = json!.players;
    _clubs         = json!.clubs;
    _clubsBySeason = json!.clubsBySeason ?? {};
  })();
  return _initPromise;
}

export function loadPlayers(): Player[] { return _players ?? []; }
export function loadClubs(): Club[] { return _clubs ?? []; }
export function getClubsForSeason(season: string): string[] { return _clubsBySeason[season] ?? []; }

export function getClubSeasonPositions(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  (_players ?? []).forEach((p: Player) => {
    p.seasons.forEach((s: PlayerSeason) => {
      const key = `${s.club}|||${s.season}`;
      if (!map.has(key)) map.set(key, new Set<string>());
      s.positions.forEach((pos: string) => map.get(key)!.add(pos));
    });
  });
  return map;
}

export function getSquad(club: string, season: string): SquadPlayer[] {
  const players = loadPlayers();
  return players
    .filter((p: Player) => p.seasons.some((s: PlayerSeason) => s.club === club && s.season === season))
    .map((p: Player) => {
      const ps = p.seasons.find((s: PlayerSeason) => s.club === club && s.season === season)!;
      const positions  = ps.positions  ?? (p.position         ? [p.position]         : []);
      const categories = ps.categories ?? (p.position_category ? [p.position_category] : []);
      return {
        id:                p.id,
        name:              p.name,
        position:          positions[0]  ?? p.position,
        position_category: categories[0] ?? p.position_category,
        all_positions:     positions,
        all_categories:    categories,
        apps:              ps.apps    ?? 0,
        goals:             ps.goals   ?? 0,
        assists:           ps.assists ?? 0,
        rating:            ps.rating,
      };
    })
    .sort((a, b) => b.rating - a.rating);
}

export function getPrimeRating(playerId: string): number {
  const player = loadPlayers().find((p: Player) => p.id === playerId);
  if (!player || player.seasons.length === 0) return 0;
  return Math.max(...player.seasons.map((s: PlayerSeason) => s.rating));
}

export function getPrimeSquad(club: string, season: string): SquadPlayer[] {
  return getSquad(club, season).map((sp: SquadPlayer) => {
    const prime = getPrimeRating(sp.id);
    return { ...sp, rating: prime, primeRating: prime };
  });
}

export function getTop11Average(club: string, season: string): number {
  const players = loadPlayers();
  const ratings = players
    .filter((p: Player) => p.seasons.some((s: PlayerSeason) => s.club === club && s.season === season))
    .map((p: Player) => {
      const ps = p.seasons.find((s: PlayerSeason) => s.club === club && s.season === season);
      return ps?.rating ?? 0;
    })
    .sort((a, b) => b - a);
  if (ratings.length === 0) return 70;
  const top11 = ratings.slice(0, 11);
  return Math.round(top11.reduce((sum: number, r: number) => sum + r, 0) / top11.length);
}

export function getClubSeasonPool(): ClubSeasonEntry[] {
  const players = loadPlayers();
  const map = new Map<string, number>();
  players.forEach((p: Player) => {
    p.seasons.forEach((s: PlayerSeason) => {
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

export function toCategory(pos: string): string {
  const first = pos.split(',')[0].trim();
  if (first === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB'].includes(first)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(first)) return 'MID';
  return 'ATT';
}

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

// ===========================================================================
// MODALITA MULTI-LEGA
// ===========================================================================

let _activeLeagueId: string | null = null;
let _activeLeagueData: LeagueDataSource | undefined = undefined;

export async function setActiveLeague(leagueId: string): Promise<void> {
  if (_activeLeagueId === leagueId && _activeLeagueData) return;
  _activeLeagueId = leagueId;
  _activeLeagueData = await loadLeague(leagueId);
  if (!_activeLeagueData) {
    throw new Error(`Campionato "${leagueId}" non trovato`);
  }
  // Populate legacy global state for draft/compat
  const ds = _activeLeagueData;
  _players = ds.players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    position_category: p.position_category,
    seasons: p.seasons.map((s) => ({
      club: s.club,
      season: s.season,
      rating: s.rating,
      positions: s.positions,
      categories: s.categories,
      apps: s.apps ?? 0,
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
    })),
  }));
  _clubs = ds.clubs.map((c) => ({ id: c.id, name: c.name }));
  // Rebuild clubs-by-season
  _clubsBySeason = {};
  for (const p of _players) {
    for (const s of p.seasons) {
      if (!_clubsBySeason[s.season]) _clubsBySeason[s.season] = [];
      if (!_clubsBySeason[s.season].includes(s.club)) _clubsBySeason[s.season].push(s.club);
    }
  }
}

export function getActiveLeagueMeta(): LeagueMeta | undefined {
  return _activeLeagueData?.meta;
}

export function getActiveLeagueClubs(): LeagueClub[] {
  if (!_activeLeagueData) return [];
  return getClubsForLeague(_activeLeagueData);
}

export function getActiveLeaguePlayers(): LeaguePlayer[] {
  return _activeLeagueData?.players ?? [];
}

export function getTop11AverageForActiveLeague(clubId: string, season: string): number {
  if (!_activeLeagueData) return 70;
  return getTop11AverageForLeague(_activeLeagueData, clubId, season);
}

export function getSquadForActiveLeague(clubId: string, season: string): LeaguePlayer['seasons'][number][] {
  if (!_activeLeagueData) return [];
  return getSquadForLeague(_activeLeagueData, clubId, season);
}

export function getSquadForLeague(
  data: LeagueDataSource,
  clubId: string,
  season: string,
): LeaguePlayer['seasons'][number][] {
  return data.players
    .filter((p: LeaguePlayer) => p.seasons.some((s: LeaguePlayer['seasons'][number]) => s.club === clubId && s.season === season))
    .map((p: LeaguePlayer) => {
      const s = p.seasons.find((s2: LeaguePlayer['seasons'][number]) => s2.club === clubId && s2.season === season)!;
      return s;
    });
}
