

## Problema: Cálculo de Lucro no Dashboard está errado

O Dashboard e a tela de Parcelas usam fórmulas **diferentes** para calcular o lucro:

**Dashboard (ERRADO):**
```
lucro = totalRecebido - totalEmprestado
```
Simplesmente subtrai o capital total emprestado (contratos ativos) do total recebido (todas as parcelas pagas). Isso ignora que parte do valor recebido é devolução do capital principal.

**Parcelas (CORRETO):**
```
Para cada parcela paga:
  principalParcela = valor_emprestado / numero_parcelas
  lucro = valor_pago - principalParcela
```
Desconta o principal proporcional de cada parcela, contando apenas os juros efetivamente recebidos como lucro.

### Exemplo prático
- Emprestou R$ 10.000 em 10 parcelas de R$ 1.500 (R$ 500 de juros por parcela)
- 5 parcelas pagas = R$ 7.500 recebido
- **Dashboard atual**: lucro = 7.500 - 10.000 = **-R$ 2.500** (ERRADO, mostra prejuízo!)
- **Cálculo correto**: lucro = 5 × R$ 500 = **R$ 2.500** (juros recebidos)

### Plano de correção

**Arquivo**: `src/pages/Dashboard.tsx`

1. Buscar parcelas com dados do contrato (já faz isso via join)
2. Substituir o cálculo do lucro pela mesma lógica da tela de Parcelas:
   - Para cada parcela paga/parcialmente paga, calcular `valor_pago - (valor_emprestado / numero_parcelas)`
   - Somar apenas valores positivos (`Math.max(lucro, 0)`)
3. Atualizar o label do card de "Recebido - Emprestado" para "Lucro sobre capital" (consistente com Parcelas)
4. Garantir que a query de parcelas inclui `valor_emprestado` e `numero_parcelas` do contrato no join

**Nenhuma migração necessária** — apenas correção de lógica no frontend.

