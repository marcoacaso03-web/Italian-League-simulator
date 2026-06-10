import type { DraftSlot } from '@/lib/draft';

// ─── Serie A 25/26 ────────────────────────────────────────────────────────────

export interface SerieATeam {
  id: string;
  name: string;
  abbr: string;
  color: string; // tailwind accent class
  rating: number;
}

export const SERIE_A_2526: SerieATeam[] = [
  { id: 'int', name: 'Inter',       abbr: 'INT', color: '#1d4ed8', rating: 89 },
  { id: 'nap', name: 'Napoli',      abbr: 'NAP', color: '#2563eb', rating: 87 },
  { id: 'mil', name: 'Milan',       abbr: 'MIL', color: '#dc2626', rating: 85 },
  { id: 'juv', name: 'Juventus',    abbr: 'JUV', color: '#e5e7eb', rating: 85 },
  { id: 'ata', name: 'Atalanta',    abbr: 'ATA', color: '#1e3a8a', rating: 84 },
  { id: 'laz', name: 'Lazio',       abbr: 'LAZ', color: '#38bdf8', rating: 81 },
  { id: 'rom', name: 'Roma',        abbr: 'ROM', color: '#b91c1c', rating: 80 },
  { id: 'fio', name: 'Fiorentina',  abbr: 'FIO', color: '#7c3aed', rating: 79 },
  { id: 'bol', name: 'Bologna',     abbr: 'BOL', color: '#92400e', rating: 77 },
  { id: 'tor', name: 'Torino',      abbr: 'TOR', color: '#78350f', rating: 75 },
  { id: 'udi', name: 'Udinese',     abbr: 'UDI', color: '#1f2937', rating: 72 },
  { id: 'cag', name: 'Cagliari',    abbr: 'CAG', color: '#b45309', rating: 71 },
  { id: 'par', name: 'Parma',       abbr: 'PAR', color: '#fbbf24', rating: 70 },
  { id: 'com', name: 'Como',        abbr: 'COM', color: '#155e75', rating: 70 },
  { id: 'gen', name: 'Genoa',       abbr: 'GEN', color: '#991b1b', rating: 69 },
  { id: 'lec', name: 'Lecce',       abbr: 'LEC', color: '#f59e0b', rating: 68 },
  { id: 'ver', name: 'Verona',      abbr: 'VER', color: '#065f46', rating: 67 },
  { id: 'emp', name: 'Empoli',      abbr: 'EMP', color: '#1d4ed8', rating: 66 },
  { id: 'ven', name: 'Venezia',     abbr: 'VEN', color: '#1e293b', rating: 65 },
  { id: 'mon', name: 'Monza',       abbr: 'MON', color: '#e11d48', rating: 64 },
];

// ─── Overall & repart rating ─────────────────────────────────────────────────

export interface TeamOverall {
  overall: number;
  attack: number;
  midfield: number;
  defence: number;
  gk: number;
}

