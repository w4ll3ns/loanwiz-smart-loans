# Corrigir exibição de atraso em parcelas quitadas

## Problema
No card de parcela (`src/pages/Parcelas.tsx`, linha 531-533), o texto "Xd atraso" aparece sempre que `calcularDiasAtraso(parcela.data_vencimento) > 0`, independentemente do status. Por isso parcelas com status **Pago** ainda mostram "223d atraso" (ver imagem).

## Solução
Condicionar a exibição do atraso ao status da parcela: só mostrar quando **não** estiver quitada (`parcela.status !== "pago"`).

Trocar a condição:
```
{calcularDiasAtraso(parcela.data_vencimento) > 0 && (
```
por:
```
{parcela.status !== "pago" && calcularDiasAtraso(parcela.data_vencimento) > 0 && (
```

## Observações
- Mudança puramente de apresentação (frontend), sem alterar lógica de negócio ou banco.
- A borda esquerda do card (linha 509) já trata `status === "pago"` corretamente, então não precisa de ajuste.
- Verificar também a visão mobile do calendário se necessário, mas a tela do print é a de Parcelas.
