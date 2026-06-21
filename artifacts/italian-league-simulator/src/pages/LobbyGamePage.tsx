import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DraftScreen from '../game/DraftScreen';
import SquadPreviewScreen from '../game/SquadPreviewScreen';
import SimScreen from '../game/SimScreen';
import ResultsScreen from '../game/ResultsScreen';
import type { DraftSlot } from '../lib/draft';
import type { SeasonResult, TeamOverall } from '../lib/simulation';
import { calcTeamOverall } from '../lib/simulation';
import { submitResult, getLobbyLeaderboard, type Lobby, type LobbyPlayer } from '../lib/lobby';
import { subscribeToLobby } from '../lib/lobbyRealtime';

type GamePhase = 'draft' | 'preview' | 'sim' | 'results' | 'leaderboard';

interface LobbyGamePageProps {
  lobby: Lobby;
}

export default function LobbyGamePage({ lobby }: LobbyGamePageProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<GamePhase>('draft');
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [results, setResults] = useState<SeasonResult | null>(null);
  const [teamOverall, setTeamOverall] = useState<TeamOverall | null>(null);
  const [leaderboard, setLeaderboard] = useState<LobbyPlayer[]>([]);
  const [submitted, setSubmitted] = useState(false);

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
        if (status === 'finished') {
          setPhase('leaderboard');
        }
      }
    );

    // Carica leaderboard iniziale
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
        finalScore: 0, // Il punteggio lobby è basato sui punti, non sullo score leaderboard
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
    setPhase('draft');
    setDraftSlots([]);
    setResults(null);
    setTeamOverall(null);
    setSubmitted(false);
  }, []);

  // ─── Draft ─────────────────────────────────────
  if (phase === 'draft') {
    return (
      <DraftScreen
        config={lobby.config}
        onComplete={handleDraftComplete}
        onBack={handleRestart}
      />
    );
  }

  // ─── Preview ───────────────────────────────────
  if (phase === 'preview') {
    return (
      <SquadPreviewScreen
        slots={draftSlots}
        onSimulate={handleSimStart}
        onRestart={handleRestart}
      />
    );
  }

  // ─── Sim ───────────────────────────────────────
  if (phase === 'sim') {
    return (
      <SimScreen
        slots={draftSlots}
        onComplete={handleSimComplete}
      />
    );
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
        {/* Pulsante invia risultato */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0f] to-transparent">
          <div className="max-w-md mx-auto space-y-2">
            {submitted ? (
              <button
                onClick={handleViewLeaderboard}
                className="w-full rounded-xl bg-emerald-500 py-4 text-base font-black text-black hover:bg-emerald-400 transition-all"
              >
                🏆 Vedi Classifica
              </button>
            ) : (
              <button
                onClick={handleSubmitResult}
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
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              {leaderboard.map((player, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                const medal = medals[idx] ?? `${idx + 1}°`;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 ${
                      idx === 0 ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <span className="text-lg w-8 text-center">{medal}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{player.player_name}</p>
                      <p className="text-[10px] text-slate-500">
                        {player.final_position}° · {player.final_points} pts
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400 font-bold">{player.final_points} pts</span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={handleRestart}
            className="w-full rounded-xl bg-white/[0.06] border border-white/10 py-4 text-base font-bold text-white hover:bg-white/10 transition-all"
          >
            🔄 Gioca Ancora
          </button>
        </div>
      </div>
    );
  }

  return null;
}
