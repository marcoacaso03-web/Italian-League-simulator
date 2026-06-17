import type { DraftSlot } from '@/lib/draft';

// ─── Serie A 25/26 — 19 squadre AI (+ player = 20 totali, 38 giornate esatte) ─
//   Il Sassuolo è retrocesso: la tua XI prende il suo posto in Serie A.

export interface SerieATeam {
  id: string;
  name: string;
  abbr: string;
  color: string;
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
];

// ─── Overall ──────────────────────────────────────────────────────────────────

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

  const overall  = Math.round(avg(allRatings));
  const attack   = Math.round(avg(byCategory.ATT));
  const midfield = Math.round(avg(byCategory.MID));
  const defence  = Math.round(avg(byCategory.DEF));
  const gk       = Math.round(avg(byCategory.GK));

  return { overall, attack, midfield, defence, gk };
}

// ─── Pre-season odds ──────────────────────────────────────────────────────────

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
  const leagueRatings = [...SERIE_A_2526.map((t) => t.rating), teamRating].sort((a, b) => b - a);
  const rank = leagueRatings.indexOf(teamRating) + 1;
  const leagueAvg = SERIE_A_2526.reduce((s, t) => s + t.rating, 0) / SERIE_A_2526.length;
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

// ─── Simulation types ─────────────────────────────────────────────────────────

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
  playerMatch: MatchResult; // sempre presente — il player gioca ogni giornata
}

export interface SeasonResult {
  standings: TeamStanding[];
  matchdaySnapshots: MatchdaySnapshot[];
  playerFinalPosition: number;
  playerPoints: number;
  playerGF: number;
  playerGA: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Genera un calendario round-robin bilanciato (algoritmo cerchio fisso).
 * Con 20 squadre → 19 giornate (andata) + 19 (ritorno) = 38 giornate × 10 partite.
 * Il player gioca esattamente una partita per giornata, garantito.
 */
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

// ─── Main simulation ──────────────────────────────────────────────────────────

export function simulateSeason(
  slots: DraftSlot[],
  overall: TeamOverall
): SeasonResult {
  const playerRating = overall.overall;
  const scorerPool = buildScorerPool(slots);

  const allTeamIds = ['player', ...SERIE_A_2526.map((t) => t.id)];

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

  const getRating = (id: string) =>
    id === 'player' ? playerRating : (SERIE_A_2526.find((t) => t.id === id)?.rating ?? 70);

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
        const opp    = SERIE_A_2526.find((t) => t.id === oppId);
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
