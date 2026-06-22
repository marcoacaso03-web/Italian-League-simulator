// lib/simulation.ts
// Engine di simulazione generico per qualsiasi campionato.
//
// Usa getActiveLeagueClubs() per le squadre AI.
// Calcola rating club da player data (top-11 avg) se disponibile,
// altrimenti usa il rating hardcoded da clubs.json.

import type { DraftSlot } from './draft';
export interface TeamOverall {
  overall: number;
  attack: number;
  midfield: number;
  defence: number;
  gk: number;
}

import {
  getActiveLeagueClubs,
  getActiveLeagueMeta,
  setActiveLeague,
} from './data';

export interface TeamStanding { teamId: string; name: string; abbr: string; color: string; isPlayer: boolean; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; }
export interface GoalEvent { scorer: string; minute: number; }
export interface MatchResult { opponentId: string; opponentName: string; opponentAbbr: string; opponentColor: string; isHome: boolean; playerGoals: number; opponentGoals: number; outcome: 'W'|'D'|'L'; scorers: GoalEvent[]; }
export interface MatchdaySnapshot { matchday: number; playerPoints: number; playerPosition: number; playerMatch: MatchResult; }
export interface SeasonResult { standings: TeamStanding[]; matchdaySnapshots: MatchdaySnapshot[]; playerFinalPosition: number; playerPoints: number; playerGF: number; playerGA: number; }
export interface PreSeasonOdds { projectedFinish: number; expectedPoints: number; scudetto: number; top4: number; top6: number; top10: number; relegation: number; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Colori hardcoded per i club (fallback)
// ---------------------------------------------------------------------------

function getClubColor(clubId: string): string {
  const COLORS: Record<string, string> = {
    inter: '#1d4ed8', napoli: '#2563eb', milan: '#dc2626', juventus: '#e5e7eb',
    atalanta: '#1e3a8a', roma: '#b91c1c', lazio: '#38bdf8', fiorentina: '#7c3aed',
    bologna: '#92400e', torino: '#78350f', udinese: '#1f2937', cagliari: '#b45309',
    parma: '#fbbf24', como: '#155e75', genoa: '#991b1b', lecce: '#f59e0b',
    verona: '#065f46', cremonese: '#c0392b', pisa: '#2c3e50', sassuolo: '#008f68',
    'manchester-city': '#6CABDD', arsenal: '#EF0107', liverpool: '#C8102E',
    chelsea: '#034694', 'manchester-united': '#DA291C', tottenham: '#132257',
    newcastle: '#241F20', 'aston-villa': '#95BFE5', brighton: '#0057B8',
    'west-ham': '#7A263A', 'crystal-palace': '#1B458F', fulham: '#000000',
    wolverhampton: '#FDB913', bournemouth: '#DA291C', 'nottingham-forest': '#E5322D',
    everton: '#003399', brentford: '#E30613', southampton: '#D71920',
    leicester: '#003090', ipswich: '#3A64A3',
    'real-madrid': '#FEBE10', barcelona: '#A50044', 'atletico-madrid': '#CB3524',
    'real-sociedad': '#143C4B', 'athletic-bilbao': '#EE2523', villarreal: '#FFE667',
    'real-betis': '#00954C', sevilla: '#D4021D', valencia: '#FF7C00',
    'celta-vigo': '#6AADB6', getafe: '#0B5EBE', osasuna: '#D91A20',
    girona: '#CD2534', mallorca: '#E20613', 'rayo-vallecano': '#FFFFFF',
    'las-palmas': '#FFDE00', alaves: '#004B8D', cadiz: '#FAB800',
    granada: '#E42E2D', almeria: '#FFCShape',
    psg: '#004170', marseille: '#2FAEE0', lyon: '#1B3F8B', monaco: '#E5293A',
    lille: '#E3001B', nice: '#000000', rennes: '#E03C31', lens: '#FFE500',
    strasbourg: '#C7152A', toulouse: '#532A91', montpellier: '#FF6600',
    nantes: '#007749', brest: '#E4012B', reims: '#2B5EB0',
    lorient: '#EF7C1C', 'le-havre': '#1E3A5F', metz: '#C71528', clermont: '#CC0808',
    'bayern-munich': '#DC052D', 'borussia-dortmund': '#FDE100', 'rb-leipzig': '#DD0741',
    'bayer-leverkusen': '#E32221', 'eintracht-frankfurt': '#E1000F', wolfsburg: '#65B32E',
    freiburg: '#000000', stuttgart: '#E32219', hoffenheim: '#1B63D7',
    'werder-bremen': '#1D9053', mainz: '#C3141E', augsburg: '#BA3733',
    'borussia-mgladbach': '#000000', 'union-berlin': '#EB212B', bochum: '#005CA9',
    heidenheim: '#B8192D', darmstadt: '#1C2B4A', koln: '#ED3237',
  };
  return COLORS[clubId] ?? '#6b7280';
}

// ---------------------------------------------------------------------------
// calcTeamOverall (per SquadPreviewScreen)
// ---------------------------------------------------------------------------

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
    arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  return {
    overall:  avg(allRatings),
    attack:   avg(byCategory.ATT),
    midfield: avg(byCategory.MID),
    defence:  avg(byCategory.DEF),
    gk:       avg(byCategory.GK),
  };
}

// ---------------------------------------------------------------------------
// Inizializzazione league
// ---------------------------------------------------------------------------

