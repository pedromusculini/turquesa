# Validação Asaas — Sandbox (passo a passo)

Guia prático para homologar o modelo Turquesa Agenda **antes** de codar webhooks no app.

**Modelo a validar:** 30 dias de trial no app → primeira cobrança Asaas no **dia 30** (`nextDueDate`) → acesso `active` só após `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` → `PAYMENT_OVERDUE` = bloqueio (0 tolerância).

Documentação oficial: [Sandbox Asaas](https://docs.asaas.com/docs/sandbox-3) · [Assinaturas](https://docs.asaas.com/docs/criando-uma-assinatura) · [Webhooks](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint)

---

## 1. Criar conta Sandbox

1. Acesse **https://sandbox.asaas.com/** (conta **separada** da produção).
2. Complete o cadastro (no sandbox a conta costuma ser aprovada automaticamente com dados válidos).
3. Gere a **Chave de API** (veja seção abaixo — **não** é o Flapp).
4. A chave começa com `$aact_hmlg_` (sandbox). **Nunca** commite no Git.

### Flapp ≠ Integrações (API)

| O que você vê | Para que serve |
|---------------|----------------|
| **Flapp Store** / **Flapp** | Loja de apps parceiros (ERP, loja virtual, etc.). **Não** gera chave de API do MedSup. |
| **Integrações** | Área da **sua** integração via API: chave de API, webhooks, tokens. |

Se só aparece **Flapp**, você está no menu errado (canto superior direito → loja de parceiros).

### Onde achar **Integrações** e a chave de API

Caminho mais comum (interface web atual):

1. Logado em **https://sandbox.asaas.com/**
2. Canto **superior direito** → ícone de **perfil** / **avatar** (não o ícone da loja Flapp)
3. No menu que abre, procure **Integrações** (às vezes **Integração**, no singular)
4. Dentro: **Chaves de API** → **Gerar nova chave de API**
5. Copie a chave **na hora** — ela não aparece de novo depois de fechar/atualizar

Caminhos alternativos (layout antigo ou conta PF):

- **Minha conta** → **Integração** → **Gerar API Key** ([página desenvolvedores](https://www.asaas.com/desenvolvedores))
- Menu lateral esquerdo, se existir item **Integrações** (só para usuário **administrador**)

### Não aparece “Integrações”?

Causas frequentes ([FAQ Asaas](https://docs.asaas.com/docs/autenticação)):

1. **Usuário não é administrador** — só admin vê Integrações. Crie a conta sandbox você mesmo como titular ou peça perfil admin.
2. **Cadastro incompleto** — finalize dados comerciais/obrigatórios no sandbox e recarregue a página (F5).
3. **App mobile** — chave **não** é gerada pelo app; use o **navegador** no PC.
4. **Conta produção** — confira a URL: deve ser `sandbox.asaas.com`, não `www.asaas.com`.

Se ainda não achar: e-mail **integracoes@asaas.com.br** (assunto: “sandbox — não encontro menu Integrações / chave API”).

**Webhooks** ficam na **mesma** área **Integrações** (aba ou botão **Webhooks**), não no Flapp.

Guarde no `.env.local` (só local, por enquanto):

```env
ASAAS_API_KEY=$aact_hmlg_xxxxxxxx
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=<token que você definir no passo 6>
```

**Regra de ouro:** chave sandbox + URL `api-sandbox.asaas.com`. Misturar com produção dá erro `invalid_environment`.

---

## 2. Ferramenta para chamar a API

### Opção recomendada — script local (sem documentação Asaas)

Com a chave só no `.env.local` (nunca no Git):

```bash
npm run asaas:test              # testa autenticação + saldo
npm run asaas:test:setup        # cria cliente + assinatura trial +30 dias
```

Outras opções:

- **Insomnia / Postman** — coleção Asaas
- **curl** no terminal (exemplos abaixo)
- Documentação interativa: [Referência API](https://docs.asaas.com/reference) (às vezes só aceita chave sandbox colada manualmente)

Header obrigatório em todas as requisições:

```http
access_token: $aact_hmlg_SUA_CHAVE
Content-Type: application/json
```

---

## 3. Criar cliente de teste

Simula o médico/clínica (`owner_email` no futuro = `externalReference`).

```bash
curl -X POST "https://api-sandbox.asaas.com/v3/customers" \
  -H "access_token: $ASAAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Teste MedSup",
    "email": "seu-email-de-teste@gmail.com",
    "cpfCnpj": "24971563792",
    "mobilePhone": "47999999999",
    "externalReference": "seu-email-de-teste@gmail.com"
  }'
```

Anote o `id` retornado (ex.: `cus_xxxxxxxx`).

> CPF/CNPJ e telefone podem ser fictícios no sandbox; use um e-mail que você controla.

---

## 4. Criar assinatura — trial 30 dias (cenário real MedSup)

A **primeira cobrança** deve cair no fim do trial. Use `nextDueDate` = hoje + 30 dias.

Substitua `cus_xxx`, valor e data:

```bash
curl -X POST "https://api-sandbox.asaas.com/v3/subscriptions" \
  -H "access_token: $ASAAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "cus_xxxxxxxx",
    "billingType": "UNDEFINED",
    "value": 119.00,
    "cycle": "MONTHLY",
    "nextDueDate": "2026-06-28",
    "description": "Turquesa Agenda - Médico Solo",
    "externalReference": "seu-email-de-teste@gmail.com"
  }'
```

| Campo | Turquesa |
|-------|--------|
| `value` | `119` (médico), `390` (clínica 2–5), `449` (clínica 6–10) |
| `billingType` | `UNDEFINED` — cliente escolhe PIX/cartão/boleto no fluxo Asaas |
| `externalReference` | **E-mail do dono** (mesmo que `onboarding_profiles.email`) |
| `nextDueDate` | Data da **primeira** cobrança (dia 30 do trial) |

Anote `sub_xxxxxxxx`.

**O que conferir:**

```bash
curl "https://api-sandbox.asaas.com/v3/subscriptions/sub_xxxxxxxx/payments" \
  -H "access_token: $ASAAS_API_KEY"
```

- Antes do `nextDueDate`, pode não haver cobrança ou só cobrança futura (assinatura é “agendador”).
- Documentação: [criar assinatura](https://docs.asaas.com/docs/criando-uma-assinatura) — cobrança é criada **depois** da assinatura; liste com `GET /v3/subscriptions/{id}/payments`.

**Critério de sucesso (trial 30d):** assinatura `ACTIVE` no painel, primeira cobrança com vencimento na data que você definiu, **sem** pagamento recebido antes disso.

---

## 5. Teste acelerado (recomendado na mesma sessão)

Para não esperar 30 dias, crie **outra** assinatura de teste com `nextDueDate` = **amanhã** (ou hoje, se o sandbox permitir):

```json
"nextDueDate": "2026-05-30",
"description": "Turquesa Agenda - teste webhook rápido"
```

Fluxo:

1. Aguardar ou forçar geração da cobrança (veja painel **Cobranças** no sandbox).
2. Anotar `pay_xxxxxxxx` da primeira parcela.
3. Seguir passos 7 e 8 (confirmar pagamento / vencimento).

---

## 6. Configurar webhook (receber eventos)

**Passo a passo completo:** [ASAAS_WEBHOOK_PASSO_A_PASSO.md](./ASAAS_WEBHOOK_PASSO_A_PASSO.md)

O app já expõe `POST /api/webhooks/asaas` (valida `asaas-access-token`). Para teste rápido sem Next.js:

### Opção A — webhook.site (mais rápido)

1. Abra **https://webhook.site** e copie a URL única.
2. No sandbox: **Menu → Integrações → Webhooks → Criar**.
3. URL = URL do webhook.site.
4. **Gerar token** (32+ caracteres) → mesmo valor em `ASAAS_WEBHOOK_TOKEN` no futuro.
5. **Tipo de envio:** **Sequencial** (eventos na ordem; recomendado para pagamentos).
5. Marque pelo menos:
   - `PAYMENT_CREATED`
   - `PAYMENT_CONFIRMED`
   - `PAYMENT_RECEIVED`
   - `PAYMENT_OVERDUE`
   - `SUBSCRIPTION_INACTIVATED` (opcional)
6. Salve e dispare eventos (passo 7–8).

O Asaas envia o token no header **`asaas-access-token`**.

### Opção B — ngrok + app local (quando existir rota no Next)

```bash
ngrok http 3000
```

URL do webhook: `https://xxxx.ngrok-free.app/api/webhooks/asaas`

---

## 7. Simular pagamento confirmado (sandbox)

Quando existir cobrança `pay_xxx`:

**Pela API:**

```bash
curl -X POST "https://api-sandbox.asaas.com/v3/sandbox/payment/pay_xxxxxxxx/confirm" \
  -H "access_token: $ASAAS_API_KEY"
```

**Pelo painel:** Cobranças → abrir cobrança → botão **Confirmar pagamento** (sandbox).

**Eventos esperados no webhook** (ordem pode variar por meio de pagamento):

`PAYMENT_CREATED` → `PAYMENT_CONFIRMED` → `PAYMENT_RECEIVED`

Para o MedSup, trate **`PAYMENT_RECEIVED`** (e/ou `PAYMENT_CONFIRMED` conforme sua regra) como **`active`** + atualizar `current_period_end`.

Doc: [fluxo de webhooks de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas)

**Checklist:**

- [ ] Payload contém `payment.externalReference` = e-mail do teste
- [ ] Payload contém `payment.subscription` = `sub_xxx` (vínculo com assinatura)
- [ ] Você consegue mapear `owner_email` + `asaas_subscription_id` para a tabela `assinaturas` (futuro)

---

## 8. Simular inadimplência (0 tolerância)

Com cobrança ainda pendente:

```bash
curl -X POST "https://api-sandbox.asaas.com/v3/sandbox/payment/pay_xxxxxxxx/overdue" \
  -H "access_token: $ASAAS_API_KEY"
```

**Evento esperado:** `PAYMENT_OVERDUE`

**Checklist MedSup:**

- [ ] Com `PAYMENT_OVERDUE` sem pagamento posterior → status `expired`
- [ ] App **não** desbloqueia só porque o usuário abriu o boleto/PIX
- [ ] Só reativa após novo `PAYMENT_RECEIVED` (passo 7 de novo)

Doc: [forçar vencimento (sandbox)](https://docs.asaas.com/reference/forcar-vencimento)

---

## 9. PIX avulso (reativação após `expired`)

Validar no painel sandbox (sem codar ainda):

1. Cliente `expired` → emitir **cobrança avulsa** (não assinatura) PIX/boleto para 2ª via.
2. Mesmo `externalReference` = e-mail.
3. Confirmar pagamento → webhook `PAYMENT_RECEIVED` → `active`.

Anote se o fluxo é só API `POST /v3/payments` ou link de checkout — isso define a tela `/dashboard/conta` depois.

---

## 10. Planos e preços no painel Asaas

No **sandbox**, crie (opcional) “produtos” ou use só `value` na API — o Turquesa hoje usa:

| Plano app | Valor mensal |
|-----------|----------------|
| `medico-pix` | R$ 119 |
| `clinica-5-pix` | R$ 390 |
| `clinica-10-pix` | R$ 449 |

Desconto anual, boleto mais caro, etc.: **somente no painel Asaas** — não replicar no app.

---

## 11. Planilha de homologação (preencher manualmente)

| # | Teste | OK? | Observação |
|---|--------|-----|------------|
| 1 | Conta sandbox + API key | ☐ | |
| 2 | POST customer + `externalReference` = e-mail | ☐ | `cus_` |
| 3 | POST subscription `nextDueDate` +30d | ☐ | `sub_` |
| 4 | GET `.../subscriptions/{id}/payments` — 1ª cobrança na data certa | ☐ | |
| 5 | Webhook recebe `PAYMENT_CREATED` | ☐ | |
| 6 | Sandbox confirm → `PAYMENT_RECEIVED` | ☐ | |
| 7 | Sandbox overdue → `PAYMENT_OVERDUE` | ☐ | |
| 8 | `externalReference` e `subscription` no JSON | ☐ | |
| 9 | Teste rápido `nextDueDate` +1 dia | ☐ | |
| 10 | Cobrança avulsa PIX (2ª via) | ☐ | |

Quando **todos** os itens críticos (2–8) estiverem OK, pode iniciar implementação em [ASAAS_BILLING.md](./ASAAS_BILLING.md) (`db:assinaturas` → webhook → middleware).

---

## 12. Erros comuns

| Sintoma | Causa provável |
|---------|----------------|
| 401 `invalid_environment` | Chave produção na URL sandbox (ou vice-versa) |
| Assinatura sem cobrança | Normal até perto do `nextDueDate`; consulte `GET .../payments` |
| Webhook não chega | URL HTTP sem túnel; firewall; webhook desativado |
| Evento diferente do esperado | PIX vs boleto vs cartão — ver [fluxo por meio](https://docs.asaas.com/docs/webhook-para-cobrancas) |

Suporte integração Asaas: **integracoes@asaas.com.br** (mencionar sandbox + `sub_` / `pay_` id).

---

## 13. Política de acesso (resumo)

Ver regras completas em **[ASAAS_BILLING.md](./ASAAS_BILLING.md)**:

- 30 dias grátis; no **dia 29** o usuário cadastra pagamento no Asaas.
- **1º pagamento boleto:** só libera com `PAYMENT_RECEIVED` (compensação).
- **Renovação boleto:** 3 dias após vencimento; depois bloqueia até compensar.
- Testes: `npm run test:billing`

## 14. Próximo passo no repositório

1. `npm run db:assinaturas` e `npm run db:assinaturas-policy`
2. Variáveis na Vercel (`ASAAS_WEBHOOK_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`)
3. `ASAAS_BILLING_ENFORCED=true` após homologar webhook em produção
