export interface FormationSlot {
  id: string; label: string; acceptedPositions: string[];
  category: 'GK' | 'DEF' | 'MID' | 'ATT'; x: number; y: number;
}
function slot(
  id: string, label: string, accepted: string[],
  category: FormationSlot['category'], x: number, y: number
): FormationSlot {
  return { id, label, acceptedPositions: accepted, category, x, y };
}

export const FORMATION_SLOTS: Record<string, FormationSlot[]> = {
  '4-3-3': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 88),
    slot('rb',   'RB',  ['RB'],  'DEF', 82, 70),
    slot('cb-1', 'CB',  ['CB'],  'DEF', 62, 72),
    slot('cb-2', 'CB',  ['CB'],  'DEF', 38, 72),
    slot('lb',   'LB',  ['LB'],  'DEF', 18, 70),
    slot('cm-r', 'CM',  ['CM'],  'MID', 65, 50),
    slot('cm-c', 'CM',  ['CM'],  'MID', 50, 46),
    slot('cm-l', 'CM',  ['CM'],  'MID', 35, 50),
    slot('rw',   'RW',  ['RW'],  'ATT', 80, 26),
    slot('st',   'ST',  ['ST'],  'ATT', 50, 18),
    slot('lw',   'LW',  ['LW'],  'ATT', 20, 26),
  ],
  '4-4-2': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 88),
    slot('rb',   'RB',  ['RB'],  'DEF', 82, 70),
    slot('cb-1', 'CB',  ['CB'],  'DEF', 62, 72),
    slot('cb-2', 'CB',  ['CB'],  'DEF', 38, 72),
    slot('lb',   'LB',  ['LB'],  'DEF', 18, 70),
    slot('rm',   'RM',  ['RM'],  'MID', 82, 50),
    slot('cm-r', 'CM',  ['CM'],  'MID', 62, 50),
    slot('cm-l', 'CM',  ['CM'],  'MID', 38, 50),
    slot('lm',   'LM',  ['LM'],  'MID', 18, 50),
    slot('st-r', 'ST',  ['ST'],  'ATT', 62, 22),
    slot('st-l', 'ST',  ['ST'],  'ATT', 38, 22),
  ],
  '4-2-3-1': [
    slot('gk',    'GK',  ['GK'],  'GK',  50, 88),
    slot('rb',    'RB',  ['RB'],  'DEF', 82, 72),
    slot('cb-1',  'CB',  ['CB'],  'DEF', 62, 74),
    slot('cb-2',  'CB',  ['CB'],  'DEF', 38, 74),
    slot('lb',    'LB',  ['LB'],  'DEF', 18, 72),
    slot('cdm-r', 'CDM', ['CDM'], 'MID', 62, 58),
    slot('cdm-l', 'CDM', ['CDM'], 'MID', 38, 58),
    slot('rw',    'RW',  ['RW'],  'ATT', 80, 38),
    slot('cam',   'CAM', ['CAM'], 'MID', 50, 36),
    slot('lw',    'LW',  ['LW'],  'ATT', 20, 38),
    slot('st',    'ST',  ['ST'],  'ATT', 50, 18),
  ],
  '3-5-2': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 88),
    slot('cb-r', 'CB',  ['CB'],  'DEF', 70, 72),
    slot('cb-c', 'CB',  ['CB'],  'DEF', 50, 74),
    slot('cb-l', 'CB',  ['CB'],  'DEF', 30, 72),
    slot('rm',   'RM',  ['RM'],  'MID', 85, 52),
    slot('cm-r', 'CM',  ['CM'],  'MID', 65, 50),
    slot('cm-c', 'CM',  ['CM'],  'MID', 50, 48),
    slot('cm-l', 'CM',  ['CM'],  'MID', 35, 50),
    slot('lm',   'LM',  ['LM'],  'MID', 15, 52),
    slot('st-r', 'ST',  ['ST'],  'ATT', 62, 22),
    slot('st-l', 'ST',  ['ST'],  'ATT', 38, 22),
  ],
  '5-3-2': [
    slot('gk',   'GK',  ['GK'],  'GK',  50, 88),
    slot('rb',   'RB',  ['RB'],  'DEF', 88, 70),
    slot('cb-r', 'CB',  ['CB'],  'DEF', 70, 74),
    slot('cb-c', 'CB',  ['CB'],  'DEF', 50, 76),
    slot('cb-l', 'CB',  ['CB'],  'DEF', 30, 74),
    slot('lb',   'LB',  ['LB'],  'DEF', 12, 70),
    slot('cm-r', 'CM',  ['CM'],  'MID', 65, 50),
    slot('cm-c', 'CM',  ['CM'],  'MID', 50, 48),
    slot('cm-l', 'CM',  ['CM'],  'MID', 35, 50),
    slot('st-r', 'ST',  ['ST'],  'ATT', 62, 22),
    slot('st-l', 'ST',  ['ST'],  'ATT', 38, 22),
  ],
};
