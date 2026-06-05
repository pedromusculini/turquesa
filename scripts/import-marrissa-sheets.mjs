/**
 * Importação one-off: planilha Marri Cílios → Turquesa Agenda (Drive + Supabase).
 *
 * Uso:
 *   node scripts/import-marrissa-sheets.mjs              # dry-run (padrão)
 *   node scripts/import-marrissa-sheets.mjs --write-drive
 *   node scripts/import-marrissa-sheets.mjs --write-supabase
 *
 * Guard: só marrissamartins@gmail.com
 */
import { createClient } from '@supabase/supabase-js';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Hardcoded — não alterar sem revisão explícita */
const TARGET_EMAIL = 'marrissamartins@gmail.com';

const CSV_SOURCES = [
  { key: 'pagina1', file: 'Marri Cílios - Página1.csv' },
  { key: 'clientes', file: 'Marri Cílios - Clientes.csv' },
  { key: 'procedimento', file: 'Marri Cílios - Procedimento.csv' },
  { key: 'movimento', file: 'Marri Cílios - Movimento.csv' },
  { key: 'caixa', file: 'Marri Cílios - Caixa.csv' },
  { key: 'resumo', file: 'Marri Cílios - RESUMO.csv' },
  { key: 'parametros', file: 'Marri Cílios - Parametros.csv' },
];

const IMPORT_DIR = join(ROOT, 'docs/local/marrissa-import');
const DEFAULT_DOWNLOADS = 'C:/Users/pedro/Downloads';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    dryRun: true,
    writeDrive: false,
    writeSupabase: false,
    copyOnly: false,
    ownerEmail: TARGET_EMAIL,
  };
  for (const arg of argv) {
    if (arg === '--write-drive') {
      flags.writeDrive = true;
      flags.dryRun = false;
    } else if (arg === '--write-supabase') {
      flags.writeSupabase = true;
      flags.dryRun = false;
    } else if (arg === '--copy-only') flags.copyOnly = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg.startsWith('--owner=')) {
      flags.ownerEmail = arg.slice('--owner='.length).trim().toLowerCase();
    }
  }
  return flags;
}

