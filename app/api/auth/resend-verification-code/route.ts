import { NextRequest, NextResponse } from 'next/server';
import { storeVerificationCode } from '@/lib/onboardingCodeStore';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const body = text ? JSON.parse(text) : {};
    
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    storeVerificationCode(email, code);

    await sendVerificationEmail(email, code);

    return NextResponse.json({
      success: true,
      message: `Código reenviado para ${email}`,
    });
  } catch (error) {
    console.error('[resend-verification-code] Erro:', error);
    return NextResponse.json({ error: 'Erro ao reenviar código' }, { status: 500 });
  }
}
