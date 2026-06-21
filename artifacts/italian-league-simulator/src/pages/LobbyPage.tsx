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
      setError(t('lobby_error_code'));
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

  function handleCreate1v1() {
    setLocation('/lobby/1v1/create');
  }

  function handleJoin1v1() {
    setLocation('/lobby/1v1/join');
  }

  // ─── Menu principale ──────────────────────────
  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-2">
            <p className="text-4xl">🎮</p>
            <h1 className="text-2xl font-black text-white">{t('lobby_title')}</h1>
            <p className="text-sm text-slate-400">{t('lobby_subtitle')}</p>
          </div>

          <Link href="/">
            <button className="w-full text-slate-500 hover:text-white transition-colors text-sm">
              ← {t('back_to_home')}
            </button>
          </Link>

          {/* Crea Lobby League */}
          <button
            onClick={handleCreate}
            className="w-full glass rounded-2xl p-5 text-left hover:bg-white/[0.04] transition-all active:scale-[0.98] group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🏠</div>
              <div>
                <p className="text-base font-black text-white">{t('lobby_create')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('lobby_create_desc')}</p>
              </div>
            </div>
          </button>

          {/* Unisciti Lobby League */}
          <button
            onClick={() => setMode('join')}
            className="w-full glass rounded-2xl p-5 text-left hover:bg-white/[0.04] transition-all active:scale-[0.98] group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📱</div>
              <div>
                <p className="text-base font-black text-white">{t('lobby_join')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('lobby_join_desc')}</p>
              </div>
            </div>
          </button>

          {/* Sfida 1v1 */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-2xl">⚔️</div>
              <div>
                <p className="text-base font-black text-white">{t('lobby_1v1')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('lobby_1v1_desc')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate1v1}
                className="flex-1 rounded-xl bg-violet-500/10 border border-violet-500/30 py-3 text-sm font-bold text-violet-300 hover:bg-violet-500/20 transition-all"
              >
                {t('lobby_create')}
              </button>
              <button
                onClick={handleJoin1v1}
                className="flex-1 rounded-xl bg-white/[0.06] border border-white/10 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 transition-all"
              >
                {t('lobby_join_btn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Unisciti a Lobby ─────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <p className="text-4xl">📱</p>
          <h1 className="text-2xl font-black text-white">{t('lobby_join')}</h1>
        </div>

        <button onClick={() => setMode('menu')} className="text-slate-500 hover:text-white transition-colors text-sm">
          ← {t('back_to_home')}
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleJoin} className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 block mb-2">
              {t('lobby_nickname')}
            </label>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 16))}
              placeholder={t('lobby_nickname_placeholder')}
              maxLength={16}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 block mb-2">
              {t('lobby_code')}
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder={t('lobby_code_placeholder')}
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
            {loading ? t('lobby_joining') : t('lobby_join_btn')}
          </button>
        </form>
      </div>
    </div>
  );
}
