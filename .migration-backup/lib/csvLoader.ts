/**
 * csvLoader.ts  — SERVER ONLY
 *
 * Carica tutti i CSV dalla root del progetto e li converte
 * nei tipi Player[] e Club[] usati dall'app.
 *
 * ATTENZIONE: questo modulo usa 'fs' e deve girare SOLO in contesto Node.js
 * (Route Handler, Server Component, generateStaticParams, ecc.).
 * Non importarlo mai direttamente da un Client Component.
 *
 * Mapping filename → AnnoStagione:
 *   "Stagione 1996-97.csv" → "1996/97"
 *   "FIFA 05.csv"          → "2004/05"
 *   "FC 24.csv"            → "2023/24"
 *
 * Mapping Ruolo (italiano) → position (FIFA) + category:
 *   POR → GK/GK, DC/SW → CB/DEF, TD/ED → RB/DEF, TS/ES → LB/DEF
 *   CC → CM/MID, CDC/LCDM/RCDM → CDM/MID, COC/LCAM/RCAM → CAM/MID
 *   LWM → LM/MID, RWM → RM/MID
 *   ATT/AT → ST/ATT, AD/ADA → RW/ATT, AS/ASA → LW/ATT, CF → CF/ATT
 */

import 'server-only';
import fs from 'fs';
import path from 'path';
import type { Player, Club, PlayerSeason } from './data';

// ─── Ruolo italiano → { position, category } ──────────────────────────────────
const RUOLO_MAP: Record<string, { position: string; category: string }> = {
  POR:  { position: 'GK',  category: 'GK'  },
  DC:   { position: 'CB',  category: 'DEF' },
  SW:   { position: 'CB',  category: 'DEF' },
  TD:   { position: 'RB',  category: 'DEF' },
  ED:   { position: 'RB',  category: 'DEF' },
  TS:   { position: 'LB',  category: 'DEF' },
  ES:   { position: 'LB',  category: 'DEF' },
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
  const key = ruolo.trim().toUpperCase();
  return RUOLO_MAP[key] ?? { position: 'CM', category: 'MID' };
}

// ─── Filename → AnnoStagione ──────────────────────────────────────────────────

export function buildCsvSeasonMap(): Record<string, string> {
  const map: Record<string, string> = {};

  const stagReMatch = /^Stagione (\d{4})-(\d{2})\.csv$/;
  const fifaMatch   = /^FIFA (\d{2})\.csv$/;
  const fcMatch     = /^FC (\d{2})\.csv$/;

  const rootDir = process.cwd();
  let files: string[] = [];
  try {
    files = fs.readdirSync(rootDir).filter((f) => f.endsWith('.csv'));
  } catch {
    return map;
  }

  for (const f of files) {
    let m;
    if ((m = f.match(stagReMatch))) {
      map[f] = `${m[1]}/${m[2]}`;
    } else if ((m = f.match(fifaMatch))) {
      const nn = m[1];
      const year = 2000 + parseInt(nn, 10);
      map[f] = `${year - 1}/${nn}`;
    } else if ((m = f.match(fcMatch))) {
      const nn = m[1];
      const year = 2000 + parseInt(nn, 10);
      map[f] = `${year - 1}/${nn}`;
    }
  }

  return map;
}

// ─── Parsing CSV ──────────────────────────────────────────────────────────────

interface CsvRow {
  Squadra: string;
  Giocatore: string;
  Ruolo: string;
  Valutazione: string;
  AnnoStagione?: string;
}

function parseSimpleCsv(content: string): CsvRow[] {
  const lines = content.replace(/^\uFEFF/, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (parts[idx] ?? '').trim();
    });
    if (obj['Squadra'] && obj['Giocatore'] && obj['Ruolo'] && obj['Valutazione']) {
      rows.push(obj as unknown as CsvRow);
    }
  }
  return rows;
}

// ─── Export types ─────────────────────────────────────────────────────────────

export interface CsvDataset {
  players: Player[];
  clubs: Club[];
}

// ─── Caricamento principale ───────────────────────────────────────────────────

export function loadCsvDataset(): CsvDataset {
  const seasonMap = buildCsvSeasonMap();
  const rootDir = process.cwd();

  const playerMap = new Map<string, Player>();
  const clubSet   = new Set<string>();

  for (const [filename, annoStagione] of Object.entries(seasonMap)) {
    const filePath = path.join(rootDir, filename);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const rows = parseSimpleCsv(content);

    for (const row of rows) {
      const { position, category } = ruoloToPositionCategory(row.Ruolo);
      const rating = parseInt(row.Valutazione, 10);
      if (isNaN(rating)) continue;

      clubSet.add(row.Squadra);

      const playerId = `${row.Giocatore}__${position}`;

      const season: PlayerSeason = {
        club:   row.Squadra,
        season: annoStagione,
        rating,
      };

      if (playerMap.has(playerId)) {
        const existing = playerMap.get(playerId)!;
        const already = existing.seasons.some(
          (s) => s.club === season.club && s.season === season.season
        );
        if (!already) existing.seasons.push(season);
      } else {
        playerMap.set(playerId, {
          id:                playerId,
          name:              row.Giocatore,
          position,
          position_category: category,
          seasons:           [season],
        });
      }
    }
  }

  const players: Player[] = Array.from(playerMap.values());
  const clubs: Club[] = Array.from(clubSet).sort().map((name) => ({ id: name, name }));

  return { players, clubs };
}
