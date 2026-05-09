# Permitir Exclusão de Contratos

## Análise da regra

A premissa "contratos sem nenhuma parcela paga podem ser excluídos sem problema" está **correta e é a abordagem mais segura**. Justificativa:

- **Sem pagamentos** → não há histórico financeiro nem dinheiro recebido para rastrear. Excluir é seguro e reversível conceitualmente (basta recriar).
- **Com pelo menos uma parcela paga** (total, parcial ou só juros) → existe valor recebido, registros em `parcelas_historico`, métricas de Dashboard (lucro, recebido hoje, capital em circulação) que ficariam distorcidas se o contrato sumisse. **Bloquear** é o correto.
- **Contratos quitados** → também não devem ser excluídos (representam histórico fechado e impactam relatórios). Para "limpar" a lista, o filtro "Ativos" já esconde quitados.

Adicional: por segurança, a exclusão fica restrita ao **dono do contrato** (RLS já garante isso) e é uma ação destrutiva, então pede confirmação explícita.

## Onde fica o botão

Dentro do modal **`ContratoDetails`** (que já abre ao clicar num contrato), no rodapé/cabeçalho de ações, ao lado de "Renovar". O botão só aparece quando a regra permite (sem parcelas pagas e status ≠ quitado). Caso contrário, mostrar tooltip/mensagem explicativa: *"Contratos com parcelas pagas não podem ser excluídos. Para encerrar, aguarde a quitação."*

## Fluxo do usuário

1. Abre o contrato.
2. Vê botão **"Excluir contrato"** (vermelho, ícone lixeira) — habilitado só se elegível.
3. Clica → `AlertDialog` de confirmação: *"Excluir contrato de {Cliente}? Esta ação remove o contrato e suas {N} parcelas. Não pode ser desfeita."*
4. Confirma → exclusão → toast de sucesso → fecha modal → recarrega lista.

## Implementação técnica

### 1. Nova função no banco (`supabase/migrations`)

`excluir_contrato(p_contrato_id uuid)` — `SECURITY DEFINER`, valida:
- `auth.uid()` é dono do contrato (via `clientes.user_id`).
- Não existe nenhuma parcela com `status IN ('pago')` **nem** com `valor_pago > 0` (cobre pagamentos parciais/juros).
- Status do contrato ≠ `'quitado'`.

Se passar: `DELETE FROM parcelas_historico` (das parcelas do contrato) → `DELETE FROM parcelas` → `DELETE FROM contratos`. Tudo em uma transação implícita da função.

Erros lançados com mensagens claras (`Cannot delete contract with payments`, etc.) para o frontend traduzir.

### 2. Service (`src/services/contratos.ts`)

Adicionar `excluirContrato(contratoId: string)` que chama `supabase.rpc("excluir_contrato", { p_contrato_id })`.

### 3. UI (`src/components/contratos/ContratoDetails.tsx`)

- Helper `podeExcluir = parcelas.every(p => p.status !== 'pago' && (!p.valor_pago || Number(p.valor_pago) === 0)) && contrato.status !== 'quitado'`.
- Botão **"Excluir"** com `variant="destructive"` no header de ações, ao lado de "Renovar". Desabilitado quando `!podeExcluir`, com tooltip explicando o motivo.
- `AlertDialog` de confirmação reaproveitando o padrão já usado no arquivo.
- Ao confirmar: chama service, mostra toast, fecha modal, dispara `onContratoUpdated()` (que já recarrega a lista em `Contratos.tsx`).

### 4. Sem mudanças em RLS

As policies de DELETE em `contratos`/`parcelas`/`parcelas_historico` já existem e permitem ao dono apagar. A função `SECURITY DEFINER` apenas centraliza a regra de negócio e a ordem dos deletes.

## Arquivos

- **Criar migração**: nova função `excluir_contrato`.
- **Editar**: `src/services/contratos.ts` (+ função wrapper).
- **Editar**: `src/components/contratos/ContratoDetails.tsx` (botão + dialog + handler).

## Pontos abertos para você decidir

- Quer permitir que **admins** excluam qualquer contrato (mesmo com pagamentos)? Por padrão a proposta é **não** — manter histórico financeiro intacto.
- Quer registrar a exclusão em `audit_logs`? Útil se você quer rastrear quem apagou o quê.
