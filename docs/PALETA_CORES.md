# Paleta de cores — compartilhar com o cliente

Portfólio estático para escolha das cores do **Turquesa Agenda**, sem deploy na Vercel do produto.

## Link para enviar ao cliente (recomendado)

Após push na branch `master` do repositório [pedromusculini/turquesa](https://github.com/pedromusculini/turquesa):

**HTML Preview (GitHub):**

```
https://htmlpreview.github.io/?https://github.com/pedromusculini/turquesa/blob/master/docs/paleta-cores.html
```

Abra no navegador; não exige login. Atualiza automaticamente após cada push em `docs/paleta-cores.html`.

## Alternativa: GitHub Pages

Se quiser URL fixa sem `htmlpreview.github.io`:

1. No GitHub: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `master`, pasta **`/docs`**
4. URL típica: `https://pedromusculini.github.io/turquesa/paleta-cores.html`

Requer ativar Pages uma vez; o preview acima funciona sem isso.

## Local (desenvolvimento)

| Método | Como |
|--------|------|
| Arquivo | Abrir `docs/paleta-cores.html` no navegador (`file://`) |
| Servidor | Na raiz do repo: `npx serve docs` → abrir o caminho indicado no terminal |

## App Next (dev)

Rota local com a mesma lógica em React: `http://localhost:3000/paleta-cores` (`npm run dev`).

A página inclui banner com link para a versão GitHub acima.

## medsupapp.com.br (opcional)

Só se você copiar manualmente `docs/paleta-cores.html` para o repo/site do MedSup e publicar lá. **Não é necessário** para o Turquesa Agenda; o host canônico da paleta é o GitHub.

## Fonte da verdade no código

- Dados: `lib/paletaCores.ts`
- UI dev: `app/paleta-cores/page.tsx`, `components/PaletaCoresClient.tsx`
- HTML estático: `docs/paleta-cores.html` (manter sincronizado ao alterar paletas)

## Após a escolha do cliente

Atualizar `project_summary.txt` e `lib/constants.ts` com os HEX definitivos.
