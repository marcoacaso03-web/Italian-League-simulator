'use client';
import React, { useState, useEffect } from 'react';

interface Props {
  club: string;
  season: string;
  /** Chiamato quando l'animazione finisce e la lista può apparire */
  onReveal?: () => void;
}

/**
 * Animazione slot machine per club + stagione.
 * Fasi:
 *   1. 'rolling'  → mostra caratteri casuali che scorrono (600ms)
 *   2. 'settling' → blur/scale che si assesta (300ms)
 *   3. 'revealed' → mostra i veri valori, chiama onReveal()
 */
export default function SlotMachine({ club, season, onReveal }: Props) {
  type Phase = 'rolling' | 'settling' | 'revealed';
  const [phase, setPhase] = useState<Phase>('rolling');
  const [displayClub, setDisplayClub]   = useState('???');
  const [displaySeason, setDisplaySeason] = useState('??/??');

  useEffect(() => {
    setPhase('rolling');
    setDisplayClub('???');
    setDisplaySeason('??/??');

    // Fase 1: cifre che scorrono
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const roll = (len: number) =>
      Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

    let tick = 0;
    const interval = setInterval(() => {
      setDisplayClub(roll(Math.max(3, club.length)));
      setDisplaySeason(roll(5));
      tick++;
      if (tick >= 8) clearInterval(interval);
    }, 75);

    // Fase 2: settling → mostra il valore reale con blur
    const t1 = setTimeout(() => {
      clearInterval(interval);
      setPhase('settling');
      setDisplayClub(club);
      setDisplaySeason(season);
    }, 620);

    // Fase 3: revealed → chiama callback
    const t2 = setTimeout(() => {
      setPhase('revealed');
      onReveal?.();
    }, 980);

    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [club, season]); // eslint-disable-line react-hooks/exhaustive-deps

  const clubClass = [
    'px-5 py-3 rounded-xl border-2 text-xl font-black transition-all duration-300',
    phase === 'rolling'   && 'border-white/10 bg-white/[0.03] text-slate-400 blur-[2px] scale-95',
    phase === 'settling'  && 'border-amber-500/50 bg-amber-500/10 text-white scale-100',
    phase === 'revealed'  && 'border-emerald-500/60 bg-emerald-500/10 text-white scale-105',
  ].filter(Boolean).join(' ');

  const seasonClass = [
    'px-5 py-3 rounded-xl border-2 text-xl font-black transition-all duration-300 delay-100',
    phase === 'rolling'   && 'border-white/10 bg-white/[0.03] text-slate-400 blur-[2px] scale-95',
    phase === 'settling'  && 'border-amber-500/50 bg-amber-500/10 text-amber-300 scale-100',
    phase === 'revealed'  && 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 scale-105',
  ].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sorteggio</p>

      <div className="flex items-center gap-3">
        <div className={clubClass} style={{ minWidth: '130px', textAlign: 'center' }}>
          {displayClub}
        </div>
        <span className="text-slate-600 font-bold text-lg">·</span>
        <div className={seasonClass} style={{ minWidth: '100px', textAlign: 'center' }}>
          {displaySeason}
        </div>
      </div>

      {/* Indicatore di caricamento visibile durante rolling+settling */}
      {phase !== 'revealed' && (
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
