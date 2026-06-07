import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { resolveShortLink } from '@/lib/shortLink';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const target = resolveShortLink(token);

  if (!target) {
    return NextResponse.redirect(new URL('/', CANONICAL_APP_URL));
  }

  return NextResponse.redirect(target, 302);
}
