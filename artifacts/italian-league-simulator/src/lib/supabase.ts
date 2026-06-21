import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://baocxhhsqavvayaanwmf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_u7l3j6qyuc7mYdj-9Nc9xw_hkcl6a9e';

export const supabase = createClient(supabaseUrl, supabaseKey);

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

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('score', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function addLeaderboardEntry(data: {
  nickname: string;
  uid?: string | null;
  score: number;
  overall: number;
  points: number;
  position: number;
  formation: string;
  difficulty: string;
  show_ratings: string;
  era_from: number;
  era_to: number;
}): Promise<void> {
  const { error } = await supabase.from('leaderboard').insert(data);
  if (error) throw error;
}
