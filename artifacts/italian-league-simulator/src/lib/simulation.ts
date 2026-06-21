import { getTop11Average } from './data';
import type { DraftSlot } from './draft';

export interface SerieATeam {
  id: string;
  name: string;
  abbr: string;
  color: string;
  rating: number;
  csvName: string; // nome del club nel CSV/players.json
}

/**
 * Mappatura nome simulazione → nome nel CSV players.json.
 * I club senza corrispondenza nel CSV (Empoli, Venezia, Monza in Serie B 25/26)
 * usano il proprio nome e ricadono sul rating hardcoded di fallback.
 */
const CSV_NAME_MAP: Record<string, string> = {
  Milan:    'Milano FC',
  Verona:   'Hellas Verona',
};

/**
 * Dati base delle 20 squadre Serie A 25/26.
 * Il campo `rating` viene sovrascritto a runtime da `getSERIE_A_2526()`
 * con la media top-11 calcolata dai dati dei giocatori.
 */
const SERIE_A_2526_BASE: SerieATeam[] = [
  { id: 'int', name: 'Inter',       abbr: 'INT', color: '#1d4ed8', rating: 89, csvName: 'Inter' },
  { id: 'nap', name: 'Napoli',      abbr: 'NAP', color: '#2563eb', rating: 87, csvName: 'Napoli' },
  { id: 'mil', name: 'Milan',       abbr: 'MIL', color: '#dc2626', rating: 85, csvName: 'Milano FC' },
  { id: 'juv', name: 'Juventus',    abbr: 'JUV', color: '#e5e7eb', rating: 85, csvName: 'Juventus' },
  { id: 'ata', name: 'Atalanta',    abbr: 'ATA', color: '#1e3a8a', rating: 84, csvName: 'Atalanta' },
  { id: 'laz', name: 'Lazio',       abbr: 'LAZ', color: '#38bdf8', rating: 81, csvName: 'Lazio' },
  { id: 'rom', name: 'Roma',        abbr: 'ROM', color: '#b91c1c', rating: 80, csvName: 'Roma' },
  { id: 'fio', name: 'Fiorentina',  abbr: 'FIO', color: '#7c3aed', rating: 79, csvName: 'Fiorentina' },
  { id: 'bol', name: 'Bologna',     abbr: 'BOL', color: '#92400e', rating: 77, csvName: 'Bologna' },
  { id: 'tor', name: 'Torino',      abbr: 'TOR', color: '#78350f', rating: 75, csvName: 'Torino' },
  { id: 'udi', name: 'Udinese',     abbr: 'UDI', color: '#1f2937', rating: 72, csvName: 'Udinese' },
  { id: 'cag', name: 'Cagliari',    abbr: 'CAG', color: '#b45309', rating: 71, csvName: 'Cagliari' },
  { id: 'par', name: 'Parma',       abbr: 'PAR', color: '#fbbf24', rating: 70, csvName: 'Parma' },
  { id: 'com', name: 'Como',        abbr: 'COM', color: '#155e75', rating: 70, csvName: 'Como' },
  { id: 'gen', name: 'Genoa',       abbr: 'GEN', color: '#991b1b', rating: 69, csvName: 'Genoa' },
  { id: 'lec', name: 'Lecce',       abbr: 'LEC', color: '#f59e0b', rating: 68, csvName: 'Lecce' },
  { id: 'ver', name: 'Verona',      abbr: 'VER', color: '#065f46', rating: 67, csvName: 'Hellas Verona' },
  { id: 'emp', name: 'Empoli',      abbr: 'EMP', color: '#1d4ed8', rating: 66, csvName: 'Empoli' },
  { id: 'ven', name: 'Venezia',     abbr: 'VEN', color: '#1e293b', rating: 65, csvName: 'Venezia' },
];

const SEASON_2526 = '2025-2026';

/** Cache: rating calcolati una volta per tutta la sessione */
let _cachedTeams: SerieATeam[] | null = null;

/**
 * Restituisce le 20 squadre Serie A 25/26 con i rating calcolati
 * dalla media dei 11 giocatori con overall più alto nel club.
 * I club senza dati nel CSV (es. Empoli, Venezia) mantengono il rating hardcoded.
 */
