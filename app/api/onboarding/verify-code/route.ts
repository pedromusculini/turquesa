import { NextRequest, NextResponse } from 'next/server';
import { verifyStoredCode } from '@/lib/onboardingCodeStore';

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const body = text ? JSON.parse(text) : {};
    
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json({ error: 'E-mail e código são obrigatórios' }, { status: 400 });
    }

    const result = verifyStoredCode(email, code);

    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[onboarding/verify-code] Erro:', error);
    return NextResponse.json({ error: 'Erro na verificação' }, { status: 500 });
  }
}
