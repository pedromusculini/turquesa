import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { isPublicLandingSlug } from '@/lib/salonLanding';
import { loadLandingPublicBySlug } from '@/lib/salonLandingServer';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim().toLowerCase() ?? '';
  if (!isPublicLandingSlug(slug)) {
    return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
  }

  const ip = clientIp(req);
  const bySlug = checkRateLimit(`public-salao:${slug}`, 60, 60_000);
  const byIp = checkRateLimit(`public-salao-ip:${ip}`, 120, 60_000);
  if (!bySlug.allowed || !byIp.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  try {
    const data = await loadLandingPublicBySlug(slug);
    if (!data) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' },
    });
  } catch (error) {
    console.error('[public/salao/GET]', error);
    return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
  }
}
