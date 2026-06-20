import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { fetchLeaderboard, getUserCode, type LeaderboardEntry } from '../lib/leaderboard';
import { useAuth } from '../context/AuthContext';

function medalEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function difficultyEmoji(d: string): string {
  if (d === 'hard')   return '🔴';
  if (d === 'normal') return '🟡';
  return '🟢';
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const { user, signIn, logOut, firebaseReady } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const myCode = getUserCode();

  useEffect(() => {
    fetchLeaderboard()
      .then(setEntries)
      .catch(() => setError(t('lb_error')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <button className="text-slate-400 hover:text-white text-sm transition-colors">
              {t('back_to_home')}
            </button>
          </Link>
          {firebaseReady && user ? (
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img src={user.photoURL} alt="avatar" className="w-7 h-7 rounded-full" />
              )}
              <span className="text-xs text-slate-400 max-w-[120px] truncate">
                {user.displayName ?? user.email}
              </span>
              <button onClick={logOut} className="text-xs text-slate-600 hover:text-slate-400 transition-colors ml-1">
                {t('lb_sign_out')}
              </button>
            </div>
          ) : firebaseReady ? (
            <button
              onClick={signIn}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors border border-white/10 rounded-lg px-3 py-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('lb_sign_in')}
            </button>
          ) : null}
        </div>

        <div className="text-center space-y-1">
          <p className="text-4xl">🌍</p>
          <h1 className="text-2xl font-black text-white">{t('lb_title')}</h1>
          <p className="text-sm text-slate-400">{t('lb_subtitle')}</p>
        </div>

        {loading && (
          <div className="text-center py-10 text-slate-500 text-sm">{t('lb_loading')}</div>
        )}
        {error && (
          <div className="text-center py-10 text-red-400 text-sm">{error}</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">{t('lb_empty')}</div>
        )}

        {!loading && entries.length > 0 && (
          <section className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="grid grid-cols-[2rem_1fr_4rem_3rem_3rem_4rem] gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>#</span>
                <span>{t('lb_col_nickname')}</span>
                <span className="text-right">{t('lb_col_score')}</span>
                <span className="text-right">OVR</span>
                <span className="text-right">{t('lb_col_points')}</span>
                <span className="text-right">{t('lb_col_info')}</span>
              </div>
            </div>
            {entries.map((e, i) => {
              const rank = i + 1;
              const isMe = (user && e.uid && e.uid === user.uid) || (!user && myCode && e.nickname === myCode);
              return (
                <div key={`${e.id}-${i}`}
                  className={[
                    'grid grid-cols-[2rem_1fr_4rem_3rem_3rem_4rem] gap-2 items-center px-4 py-2.5 border-b border-white/[0.04] last:border-b-0',
                    isMe ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : '',
                  ].join(' ')}>

                  <span className={`text-sm font-bold text-center ${rank <= 3 ? 'text-lg leading-none' : 'text-slate-500'}`}>
                    {medalEmoji(rank)}
                  </span>

                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                      {e.nickname}
                      {isMe && <span className="ml-2 text-[10px] text-emerald-500 font-normal">{t('lb_you')}</span>}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {e.formation} · {difficultyEmoji(e.difficulty)} {e.difficulty}
                      {e.show_ratings === 'off' ? ` · ${t('lb_blind')}` : ''}
                    </p>
                  </div>

                  <p className="text-sm font-black text-emerald-400 text-right">{e.score.toLocaleString()}</p>
                  <p className="text-sm font-bold text-white text-right">{e.overall}</p>
                  <p className="text-sm text-slate-300 text-right">{e.points}</p>
                  <p className="text-[10px] text-slate-500 text-right leading-tight">
                    {e.era_from}–{e.era_to}<br />
                    <span className={`font-semibold ${e.position <= 4 ? 'text-emerald-400' : e.position >= 18 ? 'text-red-400' : 'text-slate-400'}`}>
                      {e.position}°
                    </span>
                  </p>
                </div>
              );
            })}
          </section>
        )}

        <Link href="/game">
          <button className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-black text-black hover:bg-emerald-400 transition-all hover:scale-[1.02] active:scale-[0.98]">
            ⚽ {t('lb_play_cta')}
          </button>
        </Link>
      </div>
    </div>
  );
}
