import React, { useMemo, useEffect, useState } from 'react';
import { Link } from 'wouter';
import type { DraftSlot } from '../lib/draft';
import type { SeasonResult, TeamOverall } from '../lib/simulation';
import type { SetupConfig } from '../pages/GamePage';
import {
  calcScore,
  checkInTop50,
  submitScore,
  getUserCode,
  createAndSaveCode,
} from '../lib/leaderboard';

interface Props {
  result:    SeasonResult;
  overall:   TeamOverall;
  slots:     DraftSlot[];
  config:    SetupConfig;
  onRestart: () => void;
}

function finishBadge(pos: number): { emoji: string; label: string; color: string } {
  if (pos === 1)  return { emoji: '🏆', label: "Campione d'Italia!",  color: 'text-amber-400' };
  if (pos <= 4)   return { emoji: '🎯', label: 'Champions League',    color: 'text-emerald-400' };
  if (pos <= 6)   return { emoji: '🇪🇺', label: 'Europa League',       color: 'text-blue-400' };
  if (pos <= 7)   return { emoji: '🏅', label: 'Conference League',   color: 'text-teal-400' };
  if (pos >= 18)  return { emoji: '💔', label: 'Retrocessione',       color: 'text-red-400' };
  return                 { emoji: '⚽', label: 'Serie A completata',  color: 'text-slate-300' };
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

function buildTechComment(pos: number, pts: number, overall: TeamOverall, gf: number, ga: number): string {
  const att = overall.attack, def = overall.defence, mid = overall.midfield, gk = overall.gk;
  const lines: string[] = [];
  if (pos === 1)       lines.push(`Una stagione perfetta. ${pts} punti, lo Scudetto alzato a San Siro: questa è storia.`);
  else if (pos <= 4)   lines.push(`Qualificazione Champions League centrata. ${pts} punti sono il frutto di un lavoro tattico solido.`);
  else if (pos <= 6)   lines.push(`Europa League conquistata. La squadra ha dimostrato carattere, chiudendo con ${pts} punti.`);
  else if (pos <= 10)  lines.push(`Una stagione di metà classifica: ${pts} punti, qualche rimpianto ma anche momenti di qualità.`);
  else if (pos <= 14)  lines.push(`Salvezza tranquilla a ${pts} punti. La squadra ha lottato, ma manca continuità.`);
  else if (pos < 18)   lines.push(`Una stagione sofferta. ${pts} punti bastano appena per la salvezza. Molto da migliorare.`);
  else                 lines.push(`La retrocessione è una realtà dura. ${pts} punti non sono bastati per restare in Serie A.`);
  const depts = [{ name: 'attacco', v: att }, { name: 'centrocampo', v: mid }, { name: 'difesa', v: def }, { name: 'portiere', v: gk }];
  const best  = depts.reduce((a, b) => (a.v >= b.v ? a : b));
  const worst = depts.reduce((a, b) => (a.v <= b.v ? a : b));
  lines.push(`Il punto di forza è stato il ${best.name} (${best.v}), mentre il ${worst.name} (${worst.v}) è rimasto il tallone d'Achille.`);
  if (gf >= 70)       lines.push(`L'attacco ha brillato con ${gf} gol segnati — uno dei migliori della lega.`);
  else if (gf >= 50)  lines.push(`${gf} reti segnate: una produzione offensiva discreta.`);
  else                lines.push(`Solo ${gf} gol in tutto il campionato: servono rinforzi in attacco.`);
  if (ga <= 30)       lines.push(`Difensivamente impeccabile: solo ${ga} gol subiti.`);
  else if (ga <= 50)  lines.push(`${ga} gol subiti — la difesa ha retto, ma può fare di più.`);
  else                lines.push(`${ga} reti al passivo: la tenuta difensiva va rivista in profondità.`);
  return lines.join(' ');
}

type SubmitState = 'idle' | 'checking' | 'show_form' | 'not_top50' | 'submitting' | 'done' | 'error' | 'not_improved';

export default function ResultsScreen({ result, overall, slots, config, onRestart }: Props) {
  const badge     = finishBadge(result.playerFinalPosition);
  const playerRow = result.standings.find((s) => s.isPlayer);
  const gd        = (playerRow?.gf ?? 0) - (playerRow?.ga ?? 0);

  const techComment = useMemo(
    () => buildTechComment(result.playerFinalPosition, result.playerPoints, overall, result.playerGF, result.playerGA),
    [result, overall],
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

  const myScore = useMemo(() => calcScore({
    points:      result.playerPoints,
    position:    result.playerFinalPosition,
    overall:     overall.overall,
    difficulty:  config.difficulty,
    showRatings: config.showRatings,
  }), [result, overall, config]);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [nickname, setNickname]       = useState('');
  const [finalCode, setFinalCode]     = useState<string | null>(null);
  const existingCode                  = useMemo(() => getUserCode(), []);

  useEffect(() => {
    setSubmitState('checking');
    checkInTop50(myScore).then((inTop) => {
      if (inTop) setSubmitState('show_form');
      else       setSubmitState('not_top50');
    }).catch(() => setSubmitState('show_form'));
  }, [myScore]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = existingCode ?? createAndSaveCode(nickname);
    setSubmitState('submitting');
    try {
      const res = await submitScore({
        nickname:    code,
        score:       myScore,
        overall:     overall.overall,
        points:      result.playerPoints,
        position:    result.playerFinalPosition,
        formation:   config.formation,
        difficulty:  config.difficulty,
        showRatings: config.showRatings,
        eraFrom:     config.eraFrom,
        eraTo:       config.eraTo,
      });
      if (res.inserted) {
        setFinalCode(code);
        setSubmitState('done');
      } else if (res.reason === 'existing_score_better') {
        setSubmitState('not_improved');
      } else {
        setSubmitState('not_top50');
      }
    } catch {
      setSubmitState('error');
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">

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

        {/* ── Leaderboard section (prima cosa dopo il badge) ── */}
        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">🌍 CLASSIFICA GLOBALE</p>
            <Link href="/leaderboard">
              <button className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">
                Vedi classifica →
              </button>
            </Link>
          </div>

          <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">Il tuo score</p>
              <p className="text-2xl font-black text-emerald-400">{myScore.toLocaleString()}</p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5">
              <p>{config.formation} · {config.difficulty === 'hard' ? '🔴' : config.difficulty === 'normal' ? '🟡' : '🟢'} {config.difficulty}</p>
              {config.showRatings === 'off' && <p className="text-purple-400">🔒 blind mode</p>}
              <p>{config.eraFrom}–{config.eraTo}</p>
            </div>
          </div>

          {submitState === 'checking' && (
            <p className="text-xs text-slate-500 text-center animate-pulse">Controllo classifica…</p>
          )}

          {submitState === 'not_top50' && (
            <p className="text-xs text-slate-500 text-center">
              Il tuo score non è ancora nella top 50. Riprova con una difficoltà più alta!
            </p>
          )}

          {submitState === 'not_improved' && (
            <p className="text-xs text-slate-500 text-center">
              Hai già un punteggio migliore in classifica. Continua così!
            </p>
          )}

          {submitState === 'show_form' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {existingCode ? (
                <div className="bg-emerald-500/10 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-400">Il tuo codice salvato</p>
                  <p className="text-base font-black text-emerald-300">{existingCode}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block">Scegli un nickname (solo lettere e numeri)</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                    placeholder="ES. ROSSI"
                    maxLength={12}
                    required={!existingCode}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
                  />
                  <p className="text-[10px] text-slate-600">
                    Il sistema assegnerà un codice univoco tipo <span className="text-slate-400">ROSSI#4821</span>
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={!existingCode && nickname.length < 2}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-black hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🏆 Salva in classifica
              </button>
            </form>
          )}

          {submitState === 'submitting' && (
            <p className="text-xs text-slate-500 text-center animate-pulse">Salvataggio in corso…</p>
          )}

          {submitState === 'done' && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-emerald-400 font-black text-sm">✅ Score salvato!</p>
                {finalCode && <p className="text-xs text-slate-400 mt-1">Il tuo codice: <span className="text-emerald-300 font-bold">{finalCode}</span></p>}
                <p className="text-[10px] text-slate-500 mt-1">Salvato su questo dispositivo. Potrai aggiornarlo se migliori.</p>
              </div>
              <Link href="/leaderboard">
                <button className="w-full rounded-xl border border-emerald-500/30 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 transition-all">
                  🌍 Vedi la classifica globale
                </button>
              </Link>
            </div>
          )}

          {submitState === 'error' && (
            <p className="text-xs text-red-400 text-center">
              Errore di connessione. Controlla la rete e riprova.
            </p>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">LA TUA STAGIONE</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Punti',  value: result.playerPoints,             color: 'text-emerald-400' },
              { label: 'Gol F.', value: playerRow?.gf ?? 0,              color: 'text-white' },
              { label: 'Gol S.', value: playerRow?.ga ?? 0,              color: 'text-white' },
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

        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">CLASSIFICA FINALE</p>
          </div>
          {result.standings.map((team, i) => {
            const pos = i + 1;
            const isPlayer = team.isPlayer;
            const isChamp  = pos === 1;
            const isCL     = pos <= 4;
            const isEL     = pos <= 6;
            const isConf   = pos === 7;
            const isRel    = pos >= 18;
            let indicator = '';
            if (isChamp)      indicator = '🏆';
            else if (isCL)   indicator = '🟢';
            else if (isEL)   indicator = '🔵';
            else if (isConf) indicator = '🩵';
            else if (isRel)  indicator = '🔴';
            return (
              <div key={team.teamId}
                className={['flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0', isPlayer ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : ''].join(' ')}>
                <span className={`w-5 text-xs font-bold text-center flex-shrink-0 ${isPlayer ? 'text-emerald-400' : 'text-slate-500'}`}>{pos}</span>
                <span className="text-base">{indicator}</span>
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
                  style={{ backgroundColor: team.color + '33', color: team.color }}>
                  {team.abbr.slice(0, 3)}
                </div>
                <span className={`flex-1 text-sm truncate ${isPlayer ? 'font-black text-emerald-300' : 'font-medium text-slate-300'}`}>{team.name}</span>
                <span className={`text-sm font-bold flex-shrink-0 ${isPlayer ? 'text-emerald-400' : 'text-slate-400'}`}>{team.points}</span>
              </div>
            );
          })}
        </section>

        <button onClick={onRestart} className="w-full rounded-2xl bg-emerald-500 py-5 text-lg font-black text-black transition-all hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]">
          ↺ Gioca ancora
        </button>
      </div>
    </div>
  );
}
