/** Versões dos documentos legais — incremente ao publicar alterações materiais. */
export const PRIVACY_POLICY_VERSION = '2026-06-23';
export const TERMS_VERSION = '2026-06-23';

export const LEGAL_CONTACT = 'suporte@turquesaagenda.com.br';
export const SUPPORT_EMAIL = 'suporte@turquesaagenda.com.br';
export const PRIVACY_CONTACT = 'privacidade@turquesaagenda.com.br';

export const COMPANY_LEGAL_NAME = 'Turquesa Agenda';
export const COMPANY_PRODUCT_NAME = 'Turquesa Agenda';

/** Foro preferencial nos Termos (ajuste com parecer jurídico se necessário). */
export const LEGAL_FORUM =
  'comarca do domicílio do contratante, salvo disposição legal imperativa em favor do consumidor pessoa física';

export function needsLegalReaccept(
  acceptedPrivacy: string | null | undefined,
  acceptedTerms: string | null | undefined,
): boolean {
  return (
    acceptedPrivacy !== PRIVACY_POLICY_VERSION ||
    acceptedTerms !== TERMS_VERSION
  );
}
