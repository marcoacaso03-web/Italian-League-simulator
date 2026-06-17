import Link from 'next/link';

const STATS = [
  { value: '20', label: 'Club Serie A' },
  { value: '5.000+', label: 'Stagioni Giocatori' },
  { value: '1996–2026', label: 'Stagioni coperte' },
];

const STEPS = [
  { emoji: '🎰', title: 'Gira', desc: 'La slot machine estrae un club e una stagione casuali dalla storia della Serie A.' },
  { emoji: '📋', title: 'Drafta', desc: 'Scegli il giocatore rivelato per il tuo XI. Ogni scelta conta!' },
  { emoji: '⚽', title: 'Costruisci', desc: 'Riempi tutti gli 11 slot della formazione con i tuoi draft.' },
  { emoji: '📊', title: 'Simula', desc: 'Guarda la tua squadra affrontare 38 giornate di campionato.' },
];

const CHALLENGES = [
  { emoji: '🏆', title: 'Stagione Imbattuta', desc: 'Vinci il campionato senza perdere' },
  { emoji: '💯', title: '38-0-0 Perfetto', desc: 'Vinci tutte le 38 partite' },
  { emoji: '🥇', title: 'Vinci lo Scudetto', desc: 'Finisci primo in classifica' },
  { emoji: '📱', title: 'XI Era Moderna', desc: 'Solo giocatori dal 2016 in poi' },
  { emoji: '👑', title: 'XI di Sempre', desc: 'I migliori di tutta la storia' },
  { emoji: '💀', title: 'Modalità Difficile', desc: 'Nessun reroll, rating nascosti' },
];

const FAQS = [
  { q: "Cos'è Italian League Simulator?", a: "Un gioco di draft calcistico ispirato a 38-0.app. Scegli la formazione, drafta giocatori con una slot machine e simula una stagione di Serie A." },
  { q: 'Quali dati usa il gioco?', a: 'I dati provengono dai CSV ufficiali del progetto (EA Sports FIFA/FC) e coprono le stagioni Serie A dal 1996/97 al 2025/26, con oltre 5.000 schede giocatore.' },
  { q: 'Come vengono calcolati i rating?', a: "Ogni giocatore usa la Valutazione presente nel CSV della stagione corrispondente (campo 'Valutazione'). L'overall di squadra è la media dei rating draftati." },
  { q: 'Posso giocare più volte?', a: 'Certo! Ogni partita è diversa grazie alla slot machine. Prova diverse formazioni, difficoltà e sfide.' },
  { q: 'È gratis?', a: 'Sì, completamente gratuito. Nessun account necessario.' },
  { q: 'Quali formazioni sono disponibili?', a: '5 formazioni: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2.' },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>
        <div className="animate-slide-up relative z-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">Draft · Simula · Vinci</p>
          <h1 className="text-6xl font-black tracking-tight sm:text-8xl">
            <span className="text-white">Italian</span>{' '}
            <span className="text-emerald-400">League</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300 sm:text-xl">
            Costruisci la squadra definitiva della{' '}
            <span className="text-gold-shimmer font-semibold">Serie A</span>.
            Simula una stagione da 38 giornate.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/game" className="glow-emerald rounded-xl bg-emerald-500 px-8 py-4 text-lg font-bold text-black transition-all hover:bg-emerald-400 hover:scale-105">
              Inizia a Giocare →
            </Link>
          </div>
        </div>
        <div className="animate-slide-up relative z-10 mt-16 grid grid-cols-3 gap-8 sm:gap-16">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-white sm:text-4xl">{s.value}</div>
              <div className="mt-1 text-xs text-slate-500 sm:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="animate-float absolute bottom-8">
          <div className="h-10 w-6 rounded-full border-2 border-white/20 p-1">
            <div className="h-2 w-full rounded-full bg-emerald-400" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-24">
        <h2 className="mb-12 text-center text-3xl font-black sm:text-4xl">Come si gioca</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="glass rounded-2xl p-6 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="mb-4 text-4xl">{step.emoji}</div>
              <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
              <p className="text-sm text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-24">
        <h2 className="mb-12 text-center text-3xl font-black sm:text-4xl">Sfide Popolari</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHALLENGES.map((c) => (
            <div key={c.title} className="glass rounded-xl p-5 flex items-start gap-4">
              <span className="text-3xl">{c.emoji}</span>
              <div><h3 className="font-bold text-white">{c.title}</h3><p className="text-sm text-slate-400">{c.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-24">
        <h2 className="mb-12 text-center text-3xl font-black sm:text-4xl">Domande Frequenti</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="glass rounded-xl group">
              <summary className="cursor-pointer p-5 text-white font-semibold flex items-center justify-between list-none">
                {faq.q}
                <span className="text-emerald-400 transition-transform group-open:rotate-45 text-xl">+</span>
              </summary>
              <div className="px-5 pb-5 text-slate-300 text-sm leading-relaxed animate-fade-in">{faq.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-3xl font-black sm:text-4xl">Pronto a costruire la tua squadra?</h2>
          <Link href="/game" className="glow-emerald inline-block rounded-xl bg-emerald-500 px-10 py-5 text-xl font-bold text-black transition-all hover:bg-emerald-400 hover:scale-105">
            Inizia a Giocare →
          </Link>
        </div>
      </section>
    </main>
  );
}
