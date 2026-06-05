/**
 * Testa POST do webhook Asaas em produção (www.turquesaagenda.com.br).
 * Uso: node scripts/test-webhook-production.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnv();
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  const email = process.env.ADMIN_EMAILS?.split(/[,;]/)[0]?.trim();
  if (!token) throw new Error('ASAAS_WEBHOOK_TOKEN ausente em .env.local');
  if (!email) throw new Error('ADMIN_EMAILS ausente em .env.local');

  const url = 'https://www.turquesaagenda.com.br/api/webhooks/asaas';
  const eventId = `evt_prod_test_${Date.now()}`;
  const payload = {
    id: eventId,
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: `pay_prod_test_${Date.now()}`,
      billingType: 'PIX',
      dueDate: '2026-07-01',
      externalReference: email,
      subscription: 'sub_test_prod',
      customer: 'cus_test_prod',
    },
  };

  console.log('1) GET', url);
  const getRes = await fetch(url);
  console.log('   ', getRes.status, (await getRes.text()).slice(0, 80));

  console.log('\n2) POST com token (simula Asaas)');
  const postRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': token,
    },
    body: JSON.stringify(payload),
  });
  const postBody = await postRes.text();
  console.log('   ', postRes.status, postBody);

  if (postRes.status === 401) {
    console.log('\n❌ Token rejeitado. Confira ASAAS_WEBHOOK_TOKEN na Vercel = painel Asaas produção.');
    process.exit(1);
  }
  if (!postRes.ok) {
    console.log('\n❌ Webhook falhou. Verifique redeploy na Vercel após salvar variáveis.');
    process.exit(1);
  }

  console.log('\n3) Supabase — assinatura e último evento');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data: sub } = await sb
    .from('assinaturas')
    .select('status, plano, current_period_end, last_payment_at, first_payment_at')
    .eq('owner_email', email)
    .maybeSingle();
  console.log('   assinaturas:', sub);

  const { data: ev } = await sb
    .from('assinaturas_webhook_events')
    .select('event_type, asaas_event_id, processed_at')
    .eq('asaas_event_id', eventId)
    .maybeSingle();
  console.log('   evento gravado:', ev ? 'sim' : 'não', ev ?? '');

  console.log('\n✅ Teste produção OK se POST=200 e evento gravado.');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
