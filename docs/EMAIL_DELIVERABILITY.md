# Entregabilidade de e-mail (OTP / transacional)

E-mails de código de verificação saem pelo **Resend** (`lib/email.ts`), remetente padrão `Turquesa Agenda <naoresponda@turquesaagenda.com.br>`.

Se o usuário relata **spam** ou não recebe o código, a causa mais comum é **DNS incompleto** — não é algo que o código do app resolva sozinho.

## Conta dedicada (jul/2026)

MedSup e Turquesa usam contas Resend **separadas** (plano free = 1 domínio por conta). Setup: **[RESEND_TURQUESA_SETUP.md](./RESEND_TURQUESA_SETUP.md)**.

## Diagnóstico rápido (jul/2026)

Consulta pública em `turquesaagenda.com.br`:

| Registro | Estado esperado | Estado observado |
|----------|-----------------|------------------|
| SPF (`@` TXT) | Incluir `include:amazonses.com` (Resend) | Só `include:_spf.mx.cloudflare.net` |
| DKIM Resend | CNAME/TXT do painel Resend | **Ausente** (`resend._domainkey` não existe) |
| Return-Path (`send`) | TXT + MX do painel Resend | **Ausente** |
| DMARC (`_dmarc`) | `p=none` ou `quarantine` durante homologação | `p=reject` **sem** DKIM/SPF alinhados → falha DMARC |

**Conclusão:** com `DMARC p=reject` e sem autenticação Resend, provedores (Gmail em especial) tendem a **rejeitar ou classificar como spam**.

## Correção (Cloudflare + Resend)

### 1. Resend → Domains

1. Acesse [resend.com/domains](https://resend.com/domains).
2. Adicione **`turquesaagenda.com.br`** (ou subdomínio dedicado, ex. `send.turquesaagenda.com.br`).
3. Copie os registros exibidos na aba **Records** (valores exatos vêm do painel — não use placeholders de tutoriais).

Tipicamente o Resend pede:

| Tipo | Nome (host) | Conteúdo |
|------|-------------|----------|
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (prioridade 10 — confira no painel) |
| TXT ou CNAME | `resend._domainkey` | chave DKIM gerada pelo Resend |

### 2. Cloudflare → DNS

1. **DNS only** (nuvem cinza) nos registros de e-mail — igual ao site na Vercel.
2. Adicione os registros do passo 1 **sem alterar** os registros A/CNAME da Vercel.
3. **SPF no apex (`@`):** se já existir TXT com `v=spf1`, **não crie um segundo** — una em um único registro, por exemplo:

   ```
   v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all
   ```

   (Mantenha `include:amazonses.com` se o Resend usar o subdomínio `send`; siga o que o painel Resend mostrar.)

4. Clique **Verify** no Resend até status **Verified**.

### 3. DMARC — relaxar durante homologação

Enquanto valida envio real, troque `_dmarc` de:

```
v=DMARC1; p=reject;
```

para algo monitorável:

```
v=DMARC1; p=none; rua=mailto:privacidade@turquesaagenda.com.br; adkim=s; aspf=r;
```

Depois de 1–2 semanas com OTP passando (cabeçalhos `dmarc=pass`), evolua para `p=quarantine` e só então `p=reject`.

### 4. Vercel

Confirme em Production:

- `RESEND_API_KEY`
- `RESEND_FROM` = `Turquesa Agenda <naoresponda@turquesaagenda.com.br>` (domínio **verificado** no Resend)
- Opcional: `RESEND_REPLY_TO` = `suporte@turquesaagenda.com.br`

Redeploy após mudar variáveis.

## Verificação pós-deploy

1. Envie um OTP de teste (login Google → `/auth/verificar-email`).
2. No Gmail: abra o e-mail → **⋮** → **Mostrar original**.
3. Confira:
   - `SPF: PASS`
   - `DKIM: PASS`
   - `DMARC: PASS`

Ferramentas úteis: [mail-tester.com](https://www.mail-tester.com), [dmarcian.com/inspector](https://dmarcian.com/dmarc-inspector/).

## O que o app já faz (código)

- Versão **text/plain** + HTML no envio (`lib/email.ts`).
- `Reply-To` para `suporte@turquesaagenda.com.br`.
- Tela `/auth/verificar-email` orienta spam/Promoções e mostra o remetente exato.

Isso **melhora** entregabilidade, mas **não substitui** DNS verificado no Resend.

## Orientação ao usuário final

Se um cliente específico caiu no spam **uma vez**:

1. Marcar como **Não é spam** / mover para Caixa de entrada.
2. Adicionar `naoresponda@turquesaagenda.com.br` aos contatos.
3. No Gmail, buscar em **Todas as mensagens** (não só Principal).

Após DNS correto, novos envios costumam ir direto para a caixa de entrada.
