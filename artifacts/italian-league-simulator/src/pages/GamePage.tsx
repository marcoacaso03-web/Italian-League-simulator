import React, { useState, useCallback } from 'react';
import { Link } from 'wouter';
import FormationSelector from '../components/FormationSelector';
import DraftScreen from '../game/DraftScreen';
import SquadPreviewScreen from '../game/SquadPreviewScreen';
import SimScreen from '../game/SimScreen';
import ResultsScreen from '../game/ResultsScreen';
import type { DraftSlot } from '../lib/draft';
import type { SeasonResult, TeamOverall } from '../lib/simulation';

export type GamePhase = 'setup' | 'draft' | 'preview' | 'sim' | 'results';
export type DraftMode = 'squad_first' | 'position_first';
export type RatingsMode = 'career' | 'prime';
export type ShowRatings = 'on' | 'off';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type EraPreset = 'all' | '2000s' | '2010s' | 'modern';

export interface SetupConfig {
  difficulty: Difficulty;
  showRatings: ShowRatings;
  draftMode: DraftMode;
  ratingsMode: RatingsMode;
  eraPreset: EraPreset;
  eraFrom: number;
  eraTo: number;
  formation: string;
}

const MIN_YEAR = 1996;
const MAX_YEAR = 2025;
const TOTAL_SEASONS = MAX_YEAR - MIN_YEAR + 1;

const ERA_PRESETS: { id: EraPreset; label: string; sub?: string; from: number }[] = [
  { id: 'all',    label: 'All-time', from: MIN_YEAR },
  { id: '2000s',  label: '2000s+',   from: 2000 },
  { id: '2010s',  label: '2010s+',   from: 2010 },
  { id: 'modern', label: 'Modern', sub: '(2016+)', from: 2016 },
];

interface ToggleCardProps {
  active: boolean; onClick: () => void; title: string; sub: string; accentColor: string;
}
function ToggleCard({ active, onClick, title, sub, accentColor }: ToggleCardProps) {
  const borderActive: Record<string, string> = {
    violet: 'border-violet-500/60 bg-violet-500/10', emerald: 'border-emerald-500/60 bg-emerald-500/10',
    teal: 'border-teal-500/60 bg-teal-500/10', amber: 'border-amber-500/60 bg-amber-500/10', red: 'border-red-500/60 bg-red-500/10',
  };
  const textActive: Record<string, string> = {
    violet: 'text-violet-300', emerald: 'text-emerald-300', teal: 'text-teal-300', amber: 'text-amber-300', red: 'text-red-300',
  };
  const subActive: Record<string, string> = {
    violet: 'text-violet-400/70', emerald: 'text-emerald-400/70', teal: 'text-teal-400/70', amber: 'text-amber-400/70', red: 'text-red-400/70',
  };
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-4 transition-all duration-200 ${
      active ? borderActive[accentColor] ?? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
    }`}>
      <span className={`text-sm font-bold ${active ? (textActive[accentColor] ?? 'text-white') : 'text-slate-300'}`}>{title}</span>
      <span className={`text-xs text-center leading-snug ${active ? (subActive[accentColor] ?? 'text-slate-400') : 'text-slate-500'}`}>{sub}</span>
    </button>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{label}</p>;
}

function EraSlider({ fromYear, toYear, onFromChange, onToChange }: {
  fromYear: number; toYear: number; onFromChange: (_v: number) => void; onToChange: (_v: number) => void;
}) {
  const fromPct    = ((fromYear - MIN_YEAR) / (TOTAL_SEASONS - 1)) * 100;
  const toPct      = ((toYear   - MIN_YEAR) / (TOTAL_SEASONS - 1)) * 100;
  const seasonCount = toYear - fromYear + 1;
  return (
    <div className="w-full">
      <div className="relative h-1 rounded-full bg-white/10 mt-4 mb-2">
        <div className="absolute top-0 h-1 rounded-full bg-emerald-400" style={{ left: `${fromPct}%`, width: `${toPct - fromPct}%` }} />
      </div>
      <div className="relative">
        <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={fromYear}
          onChange={(e) => { const v = Number(e.target.value); if (v < toYear) onFromChange(v); }}
          className="absolute w-full h-1 opacity-0 cursor-pointer z-10" />
        <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={toYear}
          onChange={(e) => { const v = Number(e.target.value); if (v > fromYear) onToChange(v); }}
          className="w-full h-1 opacity-0 cursor-pointer relative z-20" />
      </div>
      <div className="relative h-0">
        <div className="absolute w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#0a0a0f] shadow-[0_0_8px_rgba(52,211,153,0.5)] -translate-y-7 -translate-x-2.5" style={{ left: `${fromPct}%` }} />
        <div className="absolute w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#0a0a0f] shadow-[0_0_8px_rgba(52,211,153,0.5)] -translate-y-7 -translate-x-2.5" style={{ left: `${toPct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-6">
        <span className="text-sm font-bold text-emerald-400">{fromYear}/{String(fromYear + 1).slice(2)}</span>
        <span className="text-xs text-slate-400 text-center">{seasonCount} di {TOTAL_SEASONS} stagioni</span>
        <span className="text-sm font-bold text-emerald-400">{toYear}/{String(toYear + 1).slice(2)}</span>
      </div>
      <p className="text-xs text-slate-500 text-center mt-1 leading-snug">
        Solo le stagioni in questo range verranno sorteggiate — restringi per un&apos;era che conosci.
      </p>
    </div>
  );
}

