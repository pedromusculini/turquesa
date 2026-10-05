import { Resend } from 'resend';
import {
  CANONICAL_APP_URL,
  CORES,
  PRODUCT_NAME,
  VERIFICATION_CODE_DIGITS,
} from '@/lib/constants';
import { SUPPORT_EMAIL } from '@/lib/legal';

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress =
  process.env.RESEND_FROM?.trim() || 'Turquesa Agenda <naoresponda@turquesaagenda.com.br>';
const replyToAddress = process.env.RESEND_REPLY_TO?.trim() || SUPPORT_EMAIL;

type TransactionalEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: { name: string; value: string }[];
  replyTo?: string;
};

async function sendTransactionalEmail(payload: TransactionalEmailPayload) {
  const resend = getResend();
  const to = payload.to.toLowerCase().trim();

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo ?? replyToAddress,
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    },
    tags: payload.tags,
  });

  if (error) {
    throw error;
  }

  return { data, to };
}

function getResend(): Resend {
  if (!resendApiKey?.trim()) {
    throw new Error(
      'RESEND_API_KEY não está configurada. Adicione no .env.local (local) ou nas variáveis do Vercel (produção).',
    );
  }
  return new Resend(resendApiKey);
}

export function getEmailFromAddress(): string {
  return fromAddress;
}

/** Endereço puro para exibir na UI (extrai de `Nome <email@dominio>`). */
export function formatEmailSenderForDisplay(from = fromAddress): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

