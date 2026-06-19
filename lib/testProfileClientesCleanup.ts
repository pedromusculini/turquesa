/**
 * Limpeza pontual de importação planilha — somente perfil de teste (marrissamartins@gmail.com).
 * Não usar como comportamento global do produto até validar em outras contas.
 */
import { TEST_PROFILE_EMAIL } from '@/lib/constants';
import type { ClienteDriveRecord } from '@/lib/clientesDrive';

export const PLANILHA_IMPORT_JUNK_RE = /\[import:marrissa\]|codigo_planilha/i;

export function isTestProfileCleanupOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === TEST_PROFILE_EMAIL.toLowerCase();
}

export function assertTestProfileCleanupOwner(email: string): void {
  if (!isTestProfileCleanupOwner(email)) {
    throw new Error('Operação disponível apenas para o perfil de teste interno.');
  }
}

/** Cadastro lixo da importação planilha Marrissa — sem atendimentos. */
export function isPlanilhaImportJunkCliente(c: ClienteDriveRecord): boolean {
  const obs = c.observacoes_gerais ?? '';
  if (!PLANILHA_IMPORT_JUNK_RE.test(obs)) return false;
  const n = Array.isArray(c.atendimentos) ? c.atendimentos.length : 0;
  return n === 0;
}

/** Evita 500 quando JSON legado no Drive não tem arrays. Uso restrito por enquanto. */
export function ensureClienteDriveArrays(c: ClienteDriveRecord): void {
  if (!Array.isArray(c.atendimentos)) c.atendimentos = [];
  if (!Array.isArray(c.observacoes)) c.observacoes = [];
  if (!Array.isArray(c.pagamentos)) c.pagamentos = [];
}
