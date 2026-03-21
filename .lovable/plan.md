

## Plano: Indicador visual de pagamento total vs parcial nos cards de parcelas

### Problema atual

A funcao `getStatusBadge` nao diferencia entre "pago" e "parcialmente_pago". Parcelas com status `parcialmente_pago` caem no bloco de "Pendente" ou "Atrasado", sem indicacao clara de que ja houve pagamento parcial.

### Alteracoes em `src/pages/Parcelas.tsx`

**1. Atualizar `getStatusBadge` (linhas 607-618)** para tratar `parcialmente_pago` como um status distinto:

```ts
const getStatusBadge = (parcela: Parcela) => {
  if (parcela.status === "pago") {
    return <Badge variant="default" className="bg-success">Pago Total</Badge>;
  }

  if (parcela.status === "parcialmente_pago") {
    const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
    if (diasAtraso > 0) {
      return <Badge className="bg-amber-500 text-white">Parcial - Atrasado ({diasAtraso}d)</Badge>;
    }
    return <Badge className="bg-amber-500 text-white">Pago Parcial</Badge>;
  }

  const diasAtraso = calcularDiasAtraso(parcela.data_vencimento);
  if (diasAtraso > 0) {
    return <Badge variant="destructive">Atrasado ({diasAtraso}d)</Badge>;
  }

  return <Badge variant="secondary">Pendente</Badge>;
};
```

**2. Cards mobile (linhas 836-840)** - Ja mostram "Pago: R$ X" quando `valor_pago > 0`. Adicionar tambem o **saldo restante** para parcelas parcialmente pagas:

Apos a linha que mostra "Pago: R$ X", adicionar:
```tsx
{parcela.status === "parcialmente_pago" && parcela.valor_pago && (
  <p className="text-xs text-amber-600 break-all">
    Resta: R$ {(Number(parcela.valor_original || parcela.valor) - Number(parcela.valor_pago)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
  </p>
)}
```

**3. Tabela desktop** - O badge ja e renderizado por `getStatusBadge`, entao a atualizacao da funcao cobre automaticamente a view desktop. Adicionar coluna de saldo restante nao e necessario pois ja existe a coluna "Valor Pago".

### Resultado visual

- **Pago Total**: badge verde "Pago Total"
- **Pago Parcial (em dia)**: badge amber/amarelo "Pago Parcial" + texto "Resta: R$ X"
- **Pago Parcial (atrasado)**: badge amber "Parcial - Atrasado (Xd)"
- **Pendente**: badge cinza "Pendente" (sem mudanca)
- **Atrasado**: badge vermelho "Atrasado (Xd)" (sem mudanca)

| Arquivo | Acao |
|---|---|
| `src/pages/Parcelas.tsx` | Atualizar `getStatusBadge` + adicionar saldo restante nos cards mobile |

