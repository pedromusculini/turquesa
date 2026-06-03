'use client';

import { useSession } from 'next-auth/react';

/**
 * Hook de sessão simplificado - apenas Google via NextAuth.
 * Sem fallback para localStorage (causava loop de login).
 */
export function useCustomSession() {
  return useSession();
}

/** Mantido para compatibilidade, mas não faz mais nada */
export function saveUserToStorage(_email: string, _name?: string) {
  // Função obsoleta - não usa mais localStorage
}
