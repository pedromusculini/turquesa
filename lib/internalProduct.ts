/** Identificador do produto SaaS (extensível para apps irmãos no mesmo backoffice). */
export type InternalProductId = 'medsupapp' | (string & {});

export const DEFAULT_INTERNAL_PRODUCT_ID: InternalProductId = 'medsupapp';

export function getInternalProductId(): InternalProductId {
  const raw = process.env.INTERNAL_PRODUCT_ID?.trim();
  return (raw || DEFAULT_INTERNAL_PRODUCT_ID) as InternalProductId;
}
