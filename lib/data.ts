import clubsData from '../data/clubs.json';
import playersData from '../data/players.json';

export interface Club {
  id: string;
  name: string;
}

export interface PlayerSeason {
  club: string;
  season: string;
  rating: number;
  apps: number;
  goals: number;
  assists: number;
}

// position_category viene derivato runtime da position (non è nel JSON)
export interface Player {
  id: string;
  name: string;
  position: string; // specifico: GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM, LM, RM, LW, RW, ST, CF
  position_category: string; // GK, DEF, MID, ATT — calcolato in loadPlayers()
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
}

// Tipo che rispecchia il JSON grezzo (senza position_category)
interface RawPlayer {
  id: string;
  name: string;
  position: string;
  seasons: (PlayerSeason & { specific_position?: string })[];
}

export function toCategory(pos: string): string {
  if (pos === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  return 'ATT';
}

const clubs: Club[] = clubsData as Club[];

// Deriva position_category a runtime dal campo position
const players: Player[] = (playersData as RawPlayer[]).map((p) => ({
  ...p,
  position_category: toCategory(p.position),
}));

export function loadClubs(): Club[] { return clubs; }
export function loadPlayers(): Player[] { return players; }

export function getClubSeasonPool(): ClubSeasonEntry[] {
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
  return players
    .filter((p) => p.seasons.some((s) => s.club === club && s.season === season))
    .map((p) => {
      const ps = p.seasons.find((s) => s.club === club && s.season === season)!;
      return {
        id: p.id,
        name: p.name,
        position: p.position,
        position_category: p.position_category,
        apps: ps.apps,
        goals: ps.goals,
        assists: ps.assists,
        rating: ps.rating,
      };
    })
    .sort((a, b) => b.rating - a.rating);
}

export function getPrimeRating(playerId: string): number {
  const player = players.find((p) => p.id === playerId);
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
  players.forEach((p) => p.seasons.forEach((s) => set.add(s.season)));
  return Array.from(set).sort();
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
