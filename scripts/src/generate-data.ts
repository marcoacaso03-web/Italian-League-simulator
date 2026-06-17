/**
 * generate-data.ts
 * Legge tutti i CSV dalla root del workspace e genera:
 *   artifacts/italian-league-simulator/public/data/players.json
 *   artifacts/italian-league-simulator/public/data/clubs-by-season.json
 *
 * Viene eseguito come pre-step della build Vite (su Vercel e in locale).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------
interface PlayerSeason {
  club: string;
  season: string;
  rating: number;
  positions: string[];
  categories: string[];
}

interface Player {
  id: string;
  name: string;
  position: string;
  position_category: string;
  seasons: PlayerSeason[];
}

interface Club {
  id: string;
  name: string;
}

interface CsvRow {
  Squadra: string;
  Giocatore: string;
  Ruolo: string;
  Valutazione: string;
}

// ---------------------------------------------------------------------------
// Mapping ruoli → posizioni FIFA
// ---------------------------------------------------------------------------
const RUOLO_MAP: Record<string, { position: string; category: string }> = {
  POR:  { position: 'GK',  category: 'GK'  },
  DC:   { position: 'CB',  category: 'DEF' },
  SW:   { position: 'CB',  category: 'DEF' },
  TD:   { position: 'RB',  category: 'DEF' },
  TS:   { position: 'LB',  category: 'DEF' },
  ED:   { position: 'RM',  category: 'MID' },
  ES:   { position: 'LM',  category: 'MID' },
  CC:   { position: 'CM',  category: 'MID' },
  CDC:  { position: 'CDM', category: 'MID' },
  LCDM: { position: 'CDM', category: 'MID' },
  RCDM: { position: 'CDM', category: 'MID' },
  COC:  { position: 'CAM', category: 'MID' },
  LCAM: { position: 'CAM', category: 'MID' },
  RCAM: { position: 'CAM', category: 'MID' },
  LWM:  { position: 'LM',  category: 'MID' },
  RWM:  { position: 'RM',  category: 'MID' },
  ATT:  { position: 'ST',  category: 'ATT' },
  AT:   { position: 'ST',  category: 'ATT' },
  CF:   { position: 'CF',  category: 'ATT' },
  AD:   { position: 'RW',  category: 'ATT' },
  ADA:  { position: 'RW',  category: 'ATT' },
  AS:   { position: 'LW',  category: 'ATT' },
  ASA:  { position: 'LW',  category: 'ATT' },
};

function ruoloToPositionCategory(ruolo: string): { position: string; category: string } {
  return RUOLO_MAP[ruolo.trim().toUpperCase()] ?? { position: 'CM', category: 'MID' };
}

// ---------------------------------------------------------------------------
// Parsing CSV
// ---------------------------------------------------------------------------
function parseSimpleCsv(content: string): CsvRow[] {
  const lines = content.replace(/^\uFEFF/, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = (parts[idx] ?? '').trim(); });
    if (obj['Squadra'] && obj['Giocatore'] && obj['Ruolo'] && obj['Valutazione']) {
      rows.push(obj as unknown as CsvRow);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Mapping filename → stagione
// ---------------------------------------------------------------------------
function buildSeasonMap(rootDir: string): Record<string, string> {
  const map: Record<string, string> = {};
  const stagReMatch = /^Stagione (\d{4})-(\d{2})\.csv$/;
  const fifaMatch   = /^FIFA (\d{2})\.csv$/;
  const fcMatch     = /^FC (\d{2})\.csv$/;

  let files: string[] = [];
  try { files = fs.readdirSync(rootDir).filter((f) => f.endsWith('.csv')); } catch { return map; }

  for (const f of files) {
    let m;
    if ((m = f.match(stagReMatch))) {
      const y = parseInt(m[1], 10);
      map[f] = `${y}-${y + 1}`;
    } else if ((m = f.match(fifaMatch))) {
      const y = 2000 + parseInt(m[1], 10);
      map[f] = `${y - 1}-${y}`;
    } else if ((m = f.match(fcMatch))) {
      const y = 2000 + parseInt(m[1], 10);
      map[f] = `${y - 1}-${y}`;
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Merge: stesso nome + stesso club → stessa persona
// ---------------------------------------------------------------------------
function mergeByNameAndClub(players: Player[]): Player[] {
  const byName = new Map<string, Player[]>();
  for (const p of players) {
    const group = byName.get(p.name) ?? [];
    group.push(p);
    byName.set(p.name, group);
  }

  const result: Player[] = [];

  for (const [, group] of byName) {
    if (group.length === 1) { result.push(group[0]); continue; }

    const n = group.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i: number): number { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
    function union(a: number, b: number) { parent[find(a)] = find(b); }

    const clubToEntries = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      for (const s of group[i].seasons) {
        const list = clubToEntries.get(s.club) ?? [];
        list.push(i);
        clubToEntries.set(s.club, list);
      }
    }
    for (const indices of clubToEntries.values()) {
      for (let k = 1; k < indices.length; k++) union(indices[0], indices[k]);
    }

    const components = new Map<number, Player[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const comp = components.get(root) ?? [];
      comp.push(group[i]);
      components.set(root, comp);
    }

    for (const comp of components.values()) {
      if (comp.length === 1) { result.push(comp[0]); continue; }
      const dominant = comp.reduce((best, cur) => cur.seasons.length > best.seasons.length ? cur : best);
      const allSeasons: PlayerSeason[] = [];
      const seenKey = new Set<string>();
      for (const p of comp) {
        for (const s of p.seasons) {
          const key = `${s.club}|||${s.season}`;
          if (!seenKey.has(key)) { seenKey.add(key); allSeasons.push(s); }
        }
      }
      result.push({
        id: dominant.id,
        name: dominant.name,
        position: dominant.position,
        position_category: dominant.position_category,
        seasons: allSeasons,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.resolve(WORKSPACE_ROOT, 'artifacts', 'italian-league-simulator', 'public', 'data');

console.log('📂 Workspace root:', WORKSPACE_ROOT);
console.log('📤 Output dir:', OUTPUT_DIR);

const seasonMap = buildSeasonMap(WORKSPACE_ROOT);
console.log(`📋 CSV trovati: ${Object.keys(seasonMap).length}`);

const playerMap = new Map<string, Player>();
const clubSet   = new Set<string>();

for (const [filename, annoStagione] of Object.entries(seasonMap)) {
  const filePath = path.join(WORKSPACE_ROOT, filename);
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
  const rows = parseSimpleCsv(content);

  const fileGroups = new Map<string, {
    name: string; club: string;
    primaryPos: string; primaryCat: string; rating: number;
    allPos: string[]; allCat: string[];
  }>();

  for (const row of rows) {
    const { position, category } = ruoloToPositionCategory(row.Ruolo);
    const rating = parseInt(row.Valutazione, 10);
    if (isNaN(rating)) continue;
    const fileKey = `${row.Giocatore}|${row.Squadra}`;
    if (!fileGroups.has(fileKey)) {
      fileGroups.set(fileKey, {
        name: row.Giocatore, club: row.Squadra,
        primaryPos: position, primaryCat: category, rating,
        allPos: [position], allCat: [category],
      });
    } else {
      const g = fileGroups.get(fileKey)!;
      if (!g.allPos.includes(position)) g.allPos.push(position);
      if (!g.allCat.includes(category)) g.allCat.push(category);
    }
  }

  for (const g of fileGroups.values()) {
    clubSet.add(g.club);
    const playerId = `${g.name}__${g.primaryPos}`;
    const season: PlayerSeason = {
      club: g.club, season: annoStagione, rating: g.rating,
      positions: g.allPos, categories: g.allCat,
    };
    if (playerMap.has(playerId)) {
      const existing = playerMap.get(playerId)!;
      const already = existing.seasons.some((s) => s.club === season.club && s.season === season.season);
      if (!already) existing.seasons.push(season);
    } else {
      playerMap.set(playerId, {
        id: playerId, name: g.name,
        position: g.primaryPos, position_category: g.primaryCat,
        seasons: [season],
      });
    }
  }
}

const players: Player[] = mergeByNameAndClub(Array.from(playerMap.values()));
const clubs: Club[] = Array.from(clubSet).sort().map((name) => ({ id: name, name }));

// Legge clubs-by-season.json se esiste
let clubsBySeason: Record<string, string[]> = {};
try {
  const cbsPath = path.join(WORKSPACE_ROOT, 'clubs-by-season.json');
  clubsBySeason = JSON.parse(fs.readFileSync(cbsPath, 'utf-8'));
} catch { /* opzionale */ }

// Scrive output
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const playersJson = JSON.stringify({ players, clubs, clubsBySeason });
fs.writeFileSync(path.join(OUTPUT_DIR, 'players.json'), playersJson, 'utf-8');

console.log(`✅ players.json generato: ${players.length} giocatori, ${clubs.length} club`);
console.log(`✅ Stagioni coperte: ${Object.keys(seasonMap).join(', ')}`);
