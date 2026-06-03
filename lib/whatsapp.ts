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
  link: string;
}): string {
  const clinica = params.nomeClinica ? `${params.nomeClinica}` : 'sua clínica';
  const saudacao = params.nomePaciente
    ? `Olá, ${params.nomePaciente}!`
    : 'Olá!';
  return `${saudacao}\n\n${clinica} solicitou que você preencha seus dados pelo link abaixo (leva menos de 2 minutos):\n\n${params.link}\n\nObrigado!`;
}

export function buildAutocadastroWhatsAppMessage(params: {
  nomeClinica?: string;
  link: string;
}): string {
  const clinica = params.nomeClinica || 'nossa clínica';
  return (
    `Olá! Você foi convidado(a) a fazer seu cadastro em ${clinica}.\n\n` +
    `Preencha seus dados pelo link (leva menos de 2 minutos):\n${params.link}\n\n` +
    `Obrigado!`
  );
}
