# Barra de navegação inferior (mobile) — padrão "pílula ativa"

Corrigir a barra inferior em `src/components/Layout.tsx`, hoje apertada (até 6 itens em `flex-1`, rótulos de 9px, sem safe-area). Adotar ícones-only para itens inativos e pílula com ícone + rótulo para o item ativo.

## O que muda

**1. `<nav className="md:hidden fixed bottom-0 ...">` (linhas ~173-198)**
- Adicionar safe-area do iOS via `style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))', paddingTop: '0.5rem' }}`.
- Trocar o container interno por `flex items-center justify-around gap-1 px-2`.
- Cada `Link`:
  - Inativo: só ícone, `text-muted-foreground`, `h-[46px] min-w-[46px] px-2.5 rounded-full`.
  - Ativo: pílula `bg-primary/10 text-primary px-4`, ícone + rótulo lado a lado.
  - `aria-label={item.name}` e `aria-current` para acessibilidade.
  - Ícone `h-[22px] w-[22px] flex-shrink-0`.
  - Rótulo sempre no DOM, expandindo com transição: `max-w-[120px] opacity-100 ml-1.5` (ativo) vs `max-w-0 opacity-0 ml-0` (inativo), com `overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-200`.
- Remover o indicador sublinhado absoluto (linha 189-191) e o `text-[9px]`.
- `transition-all duration-200 active:scale-95` nos links.

**2. `<main>` (linha 168)**
- Aumentar o padding inferior mobile de `pb-20` para `pb-24` para acomodar a barra mais alta + safe-area (mantendo `md:pb-6`).

## Inalterado (regras)
- Arrays `baseNavigation` / `adminNavigation` e a composição `navigation`.
- Rotas, detecção `isActive` (`location.pathname === item.href`), `useUserRole`.
- Header mobile e desktop, sidebar desktop.
- Cores via tokens do tema (`primary`, `muted-foreground`, `card`) — sem hardcode; funciona em claro/escuro.

## Critérios de aceitação
- Inativos = só ícone; ativo = pílula com ícone + rótulo e transição suave.
- 5 itens (não-admin) e 6 itens (admin) cabem sem menu escondido, todos em um toque.
- Respeita `env(safe-area-inset-bottom)`, alvos ≥44px.
- Rótulos legíveis (13px) e disponíveis para leitores de tela.
- Conteúdo não fica escondido atrás da barra.
