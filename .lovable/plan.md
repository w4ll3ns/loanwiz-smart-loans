

## Plano: Corrigir Problemas de Timezone nas Datas de Pagamento

### Problema Identificado

Ha dois bugs de timezone que causam pagamentos aparecendo no dia errado:

**Bug 1 - Gravacao do pagamento (Parcelas.tsx, linha 259):**
```
data_pagamento: new Date(dataPagamento).toISOString()
```
`dataPagamento` e uma string como `"2026-03-12"`. O `new Date("2026-03-12")` interpreta como **UTC meia-noite**, e o `.toISOString()` mantem em UTC. Para um usuario no Brasil (UTC-3), isso grava o timestamp como `2026-03-12T00:00:00.000Z`, que corresponde a `2026-03-11T21:00:00` no horario local. O resultado e que o pagamento pode aparecer no dia anterior.

**Bug 2 - Consulta "Recebido Hoje" (Parcelas.tsx, linha 109):**
```
const hoje = new Date().toISOString().split('T')[0]
```
Usa `toISOString()` que converte para UTC. Apos as 21h no Brasil, `hoje` ja seria o dia seguinte em UTC, causando divergencia no filtro.

**Bug 3 - Estorno recalcula data (Parcelas.tsx, linha 448):**
```
data_pagamento: novoValorPago >= valorOriginal ? new Date().toISOString().split('T')[0] : null
```
Mesmo problema de UTC.

### Solucao

**1. Criar funcao utilitaria para obter data local**

```typescript
function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**2. Corrigir gravacao do pagamento em `Parcelas.tsx`**

Linha 259 - Ao gravar no historico, usar a data selecionada com horario local meio-dia para evitar shift de timezone:
```typescript
// Antes:  new Date(dataPagamento).toISOString()
// Depois: dataPagamento + "T12:00:00"
```

**3. Corrigir consulta "Recebido Hoje" em `Parcelas.tsx`**

Linha 109 - Usar `getLocalDateString()` em vez de `new Date().toISOString().split('T')[0]`

**4. Corrigir estorno em `Parcelas.tsx`**

Linha 448 - Usar `getLocalDateString()` em vez de `new Date().toISOString().split('T')[0]`

**5. Corrigir evento de alteracao de data em `Parcelas.tsx`**

Linha 562 - Mesmo padrao: `dataPagamento + "T12:00:00"` ou `getLocalDateString() + "T12:00:00"`

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/pages/Parcelas.tsx` | Corrigir todas as conversoes de data que usam `toISOString()` ou `new Date("YYYY-MM-DD")` |

