## Objetivo

Corrigir a data do empréstimo do contrato de R$ 700,00 da cliente **SOLANGE GOMES DE OLIVEIRA LEDA**, que foi gravada errada por troca de dia/mês.

## Diagnóstico

- Contrato `id`: `70882347-f69c-402e-bfea-98f9b6351c5a`
- Cadastrado no sistema em **07/04/2026** (`created_at`)
- Data do empréstimo atual (errada): **04/07/2026** (`data_emprestimo = 2026-07-04`)
- Causa: dígitos de dia e mês invertidos (`04/07` em vez de `07/04`)

## Correção

Atualizar **apenas** o campo `data_emprestimo` do contrato:

- De `2026-07-04` → para `2026-04-07`

As parcelas **não serão alteradas** (conforme sua escolha): as datas de vencimento e o pagamento parcial já registrado na 1ª parcela permanecem intactos.

## Detalhe técnico

Operação de atualização de dado (não é mudança de schema):

```sql
UPDATE public.contratos
SET data_emprestimo = '2026-04-07', updated_at = now()
WHERE id = '70882347-f69c-402e-bfea-98f9b6351c5a';
```

Após aplicar, valido no banco que a `data_emprestimo` ficou `2026-04-07` e que as parcelas continuam inalteradas.
