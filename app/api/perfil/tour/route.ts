import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isDevBypassAuthActive } from '@/lib/devBypassAuth';
type TourPrefs = {
  tour_completed_at: string | null;
  hints_dismissed: string[];
};

function parseHintsDismissed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('tour_completed_at, tour_hints_dismissed')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      const missingColumn =
        error.message?.includes('tour_completed_at') ||
        error.message?.includes('tour_hints_dismissed');
      if (missingColumn) {
        return NextResponse.json<TourPrefs>({
          tour_completed_at: null,
          hints_dismissed: [],
        });
      }
      throw error;
    }

    return NextResponse.json<TourPrefs>({
      tour_completed_at: data?.tour_completed_at ?? null,
      hints_dismissed: parseHintsDismissed(data?.tour_hints_dismissed),
    });
  } catch (error) {
    console.error('[perfil/tour/GET] Erro:', error);
    if (isDevBypassAuthActive()) {
      return NextResponse.json<TourPrefs>({
        tour_completed_at: null,
        hints_dismissed: [],
      });
    }
    return NextResponse.json({ error: 'Erro ao carregar preferências do tour' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === 'complete') {
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({ tour_completed_at: now, updated_at: now })
        .eq('email', email);

      if (error) {
        const missingColumn = error.message?.includes('tour_completed_at');
        if (!missingColumn) throw error;
      }

      return NextResponse.json({ success: true, tour_completed_at: now });
    }

    if (action === 'dismiss_hint') {
      const hintId = String(body?.hintId ?? '').trim();
      if (!hintId) {
        return NextResponse.json({ error: 'hintId obrigatório' }, { status: 400 });
      }

      const { data: existing, error: readError } = await supabaseAdmin
        .from('onboarding_profiles')
        .select('tour_hints_dismissed')
        .eq('email', email)
        .maybeSingle();

      if (readError) {
        const missingColumn = readError.message?.includes('tour_hints_dismissed');
        if (missingColumn) {
          return NextResponse.json({ success: true, hints_dismissed: [hintId] });
        }
        throw readError;
      }

      const current = parseHintsDismissed(existing?.tour_hints_dismissed);
      if (!current.includes(hintId)) current.push(hintId);

      const now = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({ tour_hints_dismissed: current, updated_at: now })
        .eq('email', email);

      if (updateError) {
        const missingColumn = updateError.message?.includes('tour_hints_dismissed');
        if (!missingColumn) throw updateError;
      }

      return NextResponse.json({ success: true, hints_dismissed: current });
    }

    if (action === 'reset') {
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({ tour_completed_at: null, updated_at: now })
        .eq('email', email);

      if (error) {
        const missingColumn = error.message?.includes('tour_completed_at');
        if (!missingColumn) throw error;
      }

      return NextResponse.json({ success: true, tour_completed_at: null });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('[perfil/tour/PATCH] Erro:', error);
    return NextResponse.json({ error: 'Erro ao salvar preferências do tour' }, { status: 500 });
  }
}
