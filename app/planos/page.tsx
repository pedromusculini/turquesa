import { redirect } from 'next/navigation';

/** Plano único — redireciona para a seção de preço na landing. */
export default function PlanosPage() {
  redirect('/#planos');
}
