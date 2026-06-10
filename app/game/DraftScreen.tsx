
'use client';
import React,{useState}from'react';
import type{SetupConfig}from'@/app/game/page';
import{useDraft}from'@/lib/useDraft';
import SlotMachine from'@/components/SlotMachine';
import{emptySlots,findBestSlot,findCompatibleSlots,REROLLS_BY_DIFFICULTY,type DraftedPlayer,type DraftSlot}from'@/lib/draft';
interface Props{config:SetupConfig;onBack:()=>void;onComplete:(slots:DraftSlot[])=>void;}
export default function DraftScreen({config,onBack,onComplete}:Props){
  const{state,reveal,spinSquadFirst,selectSlotAndSpin,pick,reroll,cancel}=useDraft(config);
  const[pendingPlayer,setPendingPlayer]=useState<DraftedPlayer|null>(null);
  const isSquadFirst=config.draftMode==='squad_first';
  const filled=state.slots.filter((s)=>s.player!==null).length;
  const total=state.slots.length;
  const remaining=emptySlots(state.slots);
  const maxRerolls=REROLLS_BY_DIFFICULTY[config.difficulty];
  void findBestSlot;
  function handlePickSquadFirst(player:DraftedPlayer){
    const c=findCompatibleSlots(state.slots,player);
    if(c.length===0)return;
    if(c.length===1){pick(player,c[0].formationSlot.id);setPendingPlayer(null);}
    else{setPendingPlayer(player);}
  }
  if(state.phase==='complete'){onComplete(state.slots);return null;}
  const spin=isSquadFirst?spinSquadFirst:()=>selectSlotAndSpin(remaining[0]?.formationSlot.id??'');
  return(
    React.createElement('div',{className:'flex flex-col items-center min-h-screen bg-slate-950 text-white p-6 gap-6'},
      // Header
      React.createElement('div',{className:'flex items-center justify-between w-full max-w-2xl'},
        React.createElement('button',{onClick:onBack,className:'text-slate-400 text-sm hover:text-white transition-colors'},'← Indietro'),
        React.createElement('span',{className:'text-slate-400 text-sm'},`${filled}/${total} slot`),
        React.createElement('span',{className:'text-slate-400 text-sm'},`Reroll: ${state.rerollsLeft}/${maxRerolls}`),
      ),
      // Slot machine animation quando sta girando
      state.currentSpin&&state.phase==='spinning'&&React.createElement(SlotMachine,{
        club:state.currentSpin.club,
        season:state.currentSpin.season,
        onReveal:reveal,
      }),
      // Lista giocatori: visibile solo dopo reveal (phase==='picking')
      state.currentSpin&&state.phase==='picking'&&React.createElement('div',{className:'w-full max-w-2xl flex flex-col gap-2'},
        state.currentSpin.players.map((player)=>{
          const compat=findCompatibleSlots(state.slots,player);
          const disabled=compat.length===0;
          return React.createElement('button',{
            key:player.id,
            disabled,
            onClick:()=>handlePickSquadFirst(player),
            className:[disabled?'opacity-30 cursor-not-allowed':'hover:bg-slate-700','flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 transition-colors'].join(' '),
          },
            React.createElement('div',{className:'flex items-center gap-3'},
              React.createElement('span',{className:'text-xs font-bold text-slate-400 w-8'},player.position),
              React.createElement('span',{className:'font-semibold'},player.name),
            ),
            React.createElement('span',{className:`font-black text-lg ${player.rating>=85?'text-emerald-400':player.rating>=72?'text-amber-400':'text-red-400'}`},player.rating),
          );
        }),
        // Reroll button
        state.rerollsLeft>0&&React.createElement('button',{
          onClick:reroll,
          className:'mt-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors',
        },'🔄 Reroll'),
        React.createElement('button',{onClick:cancel,className:'px-4 py-2 rounded-xl bg-transparent text-slate-400 text-sm hover:text-white transition-colors'},'Annulla'),
      ),
      // Modale selezione slot per winger ambivalenti
      pendingPlayer&&React.createElement('div',{className:'fixed inset-0 bg-black/70 flex items-center justify-center z-50'},
        React.createElement('div',{className:'bg-slate-900 rounded-2xl p-6 flex flex-col gap-4 w-80 border border-slate-700'},
          React.createElement('h3',{className:'font-bold text-lg'},`Dove gioca ${pendingPlayer.name}?`),
          findCompatibleSlots(state.slots,pendingPlayer).map((s)=>React.createElement('button',{
            key:s.formationSlot.id,
            onClick:()=>{pick(pendingPlayer,s.formationSlot.id);setPendingPlayer(null);},
            className:'px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold transition-colors',
          },s.formationSlot.label)),
          React.createElement('button',{onClick:()=>setPendingPlayer(null),className:'text-slate-400 text-sm hover:text-white transition-colors'},'Annulla'),
        )
      ),
      // Pulsante sorteggio
      state.phase==='idle'&&remaining.length>0&&React.createElement('button',{
        onClick:spin,
        className:'px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-lg transition-colors',
      },'🎲 Sorteggia'),
    )
  );
}
