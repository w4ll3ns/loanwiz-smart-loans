## Plano: Remover `.env` do versionamento Git

### Objetivo
Eliminar o arquivo `.env` (com chaves reais do Supabase) do histórico e tracking do Git, mantendo o suporte ao desenvolvimento local via `.env.example`.

### Passos

1. **Atualizar `.gitignore`**
   - Adicionar as linhas abaixo ao arquivo existente, preservando entradas atuais:
     ```
     .env
     .env.local
     .env.*.local
     ```

2. **Remover `.env` do tracking Git**
   - Executar `git rm --cached .env` para desvincular do index sem apagar o arquivo local.
   - O arquivo continuará presente e funcional no sandbox.

3. **Atualizar `README.md`**
   - Na seção "Setup Local", substituir `cp .env.example .env` por orientação de que a plataforma Lovable preenche automaticamente o `.env`.
   - Na seção "Variáveis de Ambiente", adicionar nota clara de que `.env` **nunca** deve ser versionado manualmente, mesmo com chaves públicas.

4. **Verificar `.env.example`**
   - Confirmar que o arquivo já existe com placeholders corretos (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`).

### Critério de Aceite
- `git status` mostra `.env` como `untracked` e ignorado.
- A aplicação continua rodando localmente.
- O commit final reflete `.gitignore` atualizado e `.env` removido do índice, sem expor chave real.