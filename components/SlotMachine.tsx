'use client';
import React, { useState, useEffect } from 'react';

interface Props {
  club: string;
  season: string;
  /** Callback chiamato quando l'animazione finisce */
  onReveal?: () => void;
}

/**
 * Anima il reveal di club+stagione come una slot machine.
 * Usa CSS keyframes — nessuna libreria esterna.
 */
export default function SlotMachine({ club, season, onReveal }: Props) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const t = setTimeout(() => {
      setRevealed(true);
      onReveal?.();
    }, 900);
    return () => clearTimeout(t);
  }, [club, season, onReveal]);

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sorteggio</p>
      <div className="flex items-center gap-3">
        {/* Club */}
        <div
          className={[
            'px-5 py-3 rounded-xl border-2 text-xl font-black transition-all duration-500',
            revealed
              ? 'border-emerald-500/60 bg-emerald-500/10 text-white scale-105'
              : 'border-white/10 bg-white/[0.03] text-slate-500 blur-sm scale-95',
          ].join(' ')}
          style={{ minWidth: '120px', textAlign: 'center' }}
        >
          {revealed ? club : '???'}
        </div>
        <span className="text-slate-600 font-bold">•</span>
        {/* Season */}
        <div
          className={[
            'px-5 py-3 rounded-xl border-2 text-xl font-black transition-all duration-500 delay-200',
            revealed
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 scale-105'
              : 'border-white/10 bg-white/[0.03] text-slate-500 blur-sm scale-95',
          ].join(' ')}
          style={{ minWidth: '100px', textAlign: 'center' }}
        >
          {revealed ? season : '??/??'}
        </div>
      </div>
    </div>
  );
}
