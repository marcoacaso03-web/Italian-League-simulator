import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { joinLobby, getPlayerId } from '../lib/lobby';

interface LobbyPageProps {
  onLobbyJoined: (code: string) => void;
}

export default function LobbyPage({ onLobbyJoined }: LobbyPageProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim()) {
      setError('Inserisci codice e nickname');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await joinLobby(joinCode.trim(), joinName.trim());
      onLobbyJoined(joinCode.trim().toUpperCase());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setLocation('/lobby/create');
  }

  // ─── Menu principale ──────────────────────────
  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <p className="text-4xl">🎮</p>
            <h1 className="text-2xl font-black text-white">Giochi con Amici</h1>
            <p className="text-sm text-slate-400">Crea o unisciti a una lobby per giocare insieme</p>
          </div>

          <Link href="/">
            <button className="w-full text-slate-500 hover:text-white transition-colors text-sm">
              ← Torna alla Home
            </button>
          </Link>

          {/* Crea Lobby */}
          <button
            onClick={handleCreate}
            className="w-full glass rounded-2xl p-6 text-left space-y-2 hover:bg-white/[0.04] transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏠</span>
              <div>
                <p className="text-lg font-black text-white">Crea Lobby</p>
                <p className="text-xs text-slate-400">Configura le regole e crea una lobby per i tuoi amici</p>
              </div>
            </div>
          </button>

          {/* Unisciti */}
          <button
            onClick={() => setMode('join')}
            className="w-full glass rounded-2xl p-6 text-left space-y-2 hover:bg-white/[0.04] transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">📱</span>
              <div>
                <p className="text-lg font-black text-white">Unisciti a Lobby</p>
                <p className="text-xs text-slate-400">Inserisci il codice o scansiona il QR code</p>
              </div>
            </div>
          </button>

          {/* Sfida 1v1 (placeholder) */}
          <button
            disabled
            className="w-full glass rounded-2xl p-6 text-left space-y-2 opacity-40 cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <p className="text-lg font-black text-white">Sfida 1v1 Blind</p>
                <p className="text-xs text-slate-400">Stesse squadre, chi fa più punti vince! (presto)</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ─── Unisciti a Lobby ─────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-4xl">📱</p>
          <h1 className="text-2xl font-black text-white">Unisciti a Lobby</h1>
        </div>

        <Link href="/lobby">
          <button className="text-slate-500 hover:text-white transition-colors text-sm">
            ← Indietro
          </button>
        </Link>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleJoin} className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 block mb-2">
              Nickname
            </label>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 16))}
              placeholder="Il tuo nome"
              maxLength={16}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 block mb-2">
              Codice Lobby
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-lg tracking-[0.3em] text-center placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 uppercase font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !joinCode.trim() || !joinName.trim()}
            className="w-full rounded-xl bg-emerald-500 py-4 text-base font-black text-black hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Unisco...' : '🚪 Entra'}
          </button>
        </form>
      </div>
    </div>
  );
}
