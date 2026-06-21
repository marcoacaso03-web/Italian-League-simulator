import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { createLobby } from '../lib/lobby';
import type { SetupConfig } from './GamePage';

interface LobbyCreatePageProps {
  onLobbyCreated: (code: string) => void;
}

export default function LobbyCreatePage({ onLobbyCreated }: LobbyCreatePageProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const [hostName, setHostName] = useState('');
  const [difficulty, setDifficulty] = useState<SetupConfig['difficulty']>('normal');
  const [mode, setMode] = useState<SetupConfig['draftMode']>('squad_first');
  const [eraPreset, setEraPreset] = useState<SetupConfig['eraPreset']>('all');
  const [eraFrom, setEraFrom] = useState(1996);
  const [eraTo, setEraTo] = useState(2025);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName.trim()) {
      setError('Inserisci il tuo nickname');
      return;
    }

    setCreating(true);
    setError(null);

    const config: SetupConfig = {
      difficulty,
      showRatings: 'on',
      draftMode: mode,
      ratingsMode: 'career',
      eraPreset,
      eraFrom,
      eraTo,
      formation: '4-3-3',
    };

    try {
      const lobby = await createLobby(hostName.trim(), 'league', config, maxPlayers);
      onLobbyCreated(lobby.code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore nella creazione');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <p className="text-4xl">🏠</p>
          <h1 className="text-2xl font-black text-white">Crea Lobby</h1>
          <p className="text-sm text-slate-400">Configura le regole per i tuoi amici</p>
        </div>

        <Link href="/lobby">
          <button className="text-slate-500 hover:text-white transition-colors text-sm">← Indietro</button>
        </Link>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Nickname */}
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Il tuo Nickname</p>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 16))}
              placeholder="ES. MARCO"
              maxLength={16}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </section>

          {/* Difficoltà */}
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Difficoltà</p>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'normal', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`rounded-xl border-2 py-3 text-center transition-all ${
                    difficulty === d
                      ? d === 'easy' ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                        : d === 'normal' ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                        : 'border-red-500/60 bg-red-500/10 text-red-300'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <p className="text-sm font-bold">{d === 'easy' ? '🟢 Easy' : d === 'normal' ? '🟡 Normal' : '🔴 Hard'}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Modalità Draft */}
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Modalità Draft</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'squad_first' as const, emoji: '🎰', label: 'Squadra Prima', desc: 'Sorteiga poi pesca' },
                { id: 'position_first' as const, emoji: '📋', label: 'Ruolo Prima', desc: 'Scegli ruolo poi sorteiga' },
              ]).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    mode === m.id
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
                >
                  <p className="text-xl mb-1">{m.emoji}</p>
                  <p className={`text-sm font-bold ${mode === m.id ? 'text-emerald-300' : 'text-slate-300'}`}>{m.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Era */}
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Era</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {([
                { id: 'all' as const, label: 'Tutte', from: 1996 },
                { id: '2000s' as const, label: '2000s', from: 2000 },
                { id: '2010s' as const, label: '2010s', from: 2010 },
                { id: 'modern' as const, label: 'Moderno', from: 2016 },
              ]).map((ep) => (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => { setEraPreset(ep.id); setEraFrom(ep.from); setEraTo(2025); }}
                  className={`rounded-xl border-2 py-2 px-1 text-center transition-all ${
                    eraPreset === ep.id
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
                >
                  <p className={`text-xs font-bold ${eraPreset === ep.id ? 'text-emerald-300' : 'text-slate-400'}`}>{ep.label}</p>
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 text-center">{eraFrom}–{eraTo}</div>
          </section>

          {/* Max giocatori */}
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Max Giocatori</p>
            <div className="flex items-center gap-3">
              {[2, 3, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxPlayers(n)}
                  className={`w-12 h-12 rounded-xl border-2 font-black text-sm transition-all ${
                    maxPlayers === n
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          {/* Crea */}
          <button
            type="submit"
            disabled={creating || !hostName.trim()}
            className="w-full rounded-2xl bg-emerald-500 py-5 text-lg font-black text-black hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? '⏳ Creo...' : '🚀 Crea Lobby'}
          </button>
        </form>
      </div>
    </div>
  );
}
