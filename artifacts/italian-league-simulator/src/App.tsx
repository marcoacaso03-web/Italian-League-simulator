import React, { useEffect, useState } from 'react';
import { Switch, Route, Router as WouterRouter, Redirect } from 'wouter';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import LobbyPage from './pages/LobbyPage';
import LobbyCreatePage from './pages/LobbyCreatePage';
import LobbyRoomPage from './pages/LobbyRoomPage';
import LobbyGamePage from './pages/LobbyGamePage';
import Lobby1v1CreatePage from './pages/Lobby1v1CreatePage';
import Lobby1v1JoinPage from './pages/Lobby1v1JoinPage';
import Lobby1v1GamePage from './pages/Lobby1v1GamePage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import { initData } from './lib/data';
import { getLobby } from './lib/lobby';
import type { Lobby } from './lib/lobby';
import { LobbyProvider, useLobby } from './context/LobbyContext';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
      <span className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>⚽</span>
      <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest">Caricamento dati…</p>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
      <span className="text-5xl">⚠️</span>
      <p className="text-red-400 text-sm font-semibold uppercase tracking-widest">Errore nel caricamento dati</p>
      <button onClick={onRetry} className="mt-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors">
        Riprova
      </button>
    </div>
  );
}

function LobbyRoomRoute() {
  const { setLobbyCode, setLobby } = useLobby();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setLobbyCode(code.toUpperCase());
      getLobby(code.toUpperCase()).then((lobby) => {
        if (lobby) setLobby(lobby);
        setReady(true);
      });
    } else {
      setReady(true);
    }
  }, [setLobbyCode, setLobby]);

  if (!ready) return <LoadingScreen />;
  return <LobbyRoomPageWrapper />;
}

function LobbyRoomPageWrapper() {
  const { lobbyCode, lobby, setLobby } = useLobby();
  if (!lobbyCode || !lobby) return <Redirect to="/lobby" />;
  return <LobbyRoomPage lobbyCode={lobbyCode} onStartGame={(l) => setLobby(l)} />;
}

function LobbyGameRoute() {
  const { lobby } = useLobby();
  if (!lobby) return <Redirect to="/lobby" />;
  return <LobbyGamePage lobby={lobby} />;
}

function Lobby1v1CreateRoute() {
  const { setLobby } = useLobby();
  return <Lobby1v1CreatePage onLobbyReady={(l) => setLobby(l)} />;
}

function Lobby1v1JoinRoute() {
  const { setLobby } = useLobby();
  return <Lobby1v1JoinPage onLobbyJoined={(l) => setLobby(l)} />;
}

function Lobby1v1GameRoute() {
  const { lobby, setLobby } = useLobby();
  const [loading, setLoading] = useState(!lobby);

  useEffect(() => {
    if (lobby) { setLoading(false); return; }
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    getLobby(code).then((l) => { if (l) setLobby(l); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-violet-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!lobby) return <Redirect to="/lobby" />;
  return <Lobby1v1GamePage lobby={lobby} />;
}

function Router() {
  const { setLobbyCode, setLobby } = useLobby();

  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/game" component={GamePage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/lobby">
        <LobbyPage
          onLobbyJoined={(code) => {
            setLobbyCode(code);
            window.location.href = `/lobby/room?code=${code}`;
          }}
        />
      </Route>
      <Route path="/lobby/create">
        <LobbyCreatePage
          onLobbyCreated={(code) => {
            setLobbyCode(code);
            window.location.href = `/lobby/room?code=${code}`;
          }}
        />
      </Route>
      <Route path="/lobby/room">
        <LobbyRoomRoute />
      </Route>
      <Route path="/lobby/game">
        <LobbyGameRoute />
      </Route>
      <Route path="/lobby/1v1/create">
        <Lobby1v1CreateRoute />
      </Route>
      <Route path="/lobby/1v1/join">
        <Lobby1v1JoinRoute />
      </Route>
      <Route path="/lobby/1v1/game">
        <Lobby1v1GameRoute />
      </Route>
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route>
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <p className="text-slate-400">Pagina non trovata</p>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  const [dataReady, setDataReady] = useState(false);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    initData().then(() => setDataReady(true)).catch(() => setError(true));
  }

  useEffect(() => { load(); }, []);

  if (error) return <ErrorScreen onRetry={load} />;
  if (!dataReady) return <LoadingScreen />;

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <LobbyProvider>
        <Router />
      </LobbyProvider>
    </WouterRouter>
  );
}

export default App;
