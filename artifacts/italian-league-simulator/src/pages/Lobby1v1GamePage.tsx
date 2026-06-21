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
import { submitResult, getLobbyLeaderboard, getLobbyPlayers, getPlayerId, type Lobby, type LobbyPlayer } from '../lib/lobby';
import { subscribeToLobby } from '../lib/lobbyRealtime';

type GamePhase = 'countdown' | 'draft' | 'preview' | 'sim' | 'results' | 'versus';

interface Props {
  lobby: Lobby;
}

export default function Lobby1v1GamePage({ lobby }: Props) {
  const { t } = useTranslation();
  const playerId = getPlayerId();
  const [phase, setPhase] = useState<GamePhase>('countdown');
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [results, setResults] = useState<SeasonResult | null>(null);
  const [teamOverall, setTeamOverall] = useState<TeamOverall | null>(null);
  const [opponentResult, setOpponentResult] = useState<LobbyPlayer | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { setPhase('draft'); return; }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Sottoscrivi risultati
  useEffect(() => {
    if (phase !== 'results' && phase !== 'versus') return;
    const unsub = subscribeToLobby(
      lobby.id,
      async (players) => {
        const withResults = players.filter((p) => p.final_position !== null);
        if (withResults.length >= 2) {
          const opponent = withResults.find((p) => p.player_id !== playerId);
          setOpponentResult(opponent ?? null);
          setPhase('versus');
        }
      },
      () => {}
    );
    return () => unsub();
  }, [lobby.id, phase, playerId]);

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

  const handleSubmit = useCallback(async () => {
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
    } catch (err) { console.error(err); }
  }, [results, teamOverall, submitted, lobby.id, draftSlots]);

  const handleRestart = useCallback(() => {
    setPhase('countdown');
    setCountdown(3);
    setDraftSlots([]);
    setResults(null);
    setTeamOverall(null);
    setSubmitted(false);
    setOpponentResult(null);
  }, []);

  // ─── Countdown ─────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6">
          <p className="text-6xl">⚔️</p>
          <h1 className="text-3xl font-black text-white">Sfida 1v1 Blind</h1>
          <p className="text-sm text-slate-400">Stesse squadre, stesso sorteggio. Chi fa più punti vince!</p>
          <div className="w-32 h-32 rounded-full border-4 border-violet-500/30 flex items-center justify-center mx-auto">
            <span className="text-6xl font-black text-violet-400 animate-pulse">
              {countdown > 0 ? countdown : '⚽'}
            </span>
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
        <ResultsScreen result={results} overall={teamOverall} slots={draftSlots} config={lobby.config} onRestart={handleRestart} />
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0f] to-transparent">
          <div className="max-w-md mx-auto">
            {submitted ? (
              <div className="text-center py-3 bg-violet-500/10 rounded-xl border border-violet-500/30">
                <p className="text-violet-300 text-sm font-bold">⏳ In attesa dell'avversario...</p>
              </div>
            ) : (
              <button onClick={handleSubmit}
                className="w-full rounded-xl bg-violet-500 py-4 text-base font-black text-white hover:bg-violet-400 transition-all"
              >
                📤 Invia Risultato
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Versus (confronto finale) ─────────────────
  if (phase === 'versus' && results && opponentResult) {
    const myPoints = results.playerPoints;
    const oppPoints = opponentResult.final_points ?? 0;
    const iWon = myPoints > oppPoints;
    const draw = myPoints === oppPoints;

    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <p className="text-5xl">{iWon ? '🏆' : draw ? '🤝' : '😢'}</p>
            <h1 className="text-3xl font-black text-white">
              {iWon ? 'Hai Vinto!' : draw ? 'Pareggio!' : 'Hai Perso!'}
            </h1>
          </div>

          {/* Confronto */}
          <div className="glass rounded-2xl overflow-hidden">
            {/* Il tuo risultato */}
            <div className={`px-5 py-4 border-b border-white/10 ${iWon ? 'bg-emerald-500/10' : 'bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Tu</p>
                  <p className="text-lg font-black text-white">{results.playerPoints} pts</p>
                  <p className="text-xs text-slate-400">{results.playerFinalPosition}° in Serie A</p>
                </div>
                {iWon && <span className="text-2xl">👑</span>}
              </div>
            </div>

            {/* VS divider */}
            <div className="px-5 py-2 bg-violet-500/5 text-center">
              <span className="text-xs font-black text-violet-400">VS</span>
            </div>

            {/* Risultato avversario */}
            <div className={`px-5 py-4 ${!iWon && !draw ? 'bg-emerald-500/10' : 'bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{opponentResult.player_name}</p>
                  <p className="text-lg font-black text-white">{oppPoints} pts</p>
                  <p className="text-xs text-slate-400">{opponentResult.final_position}° in Serie A</p>
                </div>
                {!iWon && !draw && <span className="text-2xl">👑</span>}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={handleRestart}
              className="w-full rounded-xl bg-violet-500 py-4 text-base font-black text-white hover:bg-violet-400 transition-all"
            >
              🔄 Rivincita
            </button>
            <Link href="/">
              <button className="w-full rounded-xl bg-white/[0.06] border border-white/10 py-3 text-sm font-bold text-slate-500 hover:text-white transition-colors">
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
