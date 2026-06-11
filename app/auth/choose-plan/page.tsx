import { redirect } from 'next/navigation';

/** Plano único — redireciona para login. */
export default function ChoosePlanPage() {
  redirect('/login');
}
