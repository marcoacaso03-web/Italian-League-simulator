import { useReducer, useCallback, useRef } from 'react';
import type { SetupConfig } from '../pages/GamePage';
import {
  buildSlots, spin, findBestSlot, assignToSlot, initialRerolls, emptySlots,
  type DraftState, type DraftedPlayer, type SpinResult,
} from './draft';

type Action =
  | { type: 'SPIN';        result: SpinResult }
  | { type: 'REVEAL' }
  | { type: 'PICK';        player: DraftedPlayer; slotId?: string }
  | { type: 'SELECT_SLOT'; slotId: string }
  | { type: 'REROLL';      result: SpinResult }
  | { type: 'CANCEL_PICK' };

function reducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {
    case 'SPIN':    return { ...state, currentSpin: action.result, phase: 'spinning' };
    case 'REROLL':  return { ...state, currentSpin: action.result, phase: 'spinning', rerollsLeft: state.rerollsLeft - 1 };
    case 'REVEAL':  return state.phase === 'spinning' ? { ...state, phase: 'picking' } : state;
    case 'SELECT_SLOT': return { ...state, activeSlotId: action.slotId, phase: 'idle' };
    case 'PICK': {
      const slotId = action.slotId ?? findBestSlot(state.slots, action.player)?.formationSlot.id ?? null;
      if (!slotId) return state;
      const newSlots = assignToSlot(state.slots, slotId, action.player);
      const done = emptySlots(newSlots).length === 0;
      return { ...state, slots: newSlots, currentSpin: null, activeSlotId: null, phase: done ? 'complete' : 'idle' };
    }
    case 'CANCEL_PICK': return { ...state, currentSpin: null, activeSlotId: null, phase: 'idle' };
    default: return state;
  }
}

export function useDraft(config: SetupConfig) {
  const usedCombosRef = useRef(new Set<string>());
  const [state, dispatch] = useReducer(reducer, {
    slots: buildSlots(config.formation),
    currentSpin: null,
    rerollsLeft: initialRerolls(config.difficulty),
    phase: 'idle',
    activeSlotId: null,
  });

  const reveal = useCallback(() => dispatch({ type: 'REVEAL' }), []);

  const spinSquadFirst = useCallback(() => {
    const r = spin(config, usedCombosRef.current, []);
    if (!r) return;
    usedCombosRef.current.add(`${r.club}|||${r.season}`);
    dispatch({ type: 'SPIN', result: r });
  }, [config]);

  const selectSlotAndSpin = useCallback((slotId: string) => {
    dispatch({ type: 'SELECT_SLOT', slotId });
    const slot = state.slots.find((s) => s.formationSlot.id === slotId);
    if (!slot) return;
    const r = spin(config, usedCombosRef.current, slot.formationSlot.acceptedPositions);
    if (!r) return;
    usedCombosRef.current.add(`${r.club}|||${r.season}`);
    dispatch({ type: 'SPIN', result: r });
  }, [config, state.slots]);

  const pick = useCallback((player: DraftedPlayer, slotId?: string) =>
    dispatch({ type: 'PICK', player, slotId }), []);

  const reroll = useCallback(() => {
    if (state.rerollsLeft <= 0) return;
    const pf = state.activeSlotId
      ? (state.slots.find((s) => s.formationSlot.id === state.activeSlotId)?.formationSlot.acceptedPositions ?? [])
      : [];
    const r = spin(config, usedCombosRef.current, pf);
    if (!r) return;
    usedCombosRef.current.add(`${r.club}|||${r.season}`);
    dispatch({ type: 'REROLL', result: r });
  }, [config, state.rerollsLeft, state.activeSlotId, state.slots]);

  const cancel = useCallback(() => dispatch({ type: 'CANCEL_PICK' }), []);

  return { state, reveal, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel };
}
