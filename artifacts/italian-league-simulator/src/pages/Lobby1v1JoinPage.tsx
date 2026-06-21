import React, { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { joinLobby, type Lobby } from '../lib/lobby';

interface Props { onLobbyJoined: (lobby: Lobby) => void; }

export default function Lobby1v1JoinPage({ onLobbyJoined }: Props) {
  const { t } = useTranslation();
  const [playerName, setPlayerName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim() || !code.trim()) { setError(t('lobby_error_code')); return; }
    setLoading(true); setError(null);
    try { const { lobby } = await joinLobby(code.trim(), playerName.trim()); onLobbyJoined(lobby); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : t('lobby_unknown_error')); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <p className="text-4xl">⚔️</p>
          <h1 className="text-2xl font-black text-white">{t('lobby_1v1')}</h1>
          <p className="text-sm text-slate-400">{t('lobby_join_desc')}</p>
        </div>
        <Link href="/lobby">
          <button className="text-slate-500 hover:text-white transition-colors text-sm">← {t('lobby_cancel')}</button>
        </Link>
        {error && (<div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"><p className="text-sm text-red-400">{error}</p></div>)}
        <form onSubmit={handleJoin} className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 block mb-2">{t('lobby_nickname')}</label>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 16))} placeholder={t('lobby_nickname_placeholder')} maxLength={16} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500 block mb-2">{t('lobby_code')}</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder={t('lobby_code_placeholder')} maxLength={6} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-lg tracking-[0.3em] text-center placeholder-slate-600 focus:outline-none focus:border-violet-500/50 uppercase font-mono" />
          </div>
          <button type="submit" disabled={loading || !playerName.trim() || !code.trim()} className="w-full rounded-xl bg-violet-500 py-4 text-base font-black text-white hover:bg-violet-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? '⏳ ' + t('lobby_joining') : '⚔️ ' + t('lobby_join_btn')}
          </button>
        </form>
      </div>
    </div>
  );
}
