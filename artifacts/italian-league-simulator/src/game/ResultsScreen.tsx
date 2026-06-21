import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import type { DraftSlot } from '../lib/draft';
import type { SeasonResult, TeamOverall } from '../lib/simulation';
import type { SetupConfig } from '../pages/GamePage';
import {
  calcScore,
  submitScore,
  getUserCode,
  createAndSaveCode,
} from '../lib/leaderboard';
import { useAuth } from '../context/AuthContext';

interface Props {
  result:    SeasonResult;
  overall:   TeamOverall;
  slots:     DraftSlot[];
  config:    SetupConfig;
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

export default function ResultsScreen({ result, overall, slots, config, onRestart }: Props) {
  const { t } = useTranslation();
  const { user, signIn, firebaseReady } = useAuth();
  const badge     = finishBadge(result.playerFinalPosition, t);
  const playerRow = result.standings.find((s) => s.isPlayer);
  const gd        = (playerRow?.gf ?? 0) - (playerRow?.ga ?? 0);

  const techComment = useMemo(
    () => buildTechComment(result.playerFinalPosition, result.playerPoints, t),
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

  const sortedStandings = useMemo(() => {
    return [...result.standings].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));
  }, [result.standings]);

  const myScore = useMemo(() => calcScore({
    points:      result.playerPoints,
    position:    result.playerFinalPosition,
    overall:     overall.overall,
    difficulty:  config.difficulty,
    showRatings: config.showRatings,
  }), [result, overall, config]);

  // Submit state: 'form' | 'submitting' | 'done' | 'error'
  const [submitState, setSubmitState] = useState<'form' | 'submitting' | 'done' | 'error'>('form');
  const [nickname, setNickname] = useState('');
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const existingCode = useMemo(() => getUserCode(), []);

  async function handleSaveAsGuest(e: React.FormEvent) {
    e.preventDefault();
    const code = existingCode ?? createAndSaveCode(nickname);
    setSubmitState('submitting');
    try {
      await submitScore({
        nickname:    code,
        uid:         null,
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
      setFinalCode(code);
      setSubmitState('done');
    } catch {
      setSubmitState('error');
    }
  }

  async function handleSaveWithGoogle() {
    // If not signed in, sign in first
    if (!user && firebaseReady) {
      try {
        await signIn();
      } catch {
        return;
      }
    }
    // After sign-in (or if already signed in), submit
    // We need to wait for the auth state to update, so we use a small delay
    setTimeout(async () => {
      setSubmitState('submitting');
      try {
        await submitScore({
          nickname:    `${user?.displayName ?? 'PLAYER'}#${String(Math.floor(Math.random() * 9000) + 1000)}`,
          uid:         user?.uid ?? null,
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
        setFinalCode(null);
        setSubmitState('done');
      } catch {
        setSubmitState('error');
      }
    }, 1500);
  }

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

        {/* ── Leaderboard save section ── */}
        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">🌍 {t('lb_title')}</p>
            <Link href="/leaderboard">
              <button className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold">
                {t('lb_view_full')} →
              </button>
            </Link>
          </div>

          {/* Score display */}
          <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">{t('lb_your_score')}</p>
              <p className="text-2xl font-black text-emerald-400">{myScore.toLocaleString()}</p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5">
              <p>{config.formation} · {config.difficulty === 'hard' ? '🔴' : config.difficulty === 'normal' ? '🟡' : '🟢'} {config.difficulty}</p>
              {config.showRatings === 'off' && <p className="text-purple-400">🔒 {t('lb_blind')}</p>}
              <p>{config.eraFrom}–{config.eraTo}</p>
            </div>
          </div>

          {/* Show form only if not yet submitted */}
          {submitState === 'form' && (
            <>
              {/* Google sign-in button */}
              {firebaseReady && !user && (
                <button
                  onClick={handleSaveWithGoogle}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/10 py-3 text-sm font-bold text-white hover:bg-white/5 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t('lb_save_with_google')}
                </button>
              )}

              {/* Already signed in — show save button */}
              {firebaseReady && user && (
                <button
                  onClick={handleSaveWithGoogle}
                  className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-black hover:bg-emerald-400 transition-all"
                >
                  🏆 {t('lb_save_score')}
                </button>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-slate-500 uppercase">{t('lb_or_continue_guest')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Guest form */}
              <form onSubmit={handleSaveAsGuest} className="space-y-3">
                {existingCode ? (
                  <div className="bg-emerald-500/10 rounded-xl px-4 py-3">
                    <p className="text-xs text-slate-400">{t('lb_your_code')}</p>
                    <p className="text-base font-black text-emerald-300">{existingCode}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 block">{t('lb_choose_nickname')}</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                      placeholder="ES. ROSSI"
                      maxLength={12}
                      required={!existingCode}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                    <p className="text-[10px] text-slate-600">
                      {t('lb_code_hint')} <span className="text-slate-400">ROSSI#4821</span>
                    </p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!existingCode && nickname.length < 2}
                  className="w-full rounded-xl border border-emerald-500/30 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  👤 {t('lb_save_as_guest')}
                </button>
              </form>
            </>
          )}

          {submitState === 'submitting' && (
            <p className="text-xs text-slate-500 text-center animate-pulse">{t('lb_saving')}</p>
          )}

          {submitState === 'done' && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-emerald-400 font-black text-sm">✅ {t('lb_saved')}</p>
                {finalCode && <p className="text-xs text-slate-400 mt-1">{t('lb_your_code')}: <span className="text-emerald-300 font-bold">{finalCode}</span></p>}
              </div>
              <Link href="/leaderboard">
                <button className="w-full rounded-xl border border-emerald-500/30 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 transition-all">
                  🌍 {t('lb_view_full')}
                </button>
              </Link>
            </div>
          )}

          {submitState === 'error' && (
            <p className="text-xs text-red-400 text-center">{t('lb_error')}</p>
          )}
        </section>

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