function SetupScreen({ onStart }: { onStart: (_cfg: SetupConfig) => void }) {
  const [difficulty,   setDifficulty]   = useState<Difficulty>('normal');
  const [showRatings,  setShowRatings]  = useState<ShowRatings>('on');
  const [draftMode,    setDraftMode]    = useState<DraftMode>('squad_first');
  const [ratingsMode,  setRatingsMode]  = useState<RatingsMode>('career');
  const [eraPreset,    setEraPreset]    = useState<EraPreset>('all');
  const [eraFrom,      setEraFrom]      = useState(MIN_YEAR);
  const [eraTo,        setEraTo]        = useState(MAX_YEAR);
  const [formation,    setFormation]    = useState('4-3-3');

  function handleDifficulty(d: Difficulty) {
    setDifficulty(d);
    if (d === 'hard') setShowRatings('off');
  }

  function handleEraPreset(preset: EraPreset) {
    setEraPreset(preset);
    const from = ERA_PRESETS.find((e) => e.id === preset)?.from ?? MIN_YEAR;
    setEraFrom(from); setEraTo(MAX_YEAR);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md flex items-center justify-between mb-8">
        <Link href="/" className="text-slate-500 hover:text-white transition-colors text-sm flex items-center gap-1">← Torna alla Home</Link>
        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Italian League Simulator</span>
      </div>
      <div className="w-full max-w-md space-y-7">
        <section className="glass rounded-2xl p-5">
          <SectionLabel label="DIFFICOLTÀ" />
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: 'easy'   as Difficulty, label: 'Facile',    sub: '3 reroll disponibili',        color: 'emerald' },
              { id: 'normal' as Difficulty, label: 'Normale',   sub: '1 reroll disponibile',        color: 'amber' },
              { id: 'hard'   as Difficulty, label: 'Difficile', sub: 'No reroll · rating nascosti', color: 'red' },
            ] as const).map((d) => (
              <ToggleCard key={d.id} active={difficulty === d.id} onClick={() => handleDifficulty(d.id)} title={d.label} sub={d.sub} accentColor={d.color} />
            ))}
          </div>
        </section>
        <section className={`glass rounded-2xl p-5 transition-opacity duration-200 ${difficulty === 'hard' ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel label="MOSTRA RATING" />
            {difficulty === 'hard' && (
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400 border border-red-500/40 rounded-lg px-2 py-0.5 mb-3">
                🔒 Bloccato in Difficile
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ToggleCard
              active={showRatings === 'on'}
              onClick={() => { if (difficulty !== 'hard') setShowRatings('on'); }}
              title="On"
              sub="Overall giocatori visibili"
              accentColor="violet"
            />
            <ToggleCard
              active={showRatings === 'off'}
              onClick={() => { if (difficulty !== 'hard') setShowRatings('off'); }}
              title="Off"
              sub={difficulty === 'hard' ? 'Forzato dalla difficoltà' : 'Blind mode — fidati del tuo istinto'}
              accentColor="violet"
            />
          </div>
        </section>
        <section className="glass rounded-2xl p-5">
          <SectionLabel label="MODALITÀ DRAFT" />
          <div className="grid grid-cols-2 gap-3">
            <ToggleCard active={draftMode === 'squad_first'}    onClick={() => setDraftMode('squad_first')}    title="Squad First"    sub="Gira un club, scegli il giocatore e il ruolo"      accentColor="emerald" />
            <ToggleCard active={draftMode === 'position_first'} onClick={() => setDraftMode('position_first')} title="Position First" sub="Scegli uno slot, poi gira un club per riempirlo" accentColor="emerald" />
          </div>
        </section>
        <section className="glass rounded-2xl p-5">
          <SectionLabel label="RATING GIOCATORI" />
          <div className="grid grid-cols-2 gap-3">
            <ToggleCard active={ratingsMode === 'career'} onClick={() => setRatingsMode('career')} title="Career Seasons" sub="Rating di quella stagione specifica"     accentColor="teal" />
            <ToggleCard active={ratingsMode === 'prime'}  onClick={() => setRatingsMode('prime')}  title="Prime Mode"    sub="Ogni giocatore al suo massimo storico" accentColor="teal" />
          </div>
        </section>
        <section className="glass rounded-2xl p-5">
          <SectionLabel label="ERA" />
          <div className="grid grid-cols-4 gap-2 mb-5">
            {ERA_PRESETS.map((e) => {
              const active = eraPreset === e.id;
              return (
                <button key={e.id} onClick={() => handleEraPreset(e.id)}
                  className={`rounded-xl border-2 py-2 px-1 text-center transition-all duration-200 ${
                    active ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}>
                  <p className={`text-xs font-bold ${active ? 'text-emerald-400' : 'text-slate-300'}`}>{e.label}</p>
                  {e.sub && <p className={`text-[10px] ${active ? 'text-emerald-400/60' : 'text-slate-500'}`}>{e.sub}</p>}
                </button>
              );
            })}
          </div>
          <EraSlider fromYear={eraFrom} toYear={eraTo}
            onFromChange={(v) => { setEraFrom(v); setEraPreset('all'); }}
            onToChange={(v)   => { setEraTo(v);   setEraPreset('all'); }} />
        </section>
        <section className="glass rounded-2xl p-5">
          <SectionLabel label="FORMAZIONE" />
          <FormationSelector value={formation} onChange={setFormation} />
        </section>
        <button
          onClick={() => onStart({ difficulty, showRatings, draftMode, ratingsMode, eraPreset, eraFrom, eraTo, formation })}
          className="w-full rounded-2xl bg-emerald-500 py-5 text-lg font-black text-black transition-all hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] glow-emerald"
        >
          Inizia il Draft →
        </button>
      </div>
    </div>
  );
}

