import React, { useEffect, useState } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import { initData } from './lib/data';

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/game" component={GamePage} />
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
  const [error,     setError]     = useState(false);

  function load() {
    setError(false);
    initData()
      .then(() => setDataReady(true))
      .catch(() => setError(true));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error)     return <ErrorScreen onRetry={load} />;
  if (!dataReady) return <LoadingScreen />;

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Router />
    </WouterRouter>
  );
}

export default App;
