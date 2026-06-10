
export interface FormationSlot {
  id: string; label: string; acceptedPositions: string[];
  category: 'GK'|'DEF'|'MID'|'ATT'; x: number; y: number;
}
function slot(id:string,label:string,accepted:string[],category:FormationSlot['category'],x:number,y:number):FormationSlot{
  return{id,label,acceptedPositions:accepted,category,x,y};
}
export const FORMATION_SLOTS: Record<string,FormationSlot[]> = {
  '4-3-3':[
    slot('gk','GK',['GK'],'GK',50,90),slot('rb','RB',['RB'],'DEF',82,70),
    slot('cb-1','CB',['CB'],'DEF',62,72),slot('cb-2','CB',['CB'],'DEF',38,72),
    slot('lb','LB',['LB'],'DEF',18,70),slot('cm-r','CM',['CM'],'MID',65,48),
    slot('cm-c','CM',['CM'],'MID',50,44),slot('cm-l','CM',['CM'],'MID',35,48),
    slot('rw','RW',['RW'],'ATT',80,26),slot('st','ST',['ST'],'ATT',50,18),
    slot('lw','LW',['LW'],'ATT',20,26),
  ],
  '4-4-2':[
    slot('gk','GK',['GK'],'GK',50,90),slot('rb','RB',['RB'],'DEF',82,70),
    slot('cb-1','CB',['CB'],'DEF',62,72),slot('cb-2','CB',['CB'],'DEF',38,72),
    slot('lb','LB',['LB'],'DEF',18,70),slot('rm','RM',['RM'],'MID',82,48),
    slot('cm-r','CM',['CM'],'MID',62,48),slot('cm-l','CM',['CM'],'MID',38,48),
    slot('lm','LM',['LM'],'MID',18,48),slot('st-r','ST',['ST'],'ATT',62,20),
    slot('st-l','ST',['ST'],'ATT',38,20),
  ],
};
