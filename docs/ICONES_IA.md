# Ícones e logomarcas com IA — Turquesa Agenda

O portfólio [`/paleta-cores`](/paleta-cores) e [`docs/paleta-cores.html`](paleta-cores.html) traz **15 logomarcas (wordmark)** e **5 paletas** — não packs de ícone nem emoji. Use este guia para gerar **logos finais** e **ícones de app** (favicon, PWA, aba do navegador) com ferramentas de IA e design.

Paleta de referência até o cliente escolher: petróleo `#1B3A4B`, turquesa `#0D9488`, ocre `#D4A574`, fundo `#F8FAFC` (`project_summary.txt`).

---

## Logomarcas vs ícones de app

| | **Logomarca (logo)** | **Ícone de app** |
|---|----------------------|------------------|
| **Uso** | Site, cartão, Instagram, fachada, e-mail | Favicon, “Adicionar à tela”, lojas, notificações |
| **Formato** | Wordmark, lockup, monograma horizontal | Quadrado, símbolo simples, pouco ou nenhum texto |
| **Legibilidade** | Pode ter duas linhas e tipografia fina | Deve ler em **16–32 px**; evitar texto longo |
| **No portfólio** | Códigos **LOGO-A … LOGO-O** | Fora do portfólio — gere com IA (abaixo) |
| **Ferramentas típicas** | Looka, Brandmark, Ideogram, Figma | Recraft, DALL·E, Midjourney, Recraft, Figma |

Um **monograma** (ex.: LOGO-E “TA” no círculo) pode inspirar o ícone de app, mas exporte sempre uma versão **simplificada** só para favicon.

---

## Ferramentas recomendadas

### Logomarcas e identidade

| Ferramenta | Bom para |
|------------|----------|
| **Looka** | Pacotes de logo + variações de cor e layout |
| **Brandmark** | Wordmarks e símbolos rápidos para revisão |
| **Ideogram** | Conceitos com tipografia (validar legibilidade em tamanho pequeno) |
| **Figma** | Refinar vetor, grid, versões claro/escuro, export SVG |
| **Adobe Firefly** | Exploração com uso comercial claro (Creative Cloud) |

### Ícones de app (símbolo / favicon)

| Ferramenta | Bom para |
|------------|----------|
| **Recraft.ai** | Ícones vetoriais consistentes, séries no mesmo estilo |
| **Ideogram** | Símbolos com formas claras (evitar texto no centro) |
| **Midjourney** | Exploração visual forte → vetorizar/simplificar no Figma |
| **ChatGPT / DALL·E** | Rascunhos rápidos; pedir fundo simples e alto contraste |
| **Adobe Firefly** | Ícones editoriais, export para vetorização |

Para **steampunk**, **aqua**, **calendário clássico** ou **monograma TA**, gere 3–5 variações na **mesma ferramenta** com o mesmo prompt-base e a paleta acima.

---

## Fluxo de trabalho (resumo)

1. **Brief** — vertical (salão, lash, manicure), personalidade (clássico, luxo blush, minimal), cores HEX.
2. **Gerar** — PNG ou SVG em **512×512 px** (canvas quadrado para ícone; logo pode ser mais largo).
3. **Refinar** — Figma: simplificar detalhes, alinhar ao pixel grid, testar em 32 / 64 / 180 px.
4. **Exportar** — arquivos abaixo → pasta `public/` do Next.js.
5. **Validar** — Chrome DevTools → Application → Manifest; aba anônima em `http://localhost:3000`.

---

## Exportar para o Next.js (`public/`)

Arquivos usados hoje em `app/layout.tsx`:

| Arquivo | Tamanho / tipo | Uso |
|---------|----------------|-----|
| `public/favicon.svg` | SVG (escalável) | Favicon principal |
| `public/apple-icon.svg` | SVG | Apple touch / PWA |
| `app/icon.svg` | SVG | Metadado Next (opcional, espelha favicon) |
| `app/apple-icon.svg` | SVG | Idem apple |
| `favicon.ico` | 16, 32, 48 px | Navegadores legados (gerador abaixo) |
| PNG **512×512** | Master | Fonte para redimensionar |
| PNG **192×192** | Android / PWA | `manifest` se existir |
| PNG **32×32** | Teste favicon | Preview aba do Chrome |

Geradores úteis: [realfavicongenerator.net](https://realfavicongenerator.net/), plugins Figma “Favicon” / export SVG.

Ordem sugerida após escolha do cliente:

1. Colocar SVG otimizado em `public/favicon.svg` e `public/apple-icon.svg`.
2. Atualizar `app/layout.tsx` → `metadata.icons` se mudar caminhos ou tipos.
3. Rodar `npm run build` e conferir aba + mobile.

---

## Prompts úteis (PT)

### Logomarca

- *Clássico:* “Wordmark elegante ‘Turquesa Agenda’, serif delicada, segunda palavra em turquesa #0D9488, fundo branco, vetor flat, salão de beleza”
- *Luxo blush:* “Logotipo script ‘Turquesa’ rose gold, ‘agenda’ sans pequena, harmonização facial, fundo blush claro”
- *Institucional:* “Lockup caps TURQUESA AGENDA, sans bold, petróleo #1B3A4B, tracking amplo, impressão e uniforme”

### Ícone de app

- *Clássico:* “App icon, elegant calendar with subtle frame, teal and navy salon brand, flat vector, white background, centered, readable at 32px, no small text”
- *Moderno:* “Minimal flat app icon, rounded square, teal gradient #0D9488, abstract schedule grid, iOS style, high contrast”
- *Monograma:* “App icon, monogram TA in circle, teal to navy gradient, beauty salon agenda, simple shapes, 512px square”

---

## O que evitar

- **Emoji** (📅, 💅) como ícone oficial — inconsistente entre OS e lojas.
- Texto longo “Turquesa Agenda” no favicon — ilegível em 16 px.
- Fundos fotográficos ou muito detalhados — perdem contraste na aba do navegador.
- Copiar packs genéricos sem adaptar à paleta escolhida no portfólio (**LOGO-***, **PALETA-***).

---

## Após a escolha do cliente

1. **Paleta + logo:** atualizar `project_summary.txt`, `lib/constants.ts` e assets de marca conforme códigos **PALETA-*** e **LOGO-***.
2. **Ícone de app:** atualizar `public/favicon.svg`, `public/apple-icon.svg`, `app/layout.tsx` (`icons`) e manifest PWA se houver.
3. Guardar arquivo fonte (Figma/PNG 512) fora do repo se for muito grande; manter só exports otimizados no Git.

Ver também: [`docs/PALETA_CORES.md`](PALETA_CORES.md) (link GitHub HTML Preview para o cliente).
