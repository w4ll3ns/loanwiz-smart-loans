# LoanWiz Smart Loans

Sistema SaaS multi-tenant para gestão de empréstimos pessoais com controle de contratos, parcelas, pagamentos e clientes.

## Stack

- **Frontend**: React 18, TypeScript 5, Vite 5, Tailwind CSS 3, shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL, RLS, Edge Functions)
- **PWA**: Instalável em dispositivos móveis

## Setup Local

```bash
git clone <REPO_URL>
cd loanwiz
npm install
cp .env.example .env   # preencher com suas credenciais Supabase
npm run dev
```

### Variáveis de Ambiente

Veja `.env.example` para a lista completa. Todas usam o prefixo `VITE_` e são chaves públicas (anon key).

## Documentação

Arquitetura completa, fluxos de autenticação, RPCs, Edge Functions, RLS e orientações de deploy:

→ **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

## Links

- [Projeto Lovable](https://lovable.dev/projects/967f0cd4-eadf-45c4-858f-a2848c1eef89)