/** Busca no Gmail por mensagens do remetente transacional (qualquer pasta). */
export function getGmailSenderSearchUrl(from = fromAddress): string {
  const sender = formatEmailSenderForDisplay(from);
  const query = `from:${sender} in:anywhere`;
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`;
}

export async function sendVerificationEmail(email: string, code: string) {
  const senderDisplay = formatEmailSenderForDisplay();
  const subject = `${PRODUCT_NAME}: confirme seu e-mail`;
  const text = [
    `${PRODUCT_NAME} — confirme seu e-mail`,
    '',
    `Seu código de ${VERIFICATION_CODE_DIGITS} dígitos: ${code}`,
    '',
    'Use este código na tela de verificação após entrar com Google.',
    'O código expira em 5 minutos.',
    '',
    `Remetente: ${senderDisplay}`,
    `Dúvidas: ${replyToAddress}`,
    '',
    'Se você não solicitou este código, ignore este e-mail.',
  ].join('\n');
  const html = `
    <div style="font-family:system-ui, sans-serif; max-width:480px; margin:0 auto;">
      <div style="background:${CORES.primary}; padding:24px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="color:#fff; margin:0; font-size:24px;">${PRODUCT_NAME}</h1>
      </div>
      <div style="background:#fff; border:1px solid #e5e7eb; border-top:0; padding:32px; border-radius:0 0 12px 12px;">
        <h2 style="color:#111; margin:0 0 16px;">Seu código de verificação</h2>
        <p style="color:#6b7280; margin:0 0 24px; font-size:16px;">
          Use o código de ${VERIFICATION_CODE_DIGITS} dígitos abaixo para confirmar seu e-mail após entrar com Google:
        </p>
        <div style="background:#f3f4f6; border-radius:12px; padding:24px; text-align:center; margin:0 0 24px;">
          <span style="font-size:48px; font-weight:bold; letter-spacing:12px; color:${CORES.primary};">${code}</span>
        </div>
        <p style="color:#9ca3af; font-size:14px; margin:0 0 8px;">
          Código válido por 5 minutos.
        </p>
        <p style="color:#9ca3af; font-size:14px; margin:0;">
          Remetente: ${senderDisplay}. Dúvidas: ${replyToAddress}. Se você não solicitou, ignore este e-mail.
        </p>
      </div>
      <div style="text-align:center; padding:16px; color:#9ca3af; font-size:12px;">
        <p style="margin:0;">© 2026 ${PRODUCT_NAME}. Todos os direitos reservados.</p>
      </div>
    </div>
  `;

  try {
    const { data, to } = await sendTransactionalEmail({
      to: email,
      subject,
      html,
      text,
      tags: [{ name: 'category', value: 'otp' }],
    });
    console.log(`[email] Enviado para ${to} (id: ${data?.id})`);
    return data;
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Falha ao enviar e-mail pelo Resend.';
    console.error('[email] Erro Resend:', error);
    throw new Error(
      message ||
        `Falha ao enviar e-mail pelo Resend. Verifique RESEND_FROM (${senderDisplay}).`,
    );
  }
}

export async function sendFinanceiroPinResetEmail(email: string, code: string) {
  const subject = `${PRODUCT_NAME}: redefinir PIN do modo salão`;
  const text = [
    `${PRODUCT_NAME} — redefinir PIN do modo salão`,
    '',
    `Seu código de ${VERIFICATION_CODE_DIGITS} dígitos: ${code}`,
    '',
    'Use este código para criar um novo PIN e desbloquear o financeiro.',
    'O código expira em 5 minutos.',
    '',
    'Se você não solicitou, ignore este e-mail e verifique quem tem acesso à conta.',
  ].join('\n');
  const html = `
    <div style="font-family:system-ui, sans-serif; max-width:480px; margin:0 auto;">
      <div style="background:${CORES.primary}; padding:24px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="color:#fff; margin:0; font-size:24px;">${PRODUCT_NAME}</h1>
      </div>
      <div style="background:#fff; border:1px solid #e5e7eb; border-top:0; padding:32px; border-radius:0 0 12px 12px;">
        <h2 style="color:#111; margin:0 0 16px;">Redefinir PIN do modo salão</h2>
        <p style="color:#6b7280; margin:0 0 24px; font-size:16px;">
          Use o código de ${VERIFICATION_CODE_DIGITS} dígitos abaixo para criar um novo PIN e desbloquear o financeiro:
        </p>
        <div style="background:#f3f4f6; border-radius:12px; padding:24px; text-align:center; margin:0 0 24px;">
          <span style="font-size:48px; font-weight:bold; letter-spacing:12px; color:${CORES.primary};">${code}</span>
        </div>
        <p style="color:#9ca3af; font-size:14px; margin:0 0 8px;">
          Código válido por 5 minutos.
        </p>
        <p style="color:#9ca3af; font-size:14px; margin:0;">
          Se você não solicitou, ignore este e-mail e verifique quem tem acesso à conta.
        </p>
      </div>
    </div>
  `;

  try {
    const { data, to } = await sendTransactionalEmail({
      to: email,
      subject,
      html,
      text,
      tags: [{ name: 'category', value: 'financeiro-pin' }],
    });
    console.log(`[email] PIN reset enviado para ${to} (id: ${data?.id})`);
    return data;
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Falha ao enviar código de redefinição.';
    console.error('[email] financeiro PIN reset:', error);
    throw new Error(message);
  }
}

export type BugReportEmailPayload = {
  reportId: string;
  reporterEmail: string;
  description: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  sessionContext?: Record<string, unknown>;
  createdAt: string;
};

export async function sendBugReportEmailToOwner(
  to: string[],
  payload: BugReportEmailPayload,
) {
  const resend = getResend();
  const recipients = [...new Set(to.map((e) => e.toLowerCase().trim()).filter(Boolean))];
  if (recipients.length === 0) {
    throw new Error('Nenhum e-mail de destino configurado para relatório de problema.');
  }

  const ctx = payload.sessionContext ?? {};
  const ctxLines = [
    ctx.accessVerified != null ? `E-mail verificado: ${ctx.accessVerified ? 'sim' : 'não'}` : null,
    ctx.onboardingCompleted != null
      ? `Onboarding concluído: ${ctx.onboardingCompleted ? 'sim' : 'não'}`
      : null,
    ctx.sessionName ? `Nome na sessão: ${String(ctx.sessionName)}` : null,
  ]
    .filter(Boolean)
    .join('<br/>');

  const subject = `[${PRODUCT_NAME}] Problema reportado — ${payload.reporterEmail}`;
  const html = `
    <div style="font-family:system-ui, sans-serif; max-width:560px; margin:0 auto;">
      <div style="background:${CORES.primary}; padding:20px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="color:#fff; margin:0; font-size:20px;">Novo relatório de problema</h1>
      </div>
      <div style="background:#fff; border:1px solid #e5e7eb; border-top:0; padding:24px; border-radius:0 0 12px 12px;">
        <p style="margin:0 0 8px; color:#374151;"><strong>Reporter:</strong> ${payload.reporterEmail}</p>
        <p style="margin:0 0 8px; color:#374151;"><strong>Quando:</strong> ${payload.createdAt}</p>
        <p style="margin:0 0 8px; color:#374151;"><strong>Página:</strong> ${payload.pageUrl || '—'}</p>
        <p style="margin:0 0 16px; color:#374151;"><strong>ID:</strong> ${payload.reportId}</p>
        ${ctxLines ? `<p style="margin:0 0 16px; color:#6b7280; font-size:14px;">${ctxLines}</p>` : ''}
        <div style="background:#f9fafb; border-radius:8px; padding:16px; margin:0 0 16px;">
          <p style="margin:0 0 8px; font-weight:600; color:#111;">Descrição</p>
          <p style="margin:0; color:#374151; white-space:pre-wrap;">${escapeHtml(payload.description)}</p>
        </div>
        ${
          payload.userAgent
            ? `<p style="margin:0; color:#9ca3af; font-size:12px; word-break:break-all;"><strong>User-Agent:</strong> ${escapeHtml(payload.userAgent)}</p>`
            : ''
        }
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: recipients,
    replyTo: payload.reporterEmail,
    subject,
    html,
  });

  if (error) {
    console.error('[email] bug report Resend:', error);
    throw new Error(error.message || 'Falha ao enviar e-mail de relatório de problema.');
  }

  console.log(`[email] Bug report ${payload.reportId} → ${recipients.join(', ')} (id: ${data?.id})`);
  return data;
}

