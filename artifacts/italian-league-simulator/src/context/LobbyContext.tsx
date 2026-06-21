import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Lobby } from '../lib/lobby';

interface LobbyContextValue {
  lobby: Lobby | null;
  lobbyCode: string | null;
  setLobby: (lobby: Lobby | null) => void;
  setLobbyCode: (code: string | null) => void;
  clearLobby: () => void;
}

const LobbyContext = createContext<LobbyContextValue>({
  lobby: null,
  lobbyCode: null,
  setLobby: () => {},
  setLobbyCode: () => {},
  clearLobby: () => {},
});

export function LobbyProvider({ children }: { children: React.ReactNode }) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);

  const clearLobby = useCallback(() => {
    setLobby(null);
    setLobbyCode(null);
  }, []);

  return (
    <LobbyContext.Provider value={{ lobby, lobbyCode, setLobby, setLobbyCode, clearLobby }}>
      {children}
    </LobbyContext.Provider>
  );
}

export function useLobby() {
  return useContext(LobbyContext);
}
