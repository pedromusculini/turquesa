/**
 * Utilitários WhatsApp semi-manual (links wa.me).
 */

export function normalizeBrazilPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

/**
 * Abre WhatsApp com mensagem pré-preenchida.
 * Sem telefone: abre seletor de contato (ideal para compartilhar link).
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const text = encodeURIComponent(message);
  if (!phone?.trim()) {
    return `https://wa.me/?text=${text}`;
  }
  const normalized = normalizeBrazilPhone(phone);
  return `https://wa.me/${normalized}?text=${text}`;
}

export function buildFormularioWhatsAppMessage(params: {
  nomeClinica?: string;
  nomePaciente?: string;
  linkFormulario: string;
}): string {
  const clinica = params.nomeClinica ? `${params.nomeClinica}` : 'seu salão';
  const saudacao = params.nomePaciente ? `Olá, ${params.nomePaciente}!` : 'Olá!';
  return `${saudacao}\n\n${clinica} solicitou que você preencha seus dados pelo link abaixo (leva menos de 2 minutos):\n\n${params.linkFormulario}\n\nObrigado!`;
}

export function buildAutocadastroWhatsAppMessage(params: {
  nomeClinica?: string;
  linkFormulario: string;
}): string {
  const clinica = params.nomeClinica || 'nosso salão';
  return (
    `Olá! Você foi convidado(a) a fazer seu cadastro em ${clinica}.\n\n` +
    `Preencha seus dados pelo link (leva menos de 2 minutos):\n${params.linkFormulario}\n\n` +
    `Obrigado!`
  );
}

export function buildCatalogoWhatsAppMessage(params: {
  nomeClinica?: string;
  linkCatalogo: string;
}): string {
  const clinica = params.nomeClinica || 'nosso salão';
  return (
    `Olá! Confira os serviços de ${clinica}:\n\n` +
    `${params.linkCatalogo}\n\n` +
    `Valores e duração para referência. Para se cadastrar, peça o link de cadastro ao salão.`
  );
}

/** Substitui {{link_formulario}} e {{link_catalogo}} em templates customizados. */
export function applyPublicLinkPlaceholders(
  template: string,
  vars: { link_formulario: string; link_catalogo: string },
): string {
  return template
    .replace(/\{\{link_formulario\}\}/g, vars.link_formulario)
    .replace(/\{\{link_catalogo\}\}/g, vars.link_catalogo);
}
