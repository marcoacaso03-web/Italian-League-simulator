import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { createLobby, getPlayerId, type Lobby, type LobbyPlayer } from '../lib/lobby';
import { subscribeToLobby } from '../lib/lobbyRealtime';

const LEAGUES_1V1 = [
  { id: 'serie-a',        name: 'Serie A',        flag: '🇮🇹' },
  { id: 'premier-league',  name: 'Premier League',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'la-liga',        name: 'La Liga',         flag: '🇪🇸' },
  { id: 'ligue-1',        name: 'Ligue 1',         flag: '🇫🇷' },
  { id: 'bundesliga',     name: 'Bundesliga',      flag: '🇩🇪' },
];

interface Props { onLobbyReady: (lobby: Lobby) => void; }

export default function Lobby1v1CreatePage({ onLobbyReady }: Props) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [hostName, setHostName] = useState('');
  const [eraPreset, setEraPreset] = useState<'all' | '2000s' | '2010s' | 'modern'>('all');
  const [eraFrom, setEraFrom] = useState(2004);
  const [eraTo, setEraTo] = useState(2025);
  const [leagueId, setLeagueId] = useState('serie-a');
  const [creating, setCreating] = useState(false);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onLobbyReadyRef = useRef(onLobbyReady);
  onLobbyReadyRef.current = onLobbyReady;

  const ERA_PRESETS = [
    { id: 'all' as const, labelKey: 'lobby_era_all', from: 2004 },
    { id: '2000s' as const, labelKey: 'lobby_era_2000s', from: 2004 },
    { id: '2010s' as const, labelKey: 'lobby_era_2010s', from: 2010 },
    { id: 'modern' as const, labelKey: 'lobby_era_modern', from: 2016 },
  ];

  // Subscribe to lobby updates when lobby is created
  useEffect(() => {
    if (!lobby) return;

    const unsub = subscribeToLobby(
      lobby.id,
      (updatedPlayers) => {
        setPlayers(updatedPlayers);
        if (updatedPlayers.length >= 2) {
          onLobbyReadyRef.current(lobby);
          navigate(`/lobby/1v1/game?code=${lobby.code}`, { replace: true });
        }
      },
      () => {}
    );

    return () => { unsub(); };
  }, [lobby, navigate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return; // Previene doppio click
    if (!hostName.trim()) { setError(t('lobby_error_code')); return; }
    setCreating(true); setError(null);
    const config = {
      difficulty: 'hard' as const,
      showRatings: 'off' as const,
      draftMode: 'squad_first' as const,
      ratingsMode: 'career' as const,
      eraPreset,
      eraFrom,
      eraTo,
      formation: '4-3-3',
      leagueId,
    };
    try {
      const created = await createLobby(hostName.trim(), '1v1_blind', config, 2);
      setLobby(created);
      const joinUrl = `${window.location.origin}/lobby/1v1/join?code=${created.code}`;
      const qr = await QRCode.toDataURL(joinUrl, { width: 200, margin: 2, color: { dark: '#8b5cf6', light: '#0a0a0f' } });
      setQrDataUrl(qr);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('lobby_unknown_error'));
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    if (lobby) {
      navigator.clipboard.writeText(lobby.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
  }

  // Waiting for opponent view
  if (lobby) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-3">
            <p className="text-4xl">⚔️</p>
            <h1 className="text-2xl font-black text-white">{t('lobby_1v1')}</h1>
          </div>

          {/* Code + QR */}
          <div className="text-center space-y-3">
            <button onClick={handleCopy} className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-xl px-5 py-3 hover:bg-violet-500/20 transition-all">
              <span className="text-2xl font-black text-violet-400 tracking-[0.2em] font-mono">{lobby.code}</span>
              <span className="text-xs text-violet-400">{copied ? '✅' : '📋'}</span>
            </button>
            {qrDataUrl && (
              <div className="flex justify-center">
                <div className="bg-white rounded-2xl p-3 inline-block">
                  <img src={qrDataUrl} alt="QR" className="w-40 h-40" />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500">{t('lobby_share')}</p>
          </div>

          {/* Players */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {t('lobby_players')} ({players.length}/2)
              </p>
            </div>
            {players.map((player) => {
              const isMe = player.player_id === getPlayerId();
              return (
                <div key={player.id} className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 ${isMe ? 'bg-violet-500/5' : 'bg-emerald-500/5'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${isMe ? 'bg-violet-400' : 'bg-emerald-400'} ${!isMe ? 'animate-pulse' : ''}`} />
                  <p className={`text-sm font-bold ${isMe ? 'text-violet-300' : 'text-emerald-300'}`}>
                    {player.player_name}
                    {isMe && <span className="ml-1 text-[10px] text-violet-500 font-normal">{t('lobby_you_suffix')}</span>}
                  </p>
                  {!isMe && <span className="text-xs text-emerald-400 font-bold">✓ Online</span>}
                </div>
              );
            })}
            {players.length < 2 && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] opacity-40">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-600 animate-pulse" />
                <p className="text-sm text-slate-500 italic">{t('lobby_waiting_opponent')}</p>
              </div>
            )}
          </div>

          {/* Rules */}
          {(() => {
            const league = LEAGUES_1V1.find((l) => l.id === leagueId);
            return (
              <div className="glass rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{t('lobby_challenge_rules')}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {league && (
                    <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">🏆 {league.name}</span>
                  )}
                  <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">🔴 {t('lobby_hard_mode')}</span>
                  <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">🔒 {t('lobby_blind_mode')}</span>
                  <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">📐 4-3-3</span>
                  <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">📅 {eraFrom}–{eraTo}</span>
                </div>
              </div>
            );
          })()}

          <Link href="/lobby">
            <button className="w-full rounded-xl bg-white/[0.06] border border-white/10 py-3 text-sm font-bold text-slate-400 hover:text-white transition-colors">
              ← {t('lobby_cancel')}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Create form
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
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Campionato</p>
            <div className="grid grid-cols-2 gap-2">
              {LEAGUES_1V1.map((lg) => (
                <button
                  key={lg.id}
                  type="button"
                  onClick={() => setLeagueId(lg.id)}
                  className={`rounded-xl border-2 py-3 px-2 text-center transition-all flex items-center justify-center gap-2 ${
                    leagueId === lg.id
                      ? 'border-violet-500/60 bg-violet-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
                >
                  <span className="text-xl">{lg.flag}</span>
                  <span className={`text-xs font-bold ${leagueId === lg.id ? 'text-violet-300' : 'text-slate-300'}`}>{lg.name}</span>
                </button>
              ))}
            </div>
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
