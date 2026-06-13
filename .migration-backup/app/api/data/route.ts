/**
 * Route Handler server-only — espone i dati CSV come JSON.
 * Gira esclusivamente in Node.js (runtime 'nodejs'), mai nel bundle client.
 * Chiamato da lib/data.ts::initData() durante l'SSR di app/game/layout.tsx.
 */
import { NextResponse } from 'next/server';
import { loadCsvDataset } from '@/lib/csvLoader';

export const runtime = 'nodejs';

export async function GET() {
  const dataset = loadCsvDataset();
  return NextResponse.json(dataset, {
    headers: {
      // Cache aggressiva: i CSV non cambiano a runtime
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