export function getSERIE_A_2526(): SerieATeam[] {
  if (_cachedTeams) return _cachedTeams;

  _cachedTeams = SERIE_A_2526_BASE.map((team) => {
    const avg = getTop11Average(team.csvName, SEASON_2526);
    // Se non trovati dati (avg = 70 fallback), usa il rating hardcoded
    const rating = avg > 70 ? avg : team.rating;
    return { ...team, rating };
  });

  return _cachedTeams;
}

export interface TeamOverall {
  overall: number;
  attack: number;
  midfield: number;
  defence: number;
  gk: number;
}

export function calcTeamOverall(slots: DraftSlot[]): TeamOverall {
  const byCategory: Record<string, number[]> = { ATT: [], MID: [], DEF: [], GK: [] };
  const allRatings: number[] = [];

  for (const s of slots) {
    if (!s.player) continue;
    allRatings.push(s.player.rating);
    const cat = s.player.position_category;
    if (cat in byCategory) byCategory[cat].push(s.player.rating);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    overall:  Math.round(avg(allRatings)),
    attack:   Math.round(avg(byCategory.ATT)),
    midfield: Math.round(avg(byCategory.MID)),
    defence:  Math.round(avg(byCategory.DEF)),
    gk:       Math.round(avg(byCategory.GK)),
  };
}

export interface PreSeasonOdds {
  projectedFinish: number;
  expectedPoints: number;
  scudetto: number;
  top4: number;
  top6: number;
  top10: number;
  relegation: number;
}

export function preSeasonOdds(teamRating: number): PreSeasonOdds {
  const teams = getSERIE_A_2526();
  const leagueRatings = [...teams.map((t) => t.rating), teamRating].sort((a, b) => b - a);
  const rank = leagueRatings.indexOf(teamRating) + 1;
  const leagueAvg = teams.reduce((s, t) => s + t.rating, 0) / teams.length;
  const diff = teamRating - leagueAvg;
  const expectedPoints = Math.round(Math.min(99, Math.max(20, 50 + diff * 1.2)));
  const sig = (x: number, scale = 8) => Math.round(100 / (1 + Math.exp(-x / scale)) * 10) / 10;
  const scudetto   = rank === 1 ? sig(diff, 5) : Math.max(0.1, Math.round(sig(diff - 10, 5) * 10) / 10);
  const top4       = Math.min(99, Math.round(sig(diff - 5, 6) * 10) / 10);
  const top6       = Math.min(99, Math.round(sig(diff - 2, 6) * 10) / 10);
  const top10      = Math.min(99, Math.round(sig(diff + 2, 6) * 10) / 10);
  const relegation = Math.max(0.1, Math.round(sig(-diff - 5, 5) * 10) / 10);
  return { projectedFinish: rank, expectedPoints, scudetto, top4, top6, top10, relegation };
}

export interface TeamStanding {
  teamId: string;
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

export interface GoalEvent {
  scorer: string;
  minute: number;
}

export interface MatchResult {
  opponentId: string;
  opponentName: string;
  opponentAbbr: string;
  opponentColor: string;
  isHome: boolean;
  playerGoals: number;
  opponentGoals: number;
  outcome: 'W' | 'D' | 'L';
  scorers: GoalEvent[];
}

export interface MatchdaySnapshot {
  matchday: number;
  playerPoints: number;
  playerPosition: number;
  playerMatch: MatchResult;
}

export interface SeasonResult {
  standings: TeamStanding[];
  matchdaySnapshots: MatchdaySnapshot[];
  playerFinalPosition: number;
  playerPoints: number;
  playerGF: number;
  playerGA: number;
}

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

function buildScorerPool(slots: DraftSlot[]): string[] {
  const names: string[] = [];
  for (const s of slots) {
    if (!s.player) continue;
    const parts = s.player.name.trim().split(' ');
    names.push(parts[parts.length - 1]);
  }
  return names.length > 0 ? names : ['Anon'];
}

function pickRandInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateScorerEvents(numGoals: number, pool: string[]): GoalEvent[] {
  const events: GoalEvent[] = [];
  const usedMinutes = new Set<number>();
  for (let i = 0; i < numGoals; i++) {
    let minute = pickRandInt(3, 90);
    while (usedMinutes.has(minute)) minute = pickRandInt(3, 90);
    usedMinutes.add(minute);
    const scorer = pool[Math.floor(Math.random() * pool.length)];
    events.push({ scorer, minute });
  }
  return events.sort((a, b) => a.minute - b.minute);
}

function buildRoundRobin(teamIds: string[]): [string, string][][] {
  const n = teamIds.length;
  const rounds: [string, string][][] = [];
  const ids = [...teamIds];

  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      round.push([ids[i], ids[n - 1 - i]]);
    }
    rounds.push(round);
    const last = ids[n - 1];
    for (let i = n - 1; i > 1; i--) ids[i] = ids[i - 1];
    ids[1] = last;
  }

  const returnRounds = rounds.map((r) => r.map(([h, a]) => [a, h] as [string, string]));
  for (let i = returnRounds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [returnRounds[i], returnRounds[j]] = [returnRounds[j], returnRounds[i]];
  }

  return [...rounds, ...returnRounds];
}

