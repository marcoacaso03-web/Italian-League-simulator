import React, { useState, useEffect } from 'react';

interface Props { club: string; season: string; onReveal?: () => void; }

export default function SlotMachine({ club, season, onReveal }: Props) {
  type Phase = 'rolling' | 'settling' | 'revealed';
  const [phase, setPhase] = useState<Phase>('rolling');
  const [dc, setDc] = useState('???');
  const [ds, setDs] = useState('??/??');

  useEffect(() => {
    setPhase('rolling'); setDc('???'); setDs('??/??');
    const C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const roll = (n: number) => Array.from({ length: n }, () => C[Math.floor(Math.random() * C.length)]).join('');
    let t = 0;
    const iv = setInterval(() => {
      setDc(roll(Math.max(3, club.length)));
      setDs(roll(5));
      if (++t >= 8) clearInterval(iv);
    }, 75);
    const t1 = setTimeout(() => { clearInterval(iv); setPhase('settling'); setDc(club); setDs(season); }, 620);
    const t2 = setTimeout(() => { setPhase('revealed'); onReveal?.(); }, 980);
    return () => { clearInterval(iv); clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club, season]);

  const base = 'px-5 py-3 rounded-xl border-2 text-xl font-black transition-all duration-300';
  const cls = (d = '') => [
    base, d,
    phase === 'rolling' && 'border-white/10 bg-white/[0.03] text-slate-400 scale-95',
    phase === 'settling' && 'border-amber-500/50 text-white scale-100',
    phase === 'revealed' && 'border-emerald-500/60 text-emerald-300 scale-105',
  ].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <p className="text-xs text-slate-500">Sorteggio</p>
      <div className="flex items-center gap-3">
        <div className={cls()} style={{ minWidth: '130px', textAlign: 'center' }}>{dc}</div>
        <span className="text-slate-600">·</span>
        <div className={cls('delay-100')} style={{ minWidth: '100px', textAlign: 'center' }}>{ds}</div>
      </div>
      {phase !== 'revealed' && (
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}
