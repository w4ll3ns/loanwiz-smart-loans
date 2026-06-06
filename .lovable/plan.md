# Planilha completa de Contratos e Parcelas

## Objetivo
Na página **Contratos**, adicionar a opção de baixar uma planilha Excel (.xlsx) completa, com 3 abas — **Contratos**, **Parcelas** e **Histórico** — para que o usuário possa exportar sempre que precisar. A planilha respeita os filtros ativos na tela (Ativos/Quitados/Todos e a busca por nome).

## Comportamento
- Novo botão **"Planilha"** (ícone de planilha) ao lado do botão **CSV** já existente, no cabeçalho da lista.
- Ao clicar:
  1. Coleta os contratos atualmente filtrados (mesma lista do `contratosFiltrados`).
  2. Busca no banco todas as parcelas desses contratos e todo o histórico (`parcelas_historico`) dessas parcelas.
  3. Gera um arquivo `contratos-parcelas.xlsx` com 3 abas e dispara o download.
- Enquanto carrega, o botão mostra estado "Gerando..." (desabilitado) e um toast de sucesso/erro ao final.
- Se a lista filtrada estiver vazia, exibe um toast informando que não há dados para exportar.

## Conteúdo das abas

**Aba "Contratos"**
- Cliente, Valor Emprestado, Percentual (%), Tipo de Juros, Periodicidade, Nº de Parcelas, Data do Empréstimo, Valor Total, Status, Observações.

**Aba "Parcelas"**
- Cliente, Contrato (referência), Nº da Parcela, Valor, Valor Original, Vencimento, Status, Data de Pagamento, Valor Pago.
- Uma linha por parcela, agrupadas por cliente/contrato.

**Aba "Histórico"**
- Cliente, Nº da Parcela, Tipo de Evento (pagamento/edição/estorno), Tipo de Pagamento (total/juros/parcial), Valor Pago, Data do Pagamento, Vencimento Anterior, Vencimento Novo, Observação.
- Reflete os registros de `parcelas_historico` (juros, pagamentos parciais, totais e estornos), seguindo as regras já existentes do projeto.

Valores monetários formatados em padrão BR e datas em formato legível (dd/mm/aaaa).

## Detalhes técnicos
- Adicionar dependência **`xlsx`** (SheetJS) para gerar o arquivo `.xlsx` com múltiplas abas no client-side (export 100% no frontend, sem mudanças de backend).
- Criar `src/lib/exportXlsx.ts` com uma função utilitária genérica (recebe nome do arquivo + lista de abas `{ nome, headers, rows }`) usando `XLSX.utils.aoa_to_sheet` / `book_append_sheet` / `writeFile`, ajustando larguras de coluna.
- Criar uma função de montagem de dados em `src/pages/Contratos.tsx` (ou um pequeno helper em `src/components/contratos/`) que:
  - usa `contratosFiltrados` para a aba Contratos;
  - faz `supabase.from("parcelas").select("*").in("contrato_id", ids)` para as parcelas;
  - faz `supabase.from("parcelas_historico").select("*").in("parcela_id", parcelaIds)` para o histórico;
  - mapeia tudo para linhas, resolvendo o nome do cliente via os contratos já carregados.
- O RLS garante que só os dados do próprio usuário sejam retornados (sem alterações de permissão).
- Reaproveitar `getLocalDateString`/formatação de datas já usada no projeto para consistência de fuso horário.
- Sem alterações em regras de negócio, migrações ou edge functions.

## Fora de escopo
- Não altera o botão CSV existente (continua exportando só contratos).
- Não adiciona exportação em outras páginas (Parcelas, Dashboard) — apenas em Contratos, conforme solicitado.
