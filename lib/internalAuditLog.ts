import { supabaseAdmin } from '@/lib/supabaseClient';
import { getInternalProductId } from '@/lib/internalProduct';

export type InternalAuditRow = {
  id: string;
  admin_email: string;
  action: string;
  product_id: string;
  target_owner_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listInternalAuditForTenant(
  ownerEmail: string,
  limit = 30,
): Promise<InternalAuditRow[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const productId = getInternalProductId();

  const { data, error } = await supabaseAdmin
    .from('internal_audit_log')
    .select(
      'id, admin_email, action, product_id, target_owner_email, metadata, created_at',
    )
    .eq('target_owner_email', owner)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []) as InternalAuditRow[];
}