function lifecycleEmailHtml(params: {
  titulo: string;
  paragrafos: string[];
  ctaLabel: string;
  ctaHref: string;
  extraHtml?: string;
}): string {
  const corpo = params.paragrafos
    .map((p) => `<p style="color:#374151; margin:0 0 14px; font-size:16px; line-height:1.5;">${p}</p>`)
    .join('');
  return `
    <div style="font-family:system-ui, sans-serif; max-width:480px; margin:0 auto;">
      <div style="background:${CORES.primary}; padding:20px; text-align:center; border-radius:12px 12px 0 0;">
        <p style="color:#fff; margin:0; font-size:18px; font-weight:700;">${PRODUCT_NAME}</p>
      </div>
      <div style="background:#fff; border:1px solid #e5e7eb; border-top:0; padding:28px; border-radius:0 0 12px 12px;">
        <h2 style="color:#111; margin:0 0 16px; font-size:20px;">${params.titulo}</h2>
        ${corpo}
        ${params.extraHtml ?? ''}
        <a href="${params.ctaHref}" style="display:block; background:${CORES.primary}; color:#fff; text-align:center; padding:14px; border-radius:12px; font-weight:700; text-decoration:none; margin:20px 0 0;">${params.ctaLabel}</a>
        <p style="color:#9ca3af; font-size:13px; margin:20px 0 0;">Dúvidas? Responda este e-mail.</p>
      </div>
    </div>
  `;
}

