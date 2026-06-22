import React, { useState, useRef, useEffect } from 'react';
import type { SetupConfig } from '../pages/GamePage';
import { useDraft } from '../lib/useDraft';
import { useTranslation } from 'react-i18next';
import SlotMachine from '../components/SlotMachine';
import {
  emptySlots, findCompatibleSlots, REROLLS_BY_DIFFICULTY,
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

// ─── Pitch con posizioni cliccabili ───────────────────────────────────────────

interface PitchProps {
  formation: string;
  slots: DraftSlot[];
  pendingPlayer: DraftedPlayer | null;
  onSlotClick: (slotId: string) => void;
  showRating: boolean;
}

function Pitch({ formation, slots, pendingPlayer, onSlotClick, showRating }: PitchProps) {
  const { t } = useTranslation();
  const formSlots = FORMATION_SLOTS[formation] ?? [];
  const slotMap = new Map(slots.map((s) => [s.formationSlot.id, s]));

  // Calcola quali slot sono compatibili con il pendingPlayer
  const compatibleIds = new Set(
    pendingPlayer
      ? findCompatibleSlots(slots, pendingPlayer).map((s) => s.formationSlot.id)
      : []
  );

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
        const color = catColor(fs.category);
        const badge = slotBadge(fs);
        const posLabel = slotPositionLabel(fs.id, t);
        const surname = player ? player.name.trim().split(' ').pop() ?? '' : '';

        const isCompatible = compatibleIds.has(fs.id);
        const isClickable = pendingPlayer && isCompatible && !player;

        return (
          <div
            key={fs.id}
            className={`absolute flex flex-col items-center transition-all duration-200 ${isClickable ? 'cursor-pointer scale-110' : ''}`}
            style={{
              left: `${fs.x}%`,
              top: `${fs.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: isClickable ? 20 : 10,
              gap: 2,
            }}
            onClick={() => {
              if (isClickable) onSlotClick(fs.id);
            }}
          >
            {/* Badge posizione */}
            <div style={{
              background: player ? color : isCompatible ? '#22c55e' : 'rgba(0,0,0,0.55)',
              border: player ? 'none' : isCompatible ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.25)',
              borderRadius: 4, padding: '1px 5px', fontSize: 8, fontWeight: 900,
              color: player ? '#000' : isCompatible ? '#fff' : 'rgba(255,255,255,0.55)',
              letterSpacing: 0.3, lineHeight: '1.4', whiteSpace: 'nowrap',
              boxShadow: isCompatible ? '0 0 8px rgba(34,197,94,0.6)' : 'none',
            }}>
              {badge}
            </div>

            {/* Cerchio giocatore */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: player ? color : isCompatible ? 'rgba(34,197,94,0.3)' : 'transparent',
              border: player ? `2px solid ${color}` : isCompatible ? '2px solid #22c55e' : '2px dashed rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: player ? `0 0 8px ${color}55` : isCompatible ? '0 0 12px rgba(34,197,94,0.5)' : 'none',
            }}>
              {player && (
                <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>
                  {showRating ? player.rating : '?'}
                </span>
              )}
              {isCompatible && !player && (
                <span style={{ fontSize: 14, color: '#22c55e' }}>+</span>
              )}
            </div>

            {/* Nome / Label */}
            <div style={{
              background: 'rgba(0,0,0,0.75)', borderRadius: 3, padding: '1px 5px',
              fontSize: 7, fontWeight: 700, color: player ? '#fff' : isCompatible ? '#22c55e' : 'rgba(255,255,255,0.55)',
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

// ─── PlayerCard ───────────────────────────────────────────────────────────────

interface PlayerCardProps {
  player: DraftedPlayer; disabled: boolean; showRating: boolean;
  compatibleSlotLabels: string[]; selected: boolean; onClick: () => void;
}

function PlayerCard({ player, disabled, showRating, compatibleSlotLabels, selected, onClick }: PlayerCardProps) {
  const { t } = useTranslation();
  const color = catColor(player.position_category);

  // Deduplicate compatible slot labels
  const uniqueSlots = [...new Set(compatibleSlotLabels)];

  // Build combined badges: player sub-positions + compatible slots (deduplicated)
  // Always show sub-positions (LW, CM, CB...) never the category (DEF, ATT, MID)
  const playerPositions = player.all_positions?.length
    ? player.all_positions
    : player.position
      ? [player.position]
      : [player.position_category];

  // Merge: player positions first, then compatible slots not already shown
  const allBadges = [
    ...playerPositions,
    ...uniqueSlots.filter((s) => !playerPositions.includes(s)),
  ];

  return (
    <button onClick={onClick} disabled={disabled}
      className={['relative flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all text-left',
        selected ? 'bg-emerald-500/10 border-2 border-emerald-500/60 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
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
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
        {allBadges.map((badge, i) => {
          const isCompatible = uniqueSlots.includes(badge);
          const posColor = catColor(posCategory(badge));
          return (
            <span key={`${badge}-${i}`}
              style={{
                backgroundColor: isCompatible ? posColor + '28' : posColor + '18',
                color: posColor,
                borderColor: posColor + '55',
              }}
              className="text-[10px] font-black px-2 py-0.5 rounded-md border">
              {badge}
            </span>
          );
        })}
      </div>
    </button>
  );
}

// ─── DraftScreen ──────────────────────────────────────────────────────────────

interface Props { config: SetupConfig; onBack?: () => void; onComplete: (_slots: DraftSlot[]) => void; }

export default function DraftScreen({ config, onBack, onComplete }: Props) {
  const { t } = useTranslation();
  const { state, reveal, spinSquadFirst, selectSlotAndSpin, pick, reroll, cancel, leagueLoaded } = useDraft(config);
  const [pendingPlayer, setPendingPlayer] = useState<DraftedPlayer | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const isSquadFirst = config.draftMode === 'squad_first';
  const filled = state.slots.filter((s) => s.player !== null).length;
  const total = state.slots.length;
  const remaining = emptySlots(state.slots);
  const maxRerolls = REROLLS_BY_DIFFICULTY[config.difficulty];
  const showRating = config.showRatings !== 'off' && config.difficulty !== 'hard';
  const isLoading = (state as any).loading === true;

  // Scroll to pitch when a player is selected
  useEffect(() => {
    if (pendingPlayer && pitchRef.current) {
      pitchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pendingPlayer]);

  function handlePick(player: DraftedPlayer) {
    const compat = findCompatibleSlots(state.slots, player);
    if (compat.length === 0) return;
    if (compat.length === 1) {
      // Assegna direttamente se c'è solo una posizione compatibile
      pick(player, compat[0].formationSlot.id);
      setPendingPlayer(null);
    } else {
      // Mostra il giocatore selezionato e evidenzia le posizioni compatibili
      setPendingPlayer(player);
    }
  }

  function handleSlotClick(slotId: string) {
    if (!pendingPlayer) return;
    pick(pendingPlayer, slotId);
    setPendingPlayer(null);
  }

  function handleCancelPick() {
    setPendingPlayer(null);
  }

  if (state.phase === 'complete') { onComplete(state.slots); return null; }

  const doSpin = isSquadFirst
    ? spinSquadFirst
    : () => selectSlotAndSpin(remaining[0]?.formationSlot.id ?? '');

  // Loading state: dati lega non ancora caricati
  if (!leagueLoaded) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white items-center justify-center gap-4">
        <span className="text-5xl animate-spin" style={{ animationDuration: '2s' }}>⚽</span>
        <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest">{t('loading_data')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
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

      {/* Formazione */}
      <div className="px-3" ref={pitchRef}>
        <div className="rounded-2xl overflow-hidden">
          <Pitch
            formation={config.formation}
            slots={state.slots}
            pendingPlayer={pendingPlayer}
            onSlotClick={handleSlotClick}
            showRating={showRating}
          />
        </div>
      </div>

      {/* Pending player banner */}
      {pendingPlayer && (
        <div className="mx-4 mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black"
              style={{ backgroundColor: catColor(pendingPlayer.position_category) + '33', color: catColor(pendingPlayer.position_category) }}>
              {showRating ? pendingPlayer.rating : '?'}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{pendingPlayer.name}</p>
              <p className="text-xs text-emerald-400">Clicca una posizione in formazione per inserirlo</p>
            </div>
          </div>
          <button onClick={handleCancelPick} className="text-xs font-semibold text-slate-400 border border-slate-600 rounded-lg px-3 py-1.5 hover:text-white hover:border-slate-400 transition-colors">
            ✕
          </button>
        </div>
      )}

      {/* Lista giocatori / Spin */}
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
                <p className="text-xl font-black text-white">{state.currentSpin.club.toUpperCase()}</p>
                <p className="text-xl font-black" style={{ color: '#fbbf24' }}>{state.currentSpin.season}</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">Seleziona un giocatore, poi clicca una posizione in formazione.</p>
            </div>

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
                <button onClick={reroll} disabled={isLoading} className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors disabled:opacity-50">
                  🔄 Reroll ({state.rerollsLeft}/{maxRerolls})
                </button>
              )}
              <button onClick={onBack} className="flex-1 py-3 rounded-xl text-slate-400 text-sm hover:text-white transition-colors">↺ Restart</button>
            </div>
          </div>
        )}

        {state.phase === 'idle' && remaining.length > 0 && (
          <button onClick={doSpin} disabled={isLoading}
            className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 font-black text-lg text-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Loading...
              </span>
            ) : (
              `🎲 ${t('spin')}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}
