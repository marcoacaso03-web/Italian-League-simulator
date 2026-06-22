import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import {
  getLobby, getLobbyPlayers, toggleReady, startLobby,
  getPlayerId, type Lobby, type LobbyPlayer,
} from '../lib/lobby';
import { subscribeToLobby, subscribeToPresence } from '../lib/lobbyRealtime';
import { LEAGUES } from '../lib/leagues';

interface LobbyRoomPageProps {
  lobbyCode: string;
  onStartGame: (lobby: Lobby) => void;
}

export default function LobbyRoomPage({ lobbyCode, onStartGame }: LobbyRoomPageProps) {
  const { t } = useTranslation();
  const playerId = getPlayerId();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [online, setOnline] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentPlayer = players.find((p) => p.player_id === playerId);
  const isHost = currentPlayer?.is_host ?? false;
  const allReady = players.length >= 2 && players.every((p) => p.is_ready || p.is_host);
  const lobbyConfig = lobby?.config;

  useEffect(() => {
    const joinUrl = `${window.location.origin}/lobby/room?code=${lobbyCode}`;
    QRCode.toDataURL(joinUrl, {
      width: 200, margin: 2,
      color: { dark: '#10b981', light: '#0a0a0f' },
    }).then(setQrDataUrl).catch(() => {});
  }, [lobbyCode]);

  useEffect(() => {
    let unsubLobby: (() => void) | null = null;
    let unsubPresence: (() => void) | null = null;

    async function init() {
      try {
        const lobbyData = await getLobby(lobbyCode);
        if (!lobbyData) { setError(t('lobby_error_not_found')); return; }
        setLobby(lobbyData);
        if (lobbyData.status === 'playing') { onStartGame(lobbyData); return; }
        const playersData = await getLobbyPlayers(lobbyData.id);
        setPlayers(playersData);
        unsubLobby = subscribeToLobby(lobbyData.id, (up) => setPlayers(up), (s) => { if (s === 'playing') onStartGame(lobbyData); });
        unsubPresence = subscribeToPresence(lobbyData.id, playerId, currentPlayer?.player_name ?? '???', setOnline);
      } catch (err) { setError(err instanceof Error ? err.message : t('lobby_unknown_error')); }
    }
    init();
    return () => { unsubLobby?.(); unsubPresence?.(); };
  }, [lobbyCode, onStartGame, playerId, currentPlayer?.player_name, t]);

  const handleToggleReady = useCallback(async () => {
    if (!lobby) return;
    try { await toggleReady(lobby.id); } catch { setError(t('lobby_unknown_error')); }
  }, [lobby, t]);

  const handleStart = useCallback(async () => {
    if (!lobby || !allReady) return;
    setStarting(true);
    try { await startLobby(lobby.id); onStartGame(lobby); }
    catch { setError(t('lobby_unknown_error')); setStarting(false); }
  }, [lobby, allReady, onStartGame, t]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(lobbyCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [lobbyCode]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-4xl">⚠️</p>
          <p className="text-red-400 font-bold">{error}</p>
          <Link href="/lobby">
            <button className="text-emerald-400 hover:text-emerald-300 text-sm">← {t('lobby_home')}</button>
          </Link>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-slate-500 animate-pulse">{t('loading_data')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center space-y-3">
          <p className="text-3xl">🏠</p>
          <h1 className="text-xl font-black text-white">{t('lobby_title')}</h1>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleCopyCode}
              className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-3 hover:bg-emerald-500/20 transition-all active:scale-95"
            >
              <span className="text-2xl font-black text-emerald-400 tracking-[0.2em] font-mono">{lobby.code}</span>
              <span className="text-xs text-emerald-400">{copied ? t('lobby_copied') : t('lobby_copy')}</span>
            </button>
          </div>
          {qrDataUrl && (
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl p-3 inline-block">
                <img src={qrDataUrl} alt="QR Code Lobby" className="w-40 h-40" />
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">{t('lobby_share')}</p>
        </div>

        {lobbyConfig && (() => {
          const league = LEAGUES.find((l) => l.id === (lobbyConfig as any).leagueId);
          return (
            <div className="glass rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{t('lobby_rules')}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {league && (
                  <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">
                    🏆 {league.name}
                  </span>
                )}
                <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">
                  {lobbyConfig.difficulty === 'easy' ? '🟢' : lobbyConfig.difficulty === 'normal' ? '🟡' : '🔴'} {t('difficulty_' + lobbyConfig.difficulty)}
                </span>
                <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">📐 {lobbyConfig.formation}</span>
                <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">
                  🎰 {lobbyConfig.draftMode === 'squad_first' ? t('draft_mode_squad') : t('draft_mode_position')}
                </span>
                <span className="bg-white/5 rounded-lg px-2 py-1 text-slate-300">📅 {lobbyConfig.eraFrom}–{lobbyConfig.eraTo}</span>
              </div>
            </div>
          );
        })()}

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t('lobby_players')} ({players.length}/{lobby.max_players})
            </p>
            {online.length > 0 && (
              <p className="text-[10px] text-emerald-400">🟢 {online.length} {t('lobby_online_count')}</p>
            )}
          </div>
          {players.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">{t('lobby_waiting_players')}</div>
          )}
          {players.map((player) => {
            const isMe = player.player_id === playerId;
            const isOnline = online.some((o) => o.id === player.player_id);
            return (
              <div key={player.id} className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 ${isMe ? 'bg-emerald-500/5' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                    {player.player_name}
                    {isMe && <span className="ml-1 text-[10px] text-emerald-500 font-normal">{t('lobby_you_suffix')}</span>}
                  </p>
                </div>
                {player.is_host && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5">👑 {t('lobby_host')}</span>
                )}
                <span className={`text-xs font-semibold ${player.is_ready ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {player.is_ready ? '✅' : '⏳'}
                </span>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, lobby.max_players - players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 opacity-30">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <p className="text-sm text-slate-600 italic">{t('lobby_empty_slot')}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {!isHost && (
            <button onClick={handleToggleReady}
              className={`w-full rounded-xl py-4 text-base font-bold transition-all ${
                currentPlayer?.is_ready
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500 text-black hover:bg-emerald-400'
              }`}
            >
              {currentPlayer?.is_ready ? '⏳ ' + t('lobby_not_ready_btn') : '✅ ' + t('lobby_ready_btn')}
            </button>
          )}
          {isHost && (
            <button onClick={handleStart} disabled={!allReady || starting}
              className="w-full rounded-xl bg-emerald-500 py-4 text-base font-black text-black hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {starting ? '⏳ ' + t('lobby_starting') : allReady ? '🚀 ' + t('lobby_start') : `⏳ ${t('lobby_waiting')} (${players.filter(p => p.is_ready).length}/${players.length - 1})`}
            </button>
          )}
          <Link href="/lobby">
            <button className="w-full rounded-xl bg-white/[0.06] border border-white/10 py-3 text-sm font-bold text-slate-400 hover:text-white transition-colors">
              ← {t('lobby_exit')}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
