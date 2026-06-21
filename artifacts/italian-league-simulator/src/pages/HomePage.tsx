import React from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

export default function HomePage() {
  const { t } = useTranslation();

  const STATS = [
    { value: '20', label: t('stats_clubs') },
    { value: '5.000+', label: t('stats_seasons') },
    { value: '1996–2026', label: t('stats_years') },
  ];

  const STEPS = [
    { emoji: '🎰', title: t('step_spin'), desc: t('step_spin_desc') },
    { emoji: '📋', title: t('step_draft'), desc: t('step_draft_desc') },
    { emoji: '⚽', title: t('step_build'), desc: t('step_build_desc') },
    { emoji: '📊', title: t('step_simulate'), desc: t('step_simulate_desc') },
  ];

  const CHALLENGES = [
    { emoji: '🏆', title: t('challenge_unbeaten'), desc: t('challenge_unbeaten_desc') },
    { emoji: '💯', title: t('challenge_perfect'), desc: t('challenge_perfect_desc') },
    { emoji: '🥇', title: t('challenge_scudetto'), desc: t('challenge_scudetto_desc') },
    { emoji: '📱', title: t('challenge_modern'), desc: t('challenge_modern_desc') },
    { emoji: '👑', title: t('challenge_alltime'), desc: t('challenge_alltime_desc') },
    { emoji: '💀', title: t('challenge_hard'), desc: t('challenge_hard_desc') },
  ];

  const FAQS = [
    { q: t('faq_what'), a: t('faq_what_ans') },
    { q: t('faq_data'), a: t('faq_data_ans') },
    { q: t('faq_ratings'), a: t('faq_ratings_ans') },
    { q: t('faq_replay'), a: t('faq_replay_ans') },
    { q: t('faq_free'), a: t('faq_free_ans') },
    { q: t('faq_formations'), a: t('faq_formations_ans') },
  ];

  return (
    <main className="min-h-screen">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>
        <div className="animate-slide-up relative z-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">{t('tagline')}</p>
          <h1 className="text-6xl font-black tracking-tight sm:text-8xl">
            <span className="text-white">{t('main_title')}</span>{' '}
            <span className="text-emerald-400">{t('main_title_highlight')}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300 sm:text-xl">
            {t('main_description')}{' '}
            <span className="text-gold-shimmer font-semibold">{t('main_description_highlight')}</span>.
            {t('main_description_rest')}
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/game" className="glow-emerald rounded-xl bg-emerald-500 px-8 py-4 text-lg font-bold text-black transition-all hover:bg-emerald-400 hover:scale-105">
              {t('start_playing')}
            </Link>
            <Link href="/leaderboard" className="rounded-xl border border-white/10 px-8 py-4 text-lg font-bold text-slate-300 transition-all hover:bg-white/5 hover:scale-105">
              🌍 {t('lb_title')}
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
        <h2 className="mb-12 text-center text-3xl font-black sm:text-4xl">{t('how_to_play')}</h2>
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
        <h2 className="mb-12 text-center text-3xl font-black sm:text-4xl">{t('popular_challenges')}</h2>
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
        <h2 className="mb-12 text-center text-3xl font-black sm:text-4xl">{t('faqs')}</h2>
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
          <h2 className="mb-6 text-3xl font-black sm:text-4xl">{t('ready_to_build')}</h2>
          <Link href="/game" className="glow-emerald inline-block rounded-xl bg-emerald-500 px-10 py-5 text-xl font-bold text-black transition-all hover:bg-emerald-400 hover:scale-105">
            {t('start_playing')}
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
        <p>{t('footer_unofficial')}</p>
        <p className="mt-2">{t('footer_disclaimer')}</p>
      </footer>
    </main>
  );
}
