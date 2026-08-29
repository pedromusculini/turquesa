# Google Ads API (oficial) — Turquesa Agenda

Sem Pipeboard. Você paga só a verba de anúncio (se ligar campanha). A API em si é gratuita.

Scripts locais:

| Comando | O que faz |
|---------|-----------|
| `npm run ads:oauth` | Abre o browser e gera `GOOGLE_ADS_REFRESH_TOKEN` |
| `npm run ads:accounts` | Lista IDs de contas Ads acessíveis |
| `npm run ads:keywords` | Keyword Planner (volume + CPC estimado BR/PT) |

Saída do keywords: `assets/ads/google/keyword-ideas-latest.json`

---

## Pré-requisitos

1. Conta em [ads.google.com](https://ads.google.com) (pode estar vazia / sem campanha).
2. Acesso ao [Google Cloud Console](https://console.cloud.google.com) (mesmo e-mail ou projeto da empresa).

---

## Passo 1 — Google Cloud (OAuth)

Você precisa de um cliente OAuth que aceite o redirect local do script:

`http://127.0.0.1:53682/oauth2callback`

### Opção A (recomendada) — cliente Desktop só para Ads

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. **+ Criar credenciais** → **ID do cliente OAuth**
3. Tipo: **Aplicativo para computador** (Desktop)
4. Nome: `Turquesa Ads CLI`
5. **Criar** → copie Client ID e Secret
6. No `.env.local` (não use o mesmo do login do site):

```env
GOOGLE_ADS_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=...
```

Cliente Desktop **não tem** campo de URL — e está certo. O Google libera `127.0.0.1` sozinho.

### Opção B — reutilizar cliente “Aplicativo da Web”

Só se o tipo for **Web**. O campo **não existe** em Desktop.

1. Credenciais → clique no Client ID (o mesmo do erro OAuth)
2. **URIs de redirecionamento autorizados** → **Adicionar URI**
3. Cole exatamente: `http://127.0.0.1:53682/oauth2callback`
4. **Salvar**

Se você não vê esse bloco, o cliente é Desktop → use a **Opção A**.

> Evite misturar com `GOOGLE_CLIENT_ID` do NextAuth (login do Turquesa). Prefira `GOOGLE_ADS_CLIENT_*` separado.

---

## Passo 2 — Developer Token (Google Ads)

1. Em [ads.google.com](https://ads.google.com), entre na conta (ou conta gerente / MCC).
2. **Ferramentas e configurações** (chave inglesa) → **Configuração** → **Central da API** (API Center).
3. Aceite os termos e **solicite** o developer token.
4. Níveis:
   - **Test** — só contas de teste; **não** serve para Keyword Planner da conta real.
   - **Basic / Standard** — conta de produção (é o que queremos).

Enquanto o token estiver em **Test** / aguardando aprovação Basic, o script pode falhar na conta real. Aplique Basic com uso descrito tipo: “pesquisa de palavras-chave e gestão de campanhas Search para SaaS Turquesa Agenda”.

```env
GOOGLE_ADS_DEVELOPER_TOKEN=seu_token
```

---

## Passo 3 — Refresh token

```bash
npm run ads:oauth
```

Autorize no browser. Cole no `.env.local` a linha impressa:

```env
GOOGLE_ADS_REFRESH_TOKEN=1//...
```

---

## Passo 4 — Customer ID

```bash
npm run ads:accounts
```

Escolha o ID da conta **cliente** (10 dígitos, sem hífen), ex. `1234567890`.

```env
GOOGLE_ADS_CUSTOMER_ID=1234567890
```

Se você acessa via **conta gerente (MCC)**:

```env
GOOGLE_ADS_LOGIN_CUSTOMER_ID=9999999999
```

(ID do gerente, só dígitos.)

---

## Passo 5 — Pesquisar palavras-chave

```bash
npm run ads:keywords
```

Ou seeds custom:

```bash
npm run ads:keywords -- "agenda salão" "sistema para barbearia"
```

O script imprime tabela (volume, competição, CPC topo de página em R$) e salva JSON.

---

## Checklist `.env.local`

```env
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
# GOOGLE_ADS_LOGIN_CUSTOMER_ID=   # só se MCC
```

Nunca commitar esses valores.

---

## Erros comuns

| Sintoma | Causa provável |
|---------|----------------|
| `DEVELOPER_TOKEN_NOT_APPROVED` / permission | Token ainda Test em conta real |
| `USER_PERMISSION_DENIED` | Refresh token de outro user; ou falta `LOGIN_CUSTOMER_ID` |
| `CUSTOMER_NOT_FOUND` | ID errado / hífens |
| Sem `refresh_token` no OAuth | Revogar app em [myaccount.google.com/permissions](https://myaccount.google.com/permissions) e rodar `ads:oauth` de novo |
| Redirect mismatch | URI deve ser exatamente `http://127.0.0.1:53682/oauth2callback` |

---

## Depois que funcionar

Mande o JSON ou diga “rodei ads:keywords” neste chat — aí calculamos orçamento diário realista vs Meta R$15.
