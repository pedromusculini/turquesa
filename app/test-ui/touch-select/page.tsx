import { notFound } from 'next/navigation';
import TouchSelectFixture from './TouchSelectFixture';

/** Página só para testes Playwright (oculta em produção). */
export default function TouchSelectTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <TouchSelectFixture />;
}
