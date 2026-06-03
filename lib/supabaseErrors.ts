function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
}

export function isSupabaseNetworkError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('network')
  );
}

export function isSupabaseMissingColumnError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('column') && msg.includes('config_pagamento')
  );
}

/** Status HTTP sugerido para erros de infraestrutura Supabase */
export function supabaseErrorStatus(error: unknown): number {
  if (isSupabaseNetworkError(error) || isSupabaseMissingColumnError(error)) {
    return 503;
  }
  return 500;
}

/** Mensagem amigável a partir de erro PostgREST/Supabase */
export function supabaseErrorMessage(error: unknown, fallback: string): string {
  if (isSupabaseNetworkError(error)) {
    return 'Não foi possível conectar ao banco de dados. Verifique SUPABASE_URL e a rede, ou use DEV_BYPASS_AUTH em local.';
  }
  if (isSupabaseMissingColumnError(error)) {
    return 'Colunas de pagamento ainda não existem no banco. Execute: npm run db:config-pagamento';
  }
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
