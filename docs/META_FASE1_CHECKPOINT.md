# Meta Ads — Fase 1 (checkpoint 06/09/2026)

**Campanha:** Vendas - trial - ago26 · **R$ 15/dia** · **1 conjunto**  
**Anúncios ativos:** vídeo (`Novo anúncio de Vendas 2`) + carrossel (`Onda3 - Carrossel dor real`)  
**Período:** 23/08/2026 → 06/09/2026 (~R$ 210)

## Gerar relatório

```bash
npm run meta:fase1-report
```

Com data final explícita:

```bash
npm run meta:fase1-report -- --until 2026-09-06
```

Saída: terminal + `assets/ads/meta/fase1-report-latest.json`

## Automação Cursor (06/09/2026 · 9h BRT)

Automação **“Meta Fase 1 checkpoint Turquesa”** agendada para rodar no dia do checkpoint e:

1. Executar `npm run meta:fase1-report`
2. Atualizar canvas `sales-campaign-checkpoint`
3. Resumir gasto, LPV, trials e vencedor vídeo vs carrossel

## Metas Fase 1

| Métrica | Alvo |
|---|---|
| Gasto | ~R$ 210 |
| Cliques | ≥ 15 |
| LPV | ≥ 3 |
| Trials (produto) | ≥ 1 (bom: ≥ 3) |

## Decisão pós-checkpoint

| Trials | Próximo passo |
|---|---|
| ≥ 3 | Fase 2 — subir para R$ 20/dia |
| 1–2 | Manter R$ 15/dia + 2 semanas |
| 0 + LPV ok | Revisar LP/onboarding (Clarity + pixel) |
| 0 + LPV baixo | Criativo ou budget — não mudar LP ainda |

## Não fazer na Fase 1

- Reativar estáticos soltos (já estão no carrossel)
- Abrir campanha LPV paralela
- Subir budget antes de 2 trials + pixel ok
