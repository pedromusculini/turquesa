/** Mensagem amigável a partir de erro PostgREST/Supabase */
export function supabaseErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as { code?: string; message?: string; details?: string };
  if (e.code === 'PGRST205') {
    return 'Recurso do banco ainda não configurado. Contate o suporte (tabela ausente).';
  }
  if (e.code === '23503') {
    return 'Perfil da clínica não encontrado. Conclua o cadastro em Meu Perfil.';
  }
  if (e.code === '23505') {
    return 'Este registro já existe (e-mail ou CRM duplicado).';
  }
  if (e.message) return e.message;
  return fallback;
}
