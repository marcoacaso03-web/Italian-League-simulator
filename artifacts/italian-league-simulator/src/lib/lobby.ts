import { supabase } from './supabase';
import type { SetupConfig } from '../pages/GamePage';

// ─── Tipi ───────────────────────────────────────

export interface Lobby {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  mode: 'league' | '1v1_blind';
  status: 'waiting' | 'playing' | 'finished';
  max_players: number;
  config: SetupConfig;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

export interface LobbyPlayer {
  id: string;
  lobby_id: string;
  player_id: string;
  player_name: string;
  is_host: boolean;
  is_ready: boolean;
  final_position?: number;
  final_points?: number;
  final_score?: number;
  slots_json?: unknown;
  overall_json?: unknown;
  submitted_at?: string;
  joined_at: string;
}

// ─── Player ID (anon auth via localStorage) ─────

function getPlayerId(): string {
  let id = localStorage.getItem('ils_player_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ils_player_id', id);
  }
  return id;
}

export { getPlayerId };

// ─── Codice lobby ───────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1 confusion

export function generateLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ─── CRUD Lobby ─────────────────────────────────

export async function createLobby(
  hostName: string,
  mode: 'league' | '1v1_blind',
  config: SetupConfig,
  maxPlayers = 8
): Promise<Lobby> {
  const hostId = getPlayerId();
  const code = generateLobbyCode();

  const { data, error } = await supabase
    .from('lobbies')
    .insert({
      code,
      host_id: hostId,
      host_name: hostName,
      mode,
      config,
      max_players: maxPlayers,
    })
    .select()
    .single();

  if (error) throw error;

  // Host entra automaticamente come giocatore
  await supabase.from('lobby_players').insert({
    lobby_id: data.id,
    player_id: hostId,
    player_name: hostName,
    is_host: true,
    is_ready: false,
  });

  return data;
}

export async function joinLobby(
  code: string,
  playerName: string
): Promise<{ lobby: Lobby; player: LobbyPlayer }> {
  const playerId = getPlayerId();

  // Trova la lobby
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .single();

  if (lobbyError || !lobby) throw new Error('Lobby non trovata');
  if (lobby.status !== 'waiting') throw new Error('La lobby è già in corso o terminata');

  // Controlla posti
  const { count } = await supabase
    .from('lobby_players')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', lobby.id);

  if (count && count >= lobby.max_players) {
    throw new Error('Lobby piena');
  }

  // Controlla se già dentro
  const { data: existing } = await supabase
    .from('lobby_players')
    .select('*')
    .eq('lobby_id', lobby.id)
    .eq('player_id', playerId)
    .maybeSingle();

  if (existing) {
    return { lobby, player: existing };
  }

  // Unisciti
  const { data: player, error: playerError } = await supabase
    .from('lobby_players')
    .insert({
      lobby_id: lobby.id,
      player_id: playerId,
      player_name: playerName,
      is_host: false,
      is_ready: false,
    })
    .select()
    .single();

  if (playerError) throw playerError;
  return { lobby, player };
}

export async function getLobby(code: string): Promise<Lobby | null> {
  const { data } = await supabase
    .from('lobbies')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();
  return data;
}

export async function getLobbyPlayers(lobbyId: string): Promise<LobbyPlayer[]> {
  const { data, error } = await supabase
    .from('lobby_players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function toggleReady(lobbyId: string): Promise<void> {
  const playerId = getPlayerId();
  const { data: current } = await supabase
    .from('lobby_players')
    .select('is_ready')
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId)
    .single();

  await supabase
    .from('lobby_players')
    .update({ is_ready: !current?.is_ready })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);
}

export async function startLobby(lobbyId: string): Promise<void> {
  await supabase
    .from('lobbies')
    .update({ status: 'playing', started_at: new Date().toISOString() })
    .eq('id', lobbyId);
}

export async function submitResult(
  lobbyId: string,
  result: {
    finalPosition: number;
    finalPoints: number;
    finalScore: number;
    slots: unknown;
    overall: unknown;
  }
): Promise<void> {
  const playerId = getPlayerId();
  await supabase
    .from('lobby_players')
    .update({
      final_position: result.finalPosition,
      final_points: result.finalPoints,
      final_score: result.finalScore,
      slots_json: result.slots,
      overall_json: result.overall,
      submitted_at: new Date().toISOString(),
    })
    .eq('lobby_id', lobbyId)
    .eq('player_id', playerId);
}

export async function getLobbyLeaderboard(
  lobbyId: string
): Promise<LobbyPlayer[]> {
  const { data, error } = await supabase
    .from('lobby_players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .not('final_position', 'is', null)
    .order('final_points', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