/** 48h após o cadastro, para quem ainda não criou nenhuma sessão. */
export async function sendAtivacao48hEmail(email: string, nome?: string | null) {
  const ola = nome?.trim() ? `Oi, ${escapeHtml(nome.trim().split(' ')[0])}!` : 'Oi!';
  const href = `${CANONICAL_APP_URL}/agenda`;
  const subject = 'Sua agenda ainda está vazia — leva 1 minuto';
  const paragrafos = [
    ola,
    'Você criou o salão no Turquesa, mas ainda não colocou nenhuma sessão na agenda.',
    'O jeito mais rápido de sentir a diferença: coloque o próximo atendimento de uma cliente de verdade, ou mande seu link no WhatsApp e deixe ela marcar sozinha.',
  ];
  const text = [...paragrafos, '', `Abrir agenda: ${href}`, '', 'Dúvidas? Responda este e-mail.']
    .join('\n')
    .replace(/<[^>]+>/g, '');
  const { data } = await sendTransactionalEmail({
    to: email,
    subject,
    html: lifecycleEmailHtml({
      titulo: 'Bora colocar a primeira cliente?',
      paragrafos,
      ctaLabel: 'Criar minha primeira sessão',
      ctaHref: href,
    }),
    text,
    tags: [{ name: 'category', value: 'ativacao_48h' }],
  });
  return data;
}

/** Faltando poucos dias de teste: resumo do que o salão fez + convite para assinar. */
export async function sendTrialTerminandoEmail(
  email: string,
  params: { diasRestantes: number; sessoes: number; peloLink: number; entradas: number },
) {
  const href = `${CANONICAL_APP_URL}/dashboard/conta`;
  const dias = params.diasRestantes;
  const subject = `Faltam ${dias} dias do seu teste no ${PRODUCT_NAME}`;
  const entradasFmt = params.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const paragrafos =
    params.sessoes > 0
      ? [
          `Seu teste gratuito termina em ${dias} dias. Olha o que seu salão já fez por aqui:`,
        ]
      : [
          `Seu teste gratuito termina em ${dias} dias e ainda dá tempo de testar de verdade.`,
          'Coloque as sessões da semana na agenda e mande o link para as clientes marcarem sozinhas.',
        ];
  const extraHtml =
    params.sessoes > 0
      ? `<table style="width:100%; border-collapse:collapse; margin:0 0 8px;">
          <tr>
            <td style="text-align:center; padding:10px; background:#eef4f5; border-radius:8px;"><strong style="font-size:20px; color:${CORES.primary};">${params.sessoes}</strong><br/><span style="font-size:12px; color:#6b7280;">sessões</span></td>
            <td style="width:8px;"></td>
            <td style="text-align:center; padding:10px; background:#eef4f5; border-radius:8px;"><strong style="font-size:20px; color:${CORES.primary};">${params.peloLink}</strong><br/><span style="font-size:12px; color:#6b7280;">pelo link</span></td>
            <td style="width:8px;"></td>
            <td style="text-align:center; padding:10px; background:#eef4f5; border-radius:8px;"><strong style="font-size:16px; color:${CORES.primary};">${entradasFmt}</strong><br/><span style="font-size:12px; color:#6b7280;">no financeiro</span></td>
          </tr>
        </table>
        <p style="color:#374151; margin:14px 0 0; font-size:15px;">Assine para continuar sem interrupção. No plano anual você ganha 2 meses.</p>`
      : undefined;
  const text = [
    ...paragrafos,
    params.sessoes > 0
      ? `${params.sessoes} sessões · ${params.peloLink} pelo link · ${entradasFmt} no financeiro`
      : '',
    '',
    `Ver planos: ${href}`,
  ].join('\n');
  const { data } = await sendTransactionalEmail({
    to: email,
    subject,
    html: lifecycleEmailHtml({
      titulo: `Faltam ${dias} dias de teste`,
      paragrafos,
      ctaLabel: 'Ver planos e assinar',
      ctaHref: href,
      extraHtml,
    }),
    text,
    tags: [{ name: 'category', value: 'trial_terminando' }],
  });
  return data;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
