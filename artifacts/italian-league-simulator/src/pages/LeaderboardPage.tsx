import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { getLeaderboard, difficultyLabel, getUserCode, type LeaderboardEntry } from '../lib/leaderboard';

function medalEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export default function LeaderboardPage() {
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const myCode = getUserCode();

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .catch(() => setError('Impossibile caricare la classifica.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-5">

        <div className="flex items-center gap-3 mb-2">
          <Link href="/">
            <button className="text-slate-400 hover:text-white text-sm transition-colors">← Home</button>
          </Link>
        </div>

        <div className="text-center space-y-1">
          <p className="text-4xl">🌍</p>
          <h1 className="text-2xl font-black text-white">Classifica Globale</h1>
          <p className="text-sm text-slate-400">Top 50 partite di sempre</p>
        </div>

        {loading && (
          <div className="text-center py-10 text-slate-500 text-sm">Caricamento…</div>
        )}

        {error && (
          <div className="text-center py-10 text-red-400 text-sm">{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">
            Nessun punteggio ancora. Sii il primo!
          </div>
        )}

        {!loading && entries.length > 0 && (
          <section className="glass rounded-2xl overflow-hidden">
            {entries.map((e, i) => {
              const rank = i + 1;
              const isMe = myCode !== null && e.nickname === myCode;
              return (
                <div key={e.id}
                  className={[
                    'flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0',
                    isMe ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : '',
                  ].join(' ')}>

                  <span className={`w-7 flex-shrink-0 text-center font-bold ${rank <= 3 ? 'text-xl leading-none' : 'text-xs text-slate-500'}`}>
                    {medalEmoji(rank)}
                  </span>

                  <div className="flex-1">
                    <p className={`text-sm font-bold break-all ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                      {e.nickname}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {e.formation} · {difficultyLabel(e.difficulty)}
                      {e.show_ratings === 'off' ? ' · 🔒 blind' : ''} · {e.era_from}–{e.era_to}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right space-y-0.5">
                    <p className="text-sm font-black text-emerald-400">{e.score.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500">
                      {e.points}pts · OVR {e.overall} ·{' '}
                      <span className={e.position <= 4 ? 'text-emerald-400' : e.position >= 18 ? 'text-red-400' : 'text-slate-400'}>
                        {e.position}°
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <Link href="/game">
          <button className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-black text-black hover:bg-emerald-400 transition-all hover:scale-[1.02] active:scale-[0.98]">
            ⚽ Gioca e scala la classifica
          </button>
        </Link>
      </div>
    </div>
  );
}
