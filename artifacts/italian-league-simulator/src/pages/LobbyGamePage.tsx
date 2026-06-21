import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import DraftScreen from '../game/DraftScreen';
import SquadPreviewScreen from '../game/SquadPreviewScreen';
import SimScreen from '../game/SimScreen';
import ResultsScreen from '../game/ResultsScreen';
import type { DraftSlot } from '../lib/draft';
import type { SeasonResult, TeamOverall } from '../lib/simulation';
import { calcTeamOverall } from '../lib/simulation';
import { submitResult, getLobbyLeaderboard, getPlayerId, type Lobby, type LobbyPlayer } from '../lib/lobby';
import { subscribeToLobby } from '../lib/lobbyRealtime';

type GamePhase = 'countdown' | 'draft' | 'preview' | 'sim' | 'results' | 'leaderboard';

interface LobbyGamePageProps {
  lobby: Lobby;
}

export default function LobbyGamePage({ lobby }: LobbyGamePageProps) {
  const { t } = useTranslation();
  const playerId = getPlayerId();
  const [phase, setPhase] = useState<GamePhase>('countdown');
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [results, setResults] = useState<SeasonResult | null>(null);
  const [teamOverall, setTeamOverall] = useState<TeamOverall | null>(null);
  const [leaderboard, setLeaderboard] = useState<LobbyPlayer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Countdown iniziale
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('draft');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Sottoscrivi ai risultati della lobby
  useEffect(() => {
    if (phase !== 'results' && phase !== 'leaderboard') return;

    const unsub = subscribeToLobby(
      lobby.id,
      async (players) => {
        const withResults = players.filter((p) => p.final_position !== null);
        if (withResults.length > 0) {
          setLeaderboard(withResults.sort((a, b) => (b.final_points ?? 0) - (a.final_points ?? 0)));
        }
      },
      (status) => {
        if (status === 'finished') setPhase('leaderboard');
      }
    );

    getLobbyLeaderboard(lobby.id).then(setLeaderboard);
    return () => unsub();
  }, [lobby.id, phase]);

  const handleDraftComplete = useCallback((slots: DraftSlot[]) => {
    setDraftSlots(slots);
    setPhase('preview');
  }, []);

  const handleSimStart = useCallback(() => setPhase('sim'), []);

  const handleSimComplete = useCallback((res: SeasonResult, overall: TeamOverall) => {
    setResults(res);
    setTeamOverall(overall);
    setPhase('results');
  }, []);

  const handleSubmitResult = useCallback(async () => {
    if (!results || !teamOverall || submitted) return;
    try {
      await submitResult(lobby.id, {
        finalPosition: results.playerFinalPosition,
        finalPoints: results.playerPoints,
        finalScore: 0,
        slots: draftSlots,
        overall: teamOverall,
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Submit failed:', err);
    }
  }, [results, teamOverall, submitted, lobby.id, draftSlots]);

  const handleViewLeaderboard = useCallback(async () => {
    await handleSubmitResult();
    setPhase('leaderboard');
  }, [handleSubmitResult]);

  const handleRestart = useCallback(() => {
    setPhase('countdown');
    setCountdown(3);
    setDraftSlots([]);
    setResults(null);
    setTeamOverall(null);
    setSubmitted(false);
  }, []);

  // ─── Countdown ─────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6">
          <p className="text-6xl">🎮</p>
          <h1 className="text-3xl font-black text-white">La partita sta per iniziare!</h1>
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-emerald-500/30 flex items-center justify-center mx-auto">
              <span className="text-6xl font-black text-emerald-400 animate-pulse">
                {countdown > 0 ? countdown : '⚽'}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-400">Preparati a sorteggiare la tua squadra...</p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>Regole: {lobby.config.difficulty} · {lobby.config.formation} · {lobby.config.eraFrom}–{lobby.config.eraTo}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Draft ─────────────────────────────────────
  if (phase === 'draft') {
    return <DraftScreen config={lobby.config} onComplete={handleDraftComplete} onBack={handleRestart} />;
  }

  // ─── Preview ───────────────────────────────────
  if (phase === 'preview') {
    return <SquadPreviewScreen slots={draftSlots} onSimulate={handleSimStart} onRestart={handleRestart} />;
  }

  // ─── Sim ───────────────────────────────────────
  if (phase === 'sim') {
    return <SimScreen slots={draftSlots} onComplete={handleSimComplete} />;
  }

  // ─── Results ───────────────────────────────────
  if (phase === 'results' && results && teamOverall) {
    return (
      <div className="relative">
        <ResultsScreen
          result={results}
          overall={teamOverall}
          slots={draftSlots}
          config={lobby.config}
          onRestart={handleRestart}
        />
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0f] to-transparent">
          <div className="max-w-md mx-auto space-y-2">
            {submitted ? (
              <button onClick={handleViewLeaderboard}
                className="w-full rounded-xl bg-emerald-500 py-4 text-base font-black text-black hover:bg-emerald-400 transition-all"
              >
                🏆 Vedi Classifica
              </button>
            ) : (
              <button onClick={handleSubmitResult}
                className="w-full rounded-xl bg-emerald-500 py-4 text-base font-black text-black hover:bg-emerald-400 transition-all"
              >
                📤 Invia Risultato
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Leaderboard ───────────────────────────────
  if (phase === 'leaderboard') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-lg space-y-5">
          <div className="text-center space-y-2">
            <p className="text-4xl">🏆</p>
            <h1 className="text-2xl font-black text-white">Classifica Finale</h1>
            <p className="text-sm text-slate-400">Lobby {lobby.code}</p>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <p className="animate-pulse">In attesa dei risultati...</p>
              <p className="text-xs text-slate-600 mt-2">Altri giocatori stanno ancora completando la simulazione</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              {leaderboard.map((player, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                const medal = medals[idx] ?? `${idx + 1}°`;
                const isMe = player.player_id === playerId;
                return (
                  <div key={player.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 ${
                      idx === 0 ? 'bg-amber-500/5' : isMe ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    <span className="text-lg w-8 text-center">{medal}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                        {player.player_name}
                        {isMe && <span className="ml-1 text-[10px] text-emerald-500 font-normal">(tu)</span>}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {player.final_position}° in Serie A · {player.final_points} pts
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-400">{player.final_points}</p>
                      <p className="text-[10px] text-slate-500">punti</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <button onClick={handleRestart}
              className="w-full rounded-xl bg-white/[0.06] border border-white/10 py-4 text-base font-bold text-white hover:bg-white/10 transition-all"
            >
              🔄 Gioca Ancora
            </button>
            <Link href="/">
              <button className="w-full rounded-xl bg-white/[0.03] border border-white/5 py-3 text-sm font-bold text-slate-500 hover:text-white transition-colors">
                🏠 Torna alla Home
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
