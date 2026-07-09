import {
  getOwnerGoogleAccessToken,
  getOwnerGoogleRow,
  type OwnerGoogleScope,
} from '@/lib/ownerGoogleTokens';

export type GoogleScopeHealth = {
  declared: boolean;
  tokenOk: boolean;
  apiOk: boolean;
  error?: string;
};

export type GoogleConnectionHealth = {
  connected: boolean;
  needsConnect: boolean;
  needsReconnect: boolean;
  healthy: boolean;
  drive: GoogleScopeHealth;
  calendar: GoogleScopeHealth;
  contacts: GoogleScopeHealth;
  summary: string;
};

function revokedMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/expired|revoked|invalid_grant/i.test(msg)) {
    return 'Conexão Google expirada ou revogada. Reconecte sua conta.';
  }
  return msg || 'Erro ao verificar Google';
}

async function pingDrive(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const query = encodeURIComponent(
    "name='MedSupApp' and mimeType='application/vnd.google-apps.folder' and trashed=false",
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: 'Token do Drive expirado ou revogado' };
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err?.error?.message || 'Erro ao acessar Google Drive' };
  }
  return { ok: true };
}

async function pingCalendar(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: 'Token do Calendar expirado ou revogado' };
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err?.error?.message || 'Erro ao acessar Google Calendar' };
  }
  return { ok: true };
}

async function checkScope(
  googleSub: string,
  scope: OwnerGoogleScope,
): Promise<GoogleScopeHealth> {
  const row = await getOwnerGoogleRow(googleSub);
  const declared = !!row?.scopes[scope];
  if (!declared || !row?.refresh_token_encrypted) {
    return {
      declared,
      tokenOk: false,
      apiOk: false,
      error: declared ? 'Token ausente' : 'Permissão não concedida',
    };
  }

  try {
    const token = await getOwnerGoogleAccessToken(googleSub, scope);
    if (!token) {
      return {
        declared,
        tokenOk: false,
        apiOk: false,
        error: 'Não foi possível renovar o acesso Google',
      };
    }

    if (scope === 'contacts') {
      return { declared, tokenOk: true, apiOk: true };
    }

    const ping =
      scope === 'drive' ? await pingDrive(token) : await pingCalendar(token);
    return {
      declared,
      tokenOk: true,
      apiOk: ping.ok,
      error: ping.error,
    };
  } catch (err) {
    return {
      declared,
      tokenOk: false,
      apiOk: false,
      error: revokedMessage(err),
    };
  }
}

function buildSummary(
  drive: GoogleScopeHealth,
  calendar: GoogleScopeHealth,
  needsConnect: boolean,
): string {
  if (needsConnect) {
    return 'Conecte sua conta Google para usar o Turquesa Agenda. Sem Google, clientes, agenda e financeiro não funcionam.';
  }
  const issues: string[] = [];
  if (drive.declared && !drive.apiOk) {
    issues.push(drive.error || 'Google Drive indisponível');
  }
  if (calendar.declared && !calendar.apiOk) {
    issues.push(calendar.error || 'Google Calendar indisponível');
  }
  if (!drive.declared) issues.push('Permissão do Drive não concedida');
  if (!calendar.declared) issues.push('Permissão do Calendar não concedida');
  if (issues.length === 0) {
    return 'Google conectado e funcionando.';
  }
  return issues.join(' · ');
}

/** Verifica se os tokens Google realmente funcionam (não só flags no banco). */
export async function verifyGoogleConnectionHealth(
  googleSub: string,
): Promise<GoogleConnectionHealth> {
  const row = await getOwnerGoogleRow(googleSub);
  const connected = !!row?.refresh_token_encrypted;
  const needsConnect = !connected;

  const [drive, calendar, contacts] = await Promise.all([
    checkScope(googleSub, 'drive'),
    checkScope(googleSub, 'calendar'),
    checkScope(googleSub, 'contacts'),
  ]);

  const coreOk = drive.apiOk && calendar.apiOk;
  const needsReconnect =
    connected &&
    (!drive.tokenOk ||
      !calendar.tokenOk ||
      !drive.apiOk ||
      !calendar.apiOk ||
      !drive.declared ||
      !calendar.declared);

  const healthy = !needsConnect && coreOk;

  return {
    connected,
    needsConnect,
    needsReconnect,
    healthy,
    drive,
    calendar,
    contacts,
    summary: buildSummary(drive, calendar, needsConnect),
  };
}
