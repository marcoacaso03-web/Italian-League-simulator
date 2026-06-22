import React, { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { createLobby, getPlayerId, type Lobby } from '../lib/lobby';
import { subscribeToLobby } from '../lib/lobbyRealtime';

interface Props { onLobbyReady: (lobby: Lobby) => void; }

export default function Lobby1v1CreatePage({ onLobbyReady }: Props) {
  const { t } = useTranslation();
  const [hostName, setHostName] = useState('');
  const [eraPreset, setEraPreset] = useState<'all' | '2000s' | '2010s' | 'modern'>('all');
  const [eraFrom, setEraFrom] = useState(1996);
  const [eraTo, setEraTo] = useState(2025);
  const [creating, setCreating] = useState(false);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ERA_PRESETS = [
    { id: 'all' as const, labelKey: 'lobby_era_all', from: 1996 },
    { id: '2000s' as const, labelKey: 'lobby_era_2000s', from: 2000 },
    { id: '2010s' as const, labelKey: 'lobby_era_2010s', from: 2010 },
    { id: 'modern' as const, labelKey: 'lobby_era_modern', from: 2016 },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName.trim()) { setError(t('lobby_error_code')); return; }
    setCreating(true); setError(null);
    const config = { difficulty: 'hard' as const, showRatings: 'off' as const, draftMode: 'squad_first' as const, ratingsMode: 'career' as const, eraPreset, eraFrom, eraTo, formation: '4-3-3', leagueId: 'serie-a' };
    try {
      const created = await createLobby(hostName.trim(), '1v1_blind', config, 2);
      setLobby(created);
      const joinUrl = `${window.location.origin}/lobby/1v1/join?code=${created.code}`;
      const qr = await QRCode.toDataURL(joinUrl, { width: 200, margin: 2, color: { dark: '#8b5cf6', light: '#0a0a0f' } });
      setQrDataUrl(qr);
      subscribeToLobby(created.id, (players) => { if (players.length >= 2) onLobbyReady(created); }, () => {});
    } catch (err: unknown) { setError(err instanceof Error ? err.message : t('lobby_unknown_error')); }
    finally { setCreating(false); }
  }

  function handleCopy() { if (lobby) { navigator.clipboard.writeText(lobby.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); } }

  if (lobby) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-3">
            <p className="text-4xl">⚔️</p>
            <h1 className="text-2xl font-black text-white">{t('lobby_1v1')}</h1>
            <p className="text-sm text-slate-400">{t('lobby_waiting_opponent')}</p>
          </div>
          <div className="text-center space-y-3">
            <button onClick={handleCopy} className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-xl px-5 py-3 hover:bg-violet-500/20 transition-all">
              <span className="text-2xl font-black text-violet-400 tracking-[0.2em] font-mono">{lobby.code}</span>
              <span className="text-xs text-violet-400">{copied ? '✅' : '📋'}</span>
            </button>
            {qrDataUrl && (<div className="flex justify-center"><div className="bg-white rounded-2xl p-3 inline-block"><img src={qrDataUrl} alt="QR" className="w-40 h-40" /></div></div>)}
            <p className="text-xs text-slate-500">{t('lobby_share')}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{t('lobby_challenge_rules')}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">🔴 {t('lobby_hard_mode')}</span>
              <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">🔒 {t('lobby_blind_mode')}</span>
              <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">📐 4-3-3</span>
              <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">📅 {eraFrom}–{eraTo}</span>
            </div>
          </div>
          <div className="text-center py-6">
            <div className="inline-flex items-center gap-3 bg-violet-500/5 rounded-2xl px-6 py-4">
              <div className="w-3 h-3 rounded-full bg-violet-400 animate-pulse" />
              <p className="text-sm text-violet-300">{t('lobby_waiting_opponent')}</p>
            </div>
          </div>
          <Link href="/lobby">
            <button className="w-full rounded-xl bg-white/[0.06] border border-white/10 py-3 text-sm font-bold text-slate-400 hover:text-white transition-colors">← {t('lobby_cancel')}</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <p className="text-4xl">⚔️</p>
          <h1 className="text-2xl font-black text-white">{t('lobby_1v1')}</h1>
          <p className="text-sm text-slate-400">{t('lobby_1v1_desc')}</p>
        </div>
        <Link href="/lobby">
          <button className="text-slate-500 hover:text-white transition-colors text-sm">← {t('lobby_cancel')}</button>
        </Link>
        {error && (<div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"><p className="text-sm text-red-400">{error}</p></div>)}
        <form onSubmit={handleCreate} className="space-y-4">
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('lobby_host_nickname')}</p>
            <input type="text" value={hostName} onChange={(e) => setHostName(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 16))} placeholder={t('lobby_host_nickname_placeholder')} maxLength={16} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
          </section>
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('lobby_era')}</p>
            <div className="grid grid-cols-4 gap-2">
              {ERA_PRESETS.map((ep) => (
                <button key={ep.id} type="button" onClick={() => { setEraPreset(ep.id); setEraFrom(ep.from); setEraTo(2025); }}
                  className={`rounded-xl border-2 py-2 px-1 text-center transition-all ${eraPreset === ep.id ? 'border-violet-500/60 bg-violet-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}
                >
                  <p className={`text-xs font-bold ${eraPreset === ep.id ? 'text-violet-300' : 'text-slate-400'}`}>{t(ep.labelKey)}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center mt-2">{eraFrom}–{eraTo}</p>
          </section>
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{t('lobby_rules_fixed')}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 text-red-300">🔴 {t('lobby_hard_mode')}</span>
              <span className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1 text-purple-300">🔒 {t('lobby_blind_mode')}</span>
              <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">📐 4-3-3</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">{t('lobby_same_teams')}</p>
          </section>
          <button type="submit" disabled={creating || !hostName.trim()} className="w-full rounded-2xl bg-violet-500 py-5 text-lg font-black text-white hover:bg-violet-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {creating ? '⏳ ' + t('lobby_creating_text') : '⚔️ ' + t('lobby_create_btn_text')}
          </button>
        </form>
      </div>
    </div>
  );
}
