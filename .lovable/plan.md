

## Plano: Importador de Comprovante PIX

### Visao Geral

Criar um fluxo onde o usuario faz upload de um comprovante PIX (imagem ou PDF), uma edge function envia para a API da OpenAI (GPT-4o com visao), extrai os dados estruturados (valor, nome do beneficiario/pagador, data, chave PIX), e pre-preenche o formulario de novo contrato -- criando o cliente automaticamente se necessario.

### Arquitetura

```text
+------------------+       +------------------------+       +-----------+
|  Upload no       | ----> | Edge Function          | ----> | OpenAI    |
|  Frontend        |       | parse-comprovante      |       | GPT-4o    |
|  (imagem/PDF)    | <---- | (extrai dados)         | <---- | (visao)   |
+------------------+       +------------------------+       +-----------+
        |
        v
+------------------+
| Busca cliente    |
| pelo nome        |
| (match parcial)  |
+------------------+
        |
        v
+----------------------------------+
| Pre-preenche formulario          |
| - Se cliente existe: seleciona   |
| - Se nao existe: cria novo       |
| - Valor, data ja preenchidos     |
| - Usuario completa os campos     |
+----------------------------------+
```

### Pre-requisito: Chave da OpenAI

Sera necessario configurar o secret `OPENAI_API_KEY` no Supabase para que a edge function funcione. O usuario precisara fornecer sua chave da OpenAI.

### 1. Edge Function: `parse-comprovante`

**Arquivo:** `supabase/functions/parse-comprovante/index.ts`

- Recebe o comprovante como base64 (imagem) no body da requisicao
- Envia para a API da OpenAI usando GPT-4o com capacidade de visao
- Usa tool calling para extrair dados estruturados:
  - `nome_cliente`: nome do beneficiario ou pagador
  - `valor`: valor da transferencia
  - `data`: data da operacao
  - `chave_pix`: chave PIX utilizada
  - `tipo_chave`: tipo da chave (CPF, telefone, email, aleatoria)
- Retorna JSON estruturado para o frontend

### 2. Componente Frontend: Modal de Importacao

**Modificacao em:** `src/pages/Contratos.tsx`

- Adicionar botao "Importar Comprovante" ao lado do botao "Novo Contrato"
- Icone: `Upload` do Lucide
- Ao clicar, abre um dialog para:
  1. Selecionar arquivo (aceita imagem PNG/JPG ou PDF)
  2. Converter para base64
  3. Enviar para a edge function
  4. Exibir dados extraidos para confirmacao
  5. Ao confirmar:
     - Buscar cliente pelo nome (match parcial case-insensitive)
     - Se encontrar: seleciona o cliente existente
     - Se nao encontrar: cria novo cliente com o nome e chave PIX como observacao
     - Pre-preenche `valorEmprestado` e `dataEmprestimo` no formulario de contrato
     - Abre o dialog de criacao de contrato com os dados

### 3. Fluxo do Usuario

1. Clica em "Importar Comprovante"
2. Seleciona o arquivo (foto ou PDF do comprovante PIX)
3. Sistema processa e exibe: "Valor: R$ 500,00 | Cliente: Joao Silva | Data: 12/02/2026 | Chave: CPF xxx.xxx.xxx-xx"
4. Usuario confirma os dados (pode editar se necessario)
5. Sistema verifica se "Joao Silva" ja existe nos clientes
   - Se sim: seleciona automaticamente
   - Se nao: cria o cliente e seleciona
6. Abre o formulario de novo contrato pre-preenchido
7. Usuario preenche os campos restantes (parcelas, juros, periodicidade) e confirma

### 4. Configuracao do Supabase

**Arquivo:** `supabase/config.toml`
- Adicionar configuracao para a nova edge function com `verify_jwt = false`

### Arquivos criados/modificados:

| Arquivo | Acao |
|---|---|
| `supabase/functions/parse-comprovante/index.ts` | Criar |
| `supabase/config.toml` | Modificar (adicionar funcao) |
| `src/pages/Contratos.tsx` | Modificar (adicionar botao + modal + logica) |

### Limitacoes conhecidas:

- A qualidade da extracao depende da clareza do comprovante
- PDFs com imagens escaneadas podem ter menor precisao
- O match de cliente e feito por nome (busca parcial), entao nomes muito diferentes nao serao encontrados automaticamente

