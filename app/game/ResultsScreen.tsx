'use client';
import React from 'react';
import type { SeasonResult, TeamOverall } from '@/lib/simulation';

interface Props {
  result: SeasonResult;
  overall: TeamOverall;
  onRestart: () => void;
}

function finishBadge(pos: number): { emoji: string; label: string; color: string } {
  if (pos === 1)          return { emoji: '🏆', label: 'Campione d\'Italia!',  color: 'text-amber-400' };
  if (pos <= 4)           return { emoji: '🎯', label: 'Champions League',     color: 'text-emerald-400' };
  if (pos <= 6)           return { emoji: '🇪🇺', label: 'Europa League',        color: 'text-blue-400' };
  if (pos <= 7)           return { emoji: '🏅', label: 'Conference League',    color: 'text-teal-400' };
  if (pos >= 18)          return { emoji: '💔', label: 'Retrocessione',        color: 'text-red-400' };
  return                         { emoji: '⚽', label: 'Serie A completata',  color: 'text-slate-300' };
}

export default function ResultsScreen({ result, overall, onRestart }: Props) {
  const badge = finishBadge(result.playerFinalPosition);
  const playerRow = result.standings.find((s) => s.isPlayer);
  const gd = (playerRow?.gf ?? 0) - (playerRow?.ga ?? 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">

        {/* ── Hero result ── */}
        <div className="text-center space-y-2 py-4">
          <p className="text-5xl">{badge.emoji}</p>
          <h1 className="text-2xl font-black text-white">{badge.label}</h1>
          <p className="text-sm text-slate-400">
            Hai finito <span className={`font-black text-4xl ${badge.color}`}>{result.playerFinalPosition}°</span> in Serie A con{' '}
            <span className="font-bold text-emerald-400">{result.playerPoints} punti</span>
          </p>
        </div>

        {/* ── Stats personali ── */}
        <section className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">LA TUA STAGIONE</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Punti', value: result.playerPoints, color: 'text-emerald-400' },
              { label: 'Gol F.', value: playerRow?.gf ?? 0, color: 'text-white' },
              { label: 'Gol S.', value: playerRow?.ga ?? 0, color: 'text-white' },
              { label: 'DR', value: gd > 0 ? `+${gd}` : String(gd), color: gd >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-3">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-slate-500">Overall squadra</p>
            <p className="text-2xl font-black text-white">{overall.overall}</p>
          </div>
        </section>

        {/* ── Classifica finale ── */}
        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">CLASSIFICA FINALE</p>
          </div>
          {result.standings.map((team, i) => {
            const pos = i + 1;
            const isPlayer = team.isPlayer;
            const isChamp = pos === 1;
            const isCL = pos <= 4;
            const isEL = pos <= 6;
            const isConf = pos === 7;
            const isRel = pos >= 18;

            let indicator = '';
            if (isChamp) indicator = '🏆';
            else if (isCL) indicator = '🟢';
            else if (isEL) indicator = '🔵';
            else if (isConf) indicator = '🩵';
            else if (isRel) indicator = '🔴';

            return (
              <div
                key={team.teamId}
                className={[
                  'flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0',
                  isPlayer ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : '',
                ].join(' ')}
              >
                <span className={`w-5 text-xs font-bold text-center flex-shrink-0 ${
                  isPlayer ? 'text-emerald-400' : 'text-slate-500'
                }`}>{pos}</span>

                <span className="text-base">{indicator}</span>

                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
                  style={{ backgroundColor: team.color + '33', color: team.color }}
                >
                  {team.abbr.slice(0, 3)}
                </div>

                <span className={`flex-1 text-sm truncate ${
                  isPlayer ? 'font-black text-emerald-300' : 'font-medium text-slate-300'
                }`}>{team.name}</span>

                <span className={`text-sm font-bold flex-shrink-0 ${
                  isPlayer ? 'text-emerald-400' : 'text-slate-400'
                }`}>{team.points}</span>
              </div>
            );
          })}
        </section>

        {/* ── CTA ── */}
        <button
          onClick={onRestart}
          className="w-full rounded-2xl bg-emerald-500 py-5 text-lg font-black text-black transition-all hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]"
        >
          ↺ Gioca ancora
        </button>

      </div>
    </div>
  );
}
