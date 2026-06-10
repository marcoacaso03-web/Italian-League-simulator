'use client';
import React, { useEffect, useState, useRef } from 'react';
import type { DraftSlot } from '@/lib/draft';
import { calcTeamOverall, simulateSeason, type SeasonResult, type TeamOverall } from '@/lib/simulation';

interface Props {
  slots: DraftSlot[];
  onComplete: (result: SeasonResult, overall: TeamOverall) => void;
}

export default function SimScreen({ slots, onComplete }: Props) {
  const [matchday, setMatchday] = useState(0);
  const [playerPos, setPlayerPos] = useState<number | null>(null);
  const [playerPts, setPlayerPts] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const overall = calcTeamOverall(slots);
    const result  = simulateSeason(slots, overall);

    let i = 0;
    const tick = () => {
      if (i >= result.matchdaySnapshots.length) {
        // small pause then advance
        setTimeout(() => onComplete(result, overall), 400);
        return;
      }
      const snap = result.matchdaySnapshots[i];
      setMatchday(snap.matchday);
      setPlayerPos(snap.playerPosition);
      setPlayerPts(snap.playerPoints);
      i++;
      setTimeout(tick, 45);
    };
    setTimeout(tick, 300);
  }, [slots, onComplete]);

  const progress = (matchday / 38) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 text-center gap-8">
      {/* Icon */}
      <div className="text-6xl animate-pulse">⚽</div>

      <div>
        <h2 className="text-2xl font-black text-white mb-2">Simulazione in corso…</h2>
        <p className="text-sm text-slate-400">
          Giornata <span className="font-bold text-white">{matchday}</span> / 38
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-2 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Live stats */}
      {playerPos !== null && (
        <div className="glass rounded-2xl px-8 py-5 w-full max-w-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest">POSIZIONE</p>
              <p className="text-4xl font-black text-white">{playerPos}°</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-widest">PUNTI</p>
              <p className="text-4xl font-black text-emerald-400">{playerPts}</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600">Serie A 2025/26</p>
    </div>
  );
}
