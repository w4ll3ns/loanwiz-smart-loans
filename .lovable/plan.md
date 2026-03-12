

## Plano: Botao "Trocar Cliente" na Revisao do Comprovante

### Comportamento Atual
Ao importar o comprovante, o sistema automaticamente busca ou cria um cliente pelo nome extraido do PIX. O usuario nao tem opcao de escolher outro cliente.

### Novo Comportamento
O fluxo padrao continua igual (usa o nome do PIX automaticamente). Porem, na tela de revisao, ao lado do nome do cliente extraido, aparece um botao "Trocar" que permite:
- Selecionar um cliente ja cadastrado (dropdown)
- Cadastrar um novo cliente (campo de texto)

### Alteracoes em `src/pages/Contratos.tsx`

**1. Novos estados**
- `clienteOverride`: `null` | `{ tipo: "existing", id: string, nome: string }` | `{ tipo: "new", nome: string }`
- Quando `null`, usa o fluxo padrao (nome do PIX)

**2. UI na tela de revisao (importStep === "review")**

Na linha do "Cliente", adicionar um botao "Trocar" (icone de troca ou tres pontinhos) ao lado do nome. Ao clicar:
- Expande uma secao abaixo com duas opcoes (RadioGroup):
  - "Cliente existente" -- exibe Select com lista de clientes
  - "Novo cliente" -- exibe Input pre-preenchido com o nome do PIX
- Um botao "Cancelar" para voltar ao nome original do PIX

**3. Logica em `handleConfirmImport`**

- Se `clienteOverride` e `null`: comportamento atual (busca por nome do PIX ou cria)
- Se `clienteOverride.tipo === "existing"`: usa o `clienteOverride.id` diretamente
- Se `clienteOverride.tipo === "new"`: cria cliente com `clienteOverride.nome` e chave PIX nas observacoes

### Resultado Visual

```text
+-----------------------------------+
| Cliente                           |
| Joao Silva         [Trocar]      |
+-----------------------------------+
|  (ao clicar "Trocar")            |
|  ( ) Cliente existente  [v Select]|
|  ( ) Novo cliente    [________]  |
|              [Cancelar]          |
+-----------------------------------+
| Valor: R$ 500,00                 |
| Data: 12/02/2026                 |
| Chave PIX: xxx.xxx.xxx-xx       |
+-----------------------------------+
```

### Arquivo modificado

| Arquivo | Acao |
|---|---|
| `src/pages/Contratos.tsx` | Adicionar estado `clienteOverride`, UI de troca de cliente, e logica condicional no `handleConfirmImport` |

