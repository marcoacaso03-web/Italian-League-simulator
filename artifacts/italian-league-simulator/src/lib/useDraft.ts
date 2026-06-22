import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import type { SetupConfig } from '../pages/GamePage';
import {
  buildSlots, spin, findBestSlot, assignToSlot, initialRerolls, emptySlots,
  type DraftState, type DraftedPlayer, type SpinResult,
} from './draft';
import { FORMATION_SLOTS } from './formations';
import { setActiveLeague } from './data';

type Action =
  | { type: 'SPIN';        result: SpinResult }
  | { type: 'REVEAL' }
  | { type: 'PICK';        player: DraftedPlayer; slotId?: string }
  | { type: 'SELECT_SLOT'; slotId: string }
  | { type: 'REROLL';      result: SpinResult }
  | { type: 'CANCEL_PICK' }
  | { type: 'SET_LOADING';  loading: boolean };

function reducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {
    case 'SPIN':    return { ...state, currentSpin: action.result, phase: 'spinning', loading: false };
    case 'REROLL':  return { ...state, currentSpin: action.result, phase: 'spinning', rerollsLeft: state.rerollsLeft - 1, loading: false };
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
    case 'SET_LOADING': return { ...state, loading: action.loading };
    default: return state;
  }
}

export function useDraft(config: SetupConfig) {
  const usedCombosRef = useRef(new Set<string>());
  const [leagueLoaded, setLeagueLoaded] = useState(false);

  useEffect(() => {
    setLeagueLoaded(false);
    void setActiveLeague(config.leagueId).then(() => setLeagueLoaded(true));
  }, [config.leagueId]);

  const [state, dispatch] = useReducer(reducer, {
    slots: buildSlots(config.formation),
    currentSpin: null,
    rerollsLeft: initialRerolls(config.difficulty),
    phase: 'idle',
    activeSlotId: null,
  });

  const reveal = useCallback(() => dispatch({ type: 'REVEAL' }), []);

  const spinSquadFirst = useCallback(async () => {
    if (!leagueLoaded) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    const emptyFormationSlots = emptySlots(state.slots).map((s) => s.formationSlot);
    const r = await spin(config, usedCombosRef.current, [], emptyFormationSlots);
    if (!r) { dispatch({ type: 'SET_LOADING', loading: false }); return; }
    usedCombosRef.current.add(`${r.club}|||${r.season}`);
    dispatch({ type: 'SPIN', result: r });
  }, [config, state.slots, leagueLoaded]);

  const selectSlotAndSpin = useCallback(async (slotId: string) => {
    if (!leagueLoaded) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    dispatch({ type: 'SELECT_SLOT', slotId });
    const slot = state.slots.find((s) => s.formationSlot.id === slotId);
    if (!slot) { dispatch({ type: 'SET_LOADING', loading: false }); return; }
    const emptyFormationSlots = emptySlots(state.slots).map((s) => s.formationSlot);
    const r = await spin(config, usedCombosRef.current, slot.formationSlot.acceptedPositions, emptyFormationSlots);
    if (!r) { dispatch({ type: 'SET_LOADING', loading: false }); return; }
    usedCombosRef.current.add(`${r.club}|||${r.season}`);
    dispatch({ type: 'SPIN', result: r });
  }, [config, state.slots, leagueLoaded]);

  const pick = useCallback((player: DraftedPlayer, slotId?: string) =>
    dispatch({ type: 'PICK', player, slotId }), []);

  const reroll = useCallback(async () => {
    if (!leagueLoaded) return;
    if (state.rerollsLeft <= 0) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    const pf = state.activeSlotId
      ? (state.slots.find((s) => s.formationSlot.id === state.activeSlotId)?.formationSlot.acceptedPositions ?? [])
      : [];
    const emptyFormationSlots = emptySlots(state.slots).map((s) => s.formationSlot);
    const r = await spin(config, usedCombosRef.current, pf, emptyFormationSlots);
    if (!r) { dispatch({ type: 'SET_LOADING', loading: false }); return; }
    usedCombosRef.current.add(`${r.club}|||${r.season}`);
    dispatch({ type: 'REROLL', result: r });
  }, [config, state.rerollsLeft, state.activeSlotId, state.slots, leagueLoaded]);

  const cancel = useCallback(() => dispatch({ type: 'CANCEL_PICK' }), []);

  return { state, reveal, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel, leagueLoaded };
}
