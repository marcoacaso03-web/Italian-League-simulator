"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  loadClubs,
  loadPlayers,
  getClubSeasonPool,
  getSquad,
  type ClubSeasonEntry,
  type SquadPlayer,
} from "@/lib/data";
import FormationSelector from "@/components/FormationSelector";

/* ===== TYPES ===== */

type Position =
  | "GK" | "LB" | "CB" | "RB" | "LWB" | "RWB"
  | "CDM" | "CM" | "CAM" | "LM" | "RM" | "LW" | "RW"
  | "ST" | "CF";

type DraftablePlayer = {
  id: string;
  name: string;
  position: string;
  club: string;
  season: string;
  rating: number;
  apps: number;
  goals: number;
  assists: number;
};

type Slot = {
  position: Position;
  label: string;
  x: number;
  y: number;
  player: DraftablePlayer | null;
};

type FormationKey = "4-3-3" | "4-4-2" | "4-2-3-1" | "4-5-1" | "3-4-3" | "3-5-2" | "5-4-1";

type GamePhase = "setup" | "draft" | "revealed" | "simulating" | "results";

type SimMatch = {
  matchday: number;
  opponent: string;
  gf: number;
  ga: number;
  result: "V" | "P" | "S";
};

type LeagueEntry = {
  team: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

const FORMATIONS: Record<FormationKey, Omit<Slot, "player">[]> = {
  "4-3-3": [
    { position: "GK", label: "POR", x: 50, y: 90 },
    { position: "LB", label: "TS", x: 15, y: 68 },
    { position: "CB", label: "DC", x: 38, y: 72 },
    { position: "CB", label: "DC", x: 62, y: 72 },
    { position: "RB", label: "TD", x: 85, y: 68 },
    { position: "CM", label: "CC", x: 30, y: 45 },
    { position: "CM", label: "CC", x: 50, y: 50 },
    { position: "CM", label: "CC", x: 70, y: 45 },
    { position: "LW", label: "AS", x: 20, y: 25 },
    { position: "ST", label: "ATT", x: 50, y: 18 },
    { position: "RW", label: "AD", x: 80, y: 25 },
  ],
  "4-4-2": [
    { position: "GK", label: "POR", x: 50, y: 90 },
    { position: "LB", label: "TS", x: 15, y: 68 },
    { position: "CB", label: "DC", x: 38, y: 72 },
    { position: "CB", label: "DC", x: 62, y: 72 },
    { position: "RB", label: "TD", x: 85, y: 68 },
    { position: "LM", label: "CS", x: 18, y: 45 },
    { position: "CM", label: "CC", x: 38, y: 48 },
    { position: "CM", label: "CC", x: 62, y: 48 },
    { position: "RM", label: "CD", x: 82, y: 45 },
    { position: "ST", label: "ATT", x: 35, y: 20 },
    { position: "ST", label: "ATT", x: 65, y: 20 },
  ],
  "4-2-3-1": [
    { position: "GK", label: "POR", x: 50, y: 90 },
    { position: "LB", label: "TS", x: 15, y: 68 },
    { position: "CB", label: "DC", x: 38, y: 72 },
    { position: "CB", label: "DC", x: 62, y: 72 },
    { position: "RB", label: "TD", x: 85, y: 68 },
    { position: "CDM", label: "MDC", x: 35, y: 55 },
    { position: "CDM", label: "MDC", x: 65, y: 55 },
    { position: "LW", label: "AS", x: 18, y: 32 },
    { position: "CAM", label: "TRQ", x: 50, y: 35 },
    { position: "RW", label: "AD", x: 82, y: 32 },
    { position: "ST", label: "ATT", x: 50, y: 18 },
  ],
  "4-5-1": [
    { position: "GK", label: "POR", x: 50, y: 90 },
    { position: "LB", label: "TS", x: 15, y: 68 },
    { position: "CB", label: "DC", x: 38, y: 72 },
    { position: "CB", label: "DC", x: 62, y: 72 },
    { position: "RB", label: "TD", x: 85, y: 68 },
    { position: "LM", label: "CS", x: 18, y: 45 },
    { position: "CM", label: "CC", x: 35, y: 50 },
    { position: "CM", label: "CC", x: 50, y: 48 },
    { position: "CM", label: "CC", x: 65, y: 50 },
    { position: "RM", label: "CD", x: 82, y: 45 },
    { position: "ST", label: "ATT", x: 50, y: 18 },
  ],
  "3-4-3": [
    { position: "GK", label: "POR", x: 50, y: 90 },
    { position: "CB", label: "DC", x: 30, y: 72 },
    { position: "CB", label: "DC", x: 50, y: 75 },
    { position: "CB", label: "DC", x: 70, y: 72 },
    { position: "LWB", label: "FAS", x: 15, y: 50 },
    { position: "CM", label: "CC", x: 35, y: 48 },
    { position: "CM", label: "CC", x: 65, y: 48 },
    { position: "RWB", label: "FAD", x: 85, y: 50 },
    { position: "LW", label: "AS", x: 20, y: 25 },
    { position: "ST", label: "ATT", x: 50, y: 18 },
    { position: "RW", label: "AD", x: 80, y: 25 },
  ],
  "3-5-2": [
    { position: "GK", label: "POR", x: 50, y: 90 },
    { position: "CB", label: "DC", x: 30, y: 72 },
    { position: "CB", label: "DC", x: 50, y: 75 },
    { position: "CB", label: "DC", x: 70, y: 72 },
    { position: "LWB", label: "FAS", x: 15, y: 50 },
    { position: "CM", label: "CC", x: 30, y: 48 },
    { position: "CM", label: "CC", x: 50, y: 52 },
    { position: "CM", label: "CC", x: 70, y: 48 },
    { position: "RWB", label: "FAD", x: 85, y: 50 },
    { position: "ST", label: "ATT", x: 35, y: 20 },
    { position: "ST", label: "ATT", x: 65, y: 20 },
  ],
  "5-4-1": [
    { position: "GK", label: "POR", x: 50, y: 90 },
    { position: "LWB", label: "FAS", x: 12, y: 62 },
    { position: "CB", label: "DC", x: 32, y: 72 },
    { position: "CB", label: "DC", x: 50, y: 75 },
    { position: "CB", label: "DC", x: 68, y: 72 },
    { position: "RWB", label: "FAD", x: 88, y: 62 },
    { position: "LM", label: "CS", x: 22, y: 42 },
    { position: "CM", label: "CC", x: 40, y: 48 },
    { position: "CM", label: "CC", x: 60, y: 48 },
    { position: "RM", label: "CD", x: 78, y: 42 },
    { position: "ST", label: "ATT", x: 50, y: 18 },
  ],
};

const DIFFICULTY_REROLLS: Record<string, number> = {
  facile: 3,
  normale: 1,
  difficile: 0,
};

function ratingColor(r: number): string {
  if (r >= 80) return "text-emerald-400";
  if (r >= 65) return "text-amber-400";
  return "text-red-400";
}

function ratingBg(r: number): string {
  if (r >= 80) return "bg-emerald-500/20";
  if (r >= 65) return "bg-amber-500/20";
  return "bg-red-500/20";
}

function toDraftablePlayer(sp: SquadPlayer, club: string, season: string): DraftablePlayer {
  return {
    id: sp.id,
    name: sp.name,
    position: sp.position,
    club,
    season,
    rating: sp.rating,
    apps: sp.apps,
    goals: sp.goals,
    assists: sp.assists,
  };
}

/* ===== CARD SELEZIONABILE (stile 38-0.app) ===== */
function SelectCard({
  selected,
  onClick,
  accentColor,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  accentColor: "orange" | "purple" | "green" | "teal";
  title: string;
  subtitle: string;
}) {
  const borderMap = {
    orange: "border-amber-500",
    purple: "border-violet-500",
    green: "border-emerald-500",
    teal: "border-teal-500",
  };
  const bgMap = {
    orange: "bg-amber-900/30",
    purple: "bg-violet-900/30",
    green: "bg-emerald-900/30",
    teal: "bg-teal-900/30",
  };
  const textMap = {
    orange: "text-amber-400",
    purple: "text-violet-400",
    green: "text-emerald-400",
    teal: "text-teal-400",
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? `${borderMap[accentColor]} ${bgMap[accentColor]}`
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <p className={`text-base font-bold ${selected ? textMap[accentColor] : "text-white"}`}>
        {title}
      </p>
      <p className={`mt-1 text-sm ${selected ? "text-white/70" : "text-slate-400"}`}>
        {subtitle}
      </p>
    </button>
  );
}

/* ===== MAIN COMPONENT ===== */

export default function GamePage() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [formation, setFormation] = useState<FormationKey>("4-3-3");
  const [difficulty, setDifficulty] = useState("normale");
  const [showRatings, setShowRatings] = useState(true);
  const [draftMode, setDraftMode] = useState<"squad" | "position">("squad");
  const [ratingMode, setRatingMode] = useState<"seasons" | "prime">("seasons");
  const [eraPreset, setEraPreset] = useState("all");
  const [eraFrom, setEraFrom] = useState("1992-1993");
  const [eraTo, setEraTo] = useState("2024-2025");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);
  const [rerollsLeft, setRerollsLeft] = useState(1);

  const [clubSeasonPool, setClubSeasonPool] = useState<ClubSeasonEntry[]>([]);
  const [revealedClub, setRevealedClub] = useState<string | null>(null);
  const [revealedSeason, setRevealedSeason] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [selectedSquadPlayer, setSelectedSquadPlayer] = useState<SquadPlayer | null>(null);
  const [spinning, setSpinning] = useState(false);

  const [simMatches, setSimMatches] = useState<SimMatch[]>([]);
  const [leagueTable, setLeagueTable] = useState<LeagueEntry[]>([]);
  const [finalPosition, setFinalPosition] = useState(0);

  const clubs = useMemo(() => loadClubs(), []);
  const allPlayers = useMemo(() => loadPlayers(), []);

  const availableSeasons = useMemo(() => {
    const s = new Set<string>();
    allPlayers.forEach((p) => p.seasons.forEach((ps) => s.add(ps.season)));
    return Array.from(s).sort();
  }, [allPlayers]);

  const filteredClubSeasonPool = useMemo(() => {
    const fromIdx = availableSeasons.indexOf(eraFrom);
    const toIdx = availableSeasons.indexOf(eraTo);
    const pool = getClubSeasonPool().filter((entry) => {
      const idx = availableSeasons.indexOf(entry.season);
      return idx >= fromIdx && idx <= toIdx;
    });
    return pool;
  }, [availableSeasons, eraFrom, eraTo]);

  const ERA_PRESETS = [
    { key: "all", from: "1992-1993", to: "2024-2025", label: "Sempre" },
    { key: "2000s", from: "2000-2001", to: "2024-2025", label: "2000+" },
    { key: "2010s", from: "2010-2011", to: "2024-2025", label: "2010+" },
    { key: "modern", from: "2016-2017", to: "2024-2025", label: "Moderno (2016+)" },
  ];

  const ALL_SEASONS = availableSeasons.length > 0 ? availableSeasons : ["1992-1993", "2024-2025"];
  const fromIdx = ALL_SEASONS.indexOf(eraFrom);
  const toIdx = ALL_SEASONS.indexOf(eraTo);
  const seasonCount = toIdx >= fromIdx ? toIdx - fromIdx + 1 : 0;

  const startDraft = useCallback(() => {
    const rerolls = DIFFICULTY_REROLLS[difficulty] ?? 1;
    setRerollsLeft(rerolls);
    setSlots(FORMATIONS[formation].map((s) => ({ ...s, player: null })));
    setCurrentSlotIdx(0);
    setRevealedClub(null);
    setRevealedSeason(null);
    setSquad([]);
    setSelectedSquadPlayer(null);
    setClubSeasonPool(filteredClubSeasonPool);
    setPhase("draft");
  }, [difficulty, formation, filteredClubSeasonPool]);

  const spin = useCallback(() => {
    if (spinning || clubSeasonPool.length === 0) return;
    setSpinning(true);
    setSelectedSquadPlayer(null);
    setSquad([]);
    setRevealedClub(null);
    setRevealedSeason(null);

    let count = 0;
    const maxTicks = 12;
    const interval = setInterval(() => {
      const randomEntry = clubSeasonPool[Math.floor(Math.random() * clubSeasonPool.length)];
      setRevealedClub(randomEntry.club);
      setRevealedSeason(randomEntry.season);
      count++;
      if (count >= maxTicks) {
        clearInterval(interval);
        const finalEntry = clubSeasonPool[Math.floor(Math.random() * clubSeasonPool.length)];
        setRevealedClub(finalEntry.club);
        setRevealedSeason(finalEntry.season);
        const squadPlayers = getSquad(finalEntry.club, finalEntry.season);
        setSquad(squadPlayers);
        setSpinning(false);
        setPhase("revealed");
      }
    }, 120);
  }, [spinning, clubSeasonPool]);

  const reroll = useCallback(() => {
    if (rerollsLeft <= 0 || spinning) return;
    setRerollsLeft((r) => r - 1);
    setRevealedClub(null);
    setRevealedSeason(null);
    setSquad([]);
    setSelectedSquadPlayer(null);
    setPhase("draft");
  }, [rerollsLeft, spinning]);

  const confirmPick = useCallback(() => {
    if (!selectedSquadPlayer || !revealedClub || !revealedSeason) return;
    const draftable = toDraftablePlayer(selectedSquadPlayer, revealedClub, revealedSeason);
    const newSlots = slots.map((s, i) =>
      i === currentSlotIdx ? { ...s, player: draftable } : s
    );

    setSelectedSquadPlayer(null);
    setRevealedClub(null);
    setRevealedSeason(null);
    setSquad([]);

    const nextEmpty = newSlots.findIndex((s, i) => i > currentSlotIdx && !s.player);
    if (nextEmpty !== -1) {
      setSlots(newSlots);
      setCurrentSlotIdx(nextEmpty);
      setPhase("draft");
    } else {
      simulateSeason(newSlots);
    }
  }, [selectedSquadPlayer, revealedClub, revealedSeason, slots, currentSlotIdx]);

  const simulateSeason = useCallback(
    (finalSlots: Slot[]) => {
      setPhase("simulating");
      const teamRating =
        finalSlots.reduce((sum, s) => sum + (s.player?.rating || 50), 0) / 11;

      const leagueTeams = clubs.slice(0, 20).map((c, i) => ({
        name: c.name,
        rating: i === 0 ? teamRating : 40 + Math.random() * 40,
      }));
      leagueTeams[0] = { name: "La Mia Squadra", rating: teamRating };

      const matches: SimMatch[] = [];
      const table: LeagueEntry[] = leagueTeams.map((t) => ({
        team: t.name, played: 0, w: 0, d: 0, l: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      }));

      for (let md = 1; md <= 38; md++) {
        for (let i = 0; i < leagueTeams.length; i++) {
          const oppIdx = 1 + ((md - 1 + i) % (leagueTeams.length - 1));
          if (oppIdx === i) continue;
          const diff = leagueTeams[i].rating - leagueTeams[oppIdx].rating;
          const rand = (Math.random() - 0.5) * 40;
          const total = diff + rand;
          const gf = Math.max(0, Math.round((total + 60) / 20));
          const ga = Math.max(0, Math.round((60 - total) / 20));

          let result: "V" | "P" | "S" = "P";
          if (total > 5) result = "V";
          else if (total < -5) result = "S";

          if (i === 0) {
            matches.push({ matchday: md, opponent: leagueTeams[oppIdx].name, gf, ga, result });
          }

          table[i].played++;
          table[i].gf += gf;
          table[i].ga += ga;
          if (result === "V") { table[i].w++; table[i].points += 3; }
          else if (result === "P") { table[i].d++; table[i].points += 1; }
          else { table[i].l++; }
        }
      }

      table.forEach((t) => (t.gd = t.gf - t.ga));
      table.sort((a, b) => b.points - a.points || b.gd - a.gd);
      const pos = table.findIndex((t) => t.team === "La Mia Squadra") + 1;

      setTimeout(() => {
        setSimMatches(matches.slice(-5));
        setLeagueTable(table);
        setFinalPosition(pos);
        setPhase("results");
      }, 1500);
    },
    [clubs]
  );

  /* ===== RENDER: SETUP (identico a 38-0.app) ===== */
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] px-4 py-10 text-white">
        <div className="mx-auto max-w-md">

          {/* Pill centrale */}
          <div className="mb-8 flex justify-center">
            <span className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white/80">
              Serie A Draft
            </span>
          </div>

          {/* DIFFICOLTÀ */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Difficoltà
            </p>
            <div className="grid grid-cols-3 gap-3">
              <SelectCard
                selected={difficulty === "facile"}
                onClick={() => setDifficulty("facile")}
                accentColor="green"
                title="Facile"
                subtitle="3 reroll disponibili"
              />
              <SelectCard
                selected={difficulty === "normale"}
                onClick={() => setDifficulty("normale")}
                accentColor="orange"
                title="Normale"
                subtitle="1 reroll disponibile"
              />
              <SelectCard
                selected={difficulty === "difficile"}
                onClick={() => setDifficulty("difficile")}
                accentColor="purple"
                title="Difficile"
                subtitle="Nessun reroll · rating nascosti"
              />
            </div>
          </section>

          {/* MOSTRA VALUTAZIONI */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Mostra Valutazioni
            </p>
            <div className="grid grid-cols-2 gap-3">
              <SelectCard
                selected={showRatings}
                onClick={() => setShowRatings(true)}
                accentColor="purple"
                title="Sì"
                subtitle="Valutazioni visibili"
              />
              <SelectCard
                selected={!showRatings}
                onClick={() => setShowRatings(false)}
                accentColor="purple"
                title="No"
                subtitle="Modalità cieca — fidati dell'istinto"
              />
            </div>
          </section>

          {/* MODALITÀ DRAFT */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Modalità Draft
            </p>
            <div className="grid grid-cols-2 gap-3">
              <SelectCard
                selected={draftMode === "squad"}
                onClick={() => setDraftMode("squad")}
                accentColor="green"
                title="Prima la Squadra"
                subtitle="Estrai un club, scegli il giocatore e il ruolo"
              />
              <SelectCard
                selected={draftMode === "position"}
                onClick={() => setDraftMode("position")}
                accentColor="green"
                title="Prima il Ruolo"
                subtitle="Scegli un ruolo, poi estrai un club"
              />
            </div>
          </section>

          {/* VALUTAZIONI GIOCATORI */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Valutazioni Giocatori
            </p>
            <div className="grid grid-cols-2 gap-3">
              <SelectCard
                selected={ratingMode === "seasons"}
                onClick={() => setRatingMode("seasons")}
                accentColor="teal"
                title="Stagioni in Carriera"
                subtitle="Valutati in base a quella stagione"
              />
              <SelectCard
                selected={ratingMode === "prime"}
                onClick={() => setRatingMode("prime")}
                accentColor="teal"
                title="Prime Mode"
                subtitle="Ogni giocatore al massimo storico"
              />
            </div>
          </section>

          {/* FORMAZIONE */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Formazione
            </p>
            <FormationSelector value={formation} onChange={(f: string) => setFormation(f as FormationKey)} />
          </section>

          {/* EPOCA */}
          <section className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Epoca
            </p>
            <div className="flex flex-wrap gap-2">
              {ERA_PRESETS.map((era) => (
                <button
                  key={era.key}
                  onClick={() => {
                    setEraPreset(era.key);
                    setEraFrom(era.from);
                    setEraTo(era.to);
                  }}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                    eraPreset === era.key
                      ? "border-emerald-500 bg-emerald-900/30 text-emerald-400"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {era.label}
                </button>
              ))}
            </div>

            {/* Slider range era */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span className="font-semibold text-emerald-400">{eraFrom.replace("-", "/")}</span>
                <span className="text-slate-400">{seasonCount} di {ALL_SEASONS.length} stagioni</span>
                <span className="font-semibold text-emerald-400">{eraTo.replace("-", "/")}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-white/10">
                <div
                  className="absolute h-1.5 rounded-full bg-emerald-500 transition-all"
                  style={{
                    left: `${ALL_SEASONS.length > 1 ? (fromIdx / (ALL_SEASONS.length - 1)) * 100 : 0}%`,
                    right: `${ALL_SEASONS.length > 1 ? ((ALL_SEASONS.length - 1 - toIdx) / (ALL_SEASONS.length - 1)) * 100 : 0}%`,
                  }}
                />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow"
                  style={{ left: `${ALL_SEASONS.length > 1 ? (fromIdx / (ALL_SEASONS.length - 1)) * 100 : 0}%` }}
                />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow"
                  style={{ left: `${ALL_SEASONS.length > 1 ? (toIdx / (ALL_SEASONS.length - 1)) * 100 : 100}%` }}
                />
              </div>
              <p className="text-center text-xs text-slate-500">
                Solo le stagioni in questo intervallo saranno disponibili nel draft.
              </p>
            </div>
          </section>

          {/* CTA */}
          <button
            onClick={startDraft}
            className="w-full rounded-2xl bg-emerald-500 py-5 text-lg font-bold text-black transition-all hover:bg-emerald-400 active:scale-95"
          >
            Inizia Draft →
          </button>

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
              ← Torna alla home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ===== RENDER: DRAFT ===== */
  if (phase === "draft") {
    const currentSlot = slots[currentSlotIdx];
    const filledCount = slots.filter((s) => s.player).length;

    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/game" className="text-sm text-slate-500 hover:text-emerald-400">← Nuova partita</Link>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>Draft: {filledCount}/11</span>
              {difficulty !== "difficile" && <span className="text-amber-400">Reroll: {rerollsLeft}</span>}
            </div>
          </div>

          <div className="mb-8 flex gap-1">
            {slots.map((s, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                s.player ? "bg-emerald-500" : i === currentSlotIdx ? "bg-amber-500 animate-pulse" : "bg-white/10"
              }`} />
            ))}
          </div>

          <h2 className="mb-2 text-2xl font-black">Scopri il tuo prossimo club!</h2>
          <p className="mb-6 text-sm text-slate-400">
            Posizione da ricoprire: <span className="font-bold text-emerald-400">{currentSlot?.label}</span>
          </p>

          <div className="grid gap-8 lg:grid-cols-2 mt-4">
            <PitchView slots={slots} currentIdx={currentSlotIdx} showRatings={showRatings} />

            <div className="flex flex-col items-center gap-6">
              <div className="glass w-full rounded-xl p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-slate-500">Posizione</p>
                <p className="text-3xl font-black text-emerald-400">{currentSlot?.label}</p>
              </div>

              <div className="w-full">
                <div className={`glass rounded-xl p-8 text-center transition-all duration-300 ${
                  spinning ? "border-amber-500/30" : revealedClub ? "border-emerald-500/30" : "border-white/10"
                }`}>
                  {revealedClub ? (
                    <div className="animate-pop-up">
                      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Club &amp; Stagione</p>
                      <p className="text-3xl font-black text-white">{revealedClub}</p>
                      <p className="mt-1 text-lg font-semibold text-amber-400">{revealedSeason}</p>
                    </div>
                  ) : spinning ? (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Estrazione...</p>
                      <p className="text-3xl font-black text-amber-400 animate-pulse">???</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-5xl mb-3">🎰</p>
                      <p className="text-lg font-semibold text-slate-300">Gira per scoprire</p>
                      <p className="text-sm text-slate-500">il club e la stagione</p>
                    </div>
                  )}
                </div>

                <button onClick={spin} disabled={spinning}
                  className={`mt-6 w-full rounded-xl py-4 text-lg font-bold transition-all ${
                    spinning ? "bg-white/5 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-500 text-black hover:bg-emerald-400 glow-emerald"
                  }`}>
                  {spinning ? "🎰 Estrazione..." : "🎰 Gira!"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ===== RENDER: REVEALED ===== */
  if (phase === "revealed") {
    const currentSlot = slots[currentSlotIdx];
    const filledCount = slots.filter((s) => s.player).length;

    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/game" className="text-sm text-slate-500 hover:text-emerald-400">← Nuova partita</Link>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>Draft: {filledCount}/11</span>
              {difficulty !== "difficile" && <span className="text-amber-400">Reroll: {rerollsLeft}</span>}
            </div>
          </div>

          <div className="mb-8 flex gap-1">
            {slots.map((s, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                s.player ? "bg-emerald-500" : i === currentSlotIdx ? "bg-amber-500 animate-pulse" : "bg-white/10"
              }`} />
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-2 mt-4">
            <PitchView slots={slots} currentIdx={currentSlotIdx} showRatings={showRatings} />

            <div className="flex flex-col gap-4">
              <div className="glass rounded-xl p-4 text-center border border-emerald-500/20">
                <p className="text-xs uppercase tracking-widest text-slate-500">Club &amp; Stagione</p>
                <p className="text-2xl font-black text-white">{revealedClub}</p>
                <p className="text-sm font-semibold text-amber-400">{revealedSeason}</p>
                <p className="mt-1 text-xs text-slate-500">Ruolo: <span className="text-emerald-400 font-bold">{currentSlot?.label}</span></p>
              </div>

              <div className="glass rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Rosa · {squad.length} giocatori
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {squad.map((sp) => {
                    const isSelected = selectedSquadPlayer?.id === sp.id;
                    return (
                      <button
                        key={sp.id}
                        onClick={() => setSelectedSquadPlayer(sp)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 last:border-b-0 ${
                          isSelected
                            ? "bg-emerald-500/15 border-l-2 border-l-emerald-500"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-400"
                        }`}>
                          {sp.position}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${isSelected ? "text-emerald-400" : "text-slate-200"}`}>
                            {sp.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {sp.apps} pres · {sp.goals} gol · {sp.assists} ass
                            {showRatings && (
                              <span className={`ml-2 font-bold ${ratingColor(sp.rating)}`}>{sp.rating}</span>
                            )}
                          </p>
                        </div>
                        {isSelected && <span className="text-emerald-400 text-lg">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={confirmPick} disabled={!selectedSquadPlayer}
                  className={`flex-1 rounded-xl py-3 font-bold transition-all ${
                    selectedSquadPlayer
                      ? "bg-emerald-500 text-black hover:bg-emerald-400 glow-emerald"
                      : "bg-white/5 text-slate-500 cursor-not-allowed"
                  }`}>
                  Conferma ✓
                </button>
                {rerollsLeft > 0 && (
                  <button onClick={reroll}
                    className="rounded-xl border border-amber-500/30 px-6 py-3 font-bold text-amber-400 hover:bg-amber-500/10 transition-all">
                    Reroll ({rerollsLeft})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ===== RENDER: SIMULATING ===== */
  if (phase === "simulating") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center animate-bounce-in">
          <div className="text-6xl mb-4">⚽</div>
          <h2 className="text-2xl font-black">Stagione in corso...</h2>
          <p className="mt-2 text-slate-400">La tua squadra sta giocando 38 giornate</p>
          <div className="mt-6 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 w-3 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ===== RENDER: RESULTS ===== */
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-slate-500 hover:text-emerald-400">← Nuova partita</Link>

        <div className="mt-8 animate-slide-up">
          <h1 className="text-4xl font-black">
            {finalPosition === 1 ? <span className="text-gold-shimmer">🏆 Campione!</span>
            : finalPosition <= 4 ? <span className="text-emerald-400">Champions League!</span>
            : finalPosition <= 6 ? <span className="text-blue-400">Europa League</span>
            : finalPosition <= 17 ? <span className="text-slate-300">Salvezza</span>
            : <span className="text-red-400">Retrocessione 💀</span>}
          </h1>

          <div className="mt-6 glass rounded-2xl p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center"><p className="text-3xl font-black">{finalPosition}°</p><p className="text-xs text-slate-500">Posizione</p></div>
              <div className="text-center"><p className="text-3xl font-black text-emerald-400">{leagueTable[finalPosition - 1]?.points || 0}</p><p className="text-xs text-slate-500">Punti</p></div>
              <div className="text-center"><p className="text-3xl font-black">{leagueTable[finalPosition - 1]?.w || 0}V {leagueTable[finalPosition - 1]?.d || 0}N {leagueTable[finalPosition - 1]?.l || 0}P</p><p className="text-xs text-slate-500">Risultati</p></div>
              <div className="text-center"><p className="text-3xl font-black">{leagueTable[finalPosition - 1]?.gf || 0}-{leagueTable[finalPosition - 1]?.ga || 0}</p><p className="text-xs text-slate-500">GF-GS</p></div>
            </div>
          </div>

          <div className="mt-8 glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_3rem_3rem_4rem] gap-2 border-b border-white/5 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>#</span><span>Squadra</span><span>G</span><span>V</span><span>N</span><span>P</span><span>GF</span><span>GS</span><span>DR</span><span>PT</span>
            </div>
            {leagueTable.map((entry, i) => {
              const isUser = entry.team === "La Mia Squadra";
              const pos = i + 1;
              return (
                <div key={entry.team}
                  className={`grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_3rem_3rem_4rem] gap-2 border-b border-white/5 px-4 py-2.5 text-sm ${
                    isUser ? "bg-emerald-500/10 font-bold text-emerald-400" : "text-slate-300"
                  } ${pos <= 4 ? "border-l-2 border-l-emerald-500" : ""} ${pos > 17 ? "border-l-2 border-l-red-500" : ""}`}>
                  <span>{pos}</span><span className="truncate">{entry.team}</span>
                  <span>{entry.played}</span><span>{entry.w}</span><span>{entry.d}</span><span>{entry.l}</span>
                  <span>{entry.gf}</span><span>{entry.ga}</span>
                  <span>{entry.gd > 0 ? `+${entry.gd}` : entry.gd}</span>
                  <span className="font-bold">{entry.points}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-12">
            <h2 className="mb-6 text-xl font-black">La Tua XI</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.filter((s) => s.player).map((s, i) => (
                <div key={i} className="glass rounded-xl p-3 flex items-center gap-3 animate-pop-up">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${ratingBg(s.player!.rating)}`}>
                    {showRatings ? s.player!.rating : "✓"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{s.player!.name}</p>
                    <p className="text-xs text-slate-500">{s.player!.club} · {s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/game?new=true"
              className="glow-emerald inline-block rounded-xl bg-emerald-500 px-10 py-4 text-lg font-bold text-black hover:bg-emerald-400">
              Gioca Ancora →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== PITCH VIEW ===== */
function PitchView({ slots, currentIdx, showRatings }: { slots: Slot[]; currentIdx: number; showRatings: boolean }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: "1/1.6" }}>
      <svg viewBox="0 0 100 160" className="h-full w-full">
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d5a27" />
            <stop offset="50%" stopColor="#348a2e" />
            <stop offset="100%" stopColor="#2d5a27" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="160" fill="url(#pg)" rx="4" />
        <rect x="3" y="3" width="94" height="154" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.4" rx="2" />
        <line x1="3" y1="80" x2="97" y2="80" stroke="white" strokeWidth="0.3" strokeOpacity="0.3" />
        <circle cx="50" cy="80" r="12" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.3" />
        <circle cx="50" cy="80" r="0.8" fill="white" fillOpacity="0.3" />
        <rect x="20" y="3" width="60" height="24" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.3" />
        <rect x="20" y="133" width="60" height="24" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.3" />
      </svg>

      {slots.map((slot, i) => {
        const isCurrent = i === currentIdx && !slot.player;
        return (
          <div key={i}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all sm:h-11 sm:w-11 ${
              slot.player ? "border-emerald-400 bg-emerald-500/20 text-emerald-400"
              : isCurrent ? "border-amber-400 bg-amber-500/20 text-amber-400 animate-pulse"
              : "border-white/20 bg-white/5 text-slate-500"
            }`}>
              {slot.player ? (showRatings ? <span className="text-[10px] sm:text-xs">{slot.player.rating}</span> : "✓") : slot.label}
            </div>
            {slot.player && (
              <p className="mt-0.5 max-w-[80px] truncate text-center text-[9px] font-medium text-slate-300 sm:text-[10px]">
                {slot.player.name.split(" ").pop()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
