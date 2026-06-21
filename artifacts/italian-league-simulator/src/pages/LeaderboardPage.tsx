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
          <section className="space-y-2">
            {entries.map((e, i) => {
              const rank = i + 1;
              const isMe = myCode && e.nickname === myCode;
              return (
                <div key={`${e.id}-${i}`}
                  className={[
                    'glass rounded-xl px-4 py-3 border border-white/[0.06]',
                    isMe ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20' : '',
                  ].join(' ')}>

                  {/* Top row: rank + nickname (full width) */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-sm font-bold w-8 text-center shrink-0 ${rank <= 3 ? 'text-lg leading-none' : 'text-slate-500'}`}>
                      {medalEmoji(rank)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                        {e.nickname}
                        {isMe && <span className="ml-2 text-[10px] text-emerald-500 font-normal">{t('lb_you')}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Bottom row: stats */}
                  <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr] gap-2 text-[10px] text-slate-500 uppercase tracking-wider mb-1 pl-11">
                    <span></span>
                    <span>{t('lb_col_score')}</span>
                    <span>OVR</span>
                    <span>{t('lb_col_points')}</span>
                    <span>{t('lb_col_info')}</span>
                    <span>Info</span>
                  </div>
                  <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr] gap-2 items-center pl-11">
                    <span></span>
                    <p className="text-sm font-black text-emerald-400">{e.score.toLocaleString()}</p>
                    <p className="text-sm font-bold text-white">{e.overall}</p>
                    <p className="text-sm text-slate-300">{e.points}</p>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {e.era_from}–{e.era_to}<br />
                      <span className={`font-semibold ${e.position <= 4 ? 'text-emerald-400' : e.position >= 18 ? 'text-red-400' : 'text-slate-400'}`}>
                        {e.position}°
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {e.formation}<br />
                      {difficultyEmoji(e.difficulty)} {e.difficulty}
                      {e.show_ratings === 'off' ? ` · ${t('lb_blind')}` : ''}
                    </p>
                  </div>
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
