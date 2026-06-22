import { supabase } from './supabase';
import type { LobbyPlayer } from './lobby';

/**
 * Subscribe to lobby player changes via Supabase Realtime.
 * Calls onPlayersChanged whenever lobby_players rows change.
 * Returns an unsubscribe function.
 */
export function subscribeToLobby(
  lobbyId: string,
  onPlayersChanged: (players: LobbyPlayer[]) => void,
  onStatusChange?: (status: string) => void,
): () => void {
  // Initial fetch
  supabase
    .from('lobby_players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .order('joined_at', { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        console.error('subscribeToLobby initial fetch error:', error);
        return;
      }
      if (data) {
        onPlayersChanged(data as LobbyPlayer[]);
      }
    });

  const channel = supabase
    .channel(`lobby-players-${lobbyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lobby_players',
        filter: `lobby_id=eq.${lobbyId}`,
      },
      async () => {
        const { data, error } = await supabase
          .from('lobby_players')
          .select('*')
          .eq('lobby_id', lobbyId)
          .order('joined_at', { ascending: true });

        if (error) {
          console.error('subscribeToLobby realtime fetch error:', error);
          return;
        }
        if (data) {
          onPlayersChanged(data as LobbyPlayer[]);
        }
      }
    )
    .subscribe(() => {
      // Also subscribe to lobby status changes
      if (onStatusChange) {
        supabase
          .channel(`lobby-status-${lobbyId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'lobbies',
              filter: `id=eq.${lobbyId}`,
            },
            (payload) => {
              if (payload.new && typeof payload.new === 'object' && 'status' in payload.new) {
                onStatusChange((payload.new as { status: string }).status);
              }
            }
          )
          .subscribe();
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to presence (online status) for a lobby.
 * Uses Supabase Realtime Presence API.
 * Returns an unsubscribe function.
 */
export function subscribeToPresence(
  lobbyId: string,
  playerId: string,
  playerName: string,
  setOnline: (players: { id: string; name: string }[]) => void,
): () => void {
  const channel = supabase.channel(`lobby-presence-${lobbyId}`, {
    config: {
      presence: {
        key: playerId,
      },
    },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const players: { id: string; name: string }[] = [];
      for (const key of Object.keys(state)) {
        const presences = state[key] as { player_id?: string; player_name?: string }[];
        for (const p of presences) {
          if (p.player_name) players.push({ id: key, name: p.player_name });
        }
      }
      setOnline(players);
    })
    .on('presence', { event: 'join' }, () => {
      const state = channel.presenceState();
      const players: { id: string; name: string }[] = [];
      for (const key of Object.keys(state)) {
        const presences = state[key] as { player_id?: string; player_name?: string }[];
        for (const p of presences) {
          if (p.player_name) players.push({ id: key, name: p.player_name });
        }
      }
      setOnline(players);
    })
    .on('presence', { event: 'leave' }, () => {
      const state = channel.presenceState();
      const players: { id: string; name: string }[] = [];
      for (const key of Object.keys(state)) {
        const presences = state[key] as { player_id?: string; player_name?: string }[];
        for (const p of presences) {
          if (p.player_name) players.push({ id: key, name: p.player_name });
        }
      }
      setOnline(players);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ player_id: playerId, player_name: playerName });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
