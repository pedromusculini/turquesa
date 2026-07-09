import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  supabaseErrorMessage,
  supabaseErrorStatus,
  isSupabaseNetworkError,
  isSupabaseMissingColumnError,
} from '@/lib/supabaseErrors';
import { isDevBypassAuthActive } from '@/lib/devBypassAuth';
import {
  defaultCategoriasSaida,
  sanitizeCategoriasSaidaInput,
  type CategoriaSaida,
} from '@/lib/configCategoriasSaida';
import {
  devCategoriasSaidaGet,
  devCategoriasSaidaSet,
} from '@/lib/devConfigCategoriasSaidaStore';

function isCategoriasColumnMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42703' ||
    (error.message?.includes('categorias_saida') ?? false)
  );
}

function devFallbackResponse(email: string) {
  return NextResponse.json({
    categorias: devCategoriasSaidaGet(email) ?? defaultCategoriasSaida(),
    devFallback: true,
  });
}

export async function GET() {
  let email: string | undefined;
  try {
    const authResult = await requireVerifiedOwner();
    if (isAuthError(authResult)) return authResult;
    email = authResult.email;

    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('categorias_saida')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      if (isCategoriasColumnMissing(error)) {
        return NextResponse.json({ categorias: defaultCategoriasSaida() });
      }
      throw error;
    }

    const categorias = sanitizeCategoriasSaidaInput(data?.categorias_saida);
    return NextResponse.json(
      { categorias },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch (error) {
    console.error('[config/categorias-saida/GET]', error);
    if (
      email &&
      isDevBypassAuthActive() &&
      (isSupabaseNetworkError(error) || isSupabaseMissingColumnError(error))
    ) {
      return devFallbackResponse(email);
    }
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar categorias') },
      { status: supabaseErrorStatus(error) },
    );
  }
}

export async function PUT(req: NextRequest) {
  let email: string | undefined;
  let categorias: CategoriaSaida[] = defaultCategoriasSaida();

  try {
    const authResult = await requireVerifiedOwner();
    if (isAuthError(authResult)) return authResult;
    email = authResult.email;

    const body = await req.json().catch(() => ({}));
    categorias = sanitizeCategoriasSaidaInput(body.categorias);

    const { error } = await supabaseAdmin
      .from('onboarding_profiles')
      .update({
        categorias_saida: categorias,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) {
      if (isCategoriasColumnMissing(error)) {
        if (email && isDevBypassAuthActive()) {
          devCategoriasSaidaSet(email, categorias);
          return NextResponse.json({
            categorias,
            message: 'Categorias salvas (modo dev — execute npm run db:categorias-saida)',
            devFallback: true,
          });
        }
        return NextResponse.json(
          {
            error: 'Execute npm run db:categorias-saida no Supabase.',
            code: 'SUPABASE_SCHEMA_MISSING',
          },
          { status: 503 },
        );
      }
      throw error;
    }

    return NextResponse.json({
      categorias,
      message: 'Categorias salvas',
    });
  } catch (error) {
    console.error('[config/categorias-saida/PUT]', error);
    if (
      email &&
      isDevBypassAuthActive() &&
      (isSupabaseNetworkError(error) || isSupabaseMissingColumnError(error))
    ) {
      devCategoriasSaidaSet(email, categorias);
      return NextResponse.json({
        categorias,
        message: 'Categorias salvas (modo dev, memória local do servidor)',
        devFallback: true,
      });
    }
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao salvar categorias') },
      { status: supabaseErrorStatus(error) },
    );
  }
}
