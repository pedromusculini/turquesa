import { notFound } from 'next/navigation';
import VenderPacoteFechamentoFixture from './VenderPacoteFechamentoFixture';

/** Página só para validar UI do vender pacote no fechamento (oculta em produção). */
export default function VenderPacoteFechamentoTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <VenderPacoteFechamentoFixture />;
}
