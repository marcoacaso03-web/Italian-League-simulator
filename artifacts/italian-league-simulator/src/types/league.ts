// types/league.ts
// Contratto dati condiviso per il sistema multi-lega.

export interface LeagueMeta {
  id: string;           // "premier-league"
  name: string;         // "Premier League" — nome proprio, NON tradurre
  country: string;      // Nome del paese nella lingua dell'utente (i18n)
  countryCode: string;  // "gb", "it", "es", "fr", "de" — per bandiere/emoji
  numTeams: number;     // 20 o 18
  numMatchdays: number; // 38 o 34
  season: string;       // "2024-2025"
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface LeagueClub {
  id: string;      // "manchester-united"
  name: string;    // "Manchester United"
  rating: number;  // 60-95, forza del club nella simulazione
}

/**
 * Entry del pool draft per una combinazione club+stagione.
 * `club` deve matchare un `LeagueClub.id` nella stessa lega (vincolo runtime).
 */
export interface LeagueClubSeasonEntry {
  club: string;    // LeagueClub.id
  season: string;  // "2024-2025"
  playerCount: number;
}

export interface LeaguePlayerSeason {
  club: string;    // Deve matchare un LeagueClub.id nella stessa lega
  season: string;  // "2024-2025"
  rating: number;
  positions: string[];
  categories: string[];
  apps?: number;
  goals?: number;
  assists?: number;
}

export interface LeaguePlayer {
  id: string;
  name: string;
  position: string;          // posizione primaria
  position_category: string; // "GK" | "DEF" | "MID" | "ATT"
  seasons: LeaguePlayerSeason[];
}

/**
 * DataSource completo per una lega.
 * Caricato on-demand tramite dynamic import (lazy loading).
 */
export interface LeagueDataSource {
  meta: LeagueMeta;
  clubs: LeagueClub[];
  players: LeaguePlayer[];
}
