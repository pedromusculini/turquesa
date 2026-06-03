import { NextRequest, NextResponse } from 'next/server';

const MSG =
  'Cadastro por e-mail desativado. Entre com Google em /login para usar o MedSupAPP.';

export async function POST(_request: NextRequest) {
  return NextResponse.json({ success: false, error: MSG }, { status: 403 });
}

export async function OPTIONS() {
  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
