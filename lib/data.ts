/**
 * data.ts
 * Fonte dei dati del gioco.
 *
 * Strategia:
 *  - app/game/layout.tsx (Server Component) chiama await initData() che
 *    fa fetch su /api/data/route.ts (Node.js only, usa fs + csvLoader).
 *  - I client components chiamano loadPlayers()/loadClubs() in modo sincrono
 *    perché i dati sono già in cache quando il loro render avviene.
 *
 * L'API pubblica (loadClubs, loadPlayers, getSquad, …) è invariata.
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
  ruolo?: string;
}

// ─── Utility di posizione ─────────────────────────────────────────────────────

export function toCategory(pos: string): string {
  const first = pos.split(',')[0].trim();
  if (first === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB'].includes(first)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(first)) return 'MID';
  return 'ATT';
}

// ─── Cache in-memory ──────────────────────────────────────────────────────────

let _players: Player[] | null = null;
let _clubs:   Club[]   | null = null;

/**
 * Chiama initData() una sola volta in un Server Component (es. app/game/layout.tsx)
 * PRIMA che qualsiasi client component venga renderizzato.
 *
 * In SSR il fetch su /api/data è una chiamata interna Next.js (stesso processo),
 * non una vera richiesta di rete — viene automaticamente deduplicata e
 * messa in cache da Next.js con { cache: 'force-cache' }.
 */
export async function initData(): Promise<void> {
  if (_players !== null) return; // già caricato
  try {
    // In ambiente server Next.js, le URL relative non funzionano;
    // usiamo NEXT_PUBLIC_BASE_URL o il base URL canonico di Vercel.
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const res = await fetch(`${base}/api/data`, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dataset = (await res.json()) as { players: Player[]; clubs: Club[] };
    _players = dataset.players;
    _clubs   = dataset.clubs;
  } catch (err) {
    console.error('[data.ts] initData fallito:', err);
    _players = [];
    _clubs   = [];
  }
}

export function loadClubs(): Club[] {
  return _clubs ?? [];
}

export function loadPlayers(): Player[] {
  return _players ?? [];
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