export function calcTeamOverall(slots: DraftSlot[]): TeamOverall {
  const byCategory: Record<string, number[]> = { ATT: [], MID: [], DEF: [], GK: [] };
  for (const s of slots) {
    if (!s.player) continue;
    const cat = s.player.position_category;
    if (cat in byCategory) byCategory[cat].push(s.player.rating);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 70 : arr.reduce((a, b) => a + b, 0) / arr.length;

  const attack   = Math.round(avg(byCategory.ATT));
  const midfield = Math.round(avg(byCategory.MID));
  const defence  = Math.round(avg(byCategory.DEF));
  const gk       = Math.round(avg(byCategory.GK));

  const overall = Math.round(
    (attack * 1.2 + midfield * 1.0 + defence * 1.0 + gk * 0.9) / 4.1
  );

  return { overall: Math.min(99, Math.max(60, overall)), attack, midfield, defence, gk };
}

// ─── Pre-season odds ──────────────────────────────────────────────────────────

export interface PreSeasonOdds {
  projectedFinish: number;
  expectedPoints: number;
  scudetto: number;   // %
  top4: number;
  top6: number;
  top10: number;
  relegation: number;
}

export function preSeasonOdds(teamRating: number): PreSeasonOdds {
  // Sorted league ratings (include player team at teamRating)
  const leagueRatings = [...SERIE_A_2526.map((t) => t.rating), teamRating].sort((a, b) => b - a);
  const rank = leagueRatings.indexOf(teamRating) + 1; // 1-based
  const leagueAvg = SERIE_A_2526.reduce((s, t) => s + t.rating, 0) / SERIE_A_2526.length;
  const diff = teamRating - leagueAvg; // +/- vs average

  // Points: ~38 matches, baseline ~50pts for average team
  const expectedPoints = Math.round(Math.min(99, Math.max(20, 50 + diff * 1.2)));

  // Probabilities via sigmoid-like function of diff
  const sig = (x: number, scale = 8) => Math.round(100 / (1 + Math.exp(-x / scale)) * 10) / 10;

  const scudetto   = rank === 1 ? sig(diff, 5) : Math.max(0.1, Math.round(sig(diff - 10, 5) * 10) / 10);
  const top4       = Math.min(99, Math.round(sig(diff - 5, 6) * 10) / 10);
  const top6       = Math.min(99, Math.round(sig(diff - 2, 6) * 10) / 10);
  const top10      = Math.min(99, Math.round(sig(diff + 2, 6) * 10) / 10);
  const relegation = Math.max(0.1, Math.round(sig(-diff - 5, 5) * 10) / 10);

  return {
    projectedFinish: rank,
    expectedPoints,
    scudetto, top4, top6, top10, relegation,
  };
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export interface TeamStanding {
  teamId: string;   // 'player' per il player team
  name: string;
  abbr: string;
  color: string;
  isPlayer: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export interface MatchdaySnapshot {
  matchday: number;
  playerPoints: number;
  playerPosition: number;
}

export interface SeasonResult {
  standings: TeamStanding[];
  matchdaySnapshots: MatchdaySnapshot[];
  playerFinalPosition: number;
  playerPoints: number;
  playerGF: number;
  playerGA: number;
}

/** Poisson random variable — lambda capped at 6 */
function poisson(lambda: number): number {
  const l = Math.exp(-Math.min(lambda, 6));
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

function matchGoals(homeRating: number, awayRating: number): [number, number] {
  const base = 1.35;
  const homeAdv = 0.15;
  const diff = (homeRating - awayRating) / 20;
  const homeLambda = Math.max(0.3, base + diff + homeAdv);
  const awayLambda = Math.max(0.3, base - diff);
  return [poisson(homeLambda), poisson(awayLambda)];
}

export function simulateSeason(
  slots: DraftSlot[],
  overall: TeamOverall
): SeasonResult {
  const playerRating = overall.overall;

  // Build standings map
  const standingsMap = new Map<string, TeamStanding>();
  SERIE_A_2526.forEach((t) => {
    standingsMap.set(t.id, {
      teamId: t.id, name: t.name, abbr: t.abbr, color: t.color,
      isPlayer: false, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
    });
  });
  standingsMap.set('player', {
    teamId: 'player', name: 'La Tua Squadra', abbr: 'YOU', color: '#10b981',
    isPlayer: true, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
  });

  // Schedule: round-robin (home+away). For speed, use simulated AI vs AI + player matches.
  const allTeamIds = ['player', ...SERIE_A_2526.map((t) => t.id)];
  const getRating = (id: string) =>
    id === 'player' ? playerRating : (SERIE_A_2526.find((t) => t.id === id)?.rating ?? 70);

  // Generate round-robin pairs
  const pairs: [string, string][] = [];
  for (let i = 0; i < allTeamIds.length; i++) {
    for (let j = i + 1; j < allTeamIds.length; j++) {
      pairs.push([allTeamIds[i], allTeamIds[j]]);
      pairs.push([allTeamIds[j], allTeamIds[i]]); // return fixture
    }
  }

  // Shuffle pairs into 38 matchdays (20 teams → 10 games/matchday)
  const shuffled = [...pairs].sort(() => Math.random() - 0.5);
  const matchdaySnapshots: MatchdaySnapshot[] = [];

  for (let md = 0; md < 38; md++) {
    const gamesThisRound = shuffled.slice(md * 10, md * 10 + 10);
    for (const [homeId, awayId] of gamesThisRound) {
      const [hg, ag] = matchGoals(getRating(homeId), getRating(awayId));
      const home = standingsMap.get(homeId)!;
      const away = standingsMap.get(awayId)!;
      home.played++; home.gf += hg; home.ga += ag;
      away.played++; away.gf += ag; away.ga += hg;
      if (hg > ag) { home.won++; home.points += 3; away.lost++; }
      else if (hg < ag) { away.won++; away.points += 3; home.lost++; }
      else { home.drawn++; home.points++; away.drawn++; away.points++; }
    }

    // Snapshot after each matchday
    const sorted = Array.from(standingsMap.values()).sort(
      (a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga)
    );
    const playerPos = sorted.findIndex((s) => s.isPlayer) + 1;
    const playerPts = standingsMap.get('player')!.points;
    matchdaySnapshots.push({ matchday: md + 1, playerPoints: playerPts, playerPosition: playerPos });
  }

  const finalStandings = Array.from(standingsMap.values()).sort(
    (a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga)
  );

  const playerFinal = finalStandings.findIndex((s) => s.isPlayer);
  const playerRow = standingsMap.get('player')!;

  return {
    standings: finalStandings,
    matchdaySnapshots,
    playerFinalPosition: playerFinal + 1,
    playerPoints: playerRow.points,
    playerGF: playerRow.gf,
    playerGA: playerRow.ga,
  };
}
