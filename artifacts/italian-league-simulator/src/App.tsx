import React, { useEffect, useState } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import { initData } from './lib/data';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
      <span className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>⚽</span>
      <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest">Caricamento dati…</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/game" component={GamePage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
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

  useEffect(() => {
    initData().then(() => setDataReady(true));
  }, []);

  if (!dataReady) return <LoadingScreen />;

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Router />
    </WouterRouter>
  );
}

export default App;
