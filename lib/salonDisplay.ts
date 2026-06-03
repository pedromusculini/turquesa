import { supabaseAdmin } from '@/lib/supabaseClient';

/** Nome do salão/estúdio exibido ao cliente (perfil do dono). */
export async function loadOwnerSalonName(ownerEmail: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('clinic_name, full_name')
    .eq('email', ownerEmail)
    .maybeSingle();

  const nome = String(data?.clinic_name ?? '').trim();
  if (nome) return nome;
  const pessoa = String(data?.full_name ?? '').trim();
  return pessoa || 'nosso salão';
}

export function tituloCadastroSalao(nomeSalao: string): string {
  return `Cadastre-se no ${nomeSalao}`;
}
