/**
 * Utilitários WhatsApp semi-manual (links wa.me).
 */

import { normalizePhoneForWhatsApp } from '@/lib/phoneMatch';

/** @deprecated Use normalizePhoneForWhatsApp — mantido para imports existentes. */
export function normalizeBrazilPhone(phone: string): string {
  return normalizePhoneForWhatsApp(phone);
}

export type WhatsAppUrls = {
  /** HTTPS universal link — desktop e fallback */
  web: string;
  /** Deep link whatsapp:// — iOS e fallback Android */
  app: string;
  /** Intent Android — WhatsApp Business com fallback whatsapp:// */
  android: string;
};

/** Query string para wa.me / api.whatsapp.com — encodeURIComponent preserva quebras no Web. */
function whatsAppSendQuery(phone: string | null | undefined, message: string): string {
  const parts = [`text=${encodeURIComponent(message)}`];
  if (phone?.trim()) {
    parts.push(`phone=${normalizePhoneForWhatsApp(phone)}`);
  }
  return parts.join('&');
}

/**
 * URL HTTPS para abrir WhatsApp (api.whatsapp.com).
 * Sem telefone: abre seletor de contato (ideal para compartilhar link).
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  return `https://api.whatsapp.com/send?${whatsAppSendQuery(phone, message)}`;
}

/** Deep link whatsapp:// — use no mobile com fallback para {@link buildWhatsAppUrl}. */
export function buildWhatsAppAppUrl(phone: string | null | undefined, message: string): string {
  return `whatsapp://send?${whatsAppSendQuery(phone, message)}`;
}

/**
 * Intent URL Android — abre WhatsApp Business (com.whatsapp.w4b) direto no Chrome.
 * Se não instalado, fallback para whatsapp:// (app regular).
 */
export function buildWhatsAppAndroidIntentUrl(
  phone: string | null | undefined,
  message: string,
): string {
  const query = whatsAppSendQuery(phone, message);
  const appFallback = encodeURIComponent(buildWhatsAppAppUrl(phone, message));
  return (
    `intent://send?${query}#Intent;` +
    `scheme=whatsapp;package=com.whatsapp.w4b;` +
    `S.browser_fallback_url=${appFallback};end`
  );
}

export function buildWhatsAppUrls(
  phone: string | null | undefined,
  message: string,
): WhatsAppUrls {
  return {
    web: buildWhatsAppUrl(phone, message),
    app: buildWhatsAppAppUrl(phone, message),
    android: buildWhatsAppAndroidIntentUrl(phone, message),
  };
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

/** Pedido à profissional para autorizar Google Calendar via link OAuth. */
export function buildPedidoAcessoAgendaWhatsAppMessage(params: {
  nomeProfissional: string;
  nomeSalao?: string;
  linkConvite: string;
}): string {
  const salao = params.nomeSalao?.trim() || 'Nosso salão';
  const nome = params.nomeProfissional.trim() || 'profissional';
  const link = params.linkConvite.trim();

  return (
    `Olá, ${nome}!\n\n` +
    `${salao} usa o Turquesa Agenda para organizar as sessões. Para eu conseguir ver e ajustar sua agenda, preciso que você autorize o acesso à sua agenda Google.\n\n` +
    `Abra o link abaixo e toque em "Autorizar agenda Google":\n${link}\n\n` +
    `Isso compartilha somente a agenda — não inclui Drive, e-mails nem outros dados.\n\n` +
    `O link vale por 7 dias. Se tiver dúvidas, responda esta mensagem.\n\nObrigada!`
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
