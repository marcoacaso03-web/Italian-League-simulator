/**
 * Analizza tutti i CSV e trova le combo squadra+stagione che mancano
 * di almeno una delle posizioni usate nelle formazioni del gioco.
 *
 * Esecuzione: pnpm --filter @workspace/scripts run check-missing-roles
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── mappa ruolo IT → posizione EN (stessa logica del server) ─────────────────
const RUOLO_MAP: Record<string, string> = {
  POR:  'GK',
  DC:   'CB',  SW:   'CB',
  TD:   'RB',
  TS:   'LB',
  ED:   'RM',  RWM:  'RM',
  ES:   'LM',  LWM:  'LM',
  CC:   'CM',
  CDC:  'CDM', LCDM: 'CDM', RCDM: 'CDM',
  COC:  'CAM', LCAM: 'CAM', RCAM: 'CAM',
  ATT:  'ST',  AT:   'ST',
  CF:   'CF',
  AD:   'RW',
  AS:   'LW',
};

// ADA = Ala Destra Adattato  → RB + RM
// ASA = Ala Sinistra Adattato → LB + LM
const MULTI_RUOLO: Record<string, string[]> = {
  ADA: ['RB', 'RM'],
  ASA: ['LB', 'LM'],
};

function ruoloToPositions(ruolo: string): string[] {
  const key = ruolo.trim().toUpperCase();
  if (MULTI_RUOLO[key]) return MULTI_RUOLO[key];
  const p = RUOLO_MAP[key];
  return p ? [p] : [];
}

// Posizioni effettivamente richieste dalle formazioni del gioco
const GAME_POSITIONS = ['GK', 'RB', 'CB', 'LB', 'CM', 'RM', 'LM', 'CDM', 'CAM', 'RW', 'LW', 'ST'] as const;
type Pos = typeof GAME_POSITIONS[number];

// ── helpers ──────────────────────────────────────────────────────────────────
function findRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function seasonLabel(filename: string): string {
  let m;
  if ((m = filename.match(/^Stagione (\d{4})-(\d{2})\.csv$/)))
    return `${m[1]}-${Number(m[1]) + 1}`;
  if ((m = filename.match(/^FIFA (\d{2})\.csv$/)))
    { const y = 2000 + Number(m[1]); return `${y - 1}-${y}`; }
  if ((m = filename.match(/^FC (\d{2})\.csv$/)))
    { const y = 2000 + Number(m[1]); return `${y - 1}-${y}`; }
  return filename;
}

function parseCsv(content: string): Array<{ squadra: string; ruolo: string }> {
  const lines = content.replace(/^\uFEFF/, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const iS = header.indexOf('Squadra');
  const iR = header.indexOf('Ruolo');
  if (iS < 0 || iR < 0) return [];
  return lines.slice(1).flatMap(line => {
    const parts = line.split(',');
    const squadra = (parts[iS] ?? '').trim();
    const ruolo   = (parts[iR] ?? '').trim();
    return squadra && ruolo ? [{ squadra, ruolo }] : [];
  });
}

// ── raccolta dati ─────────────────────────────────────────────────────────────
const root = findRoot();
const csvFiles = fs.readdirSync(root)
  .filter(f => f.endsWith('.csv'))
  .sort();

// teamSeasonPositions: "squadra|||season" → Set<Pos> presenti
const teamSeasonPos = new Map<string, Set<Pos>>();

for (const file of csvFiles) {
  const season = seasonLabel(file);
  const raw    = fs.readFileSync(path.join(root, file), 'utf-8');
  for (const { squadra, ruolo } of parseCsv(raw)) {
    const positions = ruoloToPositions(ruolo);
    const key = `${squadra}|||${season}`;
    for (const pos of positions) {
      if (!(GAME_POSITIONS as readonly string[]).includes(pos)) continue;
      if (!teamSeasonPos.has(key)) teamSeasonPos.set(key, new Set());
      teamSeasonPos.get(key)!.add(pos as Pos);
    }
  }
}

// ── trova le combo incomplete ────────────────────────────────────────────────
interface Entry { squadra: string; season: string; missing: Pos[]; present: Pos[] }
const incomplete: Entry[] = [];

for (const [key, present] of teamSeasonPos) {
  const [squadra, season] = key.split('|||');
  const missing = GAME_POSITIONS.filter(p => !present.has(p));
  if (missing.length > 0)
    incomplete.push({ squadra, season, missing, present: [...present] });
}

incomplete.sort((a, b) => a.season.localeCompare(b.season) || a.squadra.localeCompare(b.squadra));

// ── per-squadra summary ───────────────────────────────────────────────────────
const byTeam = new Map<string, { seasons: string[]; missingByPos: Map<Pos, number> }>();
for (const { squadra, season, missing } of incomplete) {
  if (!byTeam.has(squadra)) byTeam.set(squadra, { seasons: [], missingByPos: new Map() });
  const t = byTeam.get(squadra)!;
  t.seasons.push(season);
  for (const p of missing) t.missingByPos.set(p, (t.missingByPos.get(p) ?? 0) + 1);
}

// ── output ────────────────────────────────────────────────────────────────────
const BAR = '═'.repeat(65);

console.log(BAR);
console.log(' DETTAGLIO PER STAGIONE — combo squadra+stagione incomplete');
console.log(BAR);
console.log(`Posizioni monitorate: ${GAME_POSITIONS.join(', ')}`);
console.log(`Totale combo incomplete: ${incomplete.length}\n`);

let lastSeason = '';
for (const { squadra, season, missing } of incomplete) {
  if (season !== lastSeason) {
    console.log(`\n── ${season} ${'─'.repeat(50 - season.length)}`);
    lastSeason = season;
  }
  console.log(`  ${squadra.padEnd(32)} mancanti: ${missing.join(', ')}`);
}

console.log(`\n\n${BAR}`);
console.log(' RIEPILOGO PER SQUADRA (su tutte le stagioni)');
console.log(BAR);
console.log(`${'SQUADRA'.padEnd(32)} | ${'STAGIONI KO'.padStart(10)} | POSIZIONI MAI PRESENTI`);
console.log('─'.repeat(65));

const teamRows = [...byTeam.entries()].sort((a, b) => b[1].seasons.length - a[1].seasons.length || a[0].localeCompare(b[0]));
for (const [squadra, { seasons, missingByPos }] of teamRows) {
  // posizioni mancanti in TUTTE le stagioni del dataset
  const alwaysMissing = [...missingByPos.entries()]
    .filter(([, count]) => count === seasons.length)
    .map(([pos]) => pos);
  const sometimes = [...missingByPos.entries()]
    .filter(([, count]) => count < seasons.length)
    .map(([pos, count]) => `${pos}(${count}/${seasons.length})`);

  console.log(`\n${squadra}`);
  console.log(`  Stagioni con almeno una posizione mancante: ${seasons.length}`);
  if (alwaysMissing.length > 0)
    console.log(`  ⛔ Posizioni SEMPRE assenti:               ${alwaysMissing.join(', ')}`);
  if (sometimes.length > 0)
    console.log(`  ⚠️  Posizioni a volte assenti:              ${sometimes.join(', ')}`);
  console.log(`  Stagioni KO: ${seasons.join(', ')}`);
}

console.log(`\n${BAR}`);
console.log(` Totale squadre con almeno una stagione incompleta: ${byTeam.size}`);
console.log(`${BAR}\n`);
