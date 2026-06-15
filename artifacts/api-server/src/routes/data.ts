import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router: IRouter = Router();

interface PlayerSeason {
  club: string;
  season: string;
  rating: number;
  positions: string[];   // posizioni per questa specifica stagione+club
  categories: string[];  // categorie per questa specifica stagione+club
}

interface Player {
  id: string;
  name: string;
  position: string;          // posizione primaria di carriera (per display/filtri)
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
  TS:   { position: "LB",  category: "DEF" },
  ED:   { position: "RM",  category: "MID" },
  ES:   { position: "LM",  category: "MID" },
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
  AS:   { position: "LW",  category: "ATT" },
};

// Ruoli "adattati": coprono più posizioni (primaria + alternativa)
// ADA = Ala Destra Adattato  → gioca come RB ma può coprire anche RM (ED)
// ASA = Ala Sinistra Adattato → gioca come LB ma può coprire anche LM (ES)
const MULTI_RUOLO: Record<string, { positions: string[]; categories: string[] }> = {
  ADA: { positions: ["RB", "RM"], categories: ["DEF", "MID"] },
  ASA: { positions: ["LB", "LM"], categories: ["DEF", "MID"] },
};

function ruoloToPositionCategory(ruolo: string): { position: string; category: string } {
  const key = ruolo.trim().toUpperCase();
  if (MULTI_RUOLO[key]) {
    const m = MULTI_RUOLO[key];
    return { position: m.positions[0], category: m.categories[0] };
  }
  return RUOLO_MAP[key] ?? { position: "CM", category: "MID" };
}

function ruoloToAllPositions(ruolo: string): { positions: string[]; categories: string[] } {
  const key = ruolo.trim().toUpperCase();
  if (MULTI_RUOLO[key]) return MULTI_RUOLO[key];
  const single = RUOLO_MAP[key] ?? { position: "CM", category: "MID" };
  return { positions: [single.position], categories: [single.category] };
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

    // Group by (giocatore, club) within this CSV.
    // First row = posizione primaria; righe successive = posizioni alternative.
    // Righe identiche (stesso ruolo) vengono ignorate.
    const fileGroups = new Map<string, {
      name: string; club: string;
      primaryPos: string; primaryCat: string; rating: number;
      allPos: string[]; allCat: string[];
    }>();

    for (const row of rows) {
      const { positions, categories } = ruoloToAllPositions(row.Ruolo);
      const rating = parseInt(row.Valutazione, 10);
      if (isNaN(rating)) continue;

      const fileKey = `${row.Giocatore}|${row.Squadra}`;
      if (!fileGroups.has(fileKey)) {
        fileGroups.set(fileKey, {
          name: row.Giocatore, club: row.Squadra,
          primaryPos: positions[0], primaryCat: categories[0], rating,
          allPos: [...positions], allCat: [...categories],
        });
      } else {
        const g = fileGroups.get(fileKey)!;
        for (const pos of positions) {
          if (!g.allPos.includes(pos)) g.allPos.push(pos);
        }
        for (const cat of categories) {
          if (!g.allCat.includes(cat)) g.allCat.push(cat);
        }
      }
    }

    for (const g of fileGroups.values()) {
      clubSet.add(g.club);
      const playerId = `${g.name}__${g.primaryPos}`;
      // Le posizioni sono specifiche di questa stagione+club
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
  const clubsBySeason = loadClubsBySeason(rootDir);
  cachedData = { players, clubs, clubsBySeason };
  return cachedData;
}

/**
 * Unifica le entry con lo stesso nome solo se condividono almeno un club.
 * Stesso nome + stesso club = stessa persona (es. Del Piero sempre alla Juve).
 * Stesso nome ma club diversi e senza club in comune = persone diverse.
 */
function mergeByNameAndClub(players: Player[]): Player[] {
  // Raggruppa per nome
  const byName = new Map<string, Player[]>();
  for (const p of players) {
    const group = byName.get(p.name) ?? [];
    group.push(p);
    byName.set(p.name, group);
  }

  const result: Player[] = [];

  for (const [, group] of byName) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Costruisce componenti connesse: due entry sono collegate se condividono almeno un club
    const n = group.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i: number): number {
      return parent[i] === i ? i : (parent[i] = find(parent[i]));
    }
    function union(a: number, b: number) { parent[find(a)] = find(b); }

    // Indice club → indici entry che hanno quel club
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

    // Raggruppa per componente
    const components = new Map<number, Player[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const comp = components.get(root) ?? [];
      comp.push(group[i]);
      components.set(root, comp);
    }

    for (const comp of components.values()) {
      if (comp.length === 1) {
        result.push(comp[0]);
        continue;
      }

      // Posizione dominante = entry con più stagioni
      const dominant = comp.reduce((best, cur) =>
        cur.seasons.length > best.seasons.length ? cur : best
      );

      // Unisci stagioni (dedup per club+season) — le posizioni restano per stagione
      const allSeasons: PlayerSeason[] = [];
      const seenKey = new Set<string>();
      for (const p of comp) {
        for (const s of p.seasons) {
          const key = `${s.club}|${s.season}`;
          if (!seenKey.has(key)) { seenKey.add(key); allSeasons.push(s); }
        }
      }

      result.push({
        id:                `${dominant.name}__${dominant.position}`,
        name:              dominant.name,
        position:          dominant.position,
        position_category: dominant.position_category,
        seasons:           allSeasons,
      });
    }
  }
  return result;
}

router.get("/data", (_req, res) => {
  const dataset = loadDataset();
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.json(dataset);
});

export default router;