export default function GamePage() {
  const [phase,       setPhase]       = useState<GamePhase>('setup');
  const [config,      setConfig]      = useState<SetupConfig | null>(null);
  const [draftSlots,  setDraftSlots]  = useState<DraftSlot[]>([]);
  const [results,     setResults]     = useState<SeasonResult | null>(null);
  const [teamOverall, setTeamOverall] = useState<TeamOverall | null>(null);

  const handleStart = useCallback((cfg: SetupConfig) => {
    setConfig(cfg);
    setPhase('draft');
  }, []);

  const handleDraftComplete = useCallback((slots: DraftSlot[]) => {
    setDraftSlots(slots);
    setPhase('preview');
  }, []);

  const handleSimStart = useCallback(() => setPhase('sim'), []);

  const handleSimComplete = useCallback((res: SeasonResult, overall: TeamOverall) => {
    setResults(res);
    setTeamOverall(overall);
    setPhase('results');
  }, []);

  const handleRestart = useCallback(() => {
    setPhase('setup');
    setConfig(null);
    setDraftSlots([]);
    setResults(null);
    setTeamOverall(null);
  }, []);

  if (phase === 'setup' || config === null) return <SetupScreen onStart={handleStart} />;
  if (phase === 'draft')   return <DraftScreen   config={config} onComplete={handleDraftComplete} />;
  if (phase === 'preview') return <SquadPreviewScreen slots={draftSlots} onSimulate={handleSimStart} onRestart={handleRestart} />;
  if (phase === 'sim')     return <SimScreen slots={draftSlots} onComplete={handleSimComplete} />;
  if (phase === 'results' && results && teamOverall) return <ResultsScreen result={results} overall={teamOverall} slots={draftSlots} config={config} onRestart={handleRestart} />;
  return <SetupScreen onStart={handleStart} />;
}
