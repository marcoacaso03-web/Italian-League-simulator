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
      setError(t('lobby_error_code'));
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
      formation: '4-3-3', leagueId: 'serie-a',
    };

    try {
      const lobby = await createLobby(hostName.trim(), 'league', config, maxPlayers);
      onLobbyCreated(lobby.code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('lobby_unknown_error'));
    } finally {
      setCreating(false);
    }
  }

  const ERA_PRESETS = [
    { id: 'all' as const, labelKey: 'lobby_era_all', from: 1996 },
    { id: '2000s' as const, labelKey: 'lobby_era_2000s', from: 2000 },
    { id: '2010s' as const, labelKey: 'lobby_era_2010s', from: 2010 },
    { id: 'modern' as const, labelKey: 'lobby_era_modern', from: 2016 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <p className="text-4xl">🏠</p>
          <h1 className="text-2xl font-black text-white">{t('lobby_create')}</h1>
          <p className="text-sm text-slate-400">{t('lobby_create_desc')}</p>
        </div>

        <Link href="/lobby">
          <button className="text-slate-500 hover:text-white transition-colors text-sm">← {t('back_to_home')}</button>
        </Link>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('lobby_host_nickname')}</p>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 16))}
              placeholder={t('lobby_host_nickname_placeholder')}
              maxLength={16}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </section>

          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('lobby_difficulty')}</p>
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
                  <p className="text-sm font-bold">{d === 'easy' ? '🟢' : d === 'normal' ? '🟡' : '🔴'} {t('difficulty_' + d)}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('lobby_draft_mode')}</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'squad_first' as const, emoji: '�0', labelKey: 'draft_mode_squad', subKey: 'draft_mode_squad_sub' },
                { id: 'position_first' as const, emoji: '📋', labelKey: 'draft_mode_position', subKey: 'draft_mode_position_sub' },
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
                  <p className={`text-sm font-bold ${mode === m.id ? 'text-emerald-300' : 'text-slate-300'}`}>{t(m.labelKey)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t(m.subKey)}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('lobby_era')}</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {ERA_PRESETS.map((ep) => (
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
                  <p className={`text-xs font-bold ${eraPreset === ep.id ? 'text-emerald-300' : 'text-slate-400'}`}>{t(ep.labelKey)}</p>
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 text-center">{eraFrom}–{eraTo}</div>
          </section>

          <section className="glass rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('lobby_max_players')}</p>
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

          <button
            type="submit"
            disabled={creating || !hostName.trim()}
            className="w-full rounded-2xl bg-emerald-500 py-5 text-lg font-black text-black hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? '⏳ ' + t('lobby_creating_text') : '🚀 ' + t('lobby_create_btn_text')}
          </button>
        </form>
      </div>
    </div>
  );
}
