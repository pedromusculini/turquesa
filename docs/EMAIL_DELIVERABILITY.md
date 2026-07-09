# Entregabilidade de e-mail (OTP / transacional)

E-mails de código de verificação saem pelo **Resend** (`lib/email.ts`), remetente padrão `Turquesa Agenda <naoresponda@turquesaagenda.com.br>`.

## Conta dedicada (jul/2026)

MedSup e Turquesa usam contas Resend **separadas** (plano free = 1 domínio por conta). Setup: **[RESEND_TURQUESA_SETUP.md](./RESEND_TURQUESA_SETUP.md)**.

| Item | Estado (jul/2026) |
|------|-------------------|
| Conta Resend | `marrissamartins@gmail.com` |
| Domínio `turquesaagenda.com.br` | **Verified** no Resend |
| DNS Cloudflare | `send` (TXT+MX), `resend._domainkey`, DMARC `p=none` |
| Vercel Production | `RESEND_API_KEY` da conta Turquesa |

## Verificação pós-deploy

1. Envie um OTP de teste (login Google → `/auth/verificar-email`).
2. No Gmail: abra o e-mail → **⋮** → **Mostrar original**.
3. Confira:
   - `SPF: PASS`
   - `DKIM: PASS`
   - `DMARC: PASS`

Ferramentas úteis: [mail-tester.com](https://www.mail-tester.com), [dmarcian.com/inspector](https://dmarcian.com/dmarc-inspector/).

## Se voltar a cair em spam

### Diagnóstico DNS

Consulta pública em `turquesaagenda.com.br`:

| Registro | Estado esperado |
|----------|-----------------|
| SPF (`send` ou apex) | Incluir `include:amazonses.com` (Resend) |
| DKIM Resend | TXT/CNAME `resend._domainkey` |
| Return-Path (`send`) | TXT + MX do painel Resend |
| DMARC (`_dmarc`) | `p=none` ou `quarantine` durante homologação; evite `p=reject` sem DKIM/SPF alinhados |

### Correção (Cloudflare + Resend)

1. [resend.com/domains](https://resend.com/domains) → `turquesaagenda.com.br` → copie registros **Records**.
2. Cloudflare → DNS → **DNS only** (nuvem cinza) nos registros de e-mail.
3. **SPF no apex:** se já existir TXT `v=spf1`, una em um único registro (não duplique).
4. **Verify** no Resend até status **Verified**.
5. Vercel Production: confirme `RESEND_API_KEY` e `RESEND_FROM` → redeploy.

Detalhes passo a passo: [RESEND_TURQUESA_SETUP.md](./RESEND_TURQUESA_SETUP.md).

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
