# Compatibilidade de navegadores (Safari / macOS / iOS)

## Navegadores suportados

| Navegador | Versão |
|-----------|--------|
| Safari (macOS / iOS) | Últimas 2 versões principais |
| Chrome / Edge | Últimas 2 versões |
| Firefox | Últimas 2 versões |

## Problemas conhecidos corrigidos no código

### 1. Landing — animação do título

A animação **Medical Super Application → Turquesa Agenda** usa elementos `position: absolute` que, no Safari, podiam **cobrir os botões** do hero sem ser visíveis.

**Correção:** `pointer-events: none` e `overflow: hidden` em `.brand-title-animation`.

### 2. Botões com `disabled` (login / verificar e-mail)

No Safari, botões `disabled` parecem “mortos” — o usuário clica e nada acontece (sem mensagem).

**Correção:** classe `.btn-action` — botão permanece clicável; validação mostra texto de ajuda (código incompleto, aceite legal, etc.).

### 3. Dashboard — menu lateral fixo

`aside` com `transform: translateX(-100%)` ainda interceptava cliques na área esquerda em alguns WebKit.

**Correção:** `pointer-events-none` quando o menu está fechado (mobile).

### 4. Checkbox + links (Política / Termos)

`Link` dentro de `<label>` no Safari pode alternar o checkbox em vez de abrir o link.

**Correção:** `id` / `htmlFor` no checkbox e `stopPropagation` nos links.

### 5. Inputs no iOS

Fonte mínima **16px** em inputs mobile (evita zoom ao focar) — ver `globals.css` `@media (max-width: 767px)`.

### 6. Onboarding — Finalizar cadastro

Botões **Continuar** e **Finalizar Cadastro** usavam `disabled` quando faltava campo ou aceite legal — no Safari parecia que o app estava quebrado.

**Correção:** `.btn-action` + aviso amarelo listando o que falta; checkbox legal com `htmlFor` e links com `stopPropagation`.

### 7. Rota legada `/auth/verify-code`

Redireciona para `/auth/verificar-email` (fluxo Google + 6 dígitos).

### 8. iPhone / Safari — “Erro ao carregar conta” após login

Quem **logou e confirmou o e-mail** mas **não concluiu `/onboarding`** era redirecionado para cobrança; a API `/api/conta` falhava (FK `assinaturas` → `onboarding_profiles`).

**Correção:** middleware envia para `/onboarding` antes do bloqueio Asaas; `ensureAssinaturaRecord` não insere assinatura sem perfil; Minha conta mostra “Completar cadastro”.

### 9. Google Chrome (Windows) — extensões interferindo

Sintomas: botões sem resposta, login Google que não abre, cadastro que “volta” para o início, campos que não enviam.

**Extensões que mais causam problema:**

| Tipo | Exemplos |
|------|----------|
| Bloqueio de anúncios / rastreadores | uBlock Origin, AdBlock, AdGuard, Privacy Badger, Ghostery |
| Senhas / autopreenchimento | LastPass, Bitwarden, 1Password (camadas sobre o botão Google) |
| Edição da página | Grammarly, tradutores, Dark Reader |
| Cupons / scripts injetados | Honey e similares |
| VPN no navegador | Alteração de cookies do domínio Google |

**Como testar:**

1. Abra **janela anônima** (Ctrl+Shift+N) — extensões costumam ficar desligadas.
2. Ou em `chrome://extensions`, desative extensões uma a uma e recarregue `https://www.turquesaagenda.com.br`.
3. Nas telas de **Login**, **Verificar e-mail** e **Onboarding** há um aviso amarelo com a lista (pode fechar com “Fechar”; não volta na mesma sessão do navegador se marcou fechar).

**Correção no app:** após salvar o onboarding, o sistema aguarda confirmação no servidor antes de ir ao dashboard (evita loop com o middleware).

## Checklist para Luyddy (Mac)

1. **Safari** — atualizar macOS/Safari; testar também em Chrome.
2. **Verificar e-mail** — marcar **Política + Termos**; código com **6 dígitos**; botão mostra dica se faltar algo.
3. **Login** — mesmo aceite legal; se clicar sem marcar, aparece aviso amarelo.
4. Limpar cache: Safari → Configurações → Privacidade → Gerenciar dados do site → `turquesaagenda.com.br`.
5. **Onboarding** — preencher todos os campos + marcar Política/Termos; se o botão parecer cinza, tocar mesmo assim — aparece o aviso do que falta.

## Checklist Chrome (Windows)

1. Testar primeiro em **janela anônima** sem extensões.
2. Se funcionar, reativar extensões aos poucos em `chrome://extensions`.
3. Permitir cookies de `turquesaagenda.com.br` e `accounts.google.com` se usar bloqueador agressivo.
4. **Configurações** (mensagens, horários, link público) ficam no menu superior **Configurações** ou em `/dashboard/configuracoes`.

## Teste rápido

- `/` — botões “Começar com Google” e “Ver preços” clicáveis
- `/login` — perfis Médico/Clínica respondem ao clique (com ou sem checkbox)
- `/auth/verificar-email` — Confirmar e Reenviar respondem
- `/onboarding` — Finalizar Cadastro mostra aviso se faltar campo
- Cabeçalho logado — link **Configurações** ao lado de Backup
