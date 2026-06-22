// lib/leagues.ts
// Loader multi-lega: carica meta + clubs + players per ogni campionato.
// Ogni campionato vive in public/data/leagues/<id>/
// Lazy loading via dynamic import per cache e performance.

import type {
  LeagueMeta,
  LeagueClub,
  LeaguePlayer,
  LeagueDataSource,
} from '../types/league';

// Re-exported from data.ts to avoid circular dependency
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

// ---------------------------------------------------------------------------
// Metadati statici — non servono fetch
// ---------------------------------------------------------------------------
export const LEAGUES: LeagueMeta[] = [
  {
    id: 'serie-a',
    name: 'Serie A',
    country: 'Italia',
    countryCode: 'it',
    numTeams: 20,
    numMatchdays: 38,
    season: '2025-2026',
    colors: { primary: '#02448E', secondary: '#00C200', accent: '#FFFFFF' },
  },
  {
    id: 'premier-league',
    name: 'Premier League',
    country: 'Inghilterra',
    countryCode: 'gb',
    numTeams: 20,
    numMatchdays: 38,
    season: '2025-2026',
    colors: { primary: '#3D195B', secondary: '#FF2882', accent: '#00FF87' },
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    country: 'Spagna',
    countryCode: 'es',
    numTeams: 20,
    numMatchdays: 38,
    season: '2025-2026',
    colors: { primary: '#000000', secondary: '#FFFFFF', accent: '#FF0000' },
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    country: 'Francia',
    countryCode: 'fr',
    numTeams: 18,
    numMatchdays: 34,
    season: '2025-2026',
    colors: { primary: '#091C3E', secondary: '#DA020E', accent: '#FFD700' },
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    country: 'Germania',
    countryCode: 'de',
    numTeams: 18,
    numMatchdays: 34,
    season: '2025-2026',
    colors: { primary: '#D20515', secondary: '#FFFFFF', accent: '#000000' },
  },
];

export function getLeagueMeta(leagueId: string): LeagueMeta | undefined {
  return LEAGUES.find((l) => l.id === leagueId);
}

// ---------------------------------------------------------------------------
// Cache dati caricati
// ---------------------------------------------------------------------------
const _cache = new Map<string, LeagueDataSource>();

/**
 * Carica il data source completo per un campionato.
 * Cache: una volta caricato, ritorna la stessa istanza.
 *
 * @param leagueId — es. "serie-a", "premier-league"
 * @returns LeagueDataSource o undefined se non trovato
 */
export async function loadLeague(leagueId: string): Promise<LeagueDataSource | undefined> {
  if (_cache.has(leagueId)) return _cache.get(leagueId)!;

  try {
    // Carica pool.json (leggero: meta + clubs + pool club+stagione)
    const res = await fetch(`/data/leagues/${leagueId}/pool.json`);
    if (!res.ok) {
      console.warn(`loadLeague: ${leagueId} → HTTP ${res.status}`);
      return undefined;
    }
    const poolData = (await res.json()) as { meta: LeagueMeta; clubs: LeagueClub[]; pool: { club: string; season: string; playerCount: number }[] };
    
    // Costruisci LeagueDataSource con players vuoto (caricato on-demand)
    const ds: LeagueDataSource = {
      meta: poolData.meta,
      clubs: poolData.clubs,
      players: [], // Players caricati on-demand da loadSquad()
    };
    _cache.set(leagueId, ds);
    return ds;
  } catch (err) {
    console.warn(`loadLeague: ${leagueId} errore`, err);
    return undefined;
  }
}

/**
 * Carica la squadra di un club+stagione specifico.
 * File: /data/leagues/<leagueId>/squads/<club>_<season>.json
 */
export async function loadSquad(leagueId: string, club: string, season: string): Promise<SquadPlayer[]> {
  try {
    const clubSlug = club.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const seasonSlug = season.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const res = await fetch(`/data/leagues/${leagueId}/squads/${clubSlug}__${seasonSlug}.json`);
    if (!res.ok) {
      console.warn(`loadSquad: ${leagueId}/${club}/${season} → HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { club: string; season: string; players: SquadPlayer[] };
    return data.players;
  } catch (err) {
    console.warn(`loadSquad: ${leagueId}/${club}/${season} errore`, err);
    return [];
  }
}

/**
 * Force-reload (invalida cache). Utile dopo update dati.
 */
export function invalidateLeagueCache(leagueId?: string): void {
  if (leagueId) {
    _cache.delete(leagueId);
  } else {
    _cache.clear();
  }
}

/**
 * Verifica che tutti i file necessari esistano per un campionato.
 */
export async function leagueExists(leagueId: string): Promise<boolean> {
  try {
    const res = await fetch(`/data/leagues/${leagueId}/data.json`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers per il game engine
// ---------------------------------------------------------------------------

/**
 * Sostituisce initData globale: carica il data source di un campionato specifico
 * e popola le cache locali del game engine.
 */
export async function initLeagueData(leagueId: string): Promise<void> {
  const data = await loadLeague(leagueId);
  if (!data) throw new Error(`Campionato "${leagueId}" non trovato`);
}

/**
 * Restituisce i club disponibili per una stagione in un campionato.
 * In v1: tutti i club del campionato (gli ai usano tutta la rosa).
 */
export function getClubsForLeague(data: LeagueDataSource): LeagueClub[] {
  return data.clubs;
}

/**
 * Restituisce i giocatori di un club per una stagione specifica nel campionato.
 */
export function getSquadForLeague(
  data: LeagueDataSource,
  clubId: string,
  season: string,
): LeaguePlayer['seasons'][number][] {
  return data.players
    .filter((p) => p.seasons.some((s) => s.club === clubId && s.season === season))
    .map((p) => {
      const s = p.seasons.find((s) => s.club === clubId && s.season === season)!;
      return s;
    });
}

/**
 * Calcola la media dei 11 giocatori con rating più alto per un club+stagione.
 * Usato per i rating delle squadre AI.
 */
export function getTop11AverageForLeague(
  data: LeagueDataSource,
  clubId: string,
  season: string,
): number {
  const ratings = data.players
    .filter((p) => p.seasons.some((s) => s.club === clubId && s.season === season))
    .map((p) => {
      const s = p.seasons.find((s) => s.club === clubId && s.season === season);
      return s?.rating ?? 0;
    })
    .sort((a, b) => b - a);

  if (ratings.length === 0) return 70;
  const top11 = ratings.slice(0, 11);
  return Math.round(top11.reduce((sum, r) => sum + r, 0) / top11.length);
}

/**
 * Converte market value EUR in rating FIFA-style per era 2000-04.
 * Formula iperbolica calibrata: 47% rating in 70-85 (soglia >40%).
 */
export function marketValueToRating(marketValue: number): number {
  if (marketValue <= 0) return 45;
  const c = 1_280_000;
  const r = 55 + (38 * marketValue) / (marketValue + c);
  return Math.max(50, Math.min(95, Math.round(r)));
}
