'use client';
import React, { useState } from 'react';
import type { SetupConfig } from '@/app/game/page';
import { useDraft } from '@/lib/useDraft';
import SlotMachine from '@/components/SlotMachine';
import PlayerCard from '@/components/PlayerCard';
import PitchView from '@/components/PitchView';
import { emptySlots, findBestSlot, type DraftedPlayer, type DraftSlot } from '@/lib/draft';

// ─── Slot disambiguation modal (squad_first, quando un giocatore va bene
//     su più slot vuoti e nessuno è 'best match') ───────────────────────────

interface SlotPickerProps {
  player: DraftedPlayer;
  candidates: DraftSlot[];
  onConfirm: (slotId: string) => void;
  onCancel: () => void;
}

function SlotPicker({ player, candidates, onConfirm, onCancel }: SlotPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm glass rounded-2xl p-5 animate-bounce-in">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Scegli lo slot</p>
        <p className="text-sm font-bold text-white mb-4">
          {player.name} può giocare in più posizioni. Dove lo metti?
        </p>
        <div className="flex flex-col gap-2">
          {candidates.map((s) => (
            <button
              key={s.formationSlot.id}
              onClick={() => onConfirm(s.formationSlot.id)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white hover:border-emerald-500/40 hover:bg-emerald-500/8 transition-all"
            >
              <span>{s.formationSlot.label}</span>
              <span className="text-emerald-400">→</span>
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-4 w-full text-center text-xs text-slate-500 hover:text-white transition-colors">
          Annulla
        </button>
      </div>
    </div>
  );
}

// ─── DraftScreen ──────────────────────────────────────────────────────────────

interface Props {
  config: SetupConfig;
  onBack: () => void;
  onComplete: (slots: DraftSlot[]) => void;
}

export default function DraftScreen({ config, onBack, onComplete }: Props) {
  const { state, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel } = useDraft(config);
  const [pendingPlayer, setPendingPlayer] = useState<DraftedPlayer | null>(null);

  const isSquadFirst = config.draftMode === 'squad_first';
  const filled = state.slots.filter((s) => s.player !== null).length;
  const total = state.slots.length;
  const remaining = emptySlots(state.slots);

  // Squad_first: quando si preme su una card, proviamo auto-assign
  // Se ambiguo, mostriamo il SlotPicker
  function handlePickSquadFirst(player: DraftedPlayer) {
    const best = findBestSlot(state.slots, player);
    if (best) {
      pick(player, best.formationSlot.id);
    } else {
      // Trova tutti gli slot vuoti compatibili
      const candidates = remaining.filter((s) =>
        s.formationSlot.acceptedPositions.includes(player.position)
      );
      if (candidates.length === 1) {
        pick(player, candidates[0].formationSlot.id);
      } else if (candidates.length > 1) {
        setPendingPlayer(player);
      }
      // 0 candidati → il giocatore non è adatto, non si fa nulla
    }
  }

  // Position_first: l'utente ha già scelto lo slot, pick diretta
  function handlePickPositionFirst(player: DraftedPlayer) {
    if (!state.activeSlotId) return;
    pick(player, state.activeSlotId);
  }

  // Completamento
  if (state.phase === 'complete') {
    onComplete(state.slots);
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col lg:flex-row">

      {/* ── Colonna sinistra: pitch ─────────────────────────────────────── */}
      <div className="lg:w-[340px] lg:min-h-screen flex-shrink-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button onClick={onBack} className="text-slate-500 hover:text-white text-sm transition-colors">
            ← Setup
          </button>
          <div className="text-right">
            <p className="text-xs text-slate-500">{filled}/{total} giocatori</p>
            {state.rerollsLeft > 0 && (
              <p className="text-xs text-amber-400">{state.rerollsLeft} reroll rimasti</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mx-5 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(filled / total) * 100}%` }}
          />
        </div>

        {/* Pitch */}
        <div className="flex-1 p-5">
          <PitchView
            slots={state.slots}
            showRatings={config.showRatings}
            draftMode={config.draftMode}
            activeSlotId={state.activeSlotId}
            onSlotClick={selectSlotAndSpin}
          />
        </div>

        {/* Indicazione modalità */}
        <p className="text-center text-xs text-slate-600 pb-4 px-5">
          {isSquadFirst
            ? 'Gira un club, poi scegli il giocatore dalla lista →'
            : 'Tocca uno slot vuoto sul campo per sorteggiare un giocatore compatibile →'
          }
        </p>
      </div>

      {/* ── Colonna destra: spin + picker ──────────────────────────────── */}
      <div className="flex-1 flex flex-col border-t lg:border-t-0 lg:border-l border-white/5 overflow-y-auto">

        {/* ── Stato IDLE (nessuno spin attivo) ── */}
        {state.phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 text-center">
            {isSquadFirst ? (
              <>
                <p className="text-4xl">🎰</p>
                <h2 className="text-xl font-black text-white">Pronto per il sorteggio?</h2>
                <p className="text-sm text-slate-400 max-w-xs">
                  Verrà estratto un club e una stagione casuali dall&apos;era selezionata.
                  Scegli un giocatore dalla rosa rivelata.
                </p>
                <button
                  onClick={spinSquadFirst}
                  className="glow-emerald rounded-2xl bg-emerald-500 px-10 py-4 text-lg font-black text-black hover:bg-emerald-400 hover:scale-105 transition-all"
                >
                  Gira 🎲
                </button>
              </>
            ) : (
              <>
                <p className="text-4xl">👆</p>
                <h2 className="text-xl font-black text-white">Scegli uno slot</h2>
                <p className="text-sm text-slate-400 max-w-xs">
                  Tocca uno slot vuoto sul campo per sorteggiare un giocatore compatibile con quella posizione.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Stato SPINNING / PICKING (spin in corso o risultato mostrato) ── */}
        {(state.phase === 'spinning' || state.phase === 'picking') && state.currentSpin && (
          <div className="flex flex-col h-full">

            {/* Slot machine reveal */}
            <SlotMachine
              club={state.currentSpin.club}
              season={state.currentSpin.season}
            />

            {/* Info spin */}
            <div className="flex items-center justify-between px-5 pb-3">
              <p className="text-xs text-slate-400">
                <span className="font-bold text-white">{state.currentSpin.players.length}</span> giocatori disponibili
              </p>
              <div className="flex items-center gap-2">
                {state.rerollsLeft > 0 && (
                  <button
                    onClick={reroll}
                    className="text-xs font-bold text-amber-400 border border-amber-500/30 bg-amber-500/8 rounded-lg px-3 py-1.5 hover:bg-amber-500/15 transition-all"
                  >
                    Reroll ({state.rerollsLeft})
                  </button>
                )}
                <button
                  onClick={cancel}
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>

            {/* Lista giocatori */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-2">
              {state.currentSpin.players.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-2xl mb-3">😔</p>
                  <p className="text-sm text-slate-400">Nessun giocatore compatibile con questo slot in questa stagione.</p>
                  <button onClick={reroll} disabled={state.rerollsLeft <= 0}
                    className="mt-4 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 transition-colors">
                    {state.rerollsLeft > 0 ? `Prova un altro club (${state.rerollsLeft} rimasti)` : 'Nessun reroll rimasto'}
                  </button>
                </div>
              )}

              {state.currentSpin.players.map((player) => {
                // Per squad_first: controlla se il giocatore ha almeno uno slot compatibile
                const hasSlot = isSquadFirst
                  ? remaining.some((s) => s.formationSlot.acceptedPositions.includes(player.position))
                  : true; // position_first: già filtrato prima

                // Calcola il target slot label per mostrare l'hint all'utente
                const targetSlot = isSquadFirst
                  ? findBestSlot(state.slots, player)?.formationSlot.label
                  : state.slots.find((s) => s.formationSlot.id === state.activeSlotId)?.formationSlot.label;

                return (
                  <PlayerCard
                    key={player.id + player.season}
                    player={player}
                    showRatings={config.showRatings}
                    onPick={isSquadFirst ? handlePickSquadFirst : handlePickPositionFirst}
                    targetSlotLabel={hasSlot ? targetSlot : undefined}
                    disabled={!hasSlot}
                  />
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Slot disambiguation modal ─────────────────────────────────── */}
      {pendingPlayer && (
        <SlotPicker
          player={pendingPlayer}
          candidates={remaining.filter((s) =>
            s.formationSlot.acceptedPositions.includes(pendingPlayer.position)
          )}
          onConfirm={(slotId) => {
            pick(pendingPlayer, slotId);
            setPendingPlayer(null);
          }}
          onCancel={() => setPendingPlayer(null)}
        />
      )}
    </div>
  );
}
