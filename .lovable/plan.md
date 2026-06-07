# Ajustes no Dashboard

Todas as mudanças são em `src/pages/Dashboard.tsx`. Sem alterações em RPC, serviços ou lógica de dados.

## 1. Gráfico "Fluxo de Capital Mensal" → barras + linha de saldo
- Atualizar import do `recharts` para incluir `ComposedChart`, `Line`, `Legend`, `ReferenceLine` (mantendo `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, etc.).
- Antes do render do gráfico, derivar:
  ```ts
  const capitalComSaldo = capitalMensal.map(c => ({
    ...c,
    saldo: Number((c.recebido - c.emprestado).toFixed(2)),
  }));
  ```
- Substituir `BarChart` por `ComposedChart` usando `capitalComSaldo` como `data`.
- Manter as 2 barras: `emprestado` em `hsl(var(--primary))` e `recebido` em `hsl(var(--success))`, ambas `radius={[4,4,0,0]}`.
- Adicionar `<ReferenceLine y={0} stroke="hsl(var(--border))" />`.
- Adicionar `<Line type="monotone" dataKey="saldo" stroke="hsl(var(--foreground))" strokeWidth={2} dot name="Saldo do mês" />`.
- Adicionar `<Legend>` com `fontSize: 11`.
- Tooltip: formatar os 3 valores em R$ (pt-BR); para `saldo` mostrar sinal `+` se positivo e `−` se negativo. Adicionar `saldo` ao `config` do `ChartContainer`.
- Cores propositais: `emprestado` permanece azul (primary), não vermelho.

## 2. Nova fileira de KPIs de saúde da carteira
Inserida logo após a fileira de KPIs financeiros atual, antes dos gráficos. Reaproveitando estilo `stat-card-accent`, em `grid grid-cols-2`:
- **Em atraso**: `R$ {stats.valorVencido}` em pt-BR, cor `hsl(var(--destructive))`, ícone `AlertTriangle`. Subtítulo: `{stats.parcelasVencidas} parcela(s)`.
- **Inadimplência**: percentual = `stats.totalReceber > 0 ? (stats.valorVencido / stats.totalReceber * 100) : 0`, exibido com 1 casa decimal + `%`. Cor condicional: success se `< 10`, warning se `10–25`, destructive se `> 25`. Ícone `Percent`.

## 3. Renomear KPI
- "Capital em Circulação" → "Capital aplicado".

## 4. Limpeza
- Remover o terceiro `Link` ("contratos ativos / Em andamento") do bloco "Ações pendentes".
- Remover import de `useToast` e a linha `const { toast } = useToast();`.
- Em "Próximos vencimentos", trocar `key={index}` por `key={`${parcela.cliente}-${parcela.data}-${index}`}`.

## 5. Preservar
- Sem mudanças em lógica de dados, RPC ou outros cards.
- Manter responsividade (`grid-cols-2` no mobile) e tema claro/escuro.

## Detalhes técnicos
- Importar `Percent` de `lucide-react` (e remover `useToast` de `@/hooks/use-toast`).
- O `config` do `ChartContainer` do fluxo de capital ganha a chave `saldo` (label "Saldo do mês", color `hsl(var(--foreground))`).
- Helper de formatação do saldo no tooltip: `(v >= 0 ? "+" : "−") + "R$ " + Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2})`.