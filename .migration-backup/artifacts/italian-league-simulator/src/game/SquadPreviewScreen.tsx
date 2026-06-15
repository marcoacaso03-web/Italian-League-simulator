import React, { useMemo } from 'react';
import type { DraftSlot } from '../lib/draft';
import { calcTeamOverall, preSeasonOdds } from '../lib/simulation';

function positionBadgeClass(cat: string): string {
  switch (cat) {
    case 'GK':  return 'bg-amber-500/20  text-amber-400  border-amber-500/30';
    case 'DEF': return 'bg-blue-500/20   text-blue-400   border-blue-500/30';
    case 'MID': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'ATT': return 'bg-red-500/20    text-red-400    border-red-500/30';
    default:    return 'bg-white/10      text-white      border-white/20';
  }
}

function ordinal(n: number): string {
  if (n === 1) return '1°';
  if (n === 2) return '2°';
  if (n === 3) return '3°';
  return `${n}°`;
}

function OddsBar({ label, pct, barColor }: { label: string; pct: number; barColor: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-bold text-white">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8">
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function StatBar({ label, icon, value, barColor }: { label: string; icon: string; value: number; barColor: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-slate-300"><span>{icon}</span>{label}</span>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8">
        <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (value / 99) * 100)}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

interface Props {
  slots: DraftSlot[];
  onSimulate: () => void;
  onRestart: () => void;
}

export default function SquadPreviewScreen({ slots, onSimulate, onRestart }: Props) {
  const overall = useMemo(() => calcTeamOverall(slots), [slots]);
  const odds    = useMemo(() => preSeasonOdds(overall.overall), [overall.overall]);
  const filledSlots = slots.filter((s) => s.player !== null);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <section className="glass rounded-2xl overflow-hidden">
          {filledSlots.map((s) => {
            const p = s.player!;
            return (
              <div key={s.formationSlot.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                <span className={`flex-shrink-0 w-10 text-center rounded-lg px-1.5 py-0.5 text-xs font-black border ${positionBadgeClass(p.position_category)}`}>
                  {p.position}
                </span>
                <span className="flex-1 text-sm font-bold text-white truncate">{p.name}</span>
                <span className="text-xs text-slate-400 font-semibold flex-shrink-0">
                  {p.club} <span className="text-slate-600">{p.season}</span>
                </span>
              </div>
            );
          })}
        </section>

        <section className="glass rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">OVERALL</p>
            <p className="text-6xl font-black text-white leading-none">{overall.overall}</p>
          </div>
          <div className="space-y-3 pt-1">
            <StatBar label="Attack"   icon="⚡" value={overall.attack}   barColor="#ef4444" />
            <StatBar label="Midfield" icon="🎯" value={overall.midfield} barColor="#22c55e" />
            <StatBar label="Defence"  icon="🛡️" value={overall.defence}  barColor="#3b82f6" />
            <StatBar label="GK"       icon="🧤" value={overall.gk}       barColor="#f59e0b" />
          </div>
        </section>

        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">PRE-SEASON ODDS</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Basate su 20 stagioni di Serie A</p>
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest">PROJECTED FINISH</p>
              <p className="text-5xl font-black text-white leading-none mt-1">{ordinal(odds.projectedFinish)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-widest">EXPECTED POINTS</p>
              <p className="text-5xl font-black text-emerald-400 leading-none mt-1">{odds.expectedPoints}</p>
            </div>
          </div>
          <div className="space-y-3 pt-1">
            <OddsBar label="Win the league" pct={odds.scudetto}   barColor="#f59e0b" />
            <OddsBar label="Top 4"          pct={odds.top4}       barColor="#22c55e" />
            <OddsBar label="Top 6"          pct={odds.top6}       barColor="#3b82f6" />
            <OddsBar label="Top 10"         pct={odds.top10}      barColor="#a855f7" />
            <OddsBar label="Relegation"     pct={odds.relegation} barColor="#ef4444" />
          </div>
          <p className="text-xs text-slate-500 leading-snug">
            Quello che un overall <span className="font-bold text-slate-300">{overall.overall}</span> dovrebbe produrre.
            Simula per vedere se riesci a fare meglio.
          </p>
        </section>

        <button onClick={onSimulate} className="w-full rounded-2xl bg-emerald-500 py-5 text-lg font-black text-black transition-all hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]">
          Simula Stagione →
        </button>
        <button onClick={onRestart} className="w-full text-center text-sm text-slate-500 hover:text-white transition-colors py-2">
          ↺ Ricomincia
        </button>
      </div>
    </div>
  );
}
