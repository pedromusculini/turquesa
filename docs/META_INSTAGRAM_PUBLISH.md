# Meta — anúncios + publicação orgânica no Instagram

Automação para agendar Reels no Instagram a partir dos vídeos da biblioteca de anúncios, com legendas padronizadas e visão de performance.

## Por que isso existe

- Vídeos de **anúncio** não aparecem no Business Suite para republicar no perfil
- A API de **anúncios** (MCP/Cursor) não publica conteúdo orgânico
- Este fluxo usa a **Instagram Graph API** (`instagram_content_publish`)

## Pré-requisitos

1. Instagram **profissional** conectado à **Página do Facebook** Turquesa
2. App Meta em [developers.facebook.com](https://developers.facebook.com)
   - Produtos: **Facebook Login**, **Marketing API**, **Instagram Graph API**
   - Redirect OAuth: `http://127.0.0.1:53683/oauth2callback`
3. Permissões aprovadas (ou em modo desenvolvimento com usuários de teste):
   - `ads_management`, `ads_read`, `business_management`
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
   - `instagram_basic`, `instagram_content_publish`

## Configuração (.env.local)

```env
META_APP_ID=seu_app_id
META_APP_SECRET=seu_app_secret
META_ACCESS_TOKEN=          # gerado pelo OAuth abaixo
META_AD_ACCOUNT_ID=act_977732793417355
META_INSTAGRAM_USER_ID=     # ID numérico do IG (não é @usuario)
```

## Passo a passo (primeira vez)

```bash
# 1) Autorizar token com permissões de anúncios + publicação IG
npm run meta:oauth
# Cole META_ACCESS_TOKEN no .env.local

# 2) Descobrir ID do Instagram novo
npm run meta:ig:accounts
# Cole META_INSTAGRAM_USER_ID no .env.local

# 3) Ver vídeos únicos do Turquesa + spend/CTR
npm run meta:ig:videos

# 4) Gerar fila automática (1 Reels/dia às 18h, começando amanhã)
npm run meta:ig:plan

# 5) Revisar assets/meta/instagram-queue.json (legendas, datas, ordem)

# 6) Agendar tudo no Instagram
npm run meta:ig:schedule -- --queue assets/meta/instagram-queue.json
```

## Agendar um vídeo só

```bash
npm run meta:ig:schedule -- \
  --video 1076916191595920 \
  --at "2026-09-02T18:00:00-03:00" \
  --caption "Texto do Reels aqui"
```

## Fluxo futuro (Cursor + você)

1. Você pede: *"cria anúncio X e agenda Reels para terça 18h"*
2. Eu uso a API de anúncios para criar campanha/criativo
3. Uso `meta:ig:plan` / fila JSON para agendar orgânico com legenda revisada
4. `meta:ig:videos` + relatório (`meta:fase1-report`) mostram o que performa melhor

## Limites e cuidados

- Instagram exige `video_url` **público** — usamos URL temporária do próprio Meta (`source` do vídeo do anúncio)
- Agendamento: entre **10 minutos** e **75 dias** no futuro
- Não publique 20+ Reels idênticos seguidos — `plan` deduplica por nome, mas revise a fila
- Token long-lived expira (~60 dias) — renove com `npm run meta:oauth`

## Erros comuns

| Erro | Solução |
|------|---------|
| `instagram_content_publish` negado | Rode `meta:oauth` de novo e aceite permissões |
| `META_INSTAGRAM_USER_ID` ausente | `npm run meta:ig:accounts` |
| Vídeo sem `source` | Vídeo removido da biblioteca — use outro `video_id` |
| Container `ERROR` | Formato inválido ou URL expirou — tente de novo em poucos minutos |

## Arquivos

- `scripts/meta-oauth.mjs` — OAuth local
- `scripts/meta-instagram.mjs` — CLI de agendamento
- `scripts/lib/meta-api.mjs` — helpers Graph API
- `assets/meta/instagram-queue.example.json` — modelo da fila
