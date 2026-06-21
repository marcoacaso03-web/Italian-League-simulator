import { getLeaderboard, addLeaderboardEntry, type LeaderboardEntry } from './supabase';

export type { LeaderboardEntry };

export interface ScoreParams {
  points: number;
  position: number;
  overall: number;
  difficulty: 'easy' | 'normal' | 'hard';
  showRatings: 'on' | 'off';
}

const DIFFICULTY_MULTIPLIER: Record<string, Record<string, number>> = {
  hard:   { on: 1.8, off: 1.8 },
  normal: { on: 1.0, off: 1.5 },
  easy:   { on: 0.5, off: 1.0 },
};

export function calcScore(p: ScoreParams): number {
  const mult = DIFFICULTY_MULTIPLIER[p.difficulty]?.[p.showRatings] ?? 1.0;
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

export async function submitScore(params: {
  nickname: string;
  uid?: string | null;
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
  try {
    await addLeaderboardEntry({
      nickname:    params.nickname,
      uid:         params.uid ?? null,
      score:       params.score,
      overall:     params.overall,
      points:      params.points,
      position:    params.position,
      formation:   params.formation,
      difficulty:  params.difficulty,
      show_ratings: params.showRatings,
      era_from:    params.eraFrom,
      era_to:      params.eraTo,
    });
    return { inserted: true };
  } catch (e) {
    console.error('[Leaderboard] submitScore failed:', e);
    throw e;
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return getLeaderboard();
}

export function difficultyLabel(d: string): string {
  if (d === 'hard')   return 'hard';
  if (d === 'normal') return 'normal';
  return 'easy';
}
