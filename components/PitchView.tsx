'use client';
import React from 'react';
import type { DraftSlot } from '@/lib/draft';
import { ratingColorClass } from '@/lib/draft';
import type { SetupConfig } from '@/app/game/page';

interface Props {
  slots: DraftSlot[];
  showRatings: SetupConfig['showRatings'];
  draftMode: SetupConfig['draftMode'];
  activeSlotId: string | null;
  onSlotClick?: (slotId: string) => void;
}

export default function PitchView({
  slots,
  showRatings,
  draftMode,
  activeSlotId,
  onSlotClick,
}: Props) {
  return (
    <div className="relative w-full" style={{ paddingBottom: '140%' }}>
      {/* Campo */}
      <svg
        viewBox="0 0 100 140"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Sfondo erba */}
        <rect width="100" height="140" fill="#0f2010" rx="4" />
        {/* Righe campo */}
        <rect x="4" y="4" width="92" height="132" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" rx="2" />
        <line x1="4" y1="70" x2="96" y2="70" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <circle cx="50" cy="70" r="10" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        {/* Area rigore bassa */}
        <rect x="26" y="108" width="48" height="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        {/* Area rigore alta */}
        <rect x="26" y="8" width="48" height="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      </svg>

      {/* Slot giocatori */}
      {slots.map((slot) => {
        const { x, y, id, label } = slot.formationSlot;
        const player = slot.player;
        const isActive = activeSlotId === id;
        const isEmpty = player === null;
        const isClickable = draftMode === 'position_first' && isEmpty;

        return (
          <button
            key={id}
            onClick={() => isClickable && onSlotClick?.(id)}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={[
              'flex flex-col items-center gap-0.5 transition-all duration-200',
              isClickable ? 'cursor-pointer' : 'cursor-default',
            ].join(' ')}
            aria-label={player ? player.name : `Slot ${label} vuoto`}
          >
            {/* Pallino / avatar */}
            <div className={[
              'w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-200',
              isEmpty
                ? isActive
                  ? 'bg-emerald-500/30 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)] scale-110'
                  : isClickable
                    ? 'bg-white/5 border-white/20 hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:scale-105'
                    : 'bg-white/5 border-white/15'
                : `bg-emerald-900/60 border-emerald-500/40`
            ].join(' ')}>
              {isEmpty ? (
                <span className="text-slate-500 text-[10px]">{label}</span>
              ) : (
                <span className={`text-[11px] font-black ${
                  showRatings === 'off'
                    ? 'text-slate-300'
                    : ratingColorClass(player.rating)
                }`}>
                  {showRatings === 'off' ? '??' : player.rating}
                </span>
              )}
            </div>

            {/* Nome */}
            <span className={`text-[9px] font-bold leading-none max-w-[60px] text-center truncate ${
              isEmpty ? 'text-slate-600' : 'text-slate-200'
            }`}>
              {isEmpty ? '' : player.name.split(' ').slice(-1)[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
