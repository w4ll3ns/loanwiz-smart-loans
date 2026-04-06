

## Corrigir divergência no cálculo de lucro entre Dashboard e Parcelas

### Causa raiz

O Dashboard calcula lucro sobre **todas as parcelas com valor_pago > 0**, independente do status. A tela de Parcelas filtra apenas status `"pago"` ou `"parcialmente_pago"`.

Isso significa que se alguma parcela "pendente" tiver um `valor_pago` residual (ex: reset de pagamento, ajuste manual), o Dashboard conta esse valor como lucro mas Parcelas não.

### Correção

**Arquivo**: `src/pages/Dashboard.tsx`

Adicionar o mesmo filtro de status usado em Parcelas.tsx antes do reduce do lucro:

```typescript
const lucro = parcelas
  ?.filter(p => p.status === "pago" || p.status === "parcialmente_pago")
  .reduce((sum, p) => {
    const valorPago = Number(p.valor_pago) || 0;
    if (valorPago <= 0) return sum;
    const valorEmprestado = Number(p.contratos?.valor_emprestado) || 0;
    const numeroParcelas = Number(p.contratos?.numero_parcelas) || 1;
    const principalParcela = valorEmprestado / numeroParcelas;
    const lucroParcela = valorPago - principalParcela;
    return sum + Math.max(lucroParcela, 0);
  }, 0) || 0;
```

Nenhuma outra alteração necessária. Isso garante que ambas as telas usem exatamente a mesma lógica.

