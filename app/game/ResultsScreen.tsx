'use client';
import React, { useMemo } from 'react';
import type { DraftSlot } from '@/lib/draft';
import type { SeasonResult, TeamOverall } from '@/lib/simulation';

interface Props {
  result: SeasonResult;
  overall: TeamOverall;
  slots: DraftSlot[];
  onRestart: () => void;
}

function finishBadge(pos: number): { emoji: string; label: string; color: string } {
  if (pos === 1)  return { emoji: '🏆', label: 'Campione d\'Italia!',  color: 'text-amber-400' };
  if (pos <= 4)   return { emoji: '🎯', label: 'Champions League',     color: 'text-emerald-400' };
  if (pos <= 6)   return { emoji: '🇪🇺', label: 'Europa League',        color: 'text-blue-400' };
  if (pos <= 7)   return { emoji: '🏅', label: 'Conference League',    color: 'text-teal-400' };
  if (pos >= 18)  return { emoji: '💔', label: 'Retrocessione',        color: 'text-red-400' };
  return                 { emoji: '⚽', label: 'Serie A completata',   color: 'text-slate-300' };
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

/** Genera un commento tecnico narrativo sulla stagione */
function buildTechComment(
  pos: number,
  pts: number,
  overall: TeamOverall,
  gf: number,
  ga: number,
): string {
  const gd = gf - ga;
  const att = overall.attack;
  const def = overall.defence;
  const mid = overall.midfield;
  const gk  = overall.gk;

  const lines: string[] = [];

  // Intro posizione
  if (pos === 1)      lines.push(`Una stagione perfetta. ${pts} punti, lo Scudetto alzato a San Siro: questa è storia.`);
  else if (pos <= 4)  lines.push(`Qualificazione Champions League centrata. ${pts} punti sono il frutto di un lavoro tattico solido.`);
  else if (pos <= 6)  lines.push(`Europa League conquistata. La squadra ha dimostrato carattere, chiudendo con ${pts} punti.`);
  else if (pos <= 10) lines.push(`Una stagione di metà classifica: ${pts} punti, qualche rimpianto ma anche momenti di qualità.`);
  else if (pos <= 14) lines.push(`Salvezza tranquilla a ${pts} punti. La squadra ha lottato, ma manca continuità.`);
  else if (pos < 18)  lines.push(`Una stagione sofferta. ${pts} punti bastano appena per la salvezza. Molto da migliorare.`);
  else                lines.push(`La retrocessione è una realtà dura. ${pts} punti non sono bastati per restare in Serie A.`);

  // Analisi reparto più forte/debole
  const depts = [{ name: 'attacco', v: att }, { name: 'centrocampo', v: mid }, { name: 'difesa', v: def }, { name: 'portiere', v: gk }];
  const best  = depts.reduce((a, b) => (a.v >= b.v ? a : b));
  const worst = depts.reduce((a, b) => (a.v <= b.v ? a : b));
  lines.push(`Il punto di forza è stato il ${best.name} (${best.v}), mentre il ${worst.name} (${worst.v}) è rimasto il tallone d'Achille.`);

  // Gol
  if (gf >= 70)       lines.push(`L'attacco ha brillato con ${gf} gol segnati — uno dei migliori della lega.`);
  else if (gf >= 50)  lines.push(`${gf} reti segnate: una produzione offensiva discreta.`);
  else                lines.push(`Solo ${gf} gol in tutto il campionato: servono rinforzi in attacco.`);

  if (ga <= 30)       lines.push(`Difensivamente impeccabile: solo ${ga} gol subiti.`);
  else if (ga <= 50)  lines.push(`${ga} gol subiti — la difesa ha retto, ma può fare di più.`);
  else                lines.push(`${ga} reti al passivo: la tenuta difensiva va rivista in profondità.`);

  return lines.join(' ');
}

export default function ResultsScreen({ result, overall, slots, onRestart }: Props) {
  const badge     = finishBadge(result.playerFinalPosition);
  const playerRow = result.standings.find((s) => s.isPlayer);
  const gd        = (playerRow?.gf ?? 0) - (playerRow?.ga ?? 0);

  const techComment = useMemo(
    () => buildTechComment(
      result.playerFinalPosition,
      result.playerPoints,
      overall,
      result.playerGF,
      result.playerGA,
    ),
    [result, overall],
  );

  // Giocatori per categoria, ordinati per rating desc
  const playersByCategory = useMemo(() => {
    const cats: Record<string, DraftSlot[]> = { GK: [], DEF: [], MID: [], ATT: [] };
    for (const s of slots) {
      if (!s.player) continue;
      const cat = s.player.position_category;
      if (cat in cats) cats[cat].push(s);
    }
    // Ordina ciascuna per rating
    for (const k of Object.keys(cats)) {
      cats[k].sort((a, b) => (b.player?.rating ?? 0) - (a.player?.rating ?? 0));
    }
    return cats;
  }, [slots]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">

        {/* ── Hero result ── */}
        <div className="text-center space-y-2 py-4">
          <p className="text-5xl">{badge.emoji}</p>
          <h1 className="text-2xl font-black text-white">{badge.label}</h1>
          <p className="text-sm text-slate-400">
            Hai finito{' '}
            <span className={`font-black text-4xl ${badge.color}`}>{result.playerFinalPosition}°</span>{' '}
            in Serie A con{' '}
            <span className="font-bold text-emerald-400">{result.playerPoints} punti</span>
          </p>
        </div>

        {/* ── Stats personali ── */}
        <section className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">LA TUA STAGIONE</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Punti',  value: result.playerPoints,       color: 'text-emerald-400' },
              { label: 'Gol F.', value: playerRow?.gf ?? 0,        color: 'text-white' },
              { label: 'Gol S.', value: playerRow?.ga ?? 0,        color: 'text-white' },
              { label: 'DR',     value: gd > 0 ? `+${gd}` : String(gd), color: gd >= 0 ? 'text-emerald-400' : 'text-red-400' },
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

        {/* ── Commento tecnico ── */}
        <section className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">📋 ANALISI TECNICA</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'ATT', value: overall.attack,   color: '#ef4444' },
              { label: 'MID', value: overall.midfield, color: '#22c55e' },
              { label: 'DEF', value: overall.defence,  color: '#3b82f6' },
              { label: 'GK',  value: overall.gk,       color: '#f59e0b' },
            ].map((d) => (
              <div key={d.label} className="glass rounded-xl p-2 text-center">
                <p className="text-base font-black" style={{ color: d.color }}>{d.value}</p>
                <p className="text-[10px] text-slate-500">{d.label}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{techComment}</p>
        </section>

        {/* ── Recap giocatori ── */}
        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">LA TUA ROSA</p>
          </div>
          {(['GK', 'DEF', 'MID', 'ATT'] as const).map((cat) => {
            const catSlots = playersByCategory[cat];
            if (catSlots.length === 0) return null;
            const color = catColor(cat);
            const labels: Record<string, string> = { GK: 'Portieri', DEF: 'Difensori', MID: 'Centrocampisti', ATT: 'Attaccanti' };
            return (
              <div key={cat}>
                <div className="px-4 py-1.5 border-b border-white/[0.04]" style={{ backgroundColor: color + '15' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{labels[cat]}</p>
                </div>
                {catSlots.map((s) => {
                  const p = s.player!;
                  const ratingColor =
                    p.rating >= 85 ? '#4ade80' :
                    p.rating >= 75 ? '#fbbf24' : '#f87171';
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0"
                    >
                      {/* Mini avatar */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                        style={{ backgroundColor: color + '22', color }}
                      >
                        {s.formationSlot.acceptedPositions[0] ?? cat}
                      </div>
                      {/* Nome */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-500">{p.club} · {p.season}</p>
                      </div>
                      {/* Rating */}
                      <span className="text-base font-black" style={{ color: ratingColor }}>{p.rating}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
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
            const isCL   = pos <= 4;
            const isEL   = pos <= 6;
            const isConf = pos === 7;
            const isRel  = pos >= 18;

            let indicator = '';
            if (isChamp)    indicator = '🏆';
            else if (isCL)  indicator = '🟢';
            else if (isEL)  indicator = '🔵';
            else if (isConf)indicator = '🩵';
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
