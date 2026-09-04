import { notFound } from 'next/navigation';
import AgendaConflictFixture from './AgendaConflictFixture';

/** Página só para testes Playwright (oculta em produção). */
export default function AgendaConflictTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AgendaConflictFixture />;
}
