/** Identificador do produto SaaS (extensível para apps irmãos no mesmo backoffice). */
export type InternalProductId = 'turquesa-agenda' | (string & {});

export const DEFAULT_INTERNAL_PRODUCT_ID: InternalProductId = 'turquesa-agenda';

export function getInternalProductId(): InternalProductId {
  const raw = process.env.INTERNAL_PRODUCT_ID?.trim();
  return (raw || DEFAULT_INTERNAL_PRODUCT_ID) as InternalProductId;
}
