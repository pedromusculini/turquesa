# Pendências e backlog

Lista interna — atualizar ao fechar itens.

**Última revisão:** 2026-06-16

## Release pendente (código local)

| Item | Descrição |
|------|-----------|
| **Simplificação status sessão** | Opção leve: badge só Finalizada/Cancelada/Faltou; status único `confirmado` na criação. Arquivos alterados, **ainda sem commit** quando esta nota foi criada. |

Quando for publicar:

```bash
npm run build
npm run test:e2e
git add …
git commit -m "refactor(agenda): simplifica status sessão para salão"
npm run release
```

## Melhorias futuras (não urgentes)

| Prioridade | Item |
|------------|------|
| Baixa | Virtualização de listas 200+ itens (`react-window`) |
| Baixa | Endpoint só metadata Google/Drive (sem lista completa de clientes no mount) |
| Baixa | Botão “Cancelar sessão” / “Faltou” na UI (status já existem no modelo) |
| Baixa | Migrar SQL `clinica_medicos` → nomenclatura salão |
| Média | i18n en-US (Prompt E — fase separada) |

## Documentação

| Item | Status |
|------|--------|
| Revisão geral `docs/` | 2026-06-16 |
| `project_summary.txt` | Atualizado jun/2026 |

## Produção recente (referência)

Commits de performance/UI em jun/2026: cache catálogo, fases B/C sync leve, polish `pacientes-opcoes` limit, singleton touch pointer (`f8424be` e anteriores).
