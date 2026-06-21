import { supabase } from './supabase';
import type { LobbyPlayer } from './lobby';

type PlayersCallback = (players: LobbyPlayer[]) => void;
type StatusCallback = (status: string) => void;

/**
 * Sottoscrive ai cambiamenti in tempo reale di una lobby.
 * Restituisce una funzione di cleanup.
 */
export function subscribeToLobby(
  lobbyId: string,
  onPlayersChange: PlayersCallback,
  onStatusChange: StatusCallback
): () => void {
  // Carica inizialmente
  supabase
    .from('lobby_players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .order('joined_at', { ascending: true })
    .then(({ data }) => {
      if (data) onPlayersChange(data);
    });

  // Ascolta cambiamenti giocatori
  const playersChannel = supabase
    .channel(`lobby-p-${lobbyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lobby_players',
        filter: `lobby_id=eq.${lobbyId}`,
      },
      () => {
        supabase
          .from('lobby_players')
          .select('*')
          .eq('lobby_id', lobbyId)
          .order('joined_at', { ascending: true })
          .then(({ data }) => {
            if (data) onPlayersChange(data);
          });
      }
    )
    .subscribe();

  // Ascolta cambiamenti status lobby
  const statusChannel = supabase
    .channel(`lobby-s-${lobbyId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'lobbies',
        filter: `id=eq.${lobbyId}`,
      },
      (payload) => {
        if (payload.new?.status) onStatusChange(payload.new.status);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(playersChannel);
    supabase.removeChannel(statusChannel);
  };
}

/**
 * Sottoscrive al presence tracking (chi è online).
 */
export function subscribeToPresence(
  lobbyId: string,
  playerId: string,
  playerName: string,
  onPresenceChange: (online: { id: string; name: string }[]) => void
): () => void {
  const channel = supabase
    .channel(`lobby-pres-${lobbyId}`, {
      config: {
        presence: { key: playerId },
      },
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const online: { id: string; name: string }[] = [];
      const seen = new Set<string>();
      Object.entries(state).forEach(([key, presences]) => {
        (presences as { player_id?: string; player_name?: string }[]).forEach((p) => {
          if (p.player_id && !seen.has(p.player_id)) {
            seen.add(p.player_id);
            online.push({ id: p.player_id, name: p.player_name ?? '???' });
          }
        });
      });
      onPresenceChange(online);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          player_id: playerId,
          player_name: playerName,
          online_at: new Date().toISOString(),
        });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
