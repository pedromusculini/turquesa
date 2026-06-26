/** PostgREST retorna "Bad Request" com `.in()` muito grande ou URL longa. */
export const SUPABASE_IN_BATCH_SIZE = 80;

export function chunkForSupabaseIn<T>(items: readonly T[]): T[][] {
  const unique = [...new Set(items)];
  const chunks: T[][] = [];
  for (let i = 0; i < unique.length; i += SUPABASE_IN_BATCH_SIZE) {
    chunks.push(unique.slice(i, i + SUPABASE_IN_BATCH_SIZE));
  }
  return chunks;
}