export async function initLeague(
  leagueId: string,
  overall: number,
): Promise<Array<{ id: string; name: string; abbr: string; color: string; rating: number }>> {
  await setActiveLeague(leagueId);
  const clubs = getActiveLeagueClubs();
  const meta = getActiveLeagueMeta();
  const season = meta?.season ?? '2025-2026';

  return clubs.map((club) => {
    const rating = club.rating;
    const abbr = club.name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
    return {
      id: club.id,
      name: club.name,
      abbr,
      color: getClubColor(club.id),
      rating,
    };
  });
}

// ---------------------------------------------------------------------------
// Pre-season odds
// ---------------------------------------------------------------------------

export function preSeasonOdds(teamRating: number, _leagueId?: string): PreSeasonOdds {
  const aiTeams = getActiveLeagueClubs();
  const season = getActiveLeagueMeta()?.season ?? '2025-2026';
  const leagueRatings = [
    ...aiTeams.map((t) => t.rating),
    teamRating,
  ].sort((a, b) => b - a);

  const rank = leagueRatings.indexOf(teamRating) + 1;
  const leagueAvg = leagueRatings.reduce((s, r) => s + r, 0) / leagueRatings.length;
  const diff = teamRating - leagueAvg;
  const expectedPoints = Math.round(Math.min(99, Math.max(20, 50 + diff * 1.2)));
  const sig = (x: number, scale = 8) => Math.round(100 / (1 + Math.exp(-x / scale)) * 10) / 10;

  return {
    projectedFinish: rank,
    expectedPoints,
    scudetto:   rank === 1 ? sig(diff, 5) : Math.max(0.1, sig(diff - 10, 5)),
    top4:       Math.min(99, sig(diff - 5, 6)),
    top6:       Math.min(99, sig(diff - 2, 6)),
    top10:      Math.min(99, sig(diff + 2, 6)),
    relegation: Math.max(0.1, sig(-diff - 5, 5)),
  };
}

// ---------------------------------------------------------------------------
// Simulazione stagione
// ---------------------------------------------------------------------------

export async function simulateSeason(
  slots: DraftSlot[],
  overall: number,
  leagueId: string = 'serie-a',
): Promise<SeasonResult> {
  const playerRating = overall;
  const scorerPool = buildScorerPool(slots);

  const aiTeams = await initLeague(leagueId, playerRating);
  const PLAYER_TEAM_ID = 'player';
  const allTeamIds = [PLAYER_TEAM_ID, ...aiTeams.map((t) => t.id)];

  const standingsMap = new Map<string, TeamStanding>();
  aiTeams.forEach((t) => {
    standingsMap.set(t.id, {
      teamId: t.id, name: t.name, abbr: t.abbr, color: t.color,
      isPlayer: false, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
    });
  });
  standingsMap.set(PLAYER_TEAM_ID, {
    teamId: PLAYER_TEAM_ID, name: 'La Tua Squadra', abbr: 'YOU', color: '#10b981',
    isPlayer: true, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
  });

  const getRating = (id: string) =>
    id === PLAYER_TEAM_ID ? playerRating : (aiTeams.find((t) => t.id === id)?.rating ?? 70);

  const schedule = buildRoundRobin(allTeamIds);
  const matchdaySnapshots: MatchdaySnapshot[] = [];
  const numMatchdays = aiTeams.length === 18 ? 34 : 38;

  for (let md = 0; md < numMatchdays; md++) {
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

      const isPlayerHome = homeId === PLAYER_TEAM_ID;
      const isPlayerAway = awayId === PLAYER_TEAM_ID;
      if (isPlayerHome || isPlayerAway) {
        const pGoals = isPlayerHome ? hg : ag;
        const oGoals = isPlayerHome ? ag : hg;
        const oppId  = isPlayerHome ? awayId : homeId;
        const opp    = aiTeams.find((t) => t.id === oppId);
        const outcome: 'W'|'D'|'L' = pGoals > oGoals ? 'W' : pGoals < oGoals ? 'L' : 'D';
        playerMatch = {
          opponentId: oppId, opponentName: opp?.name ?? oppId,
          opponentAbbr: opp?.abbr ?? oppId.toUpperCase(), opponentColor: opp?.color ?? '#6b7280',
          isHome: isPlayerHome, playerGoals: pGoals, opponentGoals: oGoals, outcome,
          scorers: generateScorerEvents(pGoals, scorerPool),
        };
      }
    }

    const sorted = Array.from(standingsMap.values()).sort(
      (a, b) => b.points - a.points || ((b.gf - b.ga) - (a.gf - a.ga))
    );
    matchdaySnapshots.push({
      matchday: md + 1,
      playerPoints: standingsMap.get('player')!.points,
      playerPosition: sorted.findIndex((s) => s.isPlayer) + 1,
      playerMatch,
    });
  }

  const finalStandings = Array.from(standingsMap.values()).sort(
    (a, b) => b.points - a.points || ((b.gf - b.ga) - (a.gf - a.ga))
  );
  const playerRow = standingsMap.get('player')!;

  return {
    standings: finalStandings,
    matchdaySnapshots,
    playerFinalPosition: finalStandings.findIndex((s) => s.isPlayer) + 1,
    playerPoints: playerRow.points,
    playerGF: playerRow.gf,
    playerGA: playerRow.ga,
  };
}
