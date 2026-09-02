import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  DEFAULT_MENSAGENS,
  getMensagensConfig,
  prepareMensagemForSave,
  saveMensagensConfig,
  type MensagensWhatsappConfig,
  type MensagemTipo,
} from '@/lib/mensagensWhatsapp';
import { ensureRequiredPlaceholders, validateTemplate } from '@/lib/mensagemTemplate';
import {
  getLembretesSettings,
  saveLembretesSettings,
  type LembretesWhatsappSettings,
} from '@/lib/lembretesSettings';
import {
  getResgateSettings,
  saveResgateSettings,
  type ResgateWhatsappSettings,
} from '@/lib/resgateSettings';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const [config, lembretesSettings, resgateSettings] = await Promise.all([
      getMensagensConfig(email),
      getLembretesSettings(email),
      getResgateSettings(email),
    ]);
    return NextResponse.json({
      config: config ?? DEFAULT_MENSAGENS,
      defaults: DEFAULT_MENSAGENS,
      lembretesSettings,
      resgateSettings,
    });
  } catch (error) {
    console.error('[mensagens-whatsapp/GET]', error);
    return NextResponse.json({
      config: DEFAULT_MENSAGENS,
      defaults: DEFAULT_MENSAGENS,
      lembretesSettings: await getLembretesSettings(email),
      resgateSettings: await getResgateSettings(email),
    });
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
      sanitized[tipo] = prepareMensagemForSave(tipo, text);
    }

    const config = await saveMensagensConfig(email, sanitized);

    let lembretesSettings: LembretesWhatsappSettings | undefined;
    let resgateSettings: ResgateWhatsappSettings | undefined;
    if (body.lembretesSettings && typeof body.lembretesSettings === 'object') {
      const s = body.lembretesSettings as Partial<LembretesWhatsappSettings>;
      lembretesSettings = await saveLembretesSettings(email, {
        lembrete_antecedencia_ativo: s.lembrete_antecedencia_ativo,
        lembrete_antecedencia_dias: s.lembrete_antecedencia_dias,
        lembrete_1_dia_ativo: s.lembrete_1_dia_ativo,
      });
    }

    if (body.resgateSettings && typeof body.resgateSettings === 'object') {
      const s = body.resgateSettings as Partial<ResgateWhatsappSettings>;
      resgateSettings = await saveResgateSettings(email, {
        resgate_cliente_ativo: s.resgate_cliente_ativo,
        resgate_dias_limite: s.resgate_dias_limite,
      });
    }

    return NextResponse.json({ config, lembretesSettings, resgateSettings });
  } catch (error) {
    console.error('[mensagens-whatsapp/PUT]', error);
    return NextResponse.json({ error: 'Erro ao salvar mensagens' }, { status: 500 });
  }
}
