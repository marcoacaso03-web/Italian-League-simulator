// Mappa ogni formazione → 11 slot ordinati (GK→DEF→MID→ATT)
// acceptedPositions: STRETTO — solo il ruolo esatto di quel slot.
// La logica di intercambiabilità laterale (LM↔RM, LW↔RW) è in draft.ts.

export interface FormationSlot {
  id: string;                  // es. 'cb-1'
  label: string;               // es. 'CB'
  acceptedPositions: string[]; // ruoli ESATTI accettati (senza logica laterale)
  category: 'GK' | 'DEF' | 'MID' | 'ATT';
  x: number;
  y: number;
}

function slot(
  id: string,
  label: string,
  accepted: string[],
  category: FormationSlot['category'],
  x: number,
  y: number
): FormationSlot {
  return { id, label, acceptedPositions: accepted, category, x, y };
}

export const FORMATION_SLOTS: Record<string, FormationSlot[]> = {
  '4-3-3': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 90),
    slot('rb',   'RB',  ['RB'],  'DEF', 82, 70),
    slot('cb-1', 'CB',  ['CB'],  'DEF', 62, 72),
    slot('cb-2', 'CB',  ['CB'],  'DEF', 38, 72),
    slot('lb',   'LB',  ['LB'],  'DEF', 18, 70),
    slot('cm-r', 'CM',  ['CM'],  'MID', 65, 48),
    slot('cm-c', 'CM',  ['CM'],  'MID', 50, 44),
    slot('cm-l', 'CM',  ['CM'],  'MID', 35, 48),
    slot('rw',   'RW',  ['RW'],  'ATT', 80, 26),
    slot('st',   'ST',  ['ST'],  'ATT', 50, 18),
    slot('lw',   'LW',  ['LW'],  'ATT', 20, 26),
  ],
  '4-4-2': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 90),
    slot('rb',   'RB',  ['RB'],  'DEF', 82, 70),
    slot('cb-1', 'CB',  ['CB'],  'DEF', 62, 72),
    slot('cb-2', 'CB',  ['CB'],  'DEF', 38, 72),
    slot('lb',   'LB',  ['LB'],  'DEF', 18, 70),
    slot('rm',   'RM',  ['RM'],  'MID', 82, 48),
    slot('cm-r', 'CM',  ['CM'],  'MID', 62, 48),
    slot('cm-l', 'CM',  ['CM'],  'MID', 38, 48),
    slot('lm',   'LM',  ['LM'],  'MID', 18, 48),
    slot('st-r', 'ST',  ['ST'],  'ATT', 62, 20),
    slot('st-l', 'ST',  ['ST'],  'ATT', 38, 20),
  ],
  '4-2-3-1': [
    slot('gk',    'GK',  ['GK'],  'GK',  50, 90),
    slot('rb',    'RB',  ['RB'],  'DEF', 82, 70),
    slot('cb-1',  'CB',  ['CB'],  'DEF', 62, 72),
    slot('cb-2',  'CB',  ['CB'],  'DEF', 38, 72),
    slot('lb',    'LB',  ['LB'],  'DEF', 18, 70),
    slot('cdm-r', 'CDM', ['CDM'], 'MID', 62, 58),
    slot('cdm-l', 'CDM', ['CDM'], 'MID', 38, 58),
    slot('rw',    'RW',  ['RW'],  'ATT', 80, 36),
    slot('cam',   'CAM', ['CAM'], 'MID', 50, 34),
    slot('lw',    'LW',  ['LW'],  'ATT', 20, 36),
    slot('st',    'ST',  ['ST'],  'ATT', 50, 16),
  ],
  '4-5-1': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 90),
    slot('rb',   'RB',  ['RB'],  'DEF', 82, 70),
    slot('cb-1', 'CB',  ['CB'],  'DEF', 62, 72),
    slot('cb-2', 'CB',  ['CB'],  'DEF', 38, 72),
    slot('lb',   'LB',  ['LB'],  'DEF', 18, 70),
    slot('rm',   'RM',  ['RM'],  'MID', 82, 48),
    slot('cm-r', 'CM',  ['CM'],  'MID', 65, 46),
    slot('cm-c', 'CM',  ['CM'],  'MID', 50, 42),
    slot('cm-l', 'CM',  ['CM'],  'MID', 35, 46),
    slot('lm',   'LM',  ['LM'],  'MID', 18, 48),
    slot('st',   'ST',  ['ST'],  'ATT', 50, 16),
  ],
  '3-4-3': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 90),
    slot('cb-r', 'CB',  ['CB'],  'DEF', 70, 72),
    slot('cb-c', 'CB',  ['CB'],  'DEF', 50, 74),
    slot('cb-l', 'CB',  ['CB'],  'DEF', 30, 72),
    slot('wbr',  'WB',  ['WB'],  'DEF', 85, 52),
    slot('cm-r', 'CM',  ['CM'],  'MID', 62, 48),
    slot('cm-l', 'CM',  ['CM'],  'MID', 38, 48),
    slot('wbl',  'WB',  ['WB'],  'DEF', 15, 52),
    slot('rw',   'RW',  ['RW'],  'ATT', 78, 26),
    slot('st',   'ST',  ['ST'],  'ATT', 50, 18),
    slot('lw',   'LW',  ['LW'],  'ATT', 22, 26),
  ],
  '3-5-2': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 90),
    slot('cb-r', 'CB',  ['CB'],  'DEF', 70, 72),
    slot('cb-c', 'CB',  ['CB'],  'DEF', 50, 74),
    slot('cb-l', 'CB',  ['CB'],  'DEF', 30, 72),
    slot('wbr',  'WB',  ['WB'],  'DEF', 85, 52),
    slot('cm-r', 'CM',  ['CM'],  'MID', 68, 46),
    slot('cm-c', 'CM',  ['CM'],  'MID', 50, 44),
    slot('cm-l', 'CM',  ['CM'],  'MID', 32, 46),
    slot('wbl',  'WB',  ['WB'],  'DEF', 15, 52),
    slot('st-r', 'ST',  ['ST'],  'ATT', 62, 18),
    slot('st-l', 'ST',  ['ST'],  'ATT', 38, 18),
  ],
  '5-4-1': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 90),
    slot('rwb',  'RWB', ['RWB'], 'DEF', 86, 64),
    slot('cb-r', 'CB',  ['CB'],  'DEF', 68, 72),
    slot('cb-c', 'CB',  ['CB'],  'DEF', 50, 74),
    slot('cb-l', 'CB',  ['CB'],  'DEF', 32, 72),
    slot('lwb',  'LWB', ['LWB'], 'DEF', 14, 64),
    slot('rm',   'RM',  ['RM'],  'MID', 78, 46),
    slot('cm-r', 'CM',  ['CM'],  'MID', 60, 48),
    slot('cm-l', 'CM',  ['CM'],  'MID', 40, 48),
    slot('lm',   'LM',  ['LM'],  'MID', 22, 46),
    slot('st',   'ST',  ['ST'],  'ATT', 50, 16),
  ],
};
