# DNS — go-live Turquesa Agenda

Guia focado **somente em DNS** para colocar o domínio no ar na Vercel via Cloudflare + Registro.br.

> **UI Cloudflare atualizada em 2026-06-05** — use **Connect a domain**, não "Add a site" (rótulo antigo, removido do painel). A documentação oficial às vezes diz "Onboard a domain"; no dashboard atual o item equivalente é **Connect a domain**.

**Domínio canônico:** `https://www.turquesaagenda.com.br`  
**Apex (redireciona para www):** `turquesaagenda.com.br`  
**Projeto Vercel:** `turquesa`

Documentação relacionada: [DEPLOYMENT.md](./DEPLOYMENT.md), [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md).

---

## Visão geral da ordem (importante)

Faça nesta sequência:

1. **Cloudflare** — conectar o domínio e criar os registros DNS (nameservers ainda no Registro.br)
2. **Registro.br** — trocar nameservers para o Cloudflare (só depois dos registros prontos)
3. **Vercel** — adicionar os dois domínios (pode ser antes ou depois do passo 2; o status só fica verde quando o DNS propagar)
4. **Aguardar propagação** → verificar → `npm run deploy:promote`

**Por quê essa ordem?** Se você trocar os NS no Registro.br antes de configurar os registros no Cloudflare, o site fica fora do ar ou apontando para lugar errado durante a propagação.

---

## Parte 1 — Cloudflare (registros DNS primeiro)

### 1.1 Conectar o domínio

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) e faça login.
2. Na **página inicial da conta** (lista **Domains** / domínios), clique em **+ Add** (canto superior direito ou botão equivalente de adicionar).
3. No menu suspenso, escolha **Connect a domain** — subtítulo *"Optimize web traffic speed and security"*.  
   *(Não use Transfer a domain, Register a domain, Workers, Pages, R2, etc.)*
4. Na tela **Connect a domain**:
   - Digite o domínio **apex** (sem `www`): `turquesaagenda.com.br`
   - Escolha como importar registros DNS:
     - **Quick scan** (recomendado) — Cloudflare varre o DNS atual no Registro.br (~1 min)
     - **Enter DNS records manually** — se preferir criar tudo à mão
   - Clique **Continue**
5. **Select a plan** → escolha **Free** → **Continue**.
6. **Review your DNS records** — tabela com Type, Name, Content, **Proxy status**, TTL:
   - Revise o que o scan encontrou; remova `@` / `www` conflitantes se existirem
   - Você vai ajustar `www` e `@` na seção 1.2 (pode ser nesta tela ou depois)
   - Clique **Continue**
7. **Update your nameservers** — o Cloudflare atribui **2 authoritative nameservers** exclusivos do seu domínio (ex.: `ada.ns.cloudflare.com` e `bob.ns.cloudflare.com`).  
   Texto típico do painel: *"Last step: Update your nameservers to activate Cloudflare"* ou *"Replace your current nameservers with Cloudflare nameservers"*.
8. **Anote os 2 hostnames** (copie/cole, não digite manualmente). Você usa no Registro.br na Parte 2.  
   **Não troque NS ainda** — primeiro termine os registros DNS (1.2 e 1.3).
9. Clique **Continue to dashboard** (ou equivalente). O domínio aparece em **Domains** com status **Pending** até os NS propagarem.

**Onde ver os nameservers depois:** selecione `turquesaagenda.com.br` → barra lateral **Overview** — a seção de nameservers fica no topo ou em *"Last step: Update your nameservers…"*. Há também o botão **Check nameservers now** para forçar nova verificação.

**DNSSEC:** se estiver ativo no Registro.br, desative **antes** de trocar NS (Parte 2). Com DNSSEC ligado, a troca de nameservers pode deixar o domínio inacessível.

### 1.2 Criar os registros para Vercel

1. Selecione o domínio `turquesaagenda.com.br` na lista **Domains**.
2. Barra lateral esquerda → **DNS** → aba/submenu **Records** (URL costuma ser `…/dns/records`).
3. Configure **apenas** estes (remova ou edite conflitos antigos de `@` e `www`):

| Tipo | Nome | Conteúdo | Proxy status |
|------|------|----------|--------------|
| **CNAME** | `www` | `cname.vercel-dns.com` | **DNS only** (ícone de nuvem **cinza**) |
| **A** | `@` | `76.76.21.21` | **DNS only** (ícone de nuvem **cinza**) |

**Como adicionar/editar um registro:**

