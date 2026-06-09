import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getBugReportOwnerEmails,
  insertBugReport,
  isReporterEmailValid,
  type BugReportSessionContext,
} from '@/lib/bugReports';
import { sendBugReportEmailToOwner } from '@/lib/email';
import { getGoogleAccessFromDb } from '@/lib/requireGoogleAccess';
import { hasCompletedOnboarding } from '@/lib/onboardingGate';
import { checkRateLimit } from '@/lib/rateLimit';

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 5000;

type BugReportBody = {
  description?: string;
  reporterEmail?: string;
  pageUrl?: string;
  userAgent?: string;
};

export async function POST(req: NextRequest) {
  let body: BugReportBody;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < MIN_DESCRIPTION) {
    return NextResponse.json(
      { error: `Descreva o problema com pelo menos ${MIN_DESCRIPTION} caracteres.` },
      { status: 400 },
    );
  }
  if (description.length > MAX_DESCRIPTION) {
    return NextResponse.json(
      { error: `Descrição muito longa (máximo ${MAX_DESCRIPTION} caracteres).` },
      { status: 400 },
    );
  }

  const session = await auth();
  let reporterEmail = session?.user?.email?.toLowerCase().trim() ?? '';
  if (!reporterEmail && typeof body.reporterEmail === 'string') {
    reporterEmail = body.reporterEmail.toLowerCase().trim();
  }

  if (!reporterEmail || !isReporterEmailValid(reporterEmail)) {
    return NextResponse.json(
      { error: 'Informe um e-mail válido para contato sobre este relatório.' },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown';
  const rateKey = `bug-report:${reporterEmail}:${ip}`;
  const limit = checkRateLimit(rateKey, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Aguarde ${limit.retryAfterSec ?? 60}s antes de enviar outro relatório.`,
      },
      { status: 429 },
    );
  }

  const pageUrl =
    typeof body.pageUrl === 'string' && body.pageUrl.trim()
      ? body.pageUrl.trim().slice(0, 2048)
      : null;
  const userAgent =
    req.headers.get('user-agent')?.trim() ||
    (typeof body.userAgent === 'string' ? body.userAgent.trim().slice(0, 512) : null);

  const sessionContext: BugReportSessionContext = {
    googleSubPresent: Boolean(session?.googleSub),
    sessionName: session?.user?.name ?? null,
  };

  if (session?.googleSub && reporterEmail) {
    try {
      const access = await getGoogleAccessFromDb(session.googleSub, reporterEmail);
      sessionContext.accessVerified = access.accessVerified;
    } catch (err) {
      console.error('[bug-report] access check:', err);
    }
    try {
      sessionContext.onboardingCompleted = await hasCompletedOnboarding(reporterEmail);
    } catch (err) {
      console.error('[bug-report] onboarding check:', err);
    }
  }

  const createdAt = new Date().toISOString();

  let reportId: string;
  try {
    const inserted = await insertBugReport({
      reporterEmail,
      description,
      pageUrl,
      userAgent,
      sessionContext,
    });
    reportId = inserted.id;
  } catch (err) {
    console.error('[bug-report] insert:', err);
    const message =
      err instanceof Error ? err.message : 'Não foi possível registrar o relatório.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await sendBugReportEmailToOwner(getBugReportOwnerEmails(), {
      reportId,
      reporterEmail,
      description,
      pageUrl,
      userAgent,
      sessionContext,
      createdAt,
    });
  } catch (err) {
    console.error('[bug-report] email:', err);
    return NextResponse.json(
      {
        ok: true,
        id: reportId,
        warning: 'Relatório salvo, mas o e-mail ao responsável falhou.',
      },
      { status: 202 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: reportId,
    message: 'Obrigado! Seu relatório foi enviado.',
  });
}