function assertTargetEmail(email) {
  if (email !== TARGET_EMAIL) {
    console.error(`❌ Guard: owner deve ser ${TARGET_EMAIL}, recebido: ${email}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function readCsvFile(path) {
  const buf = readFileSync(path);
  let text = buf.toString('utf8');
  if (text.includes('\ufffd')) {
    text = buf.toString('latin1');
  }
  return parseCsv(text);
}

function findHeaderRow(rows, matchers) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].join('|').toLowerCase();
    if (matchers.every((m) => joined.includes(m.toLowerCase()))) return i;
  }
  return -1;
}

function colIndex(headerRow, ...names) {
  const lower = headerRow.map((c) => String(c).trim().toLowerCase());
  for (const name of names) {
    const idx = lower.findIndex((h) => h.includes(name.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Prefer column whose header matches all tokens (handles "Valor da Entrada" vs "Valor da Saida"). */
function colIndexAll(headerRow, ...tokens) {
  const lower = headerRow.map((c) => String(c).replace(/\s+/g, ' ').trim().toLowerCase());
  return lower.findIndex((h) => tokens.every((t) => h.includes(t.toLowerCase())));
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function brPhoneLocalDigits(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 11) d = d.slice(2);
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1);
  if (d.length > 11) d = d.slice(-11);
  return d;
}

function phonesMatch(a, b) {
  const da = brPhoneLocalDigits(a);
  const db = brPhoneLocalDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10 && da.slice(-9) === db.slice(-9)) return true;
  return false;
}

function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoneyBR(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s.includes('-   ') || s === ' R$  -   ') return null;
  const cleaned = s
    .replace(/R\$\s?/gi, '')
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .replace(/^\(/, '-')
    .replace(/\)$/, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function parseDateBR(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseBirthday(raw) {
  const s = String(raw || '').trim();
  if (!s || !/\d/.test(s)) return null;
  const m = s.match(/^(\d{1,2})\/(\w+\.?)$/i);
  if (!m) return null;
  const months = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  };
  const mon = months[m[2].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  return `1904-${mon}-${String(m[1]).padStart(2, '0')}`;
}

function normalizeProfissional(name) {
  const n = String(name || '').trim();
  if (!n) return 'Marri';
  const lower = n.toLowerCase();
  if (lower === 'marri') return 'Marri';
  if (lower === 'kathia' || lower === 'káthia') return 'Kathia';
  if (lower === 'rani') return 'Rani';
  if (lower === 'tathiane') return 'Tathiane';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function mapFormaPagamento(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return { forma: null, parcelas: 1 };
  if (s === 'pix') return { forma: 'pix', parcelas: 1 };
  if (s === 'cdebito') return { forma: 'cartao_debito', parcelas: 1 };
  if (s === 'ccred av') return { forma: 'cartao_credito', parcelas: 1 };
  if (s === 'ccred parc') return { forma: 'cartao_credito', parcelas: 5 };
  if (s === 'dinheiro') return { forma: 'pix', parcelas: 1 };
  if (s === 'permuta') return { forma: 'permuta', parcelas: 1 };
  if (s === 'retorno combo') return { forma: null, parcelas: 1 };
  return { forma: 'pix', parcelas: 1 };
}

function classificarTipoAtendimento(procedimento, formaRaw) {
  const p = String(procedimento || '').toLowerCase();
  const f = String(formaRaw || '').toLowerCase();
  if (p.includes('retorno') || f.includes('retorno combo')) return 'retorno';
  return 'consulta';
}

function isFechamentoDespesa(desc) {
  const d = String(desc || '').trim().toLowerCase();
  return (
    d.startsWith('1 - recebimentos') ||
    d.startsWith('2 - custos') ||
    d.startsWith('3 - despesas') ||
    d.startsWith('4 - despesas') ||
    d.startsWith('5 - despesas') ||
    d === 'saldo' ||
    d === 'saldo inicial'
  );
}

// ---------------------------------------------------------------------------
// Copy CSVs
// ---------------------------------------------------------------------------

function copyCsvSources() {
  mkdirSync(IMPORT_DIR, { recursive: true });
  const sourceDir = process.env.MARRISSA_CSV_DIR || DEFAULT_DOWNLOADS;
  const copied = [];

  for (const { key, file } of CSV_SOURCES) {
    const src = join(sourceDir, file);
    const dest = join(IMPORT_DIR, file);
    if (!existsSync(src)) {
      if (existsSync(dest)) {
        copied.push({ key, path: dest, fromCache: true });
        continue;
      }
      throw new Error(`CSV não encontrado: ${src}`);
    }
    copyFileSync(src, dest);
    copied.push({ key, path: dest, fromCache: false });
  }
  return copied;
}

// ---------------------------------------------------------------------------
// Parse sheets
// ---------------------------------------------------------------------------

function parseClientes(rows) {
  const hdr = findHeaderRow(rows, ['codigo cliente', 'nome cliente']);
  if (hdr < 0) throw new Error('Header Clientes não encontrado');
  const h = rows[hdr];
  const ix = {
    codigo: colIndex(h, 'codigo cliente'),
    nome: colIndex(h, 'nome cliente'),
    celular: colIndex(h, 'celular'),
    aniversario: colIndex(h, 'anivers'),
    primeiro: colIndex(h, 'primeiro procedimento'),
    ultimo: colIndex(h, 'ultimo procedimento'),
    indicacao: colIndex(h, 'indica'),
    endereco: colIndex(h, 'endere'),
    email: colIndex(h, 'e-mail'),
    obs: colIndex(h, 'observa'),
  };

  const records = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i];
    const codigo = String(r[ix.codigo] ?? '').trim();
    const nome = String(r[ix.nome] ?? '').trim();
    if (!nome || nome === 'Nome Cliente' || codigo === '9999') continue;
    if (normalizeName(nome).includes('mudanca de tabela')) continue;

    records.push({
      codigo,
      nome,
      celular: String(r[ix.celular] ?? '').trim() || null,
      aniversario: parseBirthday(r[ix.aniversario]),
      primeiro_procedimento: parseDateBR(r[ix.primeiro]) || null,
      ultimo_procedimento: parseDateBR(r[ix.ultimo]) || null,
      indicacao: String(r[ix.indicacao] ?? '').trim() || null,
      endereco: String(r[ix.endereco] ?? '').trim() || null,
      email: String(r[ix.email] ?? '').trim() || null,
      observacoes: String(r[ix.obs] ?? '').trim() || null,
    });
  }
  return records;
}

function parseProcedimentos(rows) {
  const hdr = findHeaderRow(rows, ['procedimento', 'valor']);
  if (hdr < 0) return [];
  const h = rows[hdr];
  const ixProc = colIndex(h, 'procedimento');
  const ixVal = colIndex(h, 'valor');
  const catalog = new Map();
  for (let i = hdr + 1; i < rows.length; i++) {
    const nome = String(rows[i][ixProc] ?? '').trim();
    if (!nome) continue;
    const valor = parseMoneyBR(rows[i][ixVal]);
    catalog.set(normalizeName(nome), { nome, valor });
  }
  return catalog;
}

function parseMovimento(rows, clientByCodigo) {
  const hdr = findHeaderRow(rows, ['data', 'procedimento', 'forma pagamento']);
  if (hdr < 0) throw new Error('Header Movimento não encontrado');
  const h = rows[hdr];
  const ix = {
    data: colIndex(h, 'data'),
    codigo: colIndex(h, 'cliente'),
    procedimento: colIndex(h, 'procedimento'),
    tempo: colIndex(h, 'tempo'),
    profissional: colIndex(h, 'profissional'),
    venda: colIndex(h, 'venda'),
    desconto: colIndex(h, 'desconto'),
    valorLiquido: colIndexAll(h, 'valor', 'líquido') >= 0
      ? colIndexAll(h, 'valor', 'líquido')
      : colIndexAll(h, 'valor', 'liquido'),
    forma: colIndex(h, 'forma pagamento'),
    obs: colIndex(h, 'observa'),
  };
  ix.nome = ix.codigo >= 0 ? ix.codigo + 1 : colIndex(h, 'cliente');
  ix.valorPago = ix.forma >= 0 ? ix.forma + 1 : -1;

  const sessions = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i];
    const data = parseDateBR(r[ix.data]);
    if (!data) continue;

    const codigo = String(r[ix.codigo] ?? '').trim();
    let nome = String(r[ix.nome] ?? '').trim();
    if (!nome && codigo && clientByCodigo.has(codigo)) {
      nome = clientByCodigo.get(codigo).nome;
    }
    if (!nome && !codigo) continue;

    const procedimento = String(r[ix.procedimento] ?? '').trim() || 'Sessão';
    const formaRaw = String(r[ix.forma] ?? '').trim();
    const valorPago = parseMoneyBR(r[ix.valorPago]);
    const valorLiquido = parseMoneyBR(r[ix.valorLiquido]);
    const venda = parseMoneyBR(r[ix.venda]);
    const valor = valorPago ?? valorLiquido ?? venda ?? 0;
    const { forma, parcelas } = mapFormaPagamento(formaRaw);
    const obsParts = [
      String(r[ix.obs] ?? '').trim(),
      ix.tempo >= 0 ? String(r[ix.tempo] ?? '').trim() : '',
    ].filter(Boolean);

    sessions.push({
      importKey: `mov:${i}`,
      data,
      codigo_cliente: codigo || null,
      nome_cliente: nome,
      procedimento,
      profissional: normalizeProfissional(r[ix.profissional]),
      valor,
      forma_pagamento: forma,
      parcelas,
      tipo: classificarTipoAtendimento(procedimento, formaRaw),
      observacao: obsParts.join(' · ') || null,
    });
  }
  return sessions;
}

function parseCaixa(rows) {
  const hdr = findHeaderRow(rows, ['data pagamento', 'despesa']);
  if (hdr < 0) throw new Error('Header Caixa não encontrado');
  const h = rows[hdr];
  const ix = {
    data: colIndex(h, 'data pagamento'),
    despesa: colIndex(h, 'despesa'),
    origem: colIndex(h, 'origem'),
    entrada: colIndexAll(h, 'valor', 'entrada'),
    saida: colIndexAll(h, 'valor', 'saida'),
    obs: colIndex(h, 'observa'),
  };
  if (ix.saida < 0) ix.saida = 6;

  const despesas = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i];
    const data = parseDateBR(r[ix.data]);
    const descricao = String(r[ix.despesa] ?? '').trim();
    if (!data || !descricao) continue;
    if (isFechamentoDespesa(descricao)) continue;

    const valorSaida = parseMoneyBR(r[ix.saida]);
    if (!valorSaida || valorSaida <= 0) continue;

    const origem = String(r[ix.origem] ?? '').trim() || 'Empresa';
    despesas.push({
      importKey: `caixa:${i}`,
      data,
      descricao,
      valor: valorSaida,
      categoria: origem.toLowerCase() === 'pessoal' ? 'pessoal' : 'empresa',
      observacao: String(r[ix.obs] ?? '').trim() || `[import:marrissa] Origem: ${origem}`,
    });
  }
  return despesas;
}

// ---------------------------------------------------------------------------
// Merge clients → clientes.json v2
// ---------------------------------------------------------------------------

function mergeClientes(rawClientes, sessions) {
  /** @type {Map<string, object>} */
  const byCodigo = new Map();
  /** @type {Map<string, string>} phone → codigo canônico */
  const phoneToCodigo = new Map();
  /** @type {Map<string, string>} normalized name → codigo */
  const nameToCodigo = new Map();

  function pickCanonical(a, b) {
    const score = (c) =>
      (c.celular ? 4 : 0) +
      (c.email ? 2 : 0) +
      (c.endereco ? 1 : 0) +
      (c.observacoes ? 1 : 0) +
      (c.aniversario ? 1 : 0);
    return score(a) >= score(b) ? a : b;
  }

  function register(rec) {
    const codigo = rec.codigo || `auto-${normalizeName(rec.nome)}`;
    if (byCodigo.has(codigo)) {
      byCodigo.set(codigo, pickCanonical(byCodigo.get(codigo), { ...rec, codigo }));
    } else {
      byCodigo.set(codigo, { ...rec, codigo });
    }
    const canonical = byCodigo.get(codigo);
    const phone = brPhoneLocalDigits(rec.celular);
    if (phone) phoneToCodigo.set(phone, codigo);
    const nm = normalizeName(rec.nome);
    if (nm) nameToCodigo.set(nm, codigo);
  }

  for (const c of rawClientes) register(c);

  // Clientes só presentes no Movimento
  for (const s of sessions) {
    if (s.codigo_cliente && byCodigo.has(s.codigo_cliente)) continue;
    const phone = brPhoneLocalDigits(
      rawClientes.find((c) => c.codigo === s.codigo_cliente)?.celular,
    );
    let merged = false;
    if (phone && phoneToCodigo.has(phone)) {
      s.codigo_cliente = phoneToCodigo.get(phone);
      merged = true;
    } else {
      const nm = normalizeName(s.nome_cliente);
      if (nm && nameToCodigo.has(nm)) {
        s.codigo_cliente = nameToCodigo.get(nm);
        merged = true;
      }
    }
    if (!merged && s.codigo_cliente) {
      register({
        codigo: s.codigo_cliente,
        nome: s.nome_cliente,
        celular: null,
        aniversario: null,
        primeiro_procedimento: null,
        ultimo_procedimento: null,
        indicacao: null,
        endereco: null,
        email: null,
        observacoes: null,
      });
    } else if (!merged) {
      const autoCodigo = `mov-${normalizeName(s.nome_cliente).slice(0, 40)}`;
      if (!byCodigo.has(autoCodigo)) {
        register({
          codigo: autoCodigo,
          nome: s.nome_cliente,
          celular: null,
          aniversario: null,
          primeiro_procedimento: null,
          ultimo_procedimento: null,
          indicacao: null,
          endereco: null,
          email: null,
          observacoes: null,
        });
      }
      s.codigo_cliente = autoCodigo;
    }
  }

  const now = new Date().toISOString();
  /** @type {Map<string, object>} */
  const clientesMap = new Map();

  for (const [codigo, c] of byCodigo) {
    const id = randomUUID();
    const obsGerais = [
      c.observacoes,
      c.indicacao ? `Indicação: ${c.indicacao}` : null,
      c.endereco ? `Endereço: ${c.endereco}` : null,
      c.primeiro_procedimento ? `1º procedimento (planilha): ${c.primeiro_procedimento}` : null,
      c.ultimo_procedimento ? `Último procedimento (planilha): ${c.ultimo_procedimento}` : null,
      `[import:marrissa] codigo_planilha=${codigo}`,
    ]
      .filter(Boolean)
      .join('\n');

    clientesMap.set(codigo, {
      id,
      codigo_planilha: codigo,
      nome: c.nome,
      email: c.email,
      telefone: c.celular,
      cpf: null,
      data_nascimento: c.aniversario,
      convenio: null,
      observacoes_gerais: obsGerais || null,
      created_at: now,
      updated_at: now,
      atendimentos: [],
      observacoes: [],
      pagamentos: [],
    });
  }

  // Segunda passada: fundir duplicatas por telefone
  const phoneGroups = new Map();
  for (const [codigo, cliente] of clientesMap) {
    const p = brPhoneLocalDigits(cliente.telefone);
    if (!p) continue;
    if (!phoneGroups.has(p)) phoneGroups.set(p, []);
    phoneGroups.get(p).push(codigo);
  }

  let phoneMerged = 0;
  for (const [, codigos] of phoneGroups) {
    if (codigos.length < 2) continue;
    const primary = codigos[0];
    const primaryCliente = clientesMap.get(primary);
    for (let i = 1; i < codigos.length; i++) {
      const dup = clientesMap.get(codigos[i]);
      if (!dup) continue;
      primaryCliente.observacoes_gerais = [
        primaryCliente.observacoes_gerais,
        `Alias planilha ${codigos[i]}: ${dup.nome}`,
      ]
        .filter(Boolean)
        .join('\n');
      clientesMap.delete(codigos[i]);
      phoneMerged++;
    }
  }

  return { clientesMap, phoneMerged };
}

function attachSessionsToClientes(clientesMap, sessions) {
  const codigoToId = new Map();
  for (const [codigo, c] of clientesMap) codigoToId.set(codigo, c.id);

  let orphan = 0;
  for (const s of sessions) {
    const codigo = s.codigo_cliente;
    let cliente = codigo ? clientesMap.get(codigo) : null;
    if (!cliente) {
      for (const c of clientesMap.values()) {
        if (normalizeName(c.nome) === normalizeName(s.nome_cliente)) {
          cliente = c;
          break;
        }
      }
    }
    if (!cliente) {
      orphan++;
      continue;
    }

    const atendimentoId = randomUUID();
    const now = new Date().toISOString();
    cliente.atendimentos.push({
      id: atendimentoId,
      cliente_id: cliente.id,
      data: s.data,
      hora: null,
      tipo: s.tipo,
      medico: s.profissional,
      valor: s.valor > 0 ? s.valor : null,
      plano: null,
      status: 'realizado',
      observacoes: `[${s.procedimento}] ${s.observacao || ''}`.trim(),
      created_at: now,
    });

    if (s.valor > 0 && s.forma_pagamento) {
      cliente.pagamentos.push({
        id: randomUUID(),
        cliente_id: cliente.id,
        atendimento_id: atendimentoId,
        valor: s.valor,
        data: s.data,
        status: 'pago',
        forma_pagamento: s.forma_pagamento,
        observacao: `[import:marrissa:${s.importKey}] ${s.procedimento}${s.parcelas > 1 ? ` · ${s.parcelas}x` : ''}`,
        created_at: now,
      });
    }
    cliente.updated_at = now;
  }
  return orphan;
}

function buildFinanceiroEntradas(sessions) {
  return sessions
    .filter((s) => s.valor > 0)
    .map((s) => ({
      tipo: 'entrada',
      descricao: `${s.procedimento} — ${s.nome_cliente}`,
      data: s.data,
      valor: s.valor,
      valor_bruto: s.valor,
      categoria: 'consulta',
      medico: s.profissional,
      forma_pagamento: s.forma_pagamento,
      parcelas: s.parcelas,
      observacao: `[import:marrissa:${s.importKey}]`,
      owner_email: TARGET_EMAIL,
    }));
}

function buildFinanceiroSaidas(despesas) {
  return despesas.map((d) => ({
    tipo: 'saida',
    descricao: d.descricao,
    data: d.data,
    valor: d.valor,
    categoria: d.categoria,
    medico: null,
    observacao: d.observacao,
    owner_email: TARGET_EMAIL,
  }));
}

// ---------------------------------------------------------------------------
// Repasse (simplificado para import batch)
// ---------------------------------------------------------------------------

function defaultConfigPagamento() {
  return {
    pix: { tipo: 'fixo', valor_centavos: 0 },
    debito: { tipo: 'percentual', percentual: 1.69 },
    credito_1x: { tipo: 'percentual', percentual: 3.49 },
    credito_5x: { tipo: 'percentual', percentual: 17.36 },
  };
}

function metodoIdFromForma(forma, parcelas) {
  if (forma === 'pix' || forma === 'permuta') return forma === 'pix' ? 'pix' : null;
  if (forma === 'cartao_debito') return 'debito';
  if (forma === 'cartao_credito') {
    const p = Math.min(12, Math.max(1, parcelas || 1));
    return p === 5 ? 'credito_5x' : 'credito_1x';
  }
  return null;
}

function calcularTaxa(valorBruto, metodoId, config) {
  if (!metodoId || valorBruto <= 0) return 0;
  const m = config[metodoId];
  if (!m) return 0;
  if (m.tipo === 'fixo') return m.valor_centavos / 100;
  return (valorBruto * m.percentual) / 100;
}

function enrichEntrada(entrada, percentualMap) {
  const config = defaultConfigPagamento();
  const metodoId = metodoIdFromForma(entrada.forma_pagamento, entrada.parcelas);
  const taxa = calcularTaxa(entrada.valor_bruto, metodoId, config);
  const valorLiquido = entrada.valor_bruto - taxa;
  const pct =
    percentualMap.get(entrada.medico?.toLowerCase()) ??
    (entrada.medico === 'Marri' ? 100 : 50);
  const valorProfissional = (valorLiquido * pct) / 100;
  return {
    ...entrada,
    taxa_pagamento: taxa,
    valor_liquido: valorLiquido,
    percentual_profissional: pct,
    valor_profissional: valorProfissional,
    valor_salao: valorLiquido - valorProfissional,
    repassar_custo: false,
  };
}

// ---------------------------------------------------------------------------
// Google Drive write
// ---------------------------------------------------------------------------

async function refreshGoogleAccessToken() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      'Para --write-drive: GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET em .env.local',
    );
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Falha ao renovar token Google');
  }
  return data.access_token;
}

async function writeClientesToDrive(accessToken, store) {
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const folderQuery = encodeURIComponent(
    "name='MedSupApp' and mimeType='application/vnd.google-apps.folder' and trashed=false",
  );
  const folderRes = await fetch(`${DRIVE}/files?q=${folderQuery}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const folderData = await folderRes.json();
  let folderId = folderData.files?.[0]?.id;
  if (!folderId) {
    const create = await fetch(`${DRIVE}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'MedSupApp',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    folderId = (await create.json()).id;
  }

  const fileName = 'clientes.json';
  const fileQuery = encodeURIComponent(
    `name='${fileName}' and '${folderId}' in parents and trashed=false`,
  );
  const fileRes = await fetch(`${DRIVE}/files?q=${fileQuery}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const fileData = await fileRes.json();
  const existing = fileData.files?.[0];
  const json = JSON.stringify(store, null, 2);

  if (existing) {
    const up = await fetch(`${UPLOAD}/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: json,
    });
    if (!up.ok) throw new Error('Erro ao atualizar clientes.json no Drive');
  } else {
    const boundary = `imp_${Date.now()}`;
    const meta = { name: fileName, parents: [folderId], mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${json}\r\n--${boundary}--`;
    const cr = await fetch(`${UPLOAD}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!cr.ok) throw new Error('Erro ao criar clientes.json no Drive');
  }
}

// ---------------------------------------------------------------------------
// Supabase write
// ---------------------------------------------------------------------------

async function loadPercentuais(supabase, ownerEmail) {
  const map = new Map();
  const { data: medicos } = await supabase
    .from('clinica_medicos')
    .select('nome, percentual_comissao')
    .eq('clinica_email', ownerEmail);
  for (const m of medicos ?? []) {
    if (m.nome) map.set(m.nome.trim().toLowerCase(), Number(m.percentual_comissao ?? 50));
  }
  const { data: profile } = await supabase
    .from('onboarding_profiles')
    .select('full_name')
    .eq('email', ownerEmail)
    .maybeSingle();
  if (profile?.full_name) map.set(profile.full_name.trim().toLowerCase(), 100);
  map.set('marri', 100);
  return map;
}

async function writeSupabaseBatch(supabase, entradas, saidas, dryRun) {
  if (dryRun) return { entradas: entradas.length, saidas: saidas.length };

  const batchSize = 100;
  let insertedEntradas = 0;
  let insertedSaidas = 0;

  for (let i = 0; i < entradas.length; i += batchSize) {
    const chunk = entradas.slice(i, i + batchSize);
    const { error } = await supabase.from('financeiro_transacoes').insert(chunk);
    if (error) throw error;
    insertedEntradas += chunk.length;
  }
  for (let i = 0; i < saidas.length; i += batchSize) {
    const chunk = saidas.slice(i, i + batchSize);
    const { error } = await supabase.from('financeiro_transacoes').insert(chunk);
    if (error) throw error;
    insertedSaidas += chunk.length;
  }
  return { entradas: insertedEntradas, saidas: insertedSaidas };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  assertTargetEmail(flags.ownerEmail);
  loadEnvLocal();

  console.log(`\n📋 Import Marrissa → Turquesa (${flags.dryRun ? 'DRY-RUN' : 'WRITE'})`);
  console.log(`   owner: ${flags.ownerEmail}\n`);

  const copied = copyCsvSources();
  console.log('📁 CSVs em docs/local/marrissa-import/:');
  for (const c of copied) {
    console.log(`   ${c.key}: ${c.path}${c.fromCache ? ' (cache)' : ''}`);
  }

  if (flags.copyOnly) {
    console.log('\n✅ --copy-only: CSVs copiados.');
    return;
  }

  const csv = {};
  for (const { key, file } of CSV_SOURCES) {
    csv[key] = readCsvFile(join(IMPORT_DIR, file));
  }

  const rawClientes = parseClientes(csv.clientes);
  const procedimentos = parseProcedimentos(csv.procedimento);
  const clientByCodigo = new Map(rawClientes.map((c) => [c.codigo, c]));
  const sessions = parseMovimento(csv.movimento, clientByCodigo);
  const despesas = parseCaixa(csv.caixa);

  const { clientesMap, phoneMerged } = mergeClientes(rawClientes, sessions);
  const orphanSessions = attachSessionsToClientes(clientesMap, sessions);

  const clientes = [...clientesMap.values()];
  const store = {
    version: 2,
    owner_email: flags.ownerEmail,
    atualizado_em: new Date().toISOString(),
    clientes,
  };

  const entradasRaw = buildFinanceiroEntradas(sessions);
  const saidasRaw = buildFinanceiroSaidas(despesas);

  let percentualMap = new Map([['marri', 100], ['kathia', 50], ['rani', 50]]);
  if (flags.writeSupabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessários');
    }
    const supabase = createClient(url, key);
    percentualMap = await loadPercentuais(supabase, flags.ownerEmail);
  }

  const entradas = entradasRaw.map((e) => enrichEntrada(e, percentualMap));

  const stats = {
    clientes_planilha: rawClientes.length,
    clientes_merged: clientes.length,
    phone_merged: phoneMerged,
    procedimentos_catalogo: procedimentos.size,
    sessoes_movimento: sessions.length,
    sessoes_orfas: orphanSessions,
    sessoes_com_valor: sessions.filter((s) => s.valor > 0).length,
    atendimentos_drive: clientes.reduce((n, c) => n + c.atendimentos.length, 0),
    pagamentos_drive: clientes.reduce((n, c) => n + c.pagamentos.length, 0),
    entradas_financeiro: entradas.length,
    saidas_financeiro: saidasRaw.length,
    valor_entradas: entradas.reduce((s, e) => s + e.valor, 0),
    valor_saidas: saidasRaw.reduce((s, d) => s + d.valor, 0),
  };

  const previewPath = join(IMPORT_DIR, 'import-preview.json');
  writeFileSync(
    previewPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        dry_run: flags.dryRun,
        stats,
        sample_clientes: clientes.slice(0, 3),
        sample_entradas: entradas.slice(0, 5),
        sample_saidas: saidasRaw.slice(0, 5),
      },
      null,
      2,
    ),
  );

  console.log('\n📊 Resumo:');
  console.log(`   Clientes (planilha / merged): ${stats.clientes_planilha} → ${stats.clientes_merged}`);
  console.log(`   Duplicatas fundidas por telefone: ${stats.phone_merged}`);
  console.log(`   Catálogo procedimentos: ${stats.procedimentos_catalogo}`);
  console.log(`   Sessões Movimento: ${stats.sessoes_movimento} (${stats.sessoes_com_valor} com valor > 0)`);
  console.log(`   → atendimentos Drive: ${stats.atendimentos_drive}, pagamentos: ${stats.pagamentos_drive}`);
  console.log(`   Entradas financeiro: ${stats.entradas_financeiro} (R$ ${stats.valor_entradas.toFixed(2)})`);
  console.log(`   Saídas financeiro: ${stats.saidas_financeiro} (R$ ${stats.valor_saidas.toFixed(2)})`);
  if (stats.sessoes_orfas) console.log(`   ⚠ Sessões sem cliente: ${stats.sessoes_orfas}`);
  console.log(`\n   Preview: ${previewPath}`);

  if (flags.dryRun) {
    console.log('\n✅ Dry-run concluído. Nenhum dado escrito.');
    console.log('   Próximo passo: --write-drive e/ou --write-supabase após Marrissa conectar Drive.');
    return;
  }

  if (flags.writeDrive) {
    console.log('\n☁️  Escrevendo clientes.json no Drive…');
    const token = await refreshGoogleAccessToken();
    await writeClientesToDrive(token, store);
    console.log(`   ✅ ${clientes.length} clientes, ${stats.atendimentos_drive} atendimentos`);
  }

  if (flags.writeSupabase) {
    console.log('\n🗄️  Escrevendo financeiro_transacoes…');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(url, key);
    const result = await writeSupabaseBatch(supabase, entradas, saidasRaw, false);
    console.log(`   ✅ ${result.entradas} entradas, ${result.saidas} saídas`);
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
