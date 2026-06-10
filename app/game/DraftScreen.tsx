'use client';
import React, { useState } from 'react';
import type { SetupConfig } from '@/app/game/page';
import { useDraft } from '@/lib/useDraft';
import SlotMachine from '@/components/SlotMachine';
import {
  emptySlots, findBestSlot, findCompatibleSlots, REROLLS_BY_DIFFICULTY,
  type DraftedPlayer, type DraftSlot,
} from '@/lib/draft';
import { FORMATION_SLOTS } from '@/lib/formations';

// ─── Helpers colore per categoria ───────────────────────────────────────────
function catColor(cat: string): string {
  switch (cat) {
    case 'GK':  return '#f59e0b'; // amber
    case 'DEF': return '#3b82f6'; // blue
    case 'MID': return '#22c55e'; // green
    case 'ATT': return '#ef4444'; // red
    default:    return '#6b7280';
  }
}
function catLabel(cat: string): string {
  switch (cat) {
    case 'GK':  return 'Goalkeeper';
    case 'DEF': return 'Defender';
    case 'MID': return 'Midfielder';
    case 'ATT': return 'Attacker';
    default:    return cat;
  }
}
function diffColor(d: SetupConfig['difficulty']): string {
  return d === 'easy' ? '#22c55e' : d === 'normal' ? '#f59e0b' : '#ef4444';
}

