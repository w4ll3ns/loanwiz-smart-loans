# Locks pessimistas em RPCs financeiras

## Objetivo
Eliminar race conditions em `recalcular_contrato_parcelas`, `registrar_pagamento_parcela` e `estornar_pagamento_parcela` quando o mesmo contrato/parcela é manipulado em paralelo (PWA em múltiplos dispositivos, automações).

## Mudanças

### 1. Nova migration (apenas recriação das 3 funções)

Cada função mantém assinatura, validações, lógica de negócio e auditoria já existentes. A única alteração é adicionar `FOR UPDATE` no SELECT que carrega a entidade central, garantindo lock exclusivo de linha até o fim da transação. Postgres serializa as transações concorrentes: a segunda espera a primeira terminar e então reavalia o estado (status, valor_pago) — se já não for válido, cai nos `RAISE EXCEPTION` existentes (`Installment is already fully paid`, `Cannot edit a settled contract`, etc.).

#### `recalcular_contrato_parcelas(p_contrato_id, p_tipo_juros, p_percentual)`
- SELECT inicial passa a ser:
  ```sql
  SELECT c.*, cl.user_id INTO v_contrato
  FROM contratos c
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE c.id = p_contrato_id
  FOR UPDATE OF c;
  ```
- Resto do corpo inalterado.

#### `registrar_pagamento_parcela(p_parcela_id, p_tipo, p_valor, p_data_pagamento, p_observacao)`
- SELECT inicial da parcela passa a ser:
  ```sql
  SELECT p.*, c.id as contrato_id_ref, c.valor_emprestado, c.numero_parcelas,
         c.percentual, c.tipo_juros, c.status as contrato_status
  INTO v_parcela
  FROM parcelas p
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id
  FOR UPDATE OF p, c;
  ```
- Lock também no contrato (`OF p, c`) porque a função pode atualizar `contratos.status = 'quitado'` no final — evita lost update do status quando duas parcelas distintas do mesmo contrato são quitadas em paralelo.
- Resto inalterado.

#### `estornar_pagamento_parcela(p_parcela_id)`
- SELECT inicial passa a ser:
  ```sql
  SELECT p.*, c.id as contrato_id_ref, c.status as contrato_status
  INTO v_parcela
  FROM parcelas p
  JOIN contratos c ON p.contrato_id = c.id
  JOIN clientes cl ON c.cliente_id = cl.id
  WHERE p.id = p_parcela_id AND cl.user_id = v_user_id
  FOR UPDATE OF p, c;
  ```
- Resto inalterado (já segue o mesmo padrão usado em `excluir_evento_historico`).

### 2. Sem mudanças no frontend
A semântica das RPCs não muda. Em caso de conflito real (segunda chamada vê parcela já paga), o erro retornado é o `RAISE EXCEPTION 'Installment is already fully paid'` que o cliente já trata via toast de erro.

### 3. Sem mudanças nos tipos do Supabase
Assinaturas idênticas, regeneração não necessária.

## Critério de aceite
- Pagar a mesma parcela em duas abas simultâneas: uma transação obtém o lock, conclui o INSERT em `parcelas_historico` + UPDATE em `parcelas`. A segunda espera, relê com o novo estado (`status = 'pago'`) e dispara `Installment is already fully paid`.
- `valor_pago` nunca excede `valor_original` por concorrência.
- Contrato não é marcado `quitado` indevidamente: o lock no contrato dentro de `registrar_pagamento_parcela` serializa a checagem `v_todas_pagas` e o UPDATE de status.

## Observações técnicas
- `FOR UPDATE` é seguro dentro de funções `SECURITY DEFINER PLPGSQL` — toda chamada RPC do PostgREST roda em sua própria transação, então o lock é liberado ao retornar.
- Não há risco de deadlock entre as 3 funções: todas adquirem locks na ordem `parcelas → contratos` ou apenas `contratos`, consistente.
- Não usamos `NOWAIT` / `SKIP LOCKED`: queremos que a segunda chamada espere (latência de milissegundos) e então reavalie, comportamento mais previsível para o usuário.
