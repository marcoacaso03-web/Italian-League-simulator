'use client';
import React from 'react';

const DIFFICULTIES = [
  { id: 'easy', label: 'Facile', sub: '3 reroll disponibili', color: 'emerald' },
  { id: 'normal', label: 'Normale', sub: '1 reroll disponibile', color: 'amber' },
  { id: 'hard', label: 'Difficile', sub: 'No reroll · rating nascosti', color: 'red' },
];

interface Props { value: string; onChange: (_d: string) => void; }

export default function DifficultySelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {DIFFICULTIES.map((d) => {
        const active = value === d.id;
        const borderClass = active
          ? d.color === 'emerald' ? 'border-emerald-500/60 bg-emerald-500/10'
            : d.color === 'amber' ? 'border-amber-500/60 bg-amber-500/10'
            : 'border-red-500/60 bg-red-500/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]';
        const textClass = active
          ? d.color === 'emerald' ? 'text-emerald-400'
            : d.color === 'amber' ? 'text-amber-400'
            : 'text-red-400'
          : 'text-slate-300';
        const subClass = active
          ? d.color === 'emerald' ? 'text-emerald-400/70'
            : d.color === 'amber' ? 'text-amber-400/70'
            : 'text-red-400/70'
          : 'text-slate-500';
        return (
          <button key={d.id} onClick={() => onChange(d.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all duration-200 ${borderClass}`}>
            <span className={`text-sm font-bold ${textClass}`}>{d.label}</span>
            <span className={`text-xs text-center ${subClass}`}>{d.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
