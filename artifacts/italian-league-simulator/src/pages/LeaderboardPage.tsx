import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { fetchLeaderboard, getUserCode, type LeaderboardEntry } from '../lib/leaderboard';

// Client-side cache
let cachedEntries: LeaderboardEntry[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

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
  const [entries, setEntries] = useState<LeaderboardEntry[]>(cachedEntries ?? []);
  const [loading, setLoading] = useState(!cachedEntries);
  const [error, setError]   = useState<string | null>(null);
  const myCode = getUserCode();

  const loadLeaderboard = useCallback(async () => {
    // Use cache if fresh
    if (cachedEntries && Date.now() - cacheTime < CACHE_TTL) {
      setEntries(cachedEntries);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchLeaderboard();
      cachedEntries = data;
      cacheTime = Date.now();
      setEntries(data);
      setError(null);
    } catch {
      setError(t('lb_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

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
              const isMe = myCode && e.nickname === myCode;
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
