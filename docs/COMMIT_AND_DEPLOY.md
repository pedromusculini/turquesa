# Commit e deploy (padrão do projeto)

Fluxo para **https://www.turquesaagenda.com.br**. O passo crítico é o **promote**: a Vercel builda o commit, mas o **www** pode continuar no deployment antigo.

## Fluxo recomendado (um comando)

```bash
git add .
git commit -m "feat(escopo): resumo"
npm run release
```

`npm run release` = `git push origin master` + aguardar Vercel **Ready** + `deploy:promote` (www, apex e alias).

## Automático após `git push` (hook)

Na primeira vez (ou após `npm install`), o projeto configura:

```bash
git config core.hooksPath .githooks
```

(via script `prepare` em `package.json`)

**Cada `git push origin master`** dispara automaticamente:

```bash
npm run deploy:promote -- --wait
```

Requer **Vercel CLI logada** (`npx vercel login`) no PC que faz o push.

## Passo a passo manual

### 1. Commit

```bash
git add <arquivos relevantes>
git commit -m "tipo(escopo): resumo em português"
```

**Não incluir:** `.aider.*`, `.env.local`, segredos.

### 2. Push + promote

```bash
git push origin master
npm run deploy:promote:wait
```

Ou só promote (se o build já está Ready):

```bash
npm run deploy:promote
```

### 3. Smoke test (aba anônima)

| URL | Esperado |
|-----|----------|
| `/login` | Login Google |
| `/dashboard` | Dashboard |
| `/api/health/auth-config` | Env ok |

```bash
curl -sS https://www.turquesaagenda.com.br/api/health/auth-config
```

## Checklist

- [ ] `npm run build` (se mudou código)
- [ ] `npm run test:e2e` (se mudou SearchableSelect, MultiSelect, modais touch)
- [ ] `npm run db:*` (se SQL novo)
- [ ] `git commit` + **`npm run release`** ou push + hook automático
- [ ] Teste em aba anônima no www

## Checklist para agentes / CI

- [ ] Após push em `master`, garantir **`npm run deploy:promote:wait`** (ou confirmar que o hook rodou)
- [ ] Nunca assumir que redeploy na Vercel atualiza o www sem promote

Troubleshooting: [DEPLOYMENT.md](./DEPLOYMENT.md).
