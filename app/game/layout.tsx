/**
 * app/game/layout.tsx — Server Component
 *
 * Chiama initData() prima che qualsiasi client component sotto /game
 * venga renderizzato. In questo modo _players e _clubs sono già in cache
 * quando DraftScreen, SimScreen ecc. chiamano loadPlayers()/getSquad() ecc.
 *
 * Non aggiunge nessun markup visibile: renderizza solo {children}.
 */
import { initData } from '@/lib/data';

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await initData();
  return <>{children}</>;
}
