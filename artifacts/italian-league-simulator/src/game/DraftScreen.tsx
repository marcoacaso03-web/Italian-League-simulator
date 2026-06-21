import React, { useState } from 'react';
import type { SetupConfig } from '../pages/GamePage';
import { useDraft } from '../lib/useDraft';
import { useTranslation } from 'react-i18next';
import SlotMachine from '../components/SlotMachine';
import {
  emptySlots, findBestSlot, findCompatibleSlots, REROLLS_BY_DIFFICULTY,
  type DraftedPlayer, type DraftSlot,
} from '../lib/draft';
import { FORMATION_SLOTS } from '../lib/formations';

function catColor(cat: string): string {
  switch (cat) {
    case 'GK':  return '#f59e0b';
    case 'DEF': return '#3b82f6';
    case 'MID': return '#22c55e';
    case 'ATT': return '#ef4444';
    default:    return '#6b7280';
  }
}
function catLabel(cat: string, t: any): string {
  return t(cat);
}
function posCategory(pos: string): string {
  if (pos === 'GK') return 'GK';
  if (['CB','RB','LB','WB','LWB','RWB'].includes(pos)) return 'DEF';
  if (['CDM','CM','CAM','LM','RM'].includes(pos)) return 'MID';
  return 'ATT';
}

function slotPositionLabel(id: string, t: any): string {
  const labels: Record<string, string> = {
    gk: t('pos_gk'),
    rb: t('pos_label_right'), lb: t('pos_label_left'),
    'cb-1': t('pos_label_centre'), 'cb-2': t('pos_label_centre'),
    'cb-r': t('pos_label_centre'), 'cb-c': t('pos_label_centre'), 'cb-l': t('pos_label_centre'),
    'cdm-r': t('pos_label_defensive'), 'cdm-l': t('pos_label_defensive'),
    'cm-r': t('pos_label_central'), 'cm-c': t('pos_label_central'), 'cm-l': t('pos_label_central'),
    cam: t('pos_label_attacking'),
    rm: t('pos_label_right'), lm: t('pos_label_left'),
    rw: t('pos_label_right'), lw: t('pos_label_left'),
    st: t('pos_label_striker'), 'st-r': t('pos_label_striker'), 'st-l': t('pos_label_striker'),
    cf: t('pos_label_forward'),
  };
  return labels[id] ?? id.toUpperCase();
}

function slotFullLabel(id: string, t: any): string {
  const labels: Record<string, string> = {
    gk: t('pos_full_gk'),
    rb: t('pos_full_rb'), lb: t('pos_full_lb'),
    'cb-1': t('pos_full_cb'), 'cb-2': t('pos_full_cb'),
    'cb-r': t('pos_full_cb'), 'cb-c': t('pos_full_cb'), 'cb-l': t('pos_full_cb'),
    'cdm-r': t('pos_full_cdm'), 'cdm-l': t('pos_full_cdm'),
    'cm-r': t('pos_full_cm'), 'cm-c': t('pos_full_cm'), 'cm-l': t('pos_full_cm'),
    cam: t('pos_full_cam'),
    rm: t('pos_full_rm'), lm: t('pos_full_lm'),
    rw: t('pos_full_rw'), lw: t('pos_full_lw'),
    st: t('pos_full_st'), 'st-r': t('pos_full_st'), 'st-l': t('pos_full_st'),
    cf: t('pos_full_cf'),
  };
  return labels[id] ?? id.toUpperCase();
}

function slotCat(slot: DraftSlot): string {
  return slot.formationSlot.category;
}

function diffColor(d: SetupConfig['difficulty']): string {
  return d === 'easy' ? '#22c55e' : d === 'normal' ? '#f59e0b' : '#ef4444';
}

function slotBadge(fs: { id: string; acceptedPositions: string[] }): string {
  return (fs.acceptedPositions[0] ?? fs.id).toUpperCase();
}


