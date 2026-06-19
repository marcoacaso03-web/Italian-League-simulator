import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DraftSlot } from '../lib/draft';
import type { SeasonResult, TeamOverall } from '../lib/simulation';

interface Props {
  result: SeasonResult;
  overall: TeamOverall;
  slots: DraftSlot[];
  onRestart: () => void;
}

function finishBadge(
  pos: number,
  t: (key: string) => string,
): { emoji: string; label: string; color: string } {
  if (pos === 1)  return { emoji: '🏆', label: t('finish_champion'),    color: 'text-amber-400' };
  if (pos <= 4)   return { emoji: '🎯', label: t('finish_champions'),   color: 'text-emerald-400' };
  if (pos <= 6)   return { emoji: '🇪🇺', label: t('finish_europa'),      color: 'text-blue-400' };
  if (pos <= 7)   return { emoji: '🏅', label: t('finish_conference'),  color: 'text-teal-400' };
  if (pos >= 18)  return { emoji: '💔', label: t('finish_relegated'),   color: 'text-red-400' };
  return                 { emoji: '⚽', label: t('finish_mid'),         color: 'text-slate-300' };
}

function catColor(cat: string): string {
  switch (cat) {
    case 'GK':  return '#f59e0b';
    case 'DEF': return '#3b82f6';
    case 'MID': return '#22c55e';
    case 'ATT': return '#ef4444';
    default:    return '#6b7280';
  }
}

function buildTechComment(
  pos: number,
  pts: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (pos === 1)      return t('tech_pos1',    { pts });
  if (pos <= 4)       return t('tech_top4',    { pts });
  if (pos <= 6)       return t('tech_top6',    { pts });
  if (pos <= 10)      return t('tech_top10',   { pts });
  if (pos <= 14)      return t('tech_top14',   { pts });
  if (pos < 18)       return t('tech_struggle',{ pts });
  return                     t('tech_relegated',{ pts });
}

export default function ResultsScreen({ result, overall, slots, onRestart }: Props) {
  const { t } = useTranslation();
  const badge     = finishBadge(result.playerFinalPosition, t);
  const playerRow = result.standings.find((s) => s.isPlayer);
  const gd        = (playerRow?.gf ?? 0) - (playerRow?.ga ?? 0);

  const techComment = useMemo(
    () => buildTechComment(result.playerFinalPosition, result.playerPoints, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, t],
  );

  const playersByCategory = useMemo(() => {
    const cats: Record<string, DraftSlot[]> = { GK: [], DEF: [], MID: [], ATT: [] };
    for (const s of slots) {
      if (!s.player) continue;
      const cat = s.player.position_category;
      if (cat in cats) cats[cat].push(s);
    }
    for (const k of Object.keys(cats)) {
      cats[k].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0));
    }
    return cats;
  }, [slots]);

  // Sort standings by position field if available, otherwise by points desc
  const sortedStandings = useMemo(() => {
    return [...result.standings].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));
  }, [result.standings]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">

        <div className="text-center space-y-2 py-4">
          <p className="text-5xl">{badge.emoji}</p>
          <h1 className="text-2xl font-black text-white">{badge.label}</h1>
          <p className="text-sm text-slate-400">
            {t('result_finished')}{' '}
            <span className={`font-black text-4xl ${badge.color}`}>{result.playerFinalPosition}°</span>{' '}
            {t('result_in_serie_a')}{' '}
            <span className="font-bold text-emerald-400">{result.playerPoints} {t('points').toLowerCase()}</span>
          </p>
        </div>

        <section className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">{t('season_recap')}</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: t('points'),  value: result.playerPoints,             color: 'text-emerald-400' },
              { label: 'GF', value: playerRow?.gf ?? 0,              color: 'text-white' },
              { label: 'GA', value: playerRow?.ga ?? 0,              color: 'text-white' },
              { label: 'GD',     value: gd > 0 ? `+${gd}` : String(gd), color: gd >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-3">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-slate-500">{t('overall')}</p>
            <p className="text-2xl font-black text-white">{overall.overall}</p>
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">📋 {t('overall')}</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: t('pos_att_short'), value: overall.attack,   color: '#ef4444' },
              { label: t('pos_mid_short'), value: overall.midfield, color: '#22c55e' },
              { label: t('pos_def_short'), value: overall.defence,  color: '#3b82f6' },
              { label: t('pos_gk_short'),  value: overall.gk,       color: '#f59e0b' },
            ].map((d) => (
              <div key={d.label} className="glass rounded-xl p-2 text-center">
                <p className="text-base font-black" style={{ color: d.color }}>{d.value}</p>
                <p className="text-[10px] text-slate-500">{d.label}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{techComment}</p>
        </section>

        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('your_squad')}</p>
          </div>
          {(['GK', 'DEF', 'MID', 'ATT'] as const).map((cat) => {
            const catSlots = playersByCategory[cat];
            if (catSlots.length === 0) return null;
            const color = catColor(cat);
            const labels: Record<string, string> = { GK: t('pos_gk'), DEF: t('pos_def'), MID: t('pos_mid'), ATT: t('pos_att') };
            return (
              <div key={cat}>
                <div className="px-4 py-1.5 border-b border-white/[0.04]" style={{ backgroundColor: color + '15' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{labels[cat]}</p>
                </div>
                {catSlots.map((s) => {
                  const p = s.player!;
                  const ratingColor = p.rating >= 85 ? '#4ade80' : p.rating >= 75 ? '#fbbf24' : '#f87171';
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                        style={{ backgroundColor: color + '22', color }}>
                        {p.position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-500">{p.club} · {p.season}</p>
                      </div>
                      <span className="text-base font-black" style={{ color: ratingColor }}>{p.rating}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>

        {/* FINAL STANDINGS — uses row.name (TeamStanding field), NOT row.club */}
        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('final_standing')}</p>
          </div>
          {sortedStandings.map((row, idx) => {
            const isPlayer = row.isPlayer;
            const position = idx + 1;
            return (
              <div
                key={row.teamId}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 ${
                  isPlayer ? 'bg-emerald-500/10' : ''
                }`}
              >
                <span className={`w-6 text-center text-xs font-black ${
                  position <= 4 ? 'text-emerald-400' :
                  position <= 7 ? 'text-blue-400' :
                  position >= 18 ? 'text-red-400' : 'text-slate-500'
                }`}>{position}</span>
                <span className={`flex-1 text-sm font-bold truncate ${
                  isPlayer ? 'text-emerald-400' : 'text-white'
                }`}>{row.name}</span>
                <span className="text-xs text-slate-400 font-semibold">{row.points} {t('points').toLowerCase()}</span>
              </div>
            );
          })}
        </section>

        <button
          onClick={onRestart}
          className="w-full rounded-2xl bg-white/[0.06] border border-white/10 py-4 text-base font-bold text-white hover:bg-white/10 transition-all active:scale-[0.98]"
        >
          {t('play_again')}
        </button>
      </div>
    </div>
  );
}
