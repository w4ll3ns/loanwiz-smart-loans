

## Plano: Adicionar card "Total Juros/Lucro Recebido"

### Logica de calculo

Para cada parcela paga (ou parcialmente paga), o lucro recebido e:

```
valor_pago - (valor_emprestado / numero_parcelas)
```

Ou seja, do total recebido, subtrai-se a parte do principal. O restante e juros/lucro. Isso usa a mesma logica ja existente em `calcularJuros`.

### Alteracoes em `src/pages/Parcelas.tsx`

**1. Novo calculo do dashboard** (junto aos outros, ~linha 638):

```ts
const totalJurosRecebido = dashboardParcelas
  .filter(p => p.status === "pago" || p.status === "parcialmente_pago")
  .reduce((acc, p) => {
    const valorEmprestado = Number(p.contratos?.valor_emprestado || 0);
    const numeroParcelas = p.contratos?.numero_parcelas || 1;
    const principalParcela = valorEmprestado / numeroParcelas;
    const pago = Number(p.valor_pago) || 0;
    const lucro = pago - principalParcela;
    return acc + Math.max(lucro, 0);
  }, 0);
```

**2. Grid de cards**: Mudar de `grid-cols-2 md:grid-cols-4` para `grid-cols-2 md:grid-cols-5` (linha 695).

**3. Novo card** apos "Total Recebido" (apos linha 742):

- Titulo: "Juros Recebidos"
- Icone: `TrendingUp` (importar de lucide-react)
- Cor: texto em verde/emerald para diferenciar
- Subtexto: "Lucro sobre capital"

| Arquivo | Acao |
|---|---|
| `src/pages/Parcelas.tsx` | Adicionar calculo + card de juros recebidos |

