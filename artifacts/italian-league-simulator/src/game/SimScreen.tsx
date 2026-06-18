import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DraftSlot } from '../lib/draft';
import {
  calcTeamOverall, simulateSeason,
  type MatchdaySnapshot, type SeasonResult, type TeamOverall,
} from '../lib/simulation';

interface Props {
  slots: DraftSlot[];
  onComplete: (_result: SeasonResult, _overall: TeamOverall) => void;
}

const TICK_MS = 900;

function outcomeColors(o: 'W' | 'D' | 'L') {
  if (o === 'W') return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', badge: 'bg-emerald-500', score: 'text-emerald-400' };
  if (o === 'D') return { bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   badge: 'bg-amber-500',   score: 'text-amber-400' };
  return              { bg: 'bg-red-500/10',    border: 'border-red-500/25',    badge: 'bg-red-500',    score: 'text-red-400' };
}

export default function SimScreen({ slots, onComplete }: Props) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<MatchdaySnapshot[]>([]);
  const [currentMd, setCurrentMd] = useState(0);
  const [playerPos, setPlayerPos] = useState<number | null>(null);
  const [playerPts, setPlayerPts] = useState(0);
  const resultRef = useRef<{ result: SeasonResult; overall: TeamOverall } | null>(null);
  const hasRun    = useRef(false);
  const listRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const overall = calcTeamOverall(slots);
    const result  = simulateSeason(slots, overall);
    resultRef.current = { result, overall };

    let i = 0;
    const tick = () => {
      if (i >= result.matchdaySnapshots.length) {
        setTimeout(() => onComplete(result, overall), 800);
        return;
      }
      const snap = result.matchdaySnapshots[i];
      setCurrentMd(snap.matchday);
      setPlayerPos(snap.playerPosition);
      setPlayerPts(snap.playerPoints);
      setSnapshots((prev) => [...prev, snap]);
      i++;
      setTimeout(tick, TICK_MS);
    };
    setTimeout(tick, 300);
  }, [slots, onComplete]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [snapshots]);

  const progress = (currentMd / 38) * 100;
  const visibleSnaps = snapshots.filter((s) => s.playerMatch !== null);

  function handleSkip() {
    if (resultRef.current) {
      onComplete(resultRef.current.result, resultRef.current.overall);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm px-4 pt-5 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t('position')}</p>
            <p className="text-3xl font-black text-white">{playerPos !== null ? `${playerPos}°` : '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t('points')}</p>
            <p className="text-3xl font-black text-emerald-400">{playerPts}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {t('matchweek')} <span className="text-white">{currentMd}</span> / 38
          </p>
          <button onClick={handleSkip} className="text-xs font-semibold text-slate-400 hover:text-white transition-colors">
            {t('skip_all')}
          </button>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full">
          <div className="h-1 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ scrollBehavior: 'smooth' }}>
        {visibleSnaps.map((snap) => {
          const m = snap.playerMatch!;
          const c = outcomeColors(m.outcome);
          const displayScore = `${m.playerGoals}–${m.opponentGoals}`;
          return (
            <div key={snap.matchday} className={`rounded-2xl border px-4 py-3 ${c.bg} ${c.border} transition-all`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.badge}`}>
                    <span className="text-xs font-black text-white">{m.outcome}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white">{m.opponentName}</span>
                    <span className="text-xs text-slate-500">({m.isHome ? t('match_h') : t('match_a')})</span>
                  </div>
                </div>
                <span className={`text-lg font-black tabular-nums ${c.score}`}>{displayScore}</span>
              </div>
              {m.scorers.length > 0 && (
                <div className="mt-1.5 flex items-start gap-1">
                  <span className="text-slate-500 text-xs mt-0.5 flex-shrink-0">⚽</span>
                  <p className="text-xs text-emerald-400 leading-relaxed">
                    {m.scorers.map((g) => `${g.scorer} ${g.minute}'`).join('  ')}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {visibleSnaps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
            <span className="text-4xl animate-spin" style={{ animationDuration: '2s' }}>⚽</span>
            <p className="text-sm">{t('league_start')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
