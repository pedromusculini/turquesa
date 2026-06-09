import { supabaseAdmin } from '@/lib/supabaseClient';
import { getInternalProductId } from '@/lib/internalProduct';
import { parseAdminEmails } from '@/lib/internalAdmin';
import { SUPPORT_EMAIL } from '@/lib/legal';

export type BugReportSessionContext = {
  accessVerified?: boolean | null;
  onboardingCompleted?: boolean | null;
  googleSubPresent?: boolean;
  sessionName?: string | null;
};

export type BugReportInsert = {
  reporterEmail: string;
  description: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  sessionContext?: BugReportSessionContext;
};

export function getBugReportOwnerEmails(): string[] {
  const admins = parseAdminEmails();
  if (admins.length > 0) return admins;
  return [SUPPORT_EMAIL.toLowerCase()];
}

export function isReporterEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function insertBugReport(params: BugReportInsert): Promise<{ id: string }> {
  const reporterEmail = params.reporterEmail.toLowerCase().trim();
  const description = params.description.trim();

  const { data, error } = await supabaseAdmin
    .from('bug_reports')
    .insert({
      reporter_email: reporterEmail,
      description,
      page_url: params.pageUrl?.trim() || null,
      user_agent: params.userAgent?.trim() || null,
      session_context: params.sessionContext ?? {},
      product_id: getInternalProductId(),
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error('Tabela bug_reports não encontrada. Execute npm run db:bug-reports.');
    }
    throw error;
  }

  return { id: data.id as string };
}
