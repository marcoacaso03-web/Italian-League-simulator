export interface LeaderboardEntry {
  id: number;
  nickname: string;
  score: number;
  overall: number;
  points: number;
  position: number;
  formation: string;
  difficulty: string;
  show_ratings: string;
  era_from: number;
  era_to: number;
  created_at: string;
}

export interface ScoreParams {
  points: number;
  position: number;
  overall: number;
  difficulty: 'easy' | 'normal' | 'hard';
  showRatings: 'on' | 'off';
}

export function calcScore(p: ScoreParams): number {
  let mult: number;
  if (p.difficulty === 'hard') {
    mult = 1.8;
  } else if (p.difficulty === 'normal' && p.showRatings === 'off') {
    mult = 1.5;
  } else if (p.difficulty === 'normal') {
    mult = 1.0;
  } else if (p.showRatings === 'off') {
    mult = 1.0;
  } else {
    mult = 0.5;
  }
  return Math.round(p.points * 100 + (20 - p.position) * 50 + p.overall * mult);
}

const LS_KEY = 'ils_user_code';

export function getUserCode(): string | null {
  return localStorage.getItem(LS_KEY);
}

export function createAndSaveCode(nickname: string): string {
  const clean = nickname.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'PLAYER';
  const digits = String(Math.floor(Math.random() * 9000) + 1000);
  const code = `${clean}#${digits}`;
  localStorage.setItem(LS_KEY, code);
  return code;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch('/api/leaderboard');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<LeaderboardEntry[]>;
}

export async function submitScore(params: {
  nickname: string;
  uid?: string;
  score: number;
  overall: number;
  points: number;
  position: number;
  formation: string;
  difficulty: string;
  showRatings: string;
  eraFrom: number;
  eraTo: number;
}): Promise<{ inserted: boolean; updated?: boolean; reason?: string }> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname:     params.nickname,
      uid:          params.uid ?? null,
      score:        params.score,
      overall:      params.overall,
      points:       params.points,
      position:     params.position,
      formation:    params.formation,
      difficulty:   params.difficulty,
      show_ratings: params.showRatings,
      era_from:     params.eraFrom,
      era_to:       params.eraTo,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ inserted: boolean; updated?: boolean; reason?: string }>;
}

export async function checkInTop50(score: number): Promise<boolean> {
  try {
    const board = await getLeaderboard();
    if (board.length < 50) return true;
    const minScore = Math.min(...board.map((e) => e.score));
    return score > minScore;
  } catch {
    return true;
  }
}

export function difficultyLabel(d: string): string {
  if (d === 'hard')   return '🔴 Difficile';
  if (d === 'normal') return '🟡 Normale';
  return '🟢 Facile';
}
