import { NextRequest, NextResponse } from 'next/server';
import { INSTAGRAM_AGENDA } from '@/lib/instagramAgenda';

export const runtime = 'nodejs';
export const maxDuration = 300;

const IG_GRAPH = 'https://graph.instagram.com/v21.0';

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get('authorization')?.trim() === `Bearer ${secret}`;
}

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function horaSaoPaulo(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
}

async function ig<T>(path: string, token: string, body?: Record<string, string>): Promise<T> {
  const url = new URL(`${IG_GRAPH}/${path}`);
  const init: RequestInit = { cache: 'no-store' };
  if (body) {
    init.method = 'POST';
    init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams({ ...body, access_token: token }).toString();
  } else {
    url.searchParams.set('access_token', token);
  }
  const res = await fetch(url, init);
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Instagram ${res.status}`);
  return json;
}

/** Vercel Cron diário 17h e 19h BRT: publica o post do dia/hora em `INSTAGRAM_AGENDA`. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const hoje = req.nextUrl.searchParams.get('data') ?? hojeSaoPaulo();
  const hora = Number(req.nextUrl.searchParams.get('hora') ?? horaSaoPaulo());
  const post = INSTAGRAM_AGENDA.find((p) => p.data === hoje && (p.hora ?? 19) === hora);
  if (!post) {
    return NextResponse.json({ success: true, hoje, hora, publicado: false, motivo: 'sem post agora' });
  }

  const token = process.env.META_IG_ACCESS_TOKEN?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!token || !supabaseUrl) {
    return NextResponse.json({ error: 'META_IG_ACCESS_TOKEN ou Supabase não configurado' }, { status: 500 });
  }
  const arquivo = post.video ?? post.imagem;
  if (!arquivo) return NextResponse.json({ error: 'Post sem imagem nem vídeo' }, { status: 500 });
  const mediaUrl = `${supabaseUrl}/storage/v1/object/public/meta-posts/${arquivo}`;
  if (req.nextUrl.searchParams.get('dry') === '1') {
    return NextResponse.json({ success: true, hoje, hora, dryRun: true, mediaUrl, reels: !!post.video });
  }

  try {
    const me = await ig<{ id: string }>('me?fields=id', token);
    const primeiraLinha = post.legenda.split('\n')[0];
    const recentes = await ig<{ data?: { caption?: string }[] }>(`${me.id}/media?fields=caption&limit=10`, token);
    if (recentes.data?.some((m) => m.caption?.startsWith(primeiraLinha))) {
      return NextResponse.json({ success: true, hoje, publicado: false, motivo: 'já publicado' });
    }

    const container = await ig<{ id: string }>(
      `${me.id}/media`,
      token,
      post.video
        ? { media_type: 'REELS', video_url: mediaUrl, caption: post.legenda, share_to_feed: 'true' }
        : { image_url: mediaUrl, caption: post.legenda },
    );
    // Vídeo leva de 30 s a alguns minutos para processar no Instagram.
    const tentativas = post.video ? 50 : 15;
    const intervaloMs = post.video ? 5000 : 2000;
    let pronto = false;
    for (let i = 0; i < tentativas; i++) {
      const st = await ig<{ status_code?: string }>(`${container.id}?fields=status_code`, token);
      if (st.status_code === 'FINISHED') {
        pronto = true;
        break;
      }
      if (st.status_code === 'ERROR') {
        throw new Error(post.video ? 'Instagram recusou o vídeo' : 'Instagram recusou a imagem');
      }
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
    if (!pronto) throw new Error('Instagram não terminou de processar a mídia a tempo');
    const published = await ig<{ id: string }>(`${me.id}/media_publish`, token, { creation_id: container.id });
    const media = await ig<{ permalink?: string }>(`${published.id}?fields=permalink`, token);
    return NextResponse.json({ success: true, hoje, publicado: true, permalink: media.permalink });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao publicar no Instagram';
    console.error('[cron/instagram-posts]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
