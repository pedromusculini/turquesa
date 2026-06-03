import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/** Obtém o token de acesso ao Google Drive do cookie incremental ou da sessão */
async function getDriveToken(req: NextRequest): Promise<string | null> {
  const cookieToken = req.cookies.get('google_drive_token')?.value;
  if (cookieToken) return cookieToken;

  const session = await auth();
  const sessionToken = (session as any)?.accessToken;
  if (sessionToken) return sessionToken;

  return null;
}

// POST: Salvar dados no Google Drive (pacientes, finanças, backup CSV)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const googleToken = await getDriveToken(req);
    if (!googleToken) {
      return NextResponse.json(
        { error: 'Permissão do Google Drive não concedida. Clique em "Conectar Google Drive" para autorizar.' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { action, data } = body;

    if (!action || !data) {
      return NextResponse.json(
        { error: 'Parâmetros action e data são obrigatórios' },
        { status: 400 },
      );
    }

    const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
    const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
    const FOLDER_NAME = 'MedSupApp';

    // Helper: encontrar ou criar pasta
    async function getFolderId(): Promise<string> {
      const q = encodeURIComponent(
        `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      );
      const res = await fetch(
        `${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${googleToken}` } },
      );
      const d = await res.json();
      if (d.files?.length) return d.files[0].id;

      const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });
      const folder = await createRes.json();
      return folder.id;
    }

    // Helper: upsert arquivo
    async function upsertFile(
      folderId: string,
      fileName: string,
      content: string,
      mimeType: string,
    ): Promise<string> {
      // Buscar existente
      const q = encodeURIComponent(
        `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      );
      const searchRes = await fetch(
        `${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${googleToken}` } },
      );
      const s = await searchRes.json();
      const existing = s.files?.[0];

      if (existing) {
        // Update
        await fetch(`${UPLOAD_URL}/${existing.id}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': mimeType,
          },
          body: content,
        });
        return existing.id;
      }

      // Criar
      const boundary = 'medsup_' + Date.now();
      const metadata = { name: fileName, parents: [folderId], mimeType };
      const multipart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n` +
        content +
        `\r\n--${boundary}--`;

      const createRes = await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      });
      const file = await createRes.json();
      return file.id;
    }

    const folderId = await getFolderId();
    let fileId: string;

    if (action === 'backup-csv') {
      // data.content é o CSV
      const hoje = new Date().toISOString().slice(0, 10);
      fileId = await upsertFile(
        folderId,
        `backup_${hoje}.csv`,
        data.content,
        'text/csv;charset=utf-8',
      );

      // Também salvar pacientes.json e financas.json se fornecidos
      if (data.pacientesJson) {
        await upsertFile(
          folderId,
          'pacientes.json',
          data.pacientesJson,
          'application/json',
        );
      }
      if (data.financasJson) {
        await upsertFile(
          folderId,
          'financas.json',
          data.financasJson,
          'application/json',
        );
      }
    } else if (action === 'pacientes') {
      const json = JSON.stringify(
        { version: 1, exportado_em: new Date().toISOString(), pacientes: data },
        null,
        2,
      );
      fileId = await upsertFile(folderId, 'pacientes.json', json, 'application/json');
    } else if (action === 'financas') {
      const json = JSON.stringify(
        { version: 1, exportado_em: new Date().toISOString(), ...data },
        null,
        2,
      );
      fileId = await upsertFile(folderId, 'financas.json', json, 'application/json');
    } else {
      return NextResponse.json(
        { error: 'Ação inválida. Use: backup-csv, pacientes ou financas' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Arquivo salvo com sucesso no Google Drive',
      fileId,
    });
  } catch (error: any) {
    console.error('[google-drive/POST] Erro:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// GET: Listar arquivos de backup no Google Drive
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const googleToken = await getDriveToken(req);
    if (!googleToken) {
      return NextResponse.json(
        { error: 'Permissão do Google Drive não concedida.' },
        { status: 403 },
      );
    }

    const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
    const FOLDER_NAME = 'MedSupApp';

    // Encontrar pasta
    const qFolder = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const folderRes = await fetch(
      `${DRIVE_API_BASE}/files?q=${qFolder}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${googleToken}` } },
    );
    const fData = await folderRes.json();
    const folderId = fData.files?.[0]?.id;

    if (!folderId) {
      return NextResponse.json({ files: [] });
    }

    // Listar arquivos
    const q = encodeURIComponent(
      `'${folderId}' in parents and (mimeType='text/csv' or mimeType='application/json') and trashed=false`,
    );
    const res = await fetch(
      `${DRIVE_API_BASE}/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,size,mimeType,createdTime)`,
      { headers: { Authorization: `Bearer ${googleToken}` } },
    );

    const data = await res.json();
    return NextResponse.json({ files: data.files || [] });
  } catch (error: any) {
    console.error('[google-drive/GET] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE: Remover arquivo do Google Drive
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const googleToken = await getDriveToken(req);
    if (!googleToken) {
      return NextResponse.json(
        { error: 'Permissão do Google Drive não concedida.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');
    if (!fileId) {
      return NextResponse.json({ error: 'fileId obrigatório' }, { status: 400 });
    }

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${googleToken}` },
      },
    );

    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error?.message || 'Erro ao deletar arquivo' },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[google-drive/DELETE] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}