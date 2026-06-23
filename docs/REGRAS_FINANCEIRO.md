# Regras financeiras — Turquesa Agenda (salão)

Documento de referência para repasse às profissionais e taxas de meios de pagamento.

## Fórmula de repasse

Para cada atendimento pago:

1. **Valor bruto** — valor cobrado do cliente (após descontos, se houver).
2. **Taxa do meio de pagamento** — conforme cadastro em **Configurações → Meios de pagamento**.
   - PIX / dinheiro / transferência: taxa fixa em R$.
   - Débito e crédito (1x a 12x): percentual sobre o bruto.
3. **Valor líquido** = bruto − taxa *(somente se “Repassar custo para profissional” estiver ativo)*.
4. **Parte da profissional** = líquido × (`percentual_profissional` ÷ 100).
5. **Parte do salão** = líquido − parte da profissional.

### Exemplo

| Etapa | Valor |
|-------|------:|
| Bruto | R$ 100,00 |
| Taxa cartão 3,6% | R$ 3,60 |
| Líquido | R$ 96,40 |
| Comissão profissional 50% | R$ 48,20 |
| Parte do salão | R$ 48,20 |

## Onde configurar

- **Meios de pagamento e taxas:** `/dashboard/configuracoes` (seção Meios de pagamento).
- **Comissão padrão da profissional:** Meu Perfil → Equipe (`percentual_comissao` no banco).
- **Comissão por atendimento:** modal “Atendimento avulso” ou “Finalizar atendimento” na agenda (`percentual_profissional`).

## Relatório

Em **Financeiro → Repasse profissionais**, filtre por período e profissional. Colunas: bruto, taxa, líquido, parte profissional, parte salão.

## Campos no banco (Supabase)

- `financeiro_transacoes`: `valor_bruto`, `taxa_pagamento`, `valor_liquido`, `percentual_profissional`, `valor_profissional`, `valor_salao`, `forma_pagamento`, `parcelas`, `repassar_custo`.
- `onboarding_profiles`: `config_pagamento_metodos` (JSON), `repassar_custo_profissional`.
- `clinica_medicos`: `percentual_comissao`.

## Migrações SQL

```bash
npm run db:config-pagamento
npm run db:financeiro-profissional
npm run db:catalogo
```
