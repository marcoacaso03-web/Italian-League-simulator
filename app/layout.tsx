import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Italian League Simulator — Costruisci la Squadra Definitiva',
  description: 'Draft dei migliori giocatori della Serie A. Costruisci la tua XI e simula una stagione da 38 giornate.',
  openGraph: {
    title: 'Italian League Simulator',
    description: 'Costruisci la squadra definitiva della Serie A. Simula una stagione da 38 giornate.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-slate-100 antialiased`}>
        {children}
        <Footer />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
      <p>Italian League Simulator — Gioco di draft calcistico non ufficiale.</p>
      <p className="mt-2">Non affiliato alla Serie A, FIGC o ai provider di rating. Ispirato a 38-0.app.</p>
    </footer>
  );
}
