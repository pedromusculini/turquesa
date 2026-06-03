const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutos

type StoredCode = {
  code: string;
  expiresAt: number;
  metadata?: Record<string, any>;
};

// Armazenamento em memória + tentativa de persistir em localStorage (server-side via global)
// Em produção deveria ser Redis/DB, mas para MVP isso resolve
const codeStore = new Map<string, StoredCode>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanupExpired() {
  const now = Date.now();
  for (const [email, entry] of codeStore.entries()) {
    if (entry.expiresAt <= now) {
      codeStore.delete(email);
    }
  }
}

export function storeVerificationCode(
  email: string,
  code: string,
  metadata?: Record<string, any>,
) {
  cleanupExpired();
  codeStore.set(normalizeEmail(email), {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    metadata,
  });
}

export function verifyStoredCode(email: string, typedCode: string) {
  cleanupExpired();
  const normalized = normalizeEmail(email);
  const entry = codeStore.get(normalized);

  if (!entry) {
    return {
      valid: false,
      reason:
        'O código expirou (validade: 15 minutos) ou não foi encontrado. Solicite um novo código.',
    };
  }

  if (entry.code !== typedCode) {
    return {
      valid: false,
      reason: 'Código incorreto. Verifique os dígitos e tente novamente.',
    };
  }

  codeStore.delete(normalized);
  return { valid: true, metadata: entry.metadata };
}