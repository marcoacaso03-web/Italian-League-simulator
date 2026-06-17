export interface Club {
  id: string;
  name: string;
}

export interface PlayerSeason {
  club: string;
  season: string;
  rating: number;
  positions: string[];   // posizioni in questa stagione+club
  categories: string[];  // categorie in questa stagione+club
  apps?: number;
  goals?: number;
  assists?: number;
}

export interface Player {
  id: string;
  name: string;
  position: string;          // posizione primaria di carriera
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
  all_positions: string[];   // posizioni per quella specifica stagione
  all_categories: string[];  // categorie per quella specifica stagione
  apps: number;
  goals: number;
  assists: number;
  rating: number;
  primeRating?: number;
}

export function toCategory(pos: string): string {
  const first = pos.split(',')[0].trim();
  if (first === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB'].includes(first)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(first)) return 'MID';
  return 'ATT';
}

let _players: Player[] | null = null;
let _clubs:   Club[]   | null = null;
let _clubsBySeason: Record<string, string[]> = {};
let _initPromise: Promise<void> | null = null;

/** Map<"club|||season", Set<position>> — built once, reused by filteredPool. */
let _clubSeasonPositions: Map<string, Set<string>> | null = null;

/**
 * Tenta prima il file statico generato durante la build (/data/players.json).
 * Se fallisce (ambiente Replit con API server), prova /api/data come fallback.
 */
export async function initData(): Promise<void> {
  if (_players !== null) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    let json: { players: Player[]; clubs: Club[]; clubsBySeason: Record<string, string[]> } | null = null;

    // Prova 1: file statico pre-generato (Vercel)
    try {
      const res = await fetch('/data/players.json');
      if (res.ok) {
        json = await res.json();
      }
    } catch { /* fallback */ }

    // Prova 2: API Express (Replit)
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

/**
 * Restituisce una Map<"club|||season", Set<string>> con tutte le posizioni
 * coperte da almeno un giocatore per quella combinazione club+stagione.
 */
export function getClubSeasonPositions(): Map<string, Set<string>> {
  if (_clubSeasonPositions) return _clubSeasonPositions;
  const map = new Map<string, Set<string>>();
  (_players ?? []).forEach((p) => {
    p.seasons.forEach((s) => {
      const key = `${s.club}|||${s.season}`;
      if (!map.has(key)) map.set(key, new Set<string>());
      s.positions.forEach((pos) => map.get(key)!.add(pos));
    });
  });
  _clubSeasonPositions = map;
  return map;
}

/** Restituisce i club in Serie A per una stagione specifica */
export function getClubsForSeason(season: string): string[] {
  return _clubsBySeason[season] ?? [];
}

export function loadClubs(): Club[] {
  return _clubs ?? [];
}

export function loadPlayers(): Player[] {
  return _players ?? [];
}

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
