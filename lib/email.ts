import { Resend } from 'resend';
import { VERIFICATION_CODE_DIGITS } from '@/lib/constants';

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress =
  process.env.RESEND_FROM?.trim() || 'MedSupAPP <naoresponda@medsupapp.com.br>';

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

export async function sendVerificationEmail(email: string, code: string) {
  const resend = getResend();
  const to = email.toLowerCase().trim();

  const subject = 'Seu código de verificação MedSupAPP';
  const html = `
    <div style="font-family:system-ui, sans-serif; max-width:480px; margin:0 auto;">
      <div style="background:#013a01; padding:24px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="color:#fff; margin:0; font-size:24px;">🩺 MedSupAPP</h1>
      </div>
      <div style="background:#fff; border:1px solid #e5e7eb; border-top:0; padding:32px; border-radius:0 0 12px 12px;">
        <h2 style="color:#111; margin:0 0 16px;">Seu código de verificação</h2>
        <p style="color:#6b7280; margin:0 0 24px; font-size:16px;">
          Use o código de ${VERIFICATION_CODE_DIGITS} dígitos abaixo para confirmar seu e-mail após entrar com Google:
        </p>
        <div style="background:#f3f4f6; border-radius:12px; padding:24px; text-align:center; margin:0 0 24px;">
          <span style="font-size:48px; font-weight:bold; letter-spacing:12px; color:#013a01;">${code}</span>
        </div>
        <p style="color:#9ca3af; font-size:14px; margin:0 0 8px;">
          Código válido por 5 minutos.
        </p>
        <p style="color:#9ca3af; font-size:14px; margin:0;">
          Enviado por ${fromAddress}. Se você não solicitou, ignore este e-mail.
        </p>
      </div>
      <div style="text-align:center; padding:16px; color:#9ca3af; font-size:12px;">
        <p style="margin:0;">© 2026 MedSupAPP. Todos os direitos reservados.</p>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('[email] Erro Resend:', error);
    throw new Error(
      error.message || 'Falha ao enviar e-mail pelo Resend. Verifique o domínio medsupapp.com.br.',
    );
  }

  console.log(`[email] Enviado para ${to} (id: ${data?.id})`);
  return data;
}
