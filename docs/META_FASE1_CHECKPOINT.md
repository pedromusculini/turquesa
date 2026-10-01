# Meta Ads — plano vigente: Fase 2 (desde ~07/09/2026)

> A Fase 1 abaixo (R$ 15/dia) é **histórico**. O plano em vigor foi recomendado pelo agente em ago/2026
> e aplicado na conta:

| Item | Valor |
|---|---|
| Orçamento | **R$ 80/dia** na `Vendas - trial - ago26` (faixa recomendada R$ 70–100/dia) |
| Meta | **~50 trials em 90 dias** (≈ 07/09 → 06/12/2026) para o algoritmo sair do aprendizado |
| Teto de caixa | R$ 10–15 mil no período, se o CPA ficar na faixa realista |
| Evento otimizado | `CompleteRegistration` (pixel + CAPI, dedup por `event_id`) |

**Setembro/2026:** R$ 2.099 de gasto · 14 trials brutos / 13 sem contas internas · ritmo ≈ 39 trials em 90 dias
(abaixo da meta) · 0 pagantes ainda (trials vencem em outubro).

Relatório mensal: `npm run meta:fase1-report -- --from AAAA-MM-01 --until AAAA-MM-DD`
(exclui contas de teste/internas, marca duplicados pelo WhatsApp e mostra quem pagou).

---

# Meta Ads — Fase 1 (checkpoint 06/09/2026) — histórico

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