// ─── Campo da calcio SVG ─────────────────────────────────────────────────────
interface PitchProps {
  formation: string;
  slots: DraftSlot[];
}
function Pitch({ formation, slots }: PitchProps) {
  const formSlots = FORMATION_SLOTS[formation] ?? [];
  // Mappa slotId → DraftSlot per accesso rapido
  const slotMap = new Map(slots.map((s) => [s.formationSlot.id, s]));

  return (
    <div className="relative w-full" style={{ aspectRatio: '7/10', maxHeight: '52vw', maxWidth: '100%' }}>
      {/* Campo verde */}
      <svg
        viewBox="0 0 100 143"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Strisce erba */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x="0" y={i * 18} width="100" height="18"
            fill={i % 2 === 0 ? '#1a4a1a' : '#1e5520'}
          />
        ))}
        {/* Bordo campo */}
        <rect x="4" y="4" width="92" height="135" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
        {/* Centrocampo */}
        <line x1="4" y1="71.5" x2="96" y2="71.5" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        <circle cx="50" cy="71.5" r="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        <circle cx="50" cy="71.5" r="0.8" fill="rgba(255,255,255,0.3)" />
        {/* Area grande (difesa, basso) */}
        <rect x="20" y="116" width="60" height="23" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        {/* Area piccola (difesa) */}
        <rect x="33" y="128" width="34" height="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        {/* Area grande (attacco, alto) */}
        <rect x="20" y="4" width="60" height="23" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        {/* Area piccola (attacco) */}
        <rect x="33" y="4" width="34" height="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
      </svg>

      {/* Slot pallini */}
      {formSlots.map((fs) => {
        const draftSlot = slotMap.get(fs.id);
        const filled = draftSlot?.player != null;
        const color = catColor(fs.category);
        // Coordinate: x% e y% sul viewBox 100×143 → converti in % del div
        const left = `${fs.x}%`;
        const top  = `${(fs.y / 143) * 100}%`;

        return (
          <div
            key={fs.id}
            className="absolute flex flex-col items-center"
            style={{
              left,
              top,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          >
            {/* Cerchio slot */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: filled ? `2px solid ${color}` : `2px dashed rgba(255,255,255,0.45)`,
                backgroundColor: filled ? color + '33' : 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {filled && draftSlot?.player && (
                <span style={{ fontSize: 7, fontWeight: 900, color, letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
                  {draftSlot.player.position.slice(0, 2)}
                </span>
              )}
              {!filled && (
                <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '-0.5px' }}>
                  {fs.acceptedPositions[0].slice(0, 2)}
                </span>
              )}
            </div>
            {/* Label sotto */}
            <div
              style={{
                marginTop: 2,
                background: 'rgba(0,0,0,0.75)',
                borderRadius: 3,
                padding: '1px 4px',
                fontSize: 7,
                fontWeight: 700,
                color: filled ? color : 'rgba(255,255,255,0.6)',
                whiteSpace: 'nowrap',
              }}
            >
              {filled ? (draftSlot?.player?.name.split(' ').pop() ?? fs.label) : fs.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card giocatore ──────────────────────────────────────────────────────────
interface PlayerCardProps {
  player: DraftedPlayer;
  disabled: boolean;
  showRating: boolean;
  compatibleSlotLabels: string[];
  onClick: () => void;
}
function PlayerCard({ player, disabled, showRating, compatibleSlotLabels, onClick }: PlayerCardProps) {
  const color = catColor(player.position_category);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all text-left',
        disabled
          ? 'opacity-30 cursor-not-allowed bg-white/[0.03] border border-white/5'
          : 'bg-white/[0.06] border border-white/10 active:scale-[0.98] hover:bg-white/10',
      ].join(' ')}
    >
      {/* Avatar colorato con ? */}
      <div
        style={{ backgroundColor: color + '28', border: `2px solid ${color}55` }}
        className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
      >
        <span style={{ color }} className="text-xl font-black">?</span>
      </div>

      {/* Nome + sub-label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{player.name}</p>
        <p className="text-xs text-slate-500 truncate">{catLabel(player.position_category)}</p>
      </div>

      {/* Badge slot compatibili + rating */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {compatibleSlotLabels.map((lbl) => (
          <span
            key={lbl}
            style={{ backgroundColor: color + '28', color, borderColor: color + '55' }}
            className="text-[10px] font-black px-2 py-0.5 rounded-md border"
          >
            {lbl}
          </span>
        ))}
        {showRating && (
          <span
            style={{ color: player.rating >= 85 ? '#4ade80' : player.rating >= 72 ? '#fbbf24' : '#f87171' }}
            className="text-base font-black w-8 text-right"
          >
            {player.rating}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
interface Props {
  config: SetupConfig;
  onBack: () => void;
  onComplete: (slots: DraftSlot[]) => void;
}

export default function DraftScreen({ config, onBack, onComplete }: Props) {
  const { state, reveal, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel } = useDraft(config);
  const [pendingPlayer, setPendingPlayer] = useState<DraftedPlayer | null>(null);

  const isSquadFirst = config.draftMode === 'squad_first';
  const filled = state.slots.filter((s) => s.player !== null).length;
  const total  = state.slots.length;
  const remaining = emptySlots(state.slots);
  const maxRerolls = REROLLS_BY_DIFFICULTY[config.difficulty];
  const showRating = config.showRatings !== 'off' && config.difficulty !== 'hard';

  void findBestSlot;

  function handlePick(player: DraftedPlayer) {
    const compat = findCompatibleSlots(state.slots, player);
    if (compat.length === 0) return;
    if (compat.length === 1) { pick(player, compat[0].formationSlot.id); setPendingPlayer(null); }
    else { setPendingPlayer(player); }
  }

  if (state.phase === 'complete') { onComplete(state.slots); return null; }

  const doSpin = isSquadFirst
    ? spinSquadFirst
    : () => selectSlotAndSpin(remaining[0]?.formationSlot.id ?? '');

  const diffLabel = config.difficulty.toUpperCase();

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3 flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">FORMATION</p>
            <p className="text-2xl font-black text-white">{config.formation}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              style={{ color: diffColor(config.difficulty) }}
              className="text-sm font-black uppercase tracking-widest"
            >
              {diffLabel}
            </span>
            <span className="text-sm font-bold text-white">
              <span style={{ color: filled > 0 ? '#22c55e' : '#6b7280' }}>{filled}</span>
              <span className="text-slate-600">/{total}</span>
            </span>
            <button
              onClick={onBack}
              className="text-slate-500 hover:text-white transition-colors text-lg"
              aria-label="Indietro"
            >
              ↺
            </button>
          </div>
        </div>
        {/* Barra progresso */}
        <div className="h-0.5 w-full bg-white/5 rounded-full mt-2">
          <div
            className="h-0.5 rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(filled / total) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Campo da calcio ────────────────────────────────────────────────── */}
      <div className="px-3">
        <div className="rounded-2xl overflow-hidden">
          <Pitch formation={config.formation} slots={state.slots} />
        </div>
      </div>

      {/* ── Scroll area inferiore ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-4">

        {/* SlotMachine animation */}
        {state.currentSpin && state.phase === 'spinning' && (
          <SlotMachine
            club={state.currentSpin.club}
            season={state.currentSpin.season}
            onReveal={reveal}
          />
        )}

        {/* SQUAD SPUN + lista giocatori */}
        {state.currentSpin && state.phase === 'picking' && (
          <div className="space-y-3">
            {/* Header sezione */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">SQUAD SPUN</p>
              <div className="flex items-center gap-2">
                {/* Dot colore club (placeholder rosso come nello screenshot) */}
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-xl font-black text-white">{state.currentSpin.club}</p>
                <p className="text-xl font-black" style={{ color: '#fbbf24' }}>{state.currentSpin.season}</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Scegli un giocatore, poi seleziona la posizione nella formazione.
              </p>
            </div>

            {/* Lista giocatori */}
            <div className="space-y-2">
              {state.currentSpin.players.map((player) => {
                const compat = findCompatibleSlots(state.slots, player);
                const disabled = compat.length === 0;
                const compatLabels = compat.map((s) => s.formationSlot.acceptedPositions[0]);
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    disabled={disabled}
                    showRating={showRating}
                    compatibleSlotLabels={compatLabels}
                    onClick={() => handlePick(player)}
                  />
                );
              })}
            </div>

            {/* Azioni */}
            <div className="flex gap-2 pt-1">
              {state.rerollsLeft > 0 && (
                <button
                  onClick={reroll}
                  className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
                >
                  🔄 Reroll ({state.rerollsLeft}/{maxRerolls})
                </button>
              )}
              <button
                onClick={cancel}
                className="flex-1 py-3 rounded-xl text-slate-400 text-sm hover:text-white transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Pulsante sorteggio (idle) */}
        {state.phase === 'idle' && remaining.length > 0 && (
          <button
            onClick={doSpin}
            className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 font-black text-lg text-black transition-all active:scale-[0.98]"
          >
            🎲 Sorteggia
          </button>
        )}
      </div>

      {/* ── Modale slot ambivalenti ─────────────────────────────────────────── */}
      {pendingPlayer && (
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50 p-4">
          <div className="bg-[#1a1a24] rounded-3xl p-6 w-full max-w-sm space-y-3 border border-white/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Dove lo metti?</p>
            <h3 className="text-lg font-black text-white">{pendingPlayer.name}</h3>
            {findCompatibleSlots(state.slots, pendingPlayer).map((s) => (
              <button
                key={s.formationSlot.id}
                onClick={() => { pick(pendingPlayer, s.formationSlot.id); setPendingPlayer(null); }}
                className="w-full py-4 rounded-2xl bg-white/[0.06] border border-white/10 font-bold text-white hover:bg-white/10 transition-colors"
              >
                {s.formationSlot.label}
              </button>
            ))}
            <button
              onClick={() => setPendingPlayer(null)}
              className="w-full py-2 text-slate-500 text-sm hover:text-white transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
