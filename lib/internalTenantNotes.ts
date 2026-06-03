import { supabaseAdmin } from '@/lib/supabaseClient';
import { getInternalProductId } from '@/lib/internalProduct';

export type InternalTenantNote = {
  id: string;
  owner_email: string;
  admin_email: string;
  body: string;
  product_id: string;
  created_at: string;
};

export async function listInternalTenantNotes(
  ownerEmail: string,
): Promise<InternalTenantNote[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('internal_tenant_notes')
    .select('id, owner_email, admin_email, body, product_id, created_at')
    .eq('owner_email', owner)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []) as InternalTenantNote[];
}

export async function addInternalTenantNote(params: {
  ownerEmail: string;
  adminEmail: string;
  body: string;
}): Promise<InternalTenantNote> {
  const owner = params.ownerEmail.toLowerCase().trim();
  const body = params.body.trim().slice(0, 4000);
  if (!body) throw new Error('Nota vazia');

  const { data, error } = await supabaseAdmin
    .from('internal_tenant_notes')
    .insert({
      owner_email: owner,
      admin_email: params.adminEmail.toLowerCase().trim(),
      body,
      product_id: getInternalProductId(),
    })
    .select('id, owner_email, admin_email, body, product_id, created_at')
    .single();

  if (error) throw error;
  return data as InternalTenantNote;
}
