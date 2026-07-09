# Resend — conta dedicada Turquesa Agenda

**Conta:** `marrissamartins@gmail.com` (Turquesa) · MedSup permanece em `pedromusculini@gmail.com`.

O MedSup e o Turquesa **não podem** compartilhar o mesmo domínio na conta Resend atual: o plano free permite **1 domínio** (`medsupapp.com.br` já ocupa o slot).

## Passo 1 — Criar conta (manual, ~2 min)

1. Abra **[resend.com/signup](https://resend.com/signup)** em aba anônima ou logout da conta MedSup.
2. Cadastre com **`marrissamartins@gmail.com`** (conta dedicada Turquesa — **não** reutilize a conta MedSup).
3. Confirme o e-mail se pedido.
4. No dashboard → **API Keys** → **Create API Key** → nome `turquesa-setup` → permissão **Full access** (só para o setup).
5. Copie a chave `re_…` (aparece uma vez).

> Não há API para criar conta Resend — este passo é obrigatório no browser.

## Passo 2 — Rodar script de setup

No repositório Turquesa:

```bash
RESEND_API_KEY=re_SUA_CHAVE_NOVA npm run setup:resend
```

O script:

- Cria `turquesaagenda.com.br` na região `sa-east-1`
- Imprime registros DNS para o Cloudflare
- Gera API key **só de envio** para o domínio Turquesa
- (Opcional) `--vercel` atualiza Production na Vercel

Com atualização Vercel:

```bash
RESEND_API_KEY=re_SUA_CHAVE_NOVA npm run setup:resend -- --vercel
```

## Passo 3 — Cloudflare DNS

1. [dash.cloudflare.com](https://dash.cloudflare.com) → `turquesaagenda.com.br` → **DNS** → **Records**.
2. Adicione cada registro que o script listou (`send` TXT/MX, DKIM `resend._domainkey` ou CNAMEs atuais do Resend).
3. **Nuvem cinza** (DNS only) em todos.
4. Ajuste `_dmarc` para homologação:

   ```
   v=DMARC1; p=none; rua=mailto:privacidade@turquesaagenda.com.br; adkim=s; aspf=r;
   ```

   (Hoje está `p=reject` sem DKIM — isso piora spam.)

Não altere os registros A/CNAME da Vercel (`@`, `www`).

## Passo 4 — Verificar no Resend

Após propagar DNS (geralmente 5–30 min):

```bash
RESEND_API_KEY=re_CHAVE_ENVIO npm run setup:resend -- --verify
```

Ou clique **Verify** no painel Resend → Domains.

## Passo 5 — Vercel e local

| Variável | Valor |
|----------|--------|
| `RESEND_API_KEY` | Chave **da conta Turquesa** (domain-scoped gerada no passo 2) |
| `RESEND_FROM` | `Turquesa Agenda <naoresponda@turquesaagenda.com.br>` |

```bash
npx vercel env update RESEND_API_KEY production --value "re_..." --yes
npm run release
```

Atualize também `.env.local` do Turquesa (não reutilize a chave do `medsupapp/.env.local`).

## Passo 6 — Teste

1. Login Google → `/auth/verificar-email`
2. Gmail → **Mostrar original** → `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`

## Isolamento MedSup × Turquesa

| | MedSupAPP | Turquesa Agenda |
|---|-----------|-----------------|
| Conta Resend | Conta original | **Conta nova** |
| Domínio verificado | `medsupapp.com.br` | `turquesaagenda.com.br` |
| `RESEND_API_KEY` na Vercel | Projeto `medsupapp` | Projeto `turquesa` |

Ver também [EMAIL_DELIVERABILITY.md](./EMAIL_DELIVERABILITY.md).
