'use client';
import React from 'react';
import type { DraftedPlayer } from '@/lib/draft';
import { displayRating, ratingColorClass } from '@/lib/draft';
import type { SetupConfig } from '@/app/game/page';

interface Props {
  player: DraftedPlayer;
  showRatings: SetupConfig['showRatings'];
  difficulty: SetupConfig['difficulty'];
  onPick: (_player: DraftedPlayer) => void;
  /** Hint slot target (es. 'CB') */
  targetSlotLabel?: string;
  disabled?: boolean;
}

export default function PlayerCard({
  player,
  showRatings,
  difficulty,
  onPick,
  targetSlotLabel,
  disabled = false,
}: Props) {
  const rating = player.rating;
  const ratingStr = displayRating(rating, showRatings, difficulty);
  const hidden = ratingStr === '??';

  return (
    <button
      onClick={() => !disabled && onPick(player)}
      disabled={disabled}
      className={[
        'group relative flex items-center gap-3 rounded-xl border p-3 text-left',
        'transition-all duration-150',
        disabled
          ? 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
          : 'border-white/10 bg-white/[0.04] hover:border-emerald-500/40 hover:bg-emerald-500/8 cursor-pointer',
      ].join(' ')}
    >
      {/* Rating badge */}
      <div className={[
        'flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-black text-lg',
        hidden
          ? 'bg-white/5 text-slate-400'
          : rating >= 85 ? 'bg-emerald-500/20 text-emerald-400'
          : rating >= 72 ? 'bg-amber-500/20 text-amber-400'
          : 'bg-red-500/20 text-red-400',
      ].join(' ')}>
        {ratingStr}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{player.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          <span className={`font-semibold ${
            hidden ? 'text-slate-400' : ratingColorClass(rating)
          }`}>{player.position}</span>
          {' · '}{player.club}{' '}
          <span className="text-slate-500">{player.season}</span>
        </p>
        {/* Badge prime mode */}
        {player.primeRating !== undefined && !hidden && (
          <p className="text-[10px] text-violet-400 mt-0.5 font-semibold">
            ★ Prime
          </p>
        )}
      </div>

      {/* Slot target badge */}
      {targetSlotLabel && (
        <span className="flex-shrink-0 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
          → {targetSlotLabel}
        </span>
      )}

      {/* Hover glow */}
      {!disabled && (
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ring-1 ring-emerald-500/30" />
      )}
    </button>
  );
}
