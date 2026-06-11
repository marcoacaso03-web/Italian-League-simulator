'use client';
import React from 'react';

const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '4-5-1', '3-4-3', '3-5-2', '5-4-1'] as const;

interface Props { value: string; onChange: (_f: string) => void; }

function MiniPitch({ formation }: { formation: string }) {
  const positions: Record<string, { x: number; y: number }[]> = {
    '4-3-3': [{x:50,y:90},{x:18,y:70},{x:38,y:72},{x:62,y:72},{x:82,y:70},{x:35,y:48},{x:50,y:44},{x:65,y:48},{x:20,y:26},{x:50,y:18},{x:80,y:26}],
    '4-4-2': [{x:50,y:90},{x:18,y:70},{x:38,y:72},{x:62,y:72},{x:82,y:70},{x:18,y:48},{x:38,y:48},{x:62,y:48},{x:82,y:48},{x:38,y:20},{x:62,y:20}],
    '4-2-3-1': [{x:50,y:90},{x:18,y:70},{x:38,y:72},{x:62,y:72},{x:82,y:70},{x:38,y:58},{x:62,y:58},{x:20,y:36},{x:50,y:34},{x:80,y:36},{x:50,y:16}],
    '4-5-1': [{x:50,y:90},{x:18,y:70},{x:38,y:72},{x:62,y:72},{x:82,y:70},{x:18,y:48},{x:35,y:46},{x:50,y:42},{x:65,y:46},{x:82,y:48},{x:50,y:16}],
    '3-4-3': [{x:50,y:90},{x:30,y:72},{x:50,y:74},{x:70,y:72},{x:15,y:52},{x:38,y:48},{x:62,y:48},{x:85,y:52},{x:22,y:26},{x:50,y:18},{x:78,y:26}],
    '3-5-2': [{x:50,y:90},{x:30,y:72},{x:50,y:74},{x:70,y:72},{x:15,y:52},{x:32,y:46},{x:50,y:44},{x:68,y:46},{x:85,y:52},{x:38,y:18},{x:62,y:18}],
    '5-4-1': [{x:50,y:90},{x:14,y:64},{x:32,y:72},{x:50,y:74},{x:68,y:72},{x:86,y:64},{x:22,y:46},{x:40,y:48},{x:60,y:48},{x:78,y:46},{x:50,y:16}],
  };
  const dots = positions[formation] ?? [];
  return (
    <svg viewBox="0 0 40 64" className="w-full h-full">
      <rect x="0" y="0" width="40" height="64" rx="2" fill="#1a3a15" />
      <rect x="2" y="2" width="36" height="60" rx="1" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <line x1="2" y1="32" x2="38" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      {dots.map((d, i) => <circle key={i} cx={d.x * 0.4} cy={d.y * 0.64} r="1.5" fill="#34d399" opacity="0.8" />)}
    </svg>
  );
}

export default function FormationSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {FORMATIONS.map((f) => {
        const active = value === f;
        return (
          <button key={f} onClick={() => onChange(f)}
            className={`relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all duration-200 ${
              active ? 'bg-emerald-500/15 border border-emerald-500/50 shadow-[0_0_16px_rgba(52,211,153,0.2)]'
              : 'bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
            }`}>
            <div className="w-10 h-14 rounded-md overflow-hidden"><MiniPitch formation={f} /></div>
            <span className={`text-xs font-bold ${active ? 'text-emerald-400' : 'text-slate-400'}`}>{f}</span>
          </button>
        );
      })}
    </div>
  );
}
