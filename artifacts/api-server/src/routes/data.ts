import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router: IRouter = Router();

interface PlayerSeason {
  club: string;
  season: string;
  rating: number;
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

const RUOLO_MAP: Record<string, { position: string; category: string }> = {
  POR:  { position: "GK",  category: "GK"  },
  DC:   { position: "CB",  category: "DEF" },
  SW:   { position: "CB",  category: "DEF" },
  TD:   { position: "RB",  category: "DEF" },
  ED:   { position: "RB",  category: "DEF" },
  TS:   { position: "LB",  category: "DEF" },
  ES:   { position: "LB",  category: "DEF" },
  CC:   { position: "CM",  category: "MID" },
  CDC:  { position: "CDM", category: "MID" },
  LCDM: { position: "CDM", category: "MID" },
  RCDM: { position: "CDM", category: "MID" },
  COC:  { position: "CAM", category: "MID" },
  LCAM: { position: "CAM", category: "MID" },
  RCAM: { position: "CAM", category: "MID" },
  LWM:  { position: "LM",  category: "MID" },
  RWM:  { position: "RM",  category: "MID" },
  ATT:  { position: "ST",  category: "ATT" },
  AT:   { position: "ST",  category: "ATT" },
  CF:   { position: "CF",  category: "ATT" },
  AD:   { position: "RW",  category: "ATT" },
  ADA:  { position: "RW",  category: "ATT" },
  AS:   { position: "LW",  category: "ATT" },
  ASA:  { position: "LW",  category: "ATT" },
};

function ruoloToPositionCategory(ruolo: string): { position: string; category: string } {
  const key = ruolo.trim().toUpperCase();
  return RUOLO_MAP[key] ?? { position: "CM", category: "MID" };
}

function buildCsvSeasonMap(rootDir: string): Record<string, string> {
  const map: Record<string, string> = {};
  const stagReMatch = /^Stagione (\d{4})-(\d{2})\.csv$/;
  const fifaMatch   = /^FIFA (\d{2})\.csv$/;
  const fcMatch     = /^FC (\d{2})\.csv$/;

  let files: string[] = [];
  try {
    files = fs.readdirSync(rootDir).filter((f) => f.endsWith(".csv"));
  } catch {
    return map;
  }

  for (const f of files) {
    let m;
    if ((m = f.match(stagReMatch))) {
      const startYear = parseInt(m[1], 10);
      map[f] = `${startYear}-${startYear + 1}`;
    } else if ((m = f.match(fifaMatch))) {
      const year = 2000 + parseInt(m[1], 10);
      map[f] = `${year - 1}-${year}`;
    } else if ((m = f.match(fcMatch))) {
      const year = 2000 + parseInt(m[1], 10);
      map[f] = `${year - 1}-${year}`;
    }
  }
  return map;
}

interface CsvRow {
  Squadra: string;
  Giocatore: string;
  Ruolo: string;
  Valutazione: string;
}

function parseSimpleCsv(content: string): CsvRow[] {
  const lines = content.replace(/^\uFEFF/, "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (parts[idx] ?? "").trim();
    });
    if (obj["Squadra"] && obj["Giocatore"] && obj["Ruolo"] && obj["Valutazione"]) {
      rows.push(obj as unknown as CsvRow);
    }
  }
  return rows;
}

let cachedData: { players: Player[]; clubs: Club[]; clubsBySeason: Record<string, string[]> } | null = null;

function findWorkspaceRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function loadClubsBySeason(rootDir: string): Record<string, string[]> {
  const filePath = path.join(rootDir, "clubs-by-season.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function loadDataset(): { players: Player[]; clubs: Club[]; clubsBySeason: Record<string, string[]> } {
  if (cachedData) return cachedData;

  const rootDir = findWorkspaceRoot();
  const seasonMap = buildCsvSeasonMap(rootDir);
  const playerMap = new Map<string, Player>();
  const clubSet   = new Set<string>();

  for (const [filename, annoStagione] of Object.entries(seasonMap)) {
    const filePath = path.join(rootDir, filename);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const rows = parseSimpleCsv(content);

    // Dedup only exact duplicates: same player + club + role in the same CSV
    const seenInFile = new Set<string>();

    for (const row of rows) {
      const fileKey = `${row.Giocatore}|${row.Squadra}|${row.Ruolo}`;
      if (seenInFile.has(fileKey)) continue;
      seenInFile.add(fileKey);

      const { position, category } = ruoloToPositionCategory(row.Ruolo);
      const rating = parseInt(row.Valutazione, 10);
      if (isNaN(rating)) continue;
      clubSet.add(row.Squadra);

      // Player identity: name + primary position (stable across seasons)
      const playerId = `${row.Giocatore}__${position}`;
      const season: PlayerSeason = { club: row.Squadra, season: annoStagione, rating };
      if (playerMap.has(playerId)) {
        const existing = playerMap.get(playerId)!;
        const already = existing.seasons.some((s) => s.club === season.club && s.season === season.season);
        if (!already) existing.seasons.push(season);
      } else {
        playerMap.set(playerId, {
          id: playerId,
          name: row.Giocatore,
          position,
          position_category: category,
          seasons: [season],
        });
      }
    }
  }

  const players: Player[] = Array.from(playerMap.values());
  const clubs: Club[] = Array.from(clubSet).sort().map((name) => ({ id: name, name }));
  const clubsBySeason = loadClubsBySeason(rootDir);
  cachedData = { players, clubs, clubsBySeason };
  return cachedData;
}

router.get("/data", (_req, res) => {
  const dataset = loadDataset();
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.json(dataset);
});

export default router;
