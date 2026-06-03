import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  DEFAULT_MENSAGENS,
  getMensagensConfig,
  saveMensagensConfig,
  type MensagensWhatsappConfig,
  type MensagemTipo,
} from '@/lib/mensagensWhatsapp';
import { ensureRequiredPlaceholders, validateTemplate } from '@/lib/mensagemTemplate';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const config = await getMensagensConfig(email);
    return NextResponse.json({ config, defaults: DEFAULT_MENSAGENS });
  } catch (error) {
    console.error('[mensagens-whatsapp/GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar mensagens' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const partial = body.config as Partial<MensagensWhatsappConfig>;
    const sanitized: Partial<MensagensWhatsappConfig> = {};

    for (const tipo of Object.keys(DEFAULT_MENSAGENS) as MensagemTipo[]) {
      if (partial[tipo] === undefined) continue;
      const text = ensureRequiredPlaceholders(String(partial[tipo]), tipo);
      const check = validateTemplate(text, tipo);
      if (!check.ok) {
        return NextResponse.json(
          {
            error: `Mensagem "${tipo}" precisa incluir: ${check.missing.join(', ')}`,
          },
          { status: 400 },
        );
      }
      sanitized[tipo] = text;
    }

    const config = await saveMensagensConfig(email, sanitized);
    return NextResponse.json({ config });
  } catch (error) {
    console.error('[mensagens-whatsapp/PUT]', error);
    return NextResponse.json({ error: 'Erro ao salvar mensagens' }, { status: 500 });
  }
}
