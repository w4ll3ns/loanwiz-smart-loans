## Atomizar criação de contrato com observações

### Migration
Recriar `criar_contrato_com_parcelas` adicionando `p_observacoes text DEFAULT NULL` no final da assinatura. O `INSERT INTO contratos` passa a incluir a coluna `observacoes`. Restante da lógica (validações, cálculo de valor total, geração de parcelas) permanece igual.

### Frontend (`src/services/contratos.ts`)
- Passar `p_observacoes: params.observacoes ?? null` na chamada `supabase.rpc("criar_contrato_com_parcelas", { ... })`.
- Remover o bloco que faz `UPDATE contratos SET observacoes` após a criação.

### Tipos
Tipos do Supabase serão regenerados automaticamente pela plataforma após a migration.

### Critério de aceite
- Criar contrato com observações grava tudo em uma única transação.
- Falha na RPC → nada é criado (rollback automático).
- Comportamento sem observações inalterado.