interface PitchProps { formation: string; slots: DraftSlot[]; }
function Pitch({ formation, slots }: PitchProps) {
  const { t } = useTranslation();
  const formSlots = FORMATION_SLOTS[formation] ?? [];
  const slotMap = new Map(slots.map((s) => [s.formationSlot.id, s]));

  return (
    <div className="relative w-full" style={{ aspectRatio: '100/143' }}>
      <svg viewBox="0 0 100 143" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="0" y={i * 18} width="100" height="18" fill={i % 2 === 0 ? '#1a4a1a' : '#1e5520'} />
        ))}
        <rect x="4" y="4" width="92" height="135" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
        <line x1="4" y1="71.5" x2="96" y2="71.5" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        <circle cx="50" cy="71.5" r="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        <circle cx="50" cy="71.5" r="0.8" fill="rgba(255,255,255,0.3)" />
        <rect x="20" y="116" width="60" height="23" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        <rect x="33" y="128" width="34" height="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        <rect x="20" y="4" width="60" height="23" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
        <rect x="33" y="4" width="34" height="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
      </svg>

      {formSlots.map((fs) => {
        const ds = slotMap.get(fs.id);
        const player = ds?.player ?? null;
        const color  = catColor(fs.category);
        const badge    = slotBadge(fs);
        const posLabel = slotPositionLabel(fs.id, t);
        const surname  = player ? player.name.trim().split(' ').pop() ?? '' : '';

        return (
          <div
            key={fs.id}
            className="absolute flex flex-col items-center"
            style={{
              left:      `${fs.x}%`,
              top:       `${fs.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex:    10,
              gap:       2,
            }}
          >
            <div style={{
              background:   player ? color : 'rgba(0,0,0,0.55)',
              border:       player ? 'none' : '1px solid rgba(255,255,255,0.25)',
              borderRadius: 4, padding: '1px 5px', fontSize: 8, fontWeight: 900,
              color:        player ? '#000' : 'rgba(255,255,255,0.55)',
              letterSpacing: 0.3, lineHeight: '1.4', whiteSpace: 'nowrap',
            }}>
              {badge}
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: player ? color : 'transparent',
              border: player ? `2px solid ${color}` : '2px dashed rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: player ? `0 0 8px ${color}55` : 'none',
            }}>
              {player && (
                <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>
                  {player.rating}
                </span>
              )}
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.75)', borderRadius: 3, padding: '1px 5px',
              fontSize: 7, fontWeight: 700, color: player ? '#fff' : 'rgba(255,255,255,0.55)',
              whiteSpace: 'nowrap', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {player ? surname : posLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SlotPickerProps {
  player: DraftedPlayer; allSlots: DraftSlot[];
  availableSlots: DraftSlot[]; onPick: (_slotId: string) => void; onCancel: () => void;
}
function SlotPicker({ player, allSlots, availableSlots, onPick, onCancel }: SlotPickerProps) {
  const { t } = useTranslation();
  const availableIds = new Set(availableSlots.map((s) => s.formationSlot.id));
  const unavailable = allSlots.filter((s) => !availableIds.has(s.formationSlot.id));
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-[#0d1f18] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-black text-white">
          {t('place_player')} <span className="text-emerald-400">{player.name}</span>
        </p>
        <button onClick={onCancel} className="text-xs font-semibold text-slate-400 border border-slate-600 rounded-lg px-3 py-1.5 hover:text-white hover:border-slate-400 transition-colors">
          {t('cancel')}
        </button>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">{t('available')} ({availableSlots.length})</p>
        <div className="flex flex-wrap gap-2">
          {availableSlots.map((s) => {
            const color = catColor(slotCat(s));
            return (
              <button key={s.formationSlot.id} onClick={() => onPick(s.formationSlot.id)}
                className="px-4 py-3 rounded-xl text-sm font-black text-white transition-all active:scale-95 hover:brightness-110"
                style={{ backgroundColor: color }}>
                {slotFullLabel(s.formationSlot.id, t)}
              </button>
            );
          })}
        </div>
      </div>
      {unavailable.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('unavailable')}</p>
          <div className="flex flex-wrap gap-1.5">
            {unavailable.map((s) => {
              const occupant = s.player ? s.player.name.split(' ').pop() : 'N/A';
              const abbr = s.formationSlot.acceptedPositions[0];
              return (
                <span key={s.formationSlot.id} className="text-[11px] font-semibold text-slate-500 border border-slate-700 rounded-lg px-2.5 py-1.5">
                  {abbr} · {occupant}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface PlayerCardProps {
  player: DraftedPlayer; disabled: boolean; showRating: boolean;
  compatibleSlotLabels: string[]; selected: boolean; onClick: () => void;
}
function PlayerCard({ player, disabled, showRating, compatibleSlotLabels, selected, onClick }: PlayerCardProps) {
  const { t } = useTranslation();
  const color = catColor(player.position_category);
  return (
    <button onClick={onClick} disabled={disabled}
      className={['relative flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all text-left',
        selected ? 'bg-emerald-500/10 border border-emerald-500/50'
          : disabled ? 'opacity-50 cursor-not-allowed grayscale bg-white/[0.06] border border-white/10'
          : 'bg-white/[0.06] border border-white/10 active:scale-[0.98] hover:bg-white/10',
      ].join(' ')}>
      <div style={{ backgroundColor: color + '28', border: `2px solid ${color}55` }}
        className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center">
        {showRating ? (
          <span style={{ color: player.rating >= 85 ? '#4ade80' : player.rating >= 72 ? '#fbbf24' : '#f87171' }}
            className="text-lg font-black leading-none">
            {player.rating}
          </span>
        ) : (
          <span style={{ color }} className="text-xl font-black">?</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{player.name}</p>
        {player.all_positions?.length > 1 ? (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {player.all_positions.map((pos) => {
              const posColor = catColor(posCategory(pos));
              return (
                <span key={pos}
                  style={{ backgroundColor: posColor + '22', color: posColor, borderColor: posColor + '55' }}
                  className="text-[9px] font-black px-1.5 py-0.5 rounded border leading-none">
                  {pos}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 truncate">{catLabel(player.position_category, t)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {compatibleSlotLabels.map((lbl) => (
          <span key={lbl} style={{ backgroundColor: color + '28', color, borderColor: color + '55' }}
            className="text-[10px] font-black px-2 py-0.5 rounded-md border">
            {lbl}
          </span>
        ))}
      </div>
    </button>
  );
}

interface Props { config: SetupConfig; onBack?: () => void; onComplete: (_slots: DraftSlot[]) => void; }

export default function DraftScreen({ config, onBack, onComplete }: Props) {
  const { t } = useTranslation();
  const { state, reveal, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel } = useDraft(config);
  const [pendingPlayer, setPendingPlayer] = useState<DraftedPlayer | null>(null);

  const isSquadFirst = config.draftMode === 'squad_first';
  const filled = state.slots.filter((s) => s.player !== null).length;
  const total = state.slots.length;
  const remaining = emptySlots(state.slots);
  const maxRerolls = REROLLS_BY_DIFFICULTY[config.difficulty];
  const showRating = config.showRatings !== 'off' && config.difficulty !== 'hard';

  void findBestSlot;

  function handlePick(player: DraftedPlayer) {
    const compat = findCompatibleSlots(state.slots, player);
    if (compat.length === 0) return;
    if (compat.length === 1) { pick(player, compat[0].formationSlot.id); setPendingPlayer(null); }
    else setPendingPlayer(player);
  }

  function handleSlotPick(slotId: string) {
    if (!pendingPlayer) return;
    pick(pendingPlayer, slotId);
    setPendingPlayer(null);
  }

  if (state.phase === 'complete') { onComplete(state.slots); return null; }

  const doSpin = isSquadFirst
    ? spinSquadFirst
    : () => selectSlotAndSpin(remaining[0]?.formationSlot.id ?? '');

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">
      <div className="px-4 pt-5 pb-3 flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('formation')}</p>
            <p className="text-2xl font-black text-white">{config.formation}</p>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ color: diffColor(config.difficulty) }} className="text-sm font-black uppercase tracking-widest">
              {t(`difficulty_${config.difficulty}`).toUpperCase()}
            </span>
            <span className="text-sm font-bold text-white">
              <span style={{ color: filled > 0 ? '#22c55e' : '#6b7280' }}>{filled}</span>
              <span className="text-slate-600">/{total}</span>
            </span>
            <button onClick={onBack} className="text-slate-500 hover:text-white transition-colors text-lg" aria-label="Indietro">↺</button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-white/5 rounded-full mt-2">
          <div className="h-0.5 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(filled / total) * 100}%` }} />
        </div>
      </div>

      <div className="px-3">
        <div className="rounded-2xl overflow-hidden">
          <Pitch formation={config.formation} slots={state.slots} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-3">
        {state.currentSpin && state.phase === 'spinning' && (
          <SlotMachine club={state.currentSpin.club} season={state.currentSpin.season} onReveal={reveal} />
        )}

        {state.currentSpin && state.phase === 'picking' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">SQUAD SPUN</p>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-xl font-black text-white">{state.currentSpin.club}</p>
                <p className="text-xl font-black" style={{ color: '#fbbf24' }}>{state.currentSpin.season}</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">Pick any player, then choose which open position to slot them into.</p>
            </div>

            {pendingPlayer && (
              <SlotPicker player={pendingPlayer} allSlots={state.slots}
                availableSlots={findCompatibleSlots(state.slots, pendingPlayer)}
                onPick={handleSlotPick} onCancel={() => setPendingPlayer(null)} />
            )}

            <div className="space-y-2">
              {state.currentSpin.players.map((player) => {
                const compat = findCompatibleSlots(state.slots, player);
                const disabled = compat.length === 0;
                const compatLabels = compat.map((s) => s.formationSlot.acceptedPositions[0]);
                const selected = pendingPlayer?.id === player.id;
                return (
                  <PlayerCard key={player.id} player={player} disabled={disabled} showRating={showRating}
                    compatibleSlotLabels={compatLabels} selected={selected} onClick={() => handlePick(player)} />
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              {state.rerollsLeft > 0 && (
                <button onClick={reroll} className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors">
                  🔄 Reroll ({state.rerollsLeft}/{maxRerolls})
                </button>
              )}
              <button onClick={onBack} className="flex-1 py-3 rounded-xl text-slate-400 text-sm hover:text-white transition-colors">↺ Restart</button>
            </div>
          </div>
        )}

        {state.phase === 'idle' && remaining.length > 0 && (
          <button onClick={doSpin} className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 font-black text-lg text-black transition-all active:scale-[0.98]">
            🎲 {t('spin')}
          </button>
        )}
      </div>
    </div>
  );
}
