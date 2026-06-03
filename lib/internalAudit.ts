import { supabaseAdmin } from '@/lib/supabaseClient';
import type { InternalProductId } from '@/lib/internalProduct';

export type InternalAuditAction =
  | 'view_overview'
  | 'list_tenants'
  | 'view_tenant'
  | 'reset_tenant_access'
  | 'remove_tenant_google_access'
  | 'add_internal_note';

export async function logInternalAudit(params: {
  adminEmail: string;
  action: InternalAuditAction;
  productId: InternalProductId;
  targetOwnerEmail?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('internal_audit_log').insert({
      admin_email: params.adminEmail.toLowerCase().trim(),
      action: params.action,
      product_id: params.productId,
      target_owner_email: params.targetOwnerEmail?.toLowerCase().trim() ?? null,
      metadata: params.metadata ?? {},
    });
    if (error && error.code !== 'PGRST205') {
      console.error('[internalAudit]', error);
    }
  } catch (err) {
    console.error('[internalAudit]', err);
  }
}
