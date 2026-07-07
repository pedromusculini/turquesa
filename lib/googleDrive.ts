/**
 * Helper para salvar e carregar dados no Google Drive do usuário (LGPD).
 * Usa o escopo drive.file - acesso somente a arquivos criados pelo app.
 *
 * Estrutura no Drive:
 *   MedSupApp/
 *     clientes.json              -> cadastro ativo (atualizado automaticamente)
 *     clientes_backup_*_auto.json -> snapshots automáticos (a cada ~6h ao salvar)
 *     clientes_backup_*_{motivo}.json -> snapshots antes de operações sensíveis
 *     faturamento.json              -> espelho financeiro (atualizado automaticamente)
 *     faturamento_backup_*_auto.json -> snapshots automáticos do financeiro (~6h)
 *     agenda_snapshot_YYYY-MM-DD.json -> snapshot diário da agenda (1x/dia)
 *     backup_YYYY-MM-DD.csv      -> export manual na página Backup
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

const APP_FOLDER_NAME = 'MedSupApp';

interface Paciente {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  ultima_consulta?: string;
  observacoes?: string;
}

/**
 * Encontra ou cria a pasta "MedSupApp" no Google Drive do usuário.
 */
async function encontrarOuCriarPasta(accessToken: string): Promise<string> {
  // Buscar pasta existente
  const query = encodeURIComponent(
    `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) throw new Error('Erro ao buscar pasta MedSupApp no Drive');

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Criar pasta
  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) throw new Error('Erro ao criar pasta MedSupApp no Drive');

  const folder = await createRes.json();
  return folder.id;
}

/**
 * Salva um arquivo na pasta MedSupApp do Google Drive.
 * Se já existir, atualiza; senão, cria.
 */
export async function salvarArquivoNoDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/csv;charset=utf-8',
): Promise<string> {
  const folderId = await encontrarOuCriarPasta(accessToken);

  // Buscar arquivo existente
  const query = encodeURIComponent(
    `name='${fileName}' and '${folderId}' in parents and trashed=false`,
  );
  const searchRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const searchData = await searchRes.json();
  const existingFile = searchData.files?.[0];

  if (existingFile) {
    // Atualizar arquivo existente
    const updateRes = await fetch(
      `${UPLOAD_URL}/${existingFile.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mimeType,
        },
        body: content,
      },
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err?.error?.message || 'Erro ao atualizar arquivo no Drive');
    }

    return existingFile.id;
  } else {
    // Criar novo arquivo como multipart
    const boundary = 'medsupapp_boundary_' + Date.now();
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType,
    };

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      `\r\n--${boundary}--`;

    const createRes = await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err?.error?.message || 'Erro ao criar arquivo no Drive');
    }

    const file = await createRes.json();
    return file.id;
  }
}

/**
 * Salva dados de pacientes (JSON) no Google Drive.
 */
export async function salvarPacientesNoDrive(
  accessToken: string,
  pacientes: Paciente[],
): Promise<string> {
  const json = JSON.stringify(
    {
      version: 1,
      exportado_em: new Date().toISOString(),
      pacientes,
    },
    null,
    2,
  );
  return salvarArquivoNoDrive(
    accessToken,
    'pacientes.json',
    json,
    'application/json',
  );
}

/**
 * Salva dados financeiros agregados (JSON) no Google Drive.
 */
export async function salvarFinancasNoDrive(
  accessToken: string,
  financas: any,
): Promise<string> {
  const json = JSON.stringify(
    {
      version: 1,
      exportado_em: new Date().toISOString(),
      ...financas,
    },
    null,
    2,
  );
  return salvarArquivoNoDrive(
    accessToken,
    'financas.json',
    json,
    'application/json',
  );
}

/**
 * Salva backup CSV no Google Drive.
 */
export async function salvarBackupCsvNoDrive(
  accessToken: string,
  csvContent: string,
): Promise<string> {
  const dataHoje = new Date().toISOString().slice(0, 10);
  return salvarArquivoNoDrive(
    accessToken,
    `backup_${dataHoje}.csv`,
    csvContent,
    'text/csv;charset=utf-8',
  );
}

/**
 * Lista arquivos de backup na pasta MedSupApp.
 */
export async function listarBackupsDoDrive(accessToken: string) {
  const folderId = await encontrarOuCriarPasta(accessToken);
  const query = encodeURIComponent(
    `'${folderId}' in parents and mimeType='text/csv' and trashed=false`,
  );
  const res = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,size,createdTime)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) throw new Error('Erro ao listar backups do Drive');

  return res.json();
}

export type DriveFileMeta = {
  id: string;
  name: string;
  size?: string;
  mimeType?: string;
  createdTime?: string;
};

/** Lista arquivos na pasta MedSupApp (opcionalmente filtrados por prefixo do nome). */
export async function listarArquivosMedSupApp(
  accessToken: string,
  options?: { namePrefix?: string; mimeTypes?: string[] },
): Promise<DriveFileMeta[]> {
  const folderId = await encontrarOuCriarPasta(accessToken);
  const mimeClause =
    options?.mimeTypes?.length
      ? `(${options.mimeTypes.map((m) => `mimeType='${m}'`).join(' or ')})`
      : `(mimeType='text/csv' or mimeType='application/json' or mimeType='application/json;charset=utf-8')`;
  const query = encodeURIComponent(
    `'${folderId}' in parents and ${mimeClause} and trashed=false`,
  );
  const res = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&orderBy=createdTime desc&pageSize=200&fields=files(id,name,size,mimeType,createdTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error('Erro ao listar arquivos do Drive');
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  let files = data.files ?? [];
  if (options?.namePrefix) {
    files = files.filter((f) => f.name.startsWith(options.namePrefix!));
  }
  return files;
}

/** Remove um arquivo do Drive (ignora 404). */
export async function deletarArquivoDoDrive(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ||
        'Erro ao deletar arquivo no Drive',
    );
  }
}

/**
 * Faz download do conteúdo de um arquivo do Google Drive.
 */
export async function baixarArquivoDoDrive(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const res = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) throw new Error('Erro ao baixar arquivo do Drive');

  return res.text();
}