1. **Add record**
2. **Type** → CNAME ou A
3. **Name** → `www` ou `@` (apex)
4. **Target** / **IPv4 address** → valor da tabela acima
5. **Proxy status** → clique no ícone de nuvem até ficar **cinza** (*DNS only*). Por padrão o Cloudflare deixa **laranja** (*Proxied*) — **mude para cinza antes de Save**.
6. **Save**

**Como alternar proxy em registro existente:** na linha do registro, clique no ícone de nuvem (laranja ↔ cinza) ou **Edit** → altere **Proxy status** → **Save**.

**Sobre o CNAME:** ao adicionar `www.turquesaagenda.com.br` na Vercel (Parte 3), o painel pode mostrar um CNAME específico do projeto (ex.: `xxx.vercel-dns-017.com`). Se mostrar, use **esse** valor no lugar de `cname.vercel-dns.com`. Os dois funcionam; o específico é o que a Vercel recomenda na tela de Domains.

**Proxy = cinza (DNS only), NUNCA laranja.** *Proxied* (nuvem laranja) quebra certificado SSL da Vercel, causa loops e impede "Valid Configuration".

### 1.3 SSL/TLS

1. Com o domínio selecionado, barra lateral → **SSL/TLS**
2. Aba **Overview** (primeira subaba)
3. Em **Configure SSL/TLS** / seletor de modo de criptografia, escolha **Full**  
   *(não "Flexible", não "Full (strict)" por enquanto)*

### 1.4 Não troque NS ainda

Pare aqui. Confirme que os registros `www` e `@` estão salvos em **DNS → Records** com nuvem **cinza**. **Só depois** vá ao Registro.br (Parte 2).

---

## Parte 2 — Registro.br (nameservers)

