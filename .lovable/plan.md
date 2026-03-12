

## Plano: Registrar horario real da baixa no historico

### Problema

O fix anterior substituiu `new Date().toISOString()` por `dataPagamento + "T12:00:00"`, o que grava um horario ficticio (12:00 UTC = 09:00 local). O usuario quer ver o horario real em que a baixa foi feita.

### Causa raiz

Havia dois problemas distintos sendo misturados:
1. **`parcelas.data_pagamento`** (tipo `date`) -- aqui so importa a data, sem horario. O fix com `getLocalDateString()` esta correto.
2. **`parcelas_historico.data_pagamento`** (tipo `timestamp with time zone`) -- aqui o horario importa. Deve gravar o momento exato da acao, nao um horario inventado.

### Solucao

Nos inserts em `parcelas_historico`, usar `new Date().toISOString()` para capturar o momento real da baixa. O `"T12:00:00"` so era necessario para o campo `date` da tabela `parcelas`, nao para o `timestamp` do historico.

### Alteracoes em `src/pages/Parcelas.tsx`

**1. Linha ~266** - Pagamento no historico:
```typescript
// Antes:  data_pagamento: dataPagamento + "T12:00:00"
// Depois: data_pagamento: new Date().toISOString()
```

**2. Linha ~569** - Alteracao de data no historico:
```typescript
// Antes:  data_pagamento: getLocalDateString() + "T12:00:00"
// Depois: data_pagamento: new Date().toISOString()
```

O formato de exibicao com `HH:mm` nas linhas ~1158 e ~1222 permanece como esta, pois agora mostrara o horario real.

### Arquivo modificado

| Arquivo | Acao |
|---|---|
| `src/pages/Parcelas.tsx` | Usar `new Date().toISOString()` nos inserts de `parcelas_historico` (2 ocorrencias) |

