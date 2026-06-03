/**
 * Helper para salvar e carregar dados no Google Drive do usuário (LGPD).
 * Usa o escopo drive.file - acesso somente a arquivos criados pelo app.
 *
 * Estrutura no Drive:
 *   MedSupApp/
 *     pacientes.json  -> lista de pacientes
 *     financas.json   -> dados financeiros agregados
 *     backup_YYYY-MM-DD.csv -> backups periódicos
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