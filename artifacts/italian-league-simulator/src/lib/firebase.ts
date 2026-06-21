// Firebase Auth disabled — using Supabase for leaderboard
// This file is kept for reference but no longer imports firebase/firestore

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
  uid?: string | null;
  created_at?: string;
}

// Stub functions — leaderboard now uses supabase.ts
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  throw new Error('Use supabase.ts for leaderboard operations');
}

export async function addLeaderboardEntry(): Promise<void> {
  throw new Error('Use supabase.ts for leaderboard operations');
}

export function getFirebaseAuth() { return null; }
export function getDb() { return null; }
export async function signInWithGoogle(): Promise<null> { return null; }
export async function signOut(): Promise<void> {}
export function onAuthStateChanged() { return () => {}; }
export type { LeaderboardEntry as User };
