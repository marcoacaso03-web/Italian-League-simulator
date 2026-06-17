import React, { useMemo, useEffect, useState } from 'react';
import { Link } from 'wouter';
import type { DraftSlot } from '../lib/draft';
import type { SeasonResult, TeamOverall } from '../lib/simulation';
import type { SetupConfig } from '../pages/GamePage';
import {
  calcScore,
  checkInTop50,
  submitScore,
} from '../lib/leaderboard';
import { useAuth } from '../context/AuthContext';

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
  const { user, signIn } = useAuth();

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

  // Check top-50 eligibility when user is logged in
  useEffect(() => {
    if (!user) { setSubmitState('idle'); return; }
    setSubmitState('checking');
    checkInTop50(myScore).then((inTop) => {
      if (inTop) setSubmitState('show_form');
      else       setSubmitState('not_top50');
    }).catch(() => setSubmitState('show_form'));
  }, [myScore, user]);

  async function handleSubmit() {
    if (!user) return;
    setSubmitState('submitting');
    try {
      const res = await submitScore({
        nickname:    user.displayName ?? user.email ?? 'Anonimo',
        uid:         user.uid,
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

        {/* Badge risultato */}
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

        {/* ── Classifica Globale (prima sezione) ── */}
        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">🌍 CLASSIFICA GLOBALE</p>
            <Link href="/leaderboard">
              <button className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">
                Vedi classifica →
              </button>
            </Link>
          </div>

          {/* Score card */}
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

          {/* Stato: non loggato */}
          {!user && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 text-center">
                Accedi con Google per salvare il tuo punteggio in classifica
              </p>
              <button
                onClick={signIn}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-white py-3 text-sm font-bold text-gray-800 hover:bg-gray-100 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Accedi con Google
              </button>
            </div>
          )}

          {/* Stato: loggato, checking */}
          {user && submitState === 'checking' && (
            <p className="text-xs text-slate-500 text-center animate-pulse">Controllo classifica…</p>
          )}

          {/* Stato: non in top 50 */}
          {user && submitState === 'not_top50' && (
            <p className="text-xs text-slate-500 text-center">
              Il tuo score non è ancora nella top 50. Riprova con una difficoltà più alta!
            </p>
          )}

          {/* Stato: punteggio non migliorato */}
          {user && submitState === 'not_improved' && (
            <p className="text-xs text-slate-500 text-center">
              Hai già un punteggio migliore in classifica. Continua così!
            </p>
          )}

          {/* Stato: pronto per il submit */}
          {user && submitState === 'show_form' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                {user.photoURL && (
                  <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.displayName ?? user.email}</p>
                  <p className="text-[10px] text-slate-500">Salverai come questo account</p>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-black hover:bg-emerald-400 transition-all"
              >
                🏆 Salva in classifica
              </button>
            </div>
          )}

          {/* Stato: salvataggio in corso */}
          {user && submitState === 'submitting' && (
            <p className="text-xs text-slate-500 text-center animate-pulse">Salvataggio in corso…</p>
          )}

          {/* Stato: salvato */}
          {user && submitState === 'done' && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-emerald-400 font-black text-sm">✅ Score salvato in classifica!</p>
                <p className="text-[10px] text-slate-500 mt-1">Sarà aggiornato automaticamente se migliori.</p>
              </div>
              <Link href="/leaderboard">
                <button className="w-full rounded-xl border border-emerald-500/30 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 transition-all">
                  🌍 Vedi la classifica globale
                </button>
              </Link>
            </div>
          )}

          {/* Stato: errore */}
          {user && submitState === 'error' && (
            <p className="text-xs text-red-400 text-center">
              Errore di connessione. Controlla la rete e riprova.
            </p>
          )}
        </section>

        {/* Stagione stats */}
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

        {/* Analisi tecnica */}
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

        {/* Rosa */}
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

        {/* Classifica finale */}
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
