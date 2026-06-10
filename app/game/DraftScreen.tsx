'use client';
import React, { useState } from 'react';
import type { SetupConfig } from '@/app/game/page';
import { useDraft } from '@/lib/useDraft';
import SlotMachine from '@/components/SlotMachine';
import PlayerCard from '@/components/PlayerCard';
import PitchView from '@/components/PitchView';
import {
  emptySlots,
  findBestSlot,
  findCompatibleSlots,
  REROLLS_BY_DIFFICULTY,
  type DraftedPlayer,
  type DraftSlot,
} from '@/lib/draft';

// ─── Slot disambiguation modal ────────────────────────────────────────────────

interface SlotPickerProps {
  player: DraftedPlayer;
  candidates: DraftSlot[];
  onConfirm: (slotId: string) => void;
  onCancel: () => void;
}

function SlotPicker({ player, candidates, onConfirm, onCancel }: SlotPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm glass rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
          Scegli lo slot
        </p>
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
        <button
          onClick={onCancel}
          className="mt-4 w-full text-center text-xs text-slate-500 hover:text-white transition-colors"
        >
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
  const { state, reveal, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel } = useDraft(config);
  const [pendingPlayer, setPendingPlayer] = useState<DraftedPlayer | null>(null);

  const isSquadFirst = config.draftMode === 'squad_first';
  const filled = state.slots.filter((s) => s.player !== null).length;
  const total = state.slots.length;
  const remaining = emptySlots(state.slots);
  const maxRerolls = REROLLS_BY_DIFFICULTY[config.difficulty];

  // squad_first: cerca slot compatibili con findCompatibleSlots,
  // auto-assegna se univoco, altrimenti SlotPicker
  function handlePickSquadFirst(player: DraftedPlayer) {
    const compatible = findCompatibleSlots(state.slots, player);
    if (compatible.length === 0) return; // nessuno slot → pulsante disabilitato
    if (compatible.length === 1) {
      pick(player, compatible[0].formationSlot.id);
    } else {
      setPendingPlayer(player);
    }
  }

  // position_first: slot già selezionato
  function handlePickPositionFirst(player: DraftedPlayer) {
    if (!state.activeSlotId) return;
    pick(player, state.activeSlotId);
  }

  if (state.phase === 'complete') {
    onComplete(state.slots);
    return null;
  }

  const isSpinning = state.phase === 'spinning';
  const isPicking  = state.phase === 'picking';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col lg:flex-row">

      {/* ── Colonna sinistra: pitch ── */}
      <div className="lg:w-[340px] lg:min-h-screen flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button onClick={onBack} className="text-slate-500 hover:text-white text-sm transition-colors">
            ← Setup
          </button>
          <div className="text-right">
            <p className="text-xs text-slate-500">{filled}/{total} giocatori</p>
            {maxRerolls > 0 && (
              <p className={`text-xs ${
                state.rerollsLeft > 0 ? 'text-amber-400' : 'text-slate-600'
              }`}>
                {state.rerollsLeft}/{maxRerolls} reroll
              </p>
            )}
            {config.ratingsMode === 'prime' && (
              <p className="text-[10px] text-violet-400 font-semibold">★ Prime Mode</p>
            )}
          </div>
        </div>

        <div className="mx-5 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(filled / total) * 100}%` }}
          />
        </div>

        <div className="flex-1 p-5">
          <PitchView
            slots={state.slots}
            showRatings={config.showRatings}
            difficulty={config.difficulty}
            draftMode={config.draftMode}
            activeSlotId={state.activeSlotId}
            onSlotClick={selectSlotAndSpin}
          />
        </div>

        <p className="text-center text-xs text-slate-600 pb-4 px-5">
          {isSquadFirst
            ? 'Gira un club, poi scegli il giocatore dalla lista →'
            : 'Tocca uno slot vuoto sul campo per sorteggiare →'
          }
        </p>
      </div>

      {/* ── Colonna destra: spin + picker ── */}
      <div className="flex-1 flex flex-col border-t lg:border-t-0 lg:border-l border-white/5 overflow-y-auto">

        {/* IDLE */}
        {state.phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 text-center">
            {isSquadFirst ? (
              <>
                <p className="text-4xl">🎰</p>
                <h2 className="text-xl font-black text-white">Pronto per il sorteggio?</h2>
                <p className="text-sm text-slate-400 max-w-xs">
                  Verrà estratto un club e una stagione casuali.
                  {config.ratingsMode === 'prime' && (
                    <span className="text-violet-400"> Rating = massimo storico.</span>
                  )}
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
                  Tocca uno slot vuoto sul campo per sorteggiare un giocatore per quella posizione.
                </p>
              </>
            )}
          </div>
        )}

        {/* SPINNING o PICKING: SlotMachine sempre visibile */}
        {(isSpinning || isPicking) && state.currentSpin && (
          <div className="flex flex-col h-full">

            {/* SlotMachine: onReveal chiama reveal() solo in fase spinning */}
            <SlotMachine
              club={state.currentSpin.club}
              season={state.currentSpin.season}
              onReveal={isSpinning ? reveal : undefined}
            />

            {/* Lista: visibile SOLO in picking */}
            {isPicking && (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 pb-3">
                  <p className="text-xs text-slate-400">
                    <span className="font-bold text-white">{state.currentSpin.players.length}</span> giocatori
                  </p>
                  <div className="flex items-center gap-2">
                    {maxRerolls > 0 && (
                      <button
                        onClick={reroll}
                        disabled={state.rerollsLeft <= 0}
                        className="text-xs font-bold text-amber-400 border border-amber-500/30 bg-amber-500/8 rounded-lg px-3 py-1.5 hover:bg-amber-500/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Reroll ({state.rerollsLeft}/{maxRerolls})
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
                  {state.currentSpin.players.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <p className="text-2xl mb-3">😔</p>
                      <p className="text-sm text-slate-400">Nessun giocatore compatibile.</p>
                      {state.rerollsLeft > 0 && (
                        <button onClick={reroll} className="mt-4 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                          Prova un altro club ({state.rerollsLeft} rimasti)
                        </button>
                      )}
                    </div>
                  ) : (
                    state.currentSpin.players.map((player) => {
                      const compatible = isSquadFirst
                        ? findCompatibleSlots(state.slots, player)
                        : remaining; // position_first: tutti i remaining sono già filtrati
                      const hasSlot = compatible.length > 0;

                      // Label slot suggerito: solo se c'è match univoco
                      const targetSlot = isSquadFirst
                        ? findBestSlot(state.slots, player)?.formationSlot.label
                        : state.slots.find((s) => s.formationSlot.id === state.activeSlotId)
                            ?.formationSlot.label;

                      return (
                        <PlayerCard
                          key={player.id + player.season}
                          player={player}
                          showRatings={config.showRatings}
                          difficulty={config.difficulty}
                          onPick={isSquadFirst ? handlePickSquadFirst : handlePickPositionFirst}
                          targetSlotLabel={hasSlot ? targetSlot : undefined}
                          disabled={!hasSlot}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Placeholder durante spinning: attesa animazione */}
            {isSpinning && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-600 animate-pulse">Caricamento rosa...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slot disambiguation modal */}
      {pendingPlayer && (
        <SlotPicker
          player={pendingPlayer}
          candidates={findCompatibleSlots(state.slots, pendingPlayer)}
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