export function simulateSeason(slots: DraftSlot[], overall: TeamOverall): SeasonResult {
  const playerRating = overall.overall;
  const scorerPool = buildScorerPool(slots);
  const teams = getSERIE_A_2526();
  const allTeamIds = ['player', ...teams.map((t) => t.id)];

  const standingsMap = new Map<string, TeamStanding>();
  teams.forEach((t) => {
    standingsMap.set(t.id, {
      teamId: t.id, name: t.name, abbr: t.abbr, color: t.color,
      isPlayer: false, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
    });
  });
  standingsMap.set('player', {
    teamId: 'player', name: 'La Tua Squadra', abbr: 'YOU', color: '#10b981',
    isPlayer: true, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
  });

  const getRating = (id: string) =>
    id === 'player' ? playerRating : (teams.find((t) => t.id === id)?.rating ?? 70);

  const schedule = buildRoundRobin(allTeamIds);
  const matchdaySnapshots: MatchdaySnapshot[] = [];

  for (let md = 0; md < 38; md++) {
    const gamesThisRound = schedule[md];
    let playerMatch!: MatchResult;

    for (const [homeId, awayId] of gamesThisRound) {
      const [hg, ag] = matchGoals(getRating(homeId), getRating(awayId));
      const home = standingsMap.get(homeId)!;
      const away = standingsMap.get(awayId)!;
      home.played++; home.gf += hg; home.ga += ag;
      away.played++; away.gf += ag; away.ga += hg;
      if (hg > ag) { home.won++; home.points += 3; away.lost++; }
      else if (hg < ag) { away.won++; away.points += 3; home.lost++; }
      else { home.drawn++; home.points++; away.drawn++; away.points++; }

      const isPlayerHome = homeId === 'player';
      const isPlayerAway = awayId === 'player';
      if (isPlayerHome || isPlayerAway) {
        const pGoals = isPlayerHome ? hg : ag;
        const oGoals = isPlayerHome ? ag : hg;
        const oppId  = isPlayerHome ? awayId : homeId;
        const opp    = teams.find((t) => t.id === oppId);
        const outcome: 'W' | 'D' | 'L' = pGoals > oGoals ? 'W' : pGoals < oGoals ? 'L' : 'D';
        playerMatch = {
          opponentId: oppId,
          opponentName: opp?.name ?? oppId,
          opponentAbbr: opp?.abbr ?? oppId.toUpperCase(),
          opponentColor: opp?.color ?? '#6b7280',
          isHome: isPlayerHome,
          playerGoals: pGoals,
          opponentGoals: oGoals,
          outcome,
          scorers: generateScorerEvents(pGoals, scorerPool),
        };
      }
    }

    const sorted = Array.from(standingsMap.values()).sort(
      (a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga)
    );
    const playerPos = sorted.findIndex((s) => s.isPlayer) + 1;
    const playerPts = standingsMap.get('player')!.points;
    matchdaySnapshots.push({ matchday: md + 1, playerPoints: playerPts, playerPosition: playerPos, playerMatch });
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
