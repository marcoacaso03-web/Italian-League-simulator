import React from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <p className="text-4xl">🔒</p>
          <h1 className="text-2xl font-black text-white">{t('privacy_title')}</h1>
          <p className="text-sm text-slate-400">{t('privacy_last_updated')}</p>
        </div>

        <Link href="/">
          <button className="text-slate-500 hover:text-white transition-colors text-sm">← {t('back_to_home')}</button>
        </Link>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">{t('privacy_section1_title')}</h2>
            <p>{t('privacy_section1_body')}</p>
          </section>

          <section className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">{t('privacy_section2_title')}</h2>
            <p>{t('privacy_section2_body')}</p>
          </section>

          <section className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">{t('privacy_section3_title')}</h2>
            <p>{t('privacy_section3_body')}</p>
          </section>

          <section className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">{t('privacy_section4_title')}</h2>
            <p>{t('privacy_section4_body')}</p>
          </section>

          <section className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">{t('privacy_section5_title')}</h2>
            <p>{t('privacy_section5_body')}</p>
          </section>

          <section className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">{t('privacy_section6_title')}</h2>
            <p>{t('privacy_section6_body')}</p>
          </section>

          <section className="glass rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">{t('privacy_section7_title')}</h2>
            <p>{t('privacy_section7_body')}</p>
            <p className="text-slate-400 text-xs mt-2">{t('privacy_contact')}: losviluppatore@hotmail.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
