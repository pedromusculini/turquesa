import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente público — evite writes sensíveis; preferir APIs server-side. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada. Defina a chave service_role no servidor (Vercel).',
    );
  }
  if (key === supabaseAnonKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não pode ser igual à ANON key. Use a secret service_role do Supabase.',
    );
  }
  return key;
}

let _admin: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(supabaseUrl, getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** Cliente admin (lazy) — somente server-side. */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as Function).bind(client) : value;
  },
});
