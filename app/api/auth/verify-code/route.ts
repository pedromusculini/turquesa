import { NextRequest, NextResponse } from 'next/server';

const MSG =
  'Acesso apenas com Google. Use /login para entrar com sua conta Google.';

export async function POST(_request: NextRequest) {
  return NextResponse.json({ success: false, error: MSG }, { status: 403 });
}

export async function OPTIONS() {
  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
