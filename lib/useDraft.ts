'use client';
import { useReducer, useCallback, useRef } from 'react';
import type { SetupConfig } from '@/app/game/page';
import {
  buildSlots,
  spin,
  findBestSlot,
  assignToSlot,
  initialRerolls,
  emptySlots,
  type DraftSlot,
  type DraftState,
  type DraftedPlayer,
  type SpinResult,
} from '@/lib/draft';

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SPIN';         result: SpinResult }   // avvia animazione
  | { type: 'REVEAL' }                              // animazione finita → mostra lista
  | { type: 'PICK';         player: DraftedPlayer; slotId?: string }
  | { type: 'SELECT_SLOT';  slotId: string }
  | { type: 'REROLL';       result: SpinResult }   // nuovo spin (mantiene fase spinning)
  | { type: 'CANCEL_PICK' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {

    case 'SPIN':
      // Salva il risultato ma mostra solo l'animazione (lista nascosta)
      return { ...state, currentSpin: action.result, phase: 'spinning' };

    case 'REROLL':
      // Reroll: nuova animazione, decrementa reroll
      return {
        ...state,
        currentSpin: action.result,
        phase: 'spinning',
        rerollsLeft: state.rerollsLeft - 1,
      };

    case 'REVEAL':
      // L'animazione ha finito → mostra la lista
      return state.phase === 'spinning'
        ? { ...state, phase: 'picking' }
        : state;

    case 'SELECT_SLOT':
      return { ...state, activeSlotId: action.slotId, phase: 'idle' };

    case 'PICK': {
      const slotId = action.slotId
        ?? findBestSlot(state.slots, action.player)?.formationSlot.id
        ?? null;
      if (!slotId) return state;
      const newSlots = assignToSlot(state.slots, slotId, action.player);
      const done = emptySlots(newSlots).length === 0;
      return {
        ...state,
        slots: newSlots,
        currentSpin: null,
        activeSlotId: null,
        phase: done ? 'complete' : 'idle',
      };
    }

    case 'CANCEL_PICK':
      return { ...state, currentSpin: null, activeSlotId: null, phase: 'idle' };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDraft(config: SetupConfig) {
  // usedCombos persiste per tutta la vita del componente (non resettato a ogni render)
  const usedCombosRef = useRef(new Set<string>());

  const [state, dispatch] = useReducer(reducer, {
    slots: buildSlots(config.formation),
    currentSpin: null,
    rerollsLeft: initialRerolls(config.difficulty),
    phase: 'idle',
    activeSlotId: null,
  });

  /** Chiamato da SlotMachine quando l'animazione finisce */
  const reveal = useCallback(() => {
    dispatch({ type: 'REVEAL' });
  }, []);

  /** Spin per squad_first: nessun filtro posizione */
  const spinSquadFirst = useCallback(() => {
    const result = spin(config, usedCombosRef.current, []);
    if (!result) return;
    usedCombosRef.current.add(`${result.club}|||${result.season}`);
    dispatch({ type: 'SPIN', result });
  }, [config]);

  /** Seleziona uno slot (position_first) poi triggera spin filtrato */
  const selectSlotAndSpin = useCallback((slotId: string) => {
    dispatch({ type: 'SELECT_SLOT', slotId });
    const slot = state.slots.find((s) => s.formationSlot.id === slotId);
    if (!slot) return;
    const result = spin(config, usedCombosRef.current, slot.formationSlot.acceptedPositions);
    if (!result) return;
    usedCombosRef.current.add(`${result.club}|||${result.season}`);
    dispatch({ type: 'SPIN', result });
  }, [config, state.slots]);

  const pick = useCallback((player: DraftedPlayer, slotId?: string) => {
    dispatch({ type: 'PICK', player, slotId });
  }, []);

  const reroll = useCallback(() => {
    if (state.rerollsLeft <= 0) return;
    const posFilter = state.activeSlotId
      ? (state.slots.find((s) => s.formationSlot.id === state.activeSlotId)
          ?.formationSlot.acceptedPositions ?? [])
      : [];
    const result = spin(config, usedCombosRef.current, posFilter);
    if (!result) return;
    usedCombosRef.current.add(`${result.club}|||${result.season}`);
    dispatch({ type: 'REROLL', result });
  }, [config, state.rerollsLeft, state.activeSlotId, state.slots]);

  const cancel = useCallback(() => dispatch({ type: 'CANCEL_PICK' }), []);

  return { state, reveal, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel };
}
