# Ícones de app com IA (favicon + PWA)

O portfólio `/paleta-cores` traz **logos e paletas** — não packs de ícone. Para favicon, botão “Adicionar à tela” e lojas, use ferramentas de design/IA e exporte assets vetoriais ou PNG em alta resolução (**não use emoji** como ícone de produto).

## Ferramentas recomendadas

| Ferramenta | Bom para | Estilos (exemplos) |
|------------|----------|-------------------|
| **Figma** + plugins (Iconify, Unsplash, vetorização) | Refinar SVG, grid 512px, variantes claro/escuro | Clássico, moderno flat, monograma |
| **Recraft.ai** | Ícones vetoriais consistentes, séries no mesmo estilo | Aqua, minimal, marca turquesa |
| **Ideogram** | Conceitos com tipografia integrada (cuidado com texto ilegível em 32px) | Display, luxo salon |
| **Midjourney** | Exploração visual forte (exportar e vetorizar depois) | Steampunk, neon lash, champagne VIP |
| **DALL·E** (ChatGPT) | Rascunhos rápidos; pedir fundo simples e contraste alto | Moderno, blush |
| **Iconik AI** / **Icons8 AI** | Packs de ícone app com tamanhos prontos | Flat, glass, calendar |
| **Adobe Firefly** | Uso comercial claro; integração Creative Cloud | Editorial beauty |
| **Canva** (Magic Media) | Mockups + export; menos preciso para favicon 16px | Redes, apresentação cliente |

Para **steampunk**, **aqua** ou **clássico calendário**, gere 3–5 variações na mesma ferramenta com o mesmo prompt-base (paleta do `project_summary.txt`: petróleo `#1B3A4B`, turquesa `#0D9488`).

## Fluxo sugerido

1. **Brief:** “Ícone de app para agenda de salão de beleza, monograma TA ou calendário, fundo sólido ou gradiente suave, legível em 32×32 px”.
2. **Gerar** PNG ou SVG em **512×512 px** (canvas quadrado).
3. **Refinar** no Figma: simplificar detalhes, alinhar ao pixel grid, testar em 32 / 64 / 180 px.
4. **Exportar para o Next.js** (`public/`):
   - `favicon.svg` — preferencial (escala bem)
   - `favicon.ico` — 16/32/48 (gerador: [realfavicongenerator.net](https://realfavicongenerator.net/) ou Figma plugin)
   - `apple-icon.svg` / `icon.svg` — conforme `app/layout.tsx` e metadados PWA
5. **Validar** no Chrome DevTools → Application → Manifest; aba anônima em `http://localhost:3000`.

## Prompts úteis (PT)

- *Clássico:* “App icon, elegant calendar with subtle serif frame, teal and navy salon brand, flat vector, white background, centered, no text under 32px”
- *Moderno:* “Minimal flat app icon, rounded square, teal gradient, abstract schedule grid, iOS style, high contrast”
- *Aqua:* “Aqua spa droplet app icon, cyan to teal gradient, glossy but simple shapes, beauty salon”
- *Steampunk:* “Steampunk brass gear app icon, dark brown background, copper accents, beauty studio vintage, simplified for small size”

## O que evitar

- Emoji (📅, 💅) como ícone oficial — inconsistente entre OS e lojas.
- Texto longo “Turquesa Agenda” no favicon — ilegível em 16px.
- Fundos fotográficos busy — perdem contraste na aba do navegador.

## Após escolha do cliente

Atualizar `public/favicon.svg`, `public/apple-icon.svg`, `app/layout.tsx` (`icons`) e, se houver, manifest PWA. Documentar o arquivo fonte (Figma/PNG) fora do repo se for grande.