1. Acesse [registro.br](https://registro.br) → login → **Meus domínios** → `turquesaagenda.com.br`.
2. **Alterar servidores DNS** (ou "DNS").
3. Escolha **"Utilizar servidores DNS próprios"** (não use os padrão do Registro.br).
4. Informe os **2 nameservers do Cloudflare** (passo 1.1, seção *Update your nameservers*), sem `http://`, só o hostname.
5. Salve/confirme.

Propagação de NS: de minutos a **até 48 h** (geralmente 1–4 h no `.com.br`). No Cloudflare, o status do domínio passa de **Pending** para **Active** quando a troca for detectada (e-mail de confirmação pode chegar).

---

## Parte 3 — Vercel (adicionar domínios)

1. [vercel.com](https://vercel.com) → projeto **turquesa** → **Settings → Domains**.
2. Adicione **os dois**:
   - `www.turquesaagenda.com.br` (domínio principal)
   - `turquesaagenda.com.br` (apex)
3. Pode fazer **antes ou depois** da troca de NS; o status só fica verde quando o DNS propagar.

**O que a Vercel espera:**

| Tipo | Nome | Conteúdo |
|------|------|----------|
| CNAME | `www` | valor da Vercel (`cname.vercel-dns.com` ou CNAME específico do projeto) |
| A | `@` | `76.76.21.21` |

**Redirect apex → www:** já está no `vercel.json` e no `middleware.ts` — `turquesaagenda.com.br` redireciona para `https://www.turquesaagenda.com.br`. **Não** crie redirect no Cloudflare (ver seção 3.1 abaixo).

### 3.1 Apex → www: Cloudflare ou Vercel?

No **MedSupAPP** (repositório `medsupapp`), o redirect apex→www **não** está documentado como regra no painel Cloudflare. O código usa o **mesmo padrão do Turquesa**:

| Camada | MedSupAPP | Turquesa Agenda |
|--------|-----------|-----------------|
| `vercel.json` | `medsupapp.com.br` → `https://www.medsupapp.com.br/:path*` (301) | `turquesaagenda.com.br` → `https://www.turquesaagenda.com.br/:path*` (301) |
| `middleware.ts` | host apex → `www` (308) | host apex → `www` (308) |
| Repositório / docs | nenhuma Redirect Rule, Bulk Redirect ou Page Rule | este guia |

Quando alguém diz que “resolveu na Cloudflare”, na prática costuma ser **DNS** (Connect a domain, registros A/CNAME, nameservers no Registro.br) — não uma regra de redirect no CF.

**Turquesa não precisa de regra extra no Cloudflare.** Com os registros em **DNS only** (nuvem **cinza**), o tráfego vai **direto para a Vercel**; a Cloudflare **não** intercepta o HTTP, então **Rules → Redirect Rules** e **Bulk Redirects** **não executam** nesse modo. O redirect acontece na Vercel assim que o DNS propagar e os dois domínios estiverem em **Valid Configuration**.

**Não adicione** Redirect Rule no Cloudflare **em paralelo** ao `vercel.json`: com proxy laranja (necessário para a regra funcionar) você quebra SSL/certificado da Vercel; com proxy cinza a regra simplesmente não roda e só confunde o troubleshooting.

**Depois da propagação, teste:**

```bash
curl -sI https://turquesaagenda.com.br | grep -iE '^(HTTP|location:)'
```

Esperado: `HTTP/2 301` (ou `308`) e `location: https://www.turquesaagenda.com.br/`.

#### Referência (só se mudar arquitetura — não recomendado)

Se no futuro o apex/`www` passarem a **Proxied** (laranja) — **não faça isso com Vercel** — a regra equivalente seria:

1. Domínio `turquesaagenda.com.br` → **Rules** → **Redirect Rules** → **Create rule**
2. **Rule name:** `apex to www`
3. **When incoming requests match:** Custom filter expression  
   `(http.host eq "turquesaagenda.com.br")`
4. **Then:** Dynamic redirect, expression  
   `concat("https://www.turquesaagenda.com.br", http.request.uri.path)`  
   (query string: preserve query string = **On**)
5. **Status code:** `301`
6. Remover o redirect do `vercel.json` para evitar duplo redirect

Com a arquitetura atual (cinza + Vercel), **pule esta seção** — aguarde a propagação e confie no `vercel.json`.

---

## Parte 4 — Verificação

### 4.1 DNS (após propagação NS)
### 4.1.1 Diagnóstico — Cloudflare certo, Vercel ainda Invalid

Se no painel Cloudflare os registros `@` / `www` estão corretos (cinza) mas a Vercel continua **Invalid Configuration** após horas, compare **DNS público** vs **nameserver autoritativo do Cloudflare**:

```bash
# Público (o que a Vercel e o mundo veem) — Git Bash sem `dig`:
nslookup -type=NS turquesaagenda.com.br
nslookup -type=CNAME www.turquesaagenda.com.br
nslookup -type=A turquesaagenda.com.br

# Autoritativo no Cloudflare (substitua pelo seu NS da Overview):
nslookup -type=A turquesaagenda.com.br langston.ns.cloudflare.com
nslookup -type=CNAME www.turquesaagenda.com.br langston.ns.cloudflare.com
```

| Sintoma | Interpretação |
|---------|----------------|
| Público: NS `a.auto.dns.br` / `b.auto.dns.br` | **Registro.br ainda não delegou** (ou alteração não salvou) — a internet **ignora** o Cloudflare |
| Público: `www` → *Non-existent domain* / NXDOMAIN | Normal enquanto NS apontam para o Registro.br **sem** registros Vercel lá |
| Autoritativo Cloudflare: A `76.76.21.21` + CNAME `cname.vercel-dns.com` | Cloudflare está **pronto**; falta só a delegação NS no Registro.br propagar |
| `curl` falha com *Could not resolve host* | DNS público ainda não serve `www` / apex para a Vercel |

Confirme propagação global em [dnschecker.org](https://dnschecker.org/#NS/turquesaagenda.com.br) — tipo **NS** deve mostrar `langston.ns.cloudflare.com` e `venus.ns.cloudflare.com` (ou os dois NS da sua conta), não `*.auto.dns.br`.

**Registro.br:** em [registro.br](https://registro.br) → domínio → **DNS** → modo **Utilizar servidores DNS próprios** com exatamente os 2 hostnames do Cloudflare (sem `http://`, sem ponto final). Salve e aguarde; `.br` costuma levar de minutos a **24–48 h** em casos raros.



No terminal (Git Bash no Windows):

```bash
# Nameservers devem ser cloudflare.com
dig NS turquesaagenda.com.br +short

# www → CNAME da Vercel
dig www.turquesaagenda.com.br CNAME +short

# apex → IP da Vercel
dig turquesaagenda.com.br A +short
```

**Esperado:**

- NS: algo como `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`
- `www`: `cname.vercel-dns.com` (ou CNAME específico da Vercel)
- `@`: `76.76.21.21`

Alternativa online: [dnschecker.org](https://dnschecker.org) para `www` e apex.

### 4.2 HTTP/HTTPS

```bash
# www deve responder 200 (ou redirect interno da app)
curl -sI https://www.turquesaagenda.com.br | head -5

# apex deve redirecionar para www (301)
curl -sI https://turquesaagenda.com.br | head -10
```

No apex, espere algo como:

```
HTTP/2 301
location: https://www.turquesaagenda.com.br/
```

### 4.3 Painel Vercel

Em **Settings → Domains**, cada domínio deve mostrar:

- **Valid Configuration** (verde)
- Sem avisos de "Invalid Configuration" ou "Pending"

Se ficar "Pending" por horas: confira proxy cinza no Cloudflare, registros corretos e NS propagados.

---

## Parte 5 — Promote (depois do DNS ok)

Quando ambos os domínios estiverem **Valid Configuration**:

```bash
npm run deploy:promote
```

Ou, se acabou de dar push e o deploy ainda está buildando:

```bash
npm run deploy:promote:wait
```

O script aponta `www.turquesaagenda.com.br` e `turquesaagenda.com.br` para o deployment Production **Ready** mais recente do projeto `turquesa`.

Teste em aba anônima: `https://www.turquesaagenda.com.br`

Ver também: [DEPLOYMENT.md § Commit no GitHub, mas o site não atualiza](./DEPLOYMENT.md#commit-no-github-mas-o-site-não-atualiza).

---

## Armadilhas comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| Vercel "Invalid Configuration" | Nuvem **laranja** (*Proxied*) no Cloudflare | Mude para **DNS only** (cinza) em `www` e `@` em **DNS → Records** |
| Site fora do ar após trocar NS | NS trocados **antes** dos registros no Cloudflare | Sempre: registros Cloudflare **primeiro**, NS **depois** |
| Apex não redireciona | DNS ainda propagando, ou redirect manual no CF (laranja) conflitando | Aguarde propagação; remova Redirect Rules/Page Rules no CF; confirme `vercel.json` no deploy Production |
| Redirect Rule no CF “não funciona” | Registros em **DNS only** (cinza) — CF não vê o HTTP | Normal: redirect é na Vercel, não no CF |
| SSL erro / too many redirects | Proxy laranja + SSL Flexible | Cinza em **DNS → Records** + **SSL/TLS → Overview** = **Full** |
| www ok, apex pendente | Falta registro A `@` | A `@` → `76.76.21.21`, cinza |
| DNS ok mas site antigo | Alias Vercel no deploy velho | `npm run deploy:promote` |
| Vercel Invalid + CF registros OK | NS públicos ainda `a.auto.dns.br` / `b.auto.dns.br` | Revisar/salvar NS no Registro.br; aguardar propagação; `Check nameservers now` no Cloudflare Overview |
| `www` NXDOMAIN no `nslookup` público | Delegação ainda no Registro.br sem CNAME Vercel | Mesmo que acima — não adicione A/CNAME no Registro.br se usa Cloudflare; só troque NS |
| Cloudflare Pending há horas | NS não propagados globalmente | dnschecker NS; quando verde, Overview passa a **Active** e Vercel valida |
| Demora | Propagação NS/TTL | Aguarde; TTL baixo no CF ajuda em mudanças futuras |

---

## Checklist final

- [ ] Cloudflare: domínio conectado via **Connect a domain** (plano Free, status Pending → Active após NS)
- [ ] Cloudflare: CNAME `www` → `cname.vercel-dns.com` (ou CNAME da Vercel) — **DNS only** (cinza)
- [ ] Cloudflare: A `@` → `76.76.21.21` — **DNS only** (cinza)
- [ ] Cloudflare: **SSL/TLS → Overview** = Full
- [ ] Cloudflare: nameservers anotados (2 hostnames)
- [ ] Registro.br: "Utilizar servidores DNS próprios" com NS do Cloudflare
- [ ] Vercel: `www.turquesaagenda.com.br` adicionado em Domains
- [ ] Vercel: `turquesaagenda.com.br` adicionado em Domains
- [ ] `dig NS` / `CNAME` / `A` retornam valores corretos
- [ ] `curl` apex retorna 301 → `www.turquesaagenda.com.br`
- [ ] Vercel: ambos domínios "Valid Configuration"
- [ ] `npm run deploy:promote` executado
- [ ] `https://www.turquesaagenda.com.br` abre em aba anônima

Quando todos os itens estiverem marcados, o DNS do go-live está concluído. Resend, Google OAuth e Asaas ficam para outra etapa.
