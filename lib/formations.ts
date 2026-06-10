// Mappa ogni formazione → 11 slot ordinati (GK→DEF→MID→ATT)
// acceptedPositions: quali ruoli specifici possono occupare questo slot

export interface FormationSlot {
  id: string;                    // es. 'cb-1'
  label: string;                 // es. 'CB'
  acceptedPositions: string[];   // es. ['CB','RB','LB','WB','LWB','RWB']
  category: 'GK' | 'DEF' | 'MID' | 'ATT';
  // coordinate sul pitch (0-100)
  x: number;
  y: number;
}

// Gruppi di posizioni compatibili per categoria
const GK_POS  = ['GK'];
const DEF_POS = ['CB', 'RB', 'LB', 'WB', 'LWB', 'RWB'];
const MID_POS = ['CDM', 'CM', 'CAM', 'LM', 'RM'];
const ATT_POS = ['LW', 'RW', 'ST', 'CF'];

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
    slot('gk',    'GK',  GK_POS,  'GK',  50, 90),
    slot('rb',    'RB',  DEF_POS, 'DEF', 82, 70),
    slot('cb-1',  'CB',  DEF_POS, 'DEF', 62, 72),
    slot('cb-2',  'CB',  DEF_POS, 'DEF', 38, 72),
    slot('lb',    'LB',  DEF_POS, 'DEF', 18, 70),
    slot('cm-r',  'CM',  MID_POS, 'MID', 65, 48),
    slot('cm-c',  'CM',  MID_POS, 'MID', 50, 44),
    slot('cm-l',  'CM',  MID_POS, 'MID', 35, 48),
    slot('rw',    'RW',  ATT_POS, 'ATT', 80, 26),
    slot('st',    'ST',  ATT_POS, 'ATT', 50, 18),
    slot('lw',    'LW',  ATT_POS, 'ATT', 20, 26),
  ],
  '4-4-2': [
    slot('gk',    'GK',  GK_POS,  'GK',  50, 90),
    slot('rb',    'RB',  DEF_POS, 'DEF', 82, 70),
    slot('cb-1',  'CB',  DEF_POS, 'DEF', 62, 72),
    slot('cb-2',  'CB',  DEF_POS, 'DEF', 38, 72),
    slot('lb',    'LB',  DEF_POS, 'DEF', 18, 70),
    slot('rm',    'RM',  MID_POS, 'MID', 82, 48),
    slot('cm-r',  'CM',  MID_POS, 'MID', 62, 48),
    slot('cm-l',  'CM',  MID_POS, 'MID', 38, 48),
    slot('lm',    'LM',  MID_POS, 'MID', 18, 48),
    slot('st-r',  'ST',  ATT_POS, 'ATT', 62, 20),
    slot('st-l',  'ST',  ATT_POS, 'ATT', 38, 20),
  ],
  '4-2-3-1': [
    slot('gk',    'GK',  GK_POS,  'GK',  50, 90),
    slot('rb',    'RB',  DEF_POS, 'DEF', 82, 70),
    slot('cb-1',  'CB',  DEF_POS, 'DEF', 62, 72),
    slot('cb-2',  'CB',  DEF_POS, 'DEF', 38, 72),
    slot('lb',    'LB',  DEF_POS, 'DEF', 18, 70),
    slot('cdm-r', 'CDM', MID_POS, 'MID', 62, 58),
    slot('cdm-l', 'CDM', MID_POS, 'MID', 38, 58),
    slot('rw',    'RW',  ATT_POS, 'ATT', 80, 36),
    slot('cam',   'CAM', MID_POS, 'MID', 50, 34),
    slot('lw',    'LW',  ATT_POS, 'ATT', 20, 36),
    slot('st',    'ST',  ATT_POS, 'ATT', 50, 16),
  ],
  '4-5-1': [
    slot('gk',    'GK',  GK_POS,  'GK',  50, 90),
    slot('rb',    'RB',  DEF_POS, 'DEF', 82, 70),
    slot('cb-1',  'CB',  DEF_POS, 'DEF', 62, 72),
    slot('cb-2',  'CB',  DEF_POS, 'DEF', 38, 72),
    slot('lb',    'LB',  DEF_POS, 'DEF', 18, 70),
    slot('rm',    'RM',  MID_POS, 'MID', 82, 48),
    slot('cm-r',  'CM',  MID_POS, 'MID', 65, 46),
    slot('cm-c',  'CM',  MID_POS, 'MID', 50, 42),
    slot('cm-l',  'CM',  MID_POS, 'MID', 35, 46),
    slot('lm',    'LM',  MID_POS, 'MID', 18, 48),
    slot('st',    'ST',  ATT_POS, 'ATT', 50, 16),
  ],
  '3-4-3': [
    slot('gk',    'GK',  GK_POS,  'GK',  50, 90),
    slot('cb-r',  'CB',  DEF_POS, 'DEF', 70, 72),
    slot('cb-c',  'CB',  DEF_POS, 'DEF', 50, 74),
    slot('cb-l',  'CB',  DEF_POS, 'DEF', 30, 72),
    slot('wbr',   'WB',  DEF_POS, 'DEF', 85, 52),
    slot('cm-r',  'CM',  MID_POS, 'MID', 62, 48),
    slot('cm-l',  'CM',  MID_POS, 'MID', 38, 48),
    slot('wbl',   'WB',  DEF_POS, 'DEF', 15, 52),
    slot('rw',    'RW',  ATT_POS, 'ATT', 78, 26),
    slot('st',    'ST',  ATT_POS, 'ATT', 50, 18),
    slot('lw',    'LW',  ATT_POS, 'ATT', 22, 26),
  ],
  '3-5-2': [
    slot('gk',    'GK',  GK_POS,  'GK',  50, 90),
    slot('cb-r',  'CB',  DEF_POS, 'DEF', 70, 72),
    slot('cb-c',  'CB',  DEF_POS, 'DEF', 50, 74),
    slot('cb-l',  'CB',  DEF_POS, 'DEF', 30, 72),
    slot('wbr',   'WB',  DEF_POS, 'DEF', 85, 52),
    slot('cm-r',  'CM',  MID_POS, 'MID', 68, 46),
    slot('cm-c',  'CM',  MID_POS, 'MID', 50, 44),
    slot('cm-l',  'CM',  MID_POS, 'MID', 32, 46),
    slot('wbl',   'WB',  DEF_POS, 'DEF', 15, 52),
    slot('st-r',  'ST',  ATT_POS, 'ATT', 62, 18),
    slot('st-l',  'ST',  ATT_POS, 'ATT', 38, 18),
  ],
  '5-4-1': [
    slot('gk',    'GK',  GK_POS,  'GK',  50, 90),
    slot('rwb',   'RWB', DEF_POS, 'DEF', 86, 64),
    slot('cb-r',  'CB',  DEF_POS, 'DEF', 68, 72),
    slot('cb-c',  'CB',  DEF_POS, 'DEF', 50, 74),
    slot('cb-l',  'CB',  DEF_POS, 'DEF', 32, 72),
    slot('lwb',   'LWB', DEF_POS, 'DEF', 14, 64),
    slot('rm',    'RM',  MID_POS, 'MID', 78, 46),
    slot('cm-r',  'CM',  MID_POS, 'MID', 60, 48),
    slot('cm-l',  'CM',  MID_POS, 'MID', 40, 48),
    slot('lm',    'LM',  MID_POS, 'MID', 22, 46),
    slot('st',    'ST',  ATT_POS, 'ATT', 50, 16),
  ],
};
