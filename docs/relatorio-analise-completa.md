# Relatório de Análise Completa — Racha Gragoatá CBO

**Data:** 22/08/2026 (Atualizado com Status de Execução)  
**Escopo:** análise em 4 eixos — qualidade do código ("code slop"), UX mobile (PWA usado como app), design autêntico (identidade "Súmula de Quinta") e novos requisitos.  
**Metodologia:** revisão integral de `src/` (rotas, componentes, hooks, libs), `supabase/migrations/`, `index.html`, `public/` e `PLANO.md`, cruzando evidências com o código ativo.

---

## Sumário Executivo e Painel de Status

> **Status Geral do Projeto:** ~85% dos itens prioritários implementados (Segurança, Correção de Hooks, Identidade Visual P1/P2/P3 e Quick Wins de UX finalizados).

| Eixo | Veredito & Diagnóstico | Status de Execução |
|---|---|---|
| **1 · Qualidade de código** | Base sólida. Furo de segurança crítico sanado (migration 069), Rules of Hooks corrigidos, RPC transacional de edição criada (migration 068), race conditions eliminadas e médias agregadas no servidor (migration 070). | **8/10 Concluído** (Faltam Prettier/ESLint e ADDENDUM do PLANO) |
| **2 · UX mobile** | PWA polido: Pull-to-refresh corrigido com scroll recursivo, votação com progresso real e rascunho em localStorage, theme-color alinhado, navegação com fallback para push, alvos de 44px e haptics em ações-chave. | **9/10 Concluído** (Falta ocultar tab bar em fluxos focados) |
| **3 · Design ("Súmula de Quinta")** | Identidade P&B + âmbar aplicada em todas as telas: Placar LED, Card do Craque com fita, Pódio Top 3, avatares terrosos com plaqueta, cabeçalhos de súmula com carimbos e textura grain global. | **10/10 Concluído** |
| **4 · Novos requisitos** | Push notifications, presença, sorteio balanceado e módulo financeiro já ativos. Próximas features de alto valor engatilhadas no backlog. | **0/2 Concluído** (Comparador e Cobrança WhatsApp no backlog) |

---

# 1 · Qualidade de código

## Veredito
**Grau de slop: 1/10 (após correções).** Base estabilizada, segurança restrita por coluna, hooks sanitizados e concorrência tratada com cleanup flags.

## Top 10 problemas (Status Detalhado)

### 1. ✅ [CONCLUÍDO] — `senha_hash` legível publicamente
- **Situação:** Resolvido na migration `069_restrict_jogadores_select.sql`.
- **Implementação:** `REVOKE SELECT ON jogadores FROM anon, authenticated;` seguido de `GRANT SELECT` apenas nas colunas seguras (`id`, `username`, `nome`, `posicao`, `posicao_b`, `is_admin`, `is_ativo`, `is_mensalista`, `created_at`). Autenticação centralizada no RPC `fazer_login`.

### 2. ✅ [CONCLUÍDO] — Violações de Rules of Hooks
- **Situação:** Resolvido em `Administrador.tsx`, `PartidaConfirma.tsx` e `PartidaNovaTimes.tsx`.
- **Implementação:** Todos os hooks (`useEffect`, `useMemo`, `useEscalacaoTimes`) foram posicionados estritamente antes dos guards de redirecionamento (`if (!isAdmin) return <Navigate ... />`).

### 3. ✅ [CONCLUÍDO] — Salvamento de edição não-transacional
- **Situação:** Resolvido na migration `068_rpc_salvar_edicao_partida.sql` e integrado em `lib/partidas.ts:408`.
- **Implementação:** Criação do RPC `salvar_edicao_partida` com bloco transacional seguro gerenciando participantes, eventos, votos e avulsos de forma atômica no Postgres.

### 4. ✅ [CONCLUÍDO] — Copy-paste integral entre rotas irmãs
- **Situação:** Resolvido com a criação do hook compartilhado `useEscalacaoTimes` em `src/hooks/useEscalacaoTimes.ts`.
- **Implementação:** Lógica de atribuição manual, limites de goleiro por time, balanceamento automático ABBA e feedback tátil unificados e consumidos tanto por `PartidaNovaTimes.tsx` quanto por `PartidaTimes.tsx`.

### 5. ✅ [CONCLUÍDO] — Classes Tailwind inexistentes
- **Situação:** Resolvido. Classes fantasmas `animate-in` removidas; utilitário `@utility no-scrollbar` e sombras-carimbo padronizadas adicionadas em `src/index.css`.

### 6. ✅ [CONCLUÍDO] — Race condition em `carregar()`
- **Situação:** Resolvido. Flag `let ativo = true` com função de cleanup aplicada em todos os `useEffect` de carregamento de dados (`PartidaDetalhe.tsx`, `Jogos.tsx`, `Administrador.tsx`, `GestaoJogadores.tsx`, `Resumo.tsx`, `Perfil.tsx`, `PartidaVotar.tsx`).

### 7. ✅ [CONCLUÍDO] — `obterMediasNotasJogadores` baixava tabela `votes` inteira
- **Situação:** Resolvido na migration `070_rpc_medias_notas_jogadores.sql` e integrado em `src/lib/jogadores.ts:144`.
- **Implementação:** RPC agrega médias no Postgres descartando menor/maior nota (quando >= 3 votos), com fallback seguro no client.

### 8. ⏳ [PENDENTE] — Formatação e padronização com Prettier
- **O que falta:** Instalar Prettier + `.editorconfig` e rodar formatação geral para unificar estilo de aspas e ponto-e-vírgula em todo o repositório.

### 9. ✅ [CONCLUÍDO] — Comentários de lint fantasma e feedback inconsistente
- **Situação:** Resolvido. Comentários `eslint-disable` mortos foram removidos; `window.confirm` nativo substituído por `ConfirmDialog`; feedback padronizado via `Snackbar` (ações rápidas com haptics) e `MensagemEstado` (persistente).

### 10. ⏳ [PENDENTE] — Atualização do PLANO.md / Criação de ADDENDUM.md
- **O que falta:** Atualizar `PLANO.md` ou criar `docs/ADDENDUM.md` documentando as decisões arquiteturais reais (status `live`, Web Push com VAPID/Edge Functions, gestão financeira e edição pós-closed).

## Dead Code (Status)

| Item | Local | Situação | Status |
|---|---|---|---|
| `SkeletonPerfil` | `components/Skeletons.tsx` | Integrado na rota de Perfil | ✅ **Resolvido** |
| `vibrateWarning` | `lib/haptics.ts` | Integrado no `useEscalacaoTimes` | ✅ **Resolvido** |
| `vibrateGoal` | `lib/haptics.ts` | Integrado no `DialogoEvento` ao confirmar gol | ✅ **Resolvido** |
| `ROTULO_TIPO` | `Administrador.tsx` | Removido em favor de `TIPOS_DIVIDA` | ✅ **Resolvido** |
| Classes `animate-in*` | Diversos | Removidas | ✅ **Resolvido** |
| Comentários `eslint-disable` | Diversos | Removidos | ✅ **Resolvido** |
| `ColunaOrdenacaoDuplas` no DuplaCard | `DuplaCard.tsx:8` | Importar tipo exportado em vez de redeclarar inline | ⏳ **Pendente** |

## Ferramentas Mínimas Sugeridas

```bash
npm i -D prettier eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals
```

- [ ] ⏳ **Configurar Prettier** (defaults + `.editorconfig`).
- [ ] ⏳ **Configurar ESLint flat config mínimo** (`typescript-eslint recommended` + `eslint-plugin-react-hooks`).
- [ ] ⏳ **Adicionar script npm:** `"lint": "tsc -b && eslint src"`.

---

# 2 · UX mobile (PWA usado como app)

## Top 10 melhorias (Status Detalhado)

1. ✅ **[CONCLUÍDO] Bug do PullToRefresh**
   - Corrigido em `PullToRefresh.tsx` com função `getScrollTop(el)` recursiva que inspeciona o contêiner de rolagem ativo (`<main overflow-y-auto>`).

2. ✅ **[CONCLUÍDO] Votação com progresso real e rascunho**
   - Implementado em `PartidaVotar.tsx`: sem pré-preenchimento automático com 6, contador "X restantes" real, autosave em `localStorage` por partida/usuário e saída protegida por `ConfirmDialog`.

3. ✅ **[CONCLUÍDO] theme-color coerente**
   - Configurado em `index.html` com suporte a `prefers-color-scheme`: claro `#f3efe4` (papel de súmula) e escuro `#12100d` (refletor).

4. ✅ **[CONCLUÍDO] Swipe × tabela horizontal do Ranking**
   - Atributo `data-no-swipe` aplicado no contêiner da tabela do Ranking, respeitado pelo hook `useSwipeTabs.ts`.

5. ✅ **[CONCLUÍDO] Voltar com fallback pós deep-link**
   - Helper `voltar(navigate, fallback)` criado em `lib/navegacao.ts` e aplicado em todas as rotas e botões de retorno do app.

6. ✅ **[CONCLUÍDO] Alvos de toque >= 44px**
   - Padronização de 44px aplicada em botões admin (`✓⏳✗✕`), botões self de presença, gatilho do `SeletorNota`, lixeira de partidas nos Jogos e cabeçalhos de ordenação.

7. 🔄 **[PARCIAL] Offline e erros amigáveis**
   - ✅ Mapper central de erros amigáveis criado em `src/lib/erros.ts`.
   - ✅ Banner global offline adicionado no `Layout.tsx`.
   - ✅ Tela `public/offline.html` repaginada na identidade Súmula de Quinta.
   - ⏳ *Pendente opcional:* Cache Stale-While-Revalidate no Service Worker para requisições GET do Supabase.

8. ✅ **[CONCLUÍDO] Troca de window.confirm por ConfirmDialog**
   - Todos os diálogos nativos substituídos pelo modal customizado `ConfirmDialog.tsx`.

9. ✅ **[CONCLUÍDO] Haptics integrados e atualização otimista**
   - Haptics ativos no seletor de notas (`vibrateLight`), registro de gols (`vibrateGoal`), bloqueios de escalação (`vibrateWarning`) e confirmação de presença (`vibrateSuccess`).
   - Atualização otimista imediata implementada na lista de presença em `PartidaDetalhe.tsx` com rollback em caso de erro.

10. 🔄 **[PARCIAL] Polimento nativo**
    - ✅ Resumo envolvido em `<PullToRefresh>`.
    - ✅ Header do `Layout.tsx` tornado `sticky top-0`.
    - ✅ `Snackbar.tsx` respeitando `env(safe-area-inset-bottom)`.
    - ✅ Screenshots e ícones ajustados no `manifest.webmanifest`.
    - ⏳ *Pendente:* Ocultar Tab Bar inferior em fluxos focados (votação, edição e partida ao vivo).
    - ⏳ *Pendente:* Splash screens dedicadas para iOS (`apple-touch-startup-image`).

## Quick Wins (<1h cada) — Status

- [x] ✅ 1. Corrigir meta theme-color clara/escura (`index.html`).
- [x] ✅ 2. `data-no-swipe` na tabela do Ranking.
- [x] ✅ 3. Haptics: vibrar nota selecionada, gol e bloqueio de escalação.
- [x] ✅ 4. Header sticky no Layout.
- [x] ✅ 5. Snackbar respeitando safe-area inferior.
- [x] ✅ 6. Envolver o Resumo em `<PullToRefresh>`.
- [x] ✅ 7. Helper de voltar com fallback para deep-link (`lib/navegacao.ts`).
- [x] ✅ 8. Substituir `window.confirm` do Administrador e Votação.
- [x] ✅ 9. Padding e área de toque 44px na lixeira dos Jogos.
- [x] ✅ 10. `apple-touch-icon` e configurações PWA atualizadas.

---

# 3 · Identidade visual — direção "Súmula de Quinta"

## Status Geral do Eixo: ✅ 100% IMPLEMENTADO

A identidade visual completa foi migrada com sucesso da estética genérica Tailwind para o conceito **Súmula de Quinta** (Preto vs Branco como duotônico principal, âmbar refletor como accent de ação, números condensados/mono e bordas duras com sombra-carimbo).

### P1 — Base Visual, Tokens e Componentes Core
- [x] ✅ `src/index.css` — Tokens `--cor-*`, fontes Google (Barlow Condensed, Archivo, Chivo Mono), textura grain global com `feTurbulence` e utilitários de sombra-carimbo (`shadow-carimbo`, `shadow-carimbo-destaque`, `shadow-carimbo-preto`, `sumula-header`).
- [x] ✅ `index.html` — Carregamento de fontes e meta tags de cores alinhadas.
- [x] ✅ `public/icon.svg`, `icon-maskable.svg`, `manifest.webmanifest` — Nova marca P&B com estrela âmbar.
- [x] ✅ `Layout.tsx` — Header com wordmark estilizado, toggle de tema escuro/claro integrado e indicador âmbar de aba ativa na barra de navegação.
- [x] ✅ `Logo.tsx` — Escudo partido preto/giz com estrela âmbar central.
- [x] ✅ `Avatar.tsx` — Paleta terrosa (campo, couro, tijolo, oliva, petróleo, terra), iniciais em condensed e plaqueta retangular de posição estilo número de camisa.
- [x] ✅ `Estado.tsx` + `ConfirmDialog.tsx` — Cantos retos (4px), bordas sólidas de 1px/2px e sombras-carimbo.

### P2 — Momentos-Assinatura
- [x] ✅ `PartidaDetalhe.tsx` — Placar LED em barra horizontal única preta com glow âmbar no modo `live`, Card do Craque com fita preta e selo translúcido rotacionado, carimbos de status (`sumula-header`).
- [x] ✅ `Ranking.tsx` — Pódio Top 3 com numerais vazados (`texto-vazado`), 1º lugar em caixa âmbar destacada e números em `tabular-nums` / Chivo Mono.
- [x] ✅ `Jogos.tsx` — Mural de mini-placares LED pretos na listagem principal.
- [x] ✅ `Resumo.tsx` — Boletim Oficial da Temporada com cabeçalho de súmula, grid de destaques estilizado e rodapé oficial.
- [x] ✅ `Skeletons.tsx` — Skeletons sincronizados com a nova geometria e CLS = 0.

### P3 — Polimento
- [x] ✅ `CampoPartida.tsx` — Tons de gramado noturno alinhados (`#16281c` / `#1b3323`), chips de jogadores com borda dura e destaque âmbar.
- [x] ✅ `Perfil.tsx` + `Administrador.tsx` — StatBoxes com números display em mono, tabelas financeiras com tipografia mono e alinhamento visual.

---

# 4 · Novos requisitos e features

## O que JÁ ESTAVA FEITO no backend/core:
- ✅ **Sorteio automático equilibrado** por posição + nota (`escalacao.ts`, `useEscalacaoTimes.ts`).
- ✅ **Presença semanal + lista de espera de 16 vagas** (`confirmar_presenca`, avulsos, auto-agendamento via cron).
- ✅ **Web Push completo** com VAPID + Edge Functions + lembretes 30/15min.
- ✅ **Destaques sazonais e Parcerias/Duplas** (`resumo_ano`, `pares_racha`, `parcerias_jogador`).
- ✅ **Módulo financeiro/dívidas** completo com drill-down por jogador.

## Novas Features (Backlog Priorizado)

| # | Feature | O que é | Complexidade | Status |
|---|---------|---------|--------------|:------:|
| 1 | **Cobrança de dívidas via WhatsApp** | Exibir antiguidade da pendência ("há X semanas" 🚨) ordenada por data + botão de copiar mensagem amigável e formatada para colar no WhatsApp (`navigator.clipboard.writeText`). | Baixa | ⏳ **PENDENTE** |
| 2 | **Comparador cara-a-cara** | Comparação direta entre dois jogadores (gols, assists, notas, vitórias) + histórico de confrontos diretos juntos vs adversários (`confronto_direto`). | Média | ⏳ **PENDENTE** |

---

# 5 · Checklist consolidado do que AINDA FALTA FAZER

Abaixo está a lista objetiva dos itens pendentes para conclusão total:

### 🔴 Prioridade Alta (Funcionalidades de Valor)
- [ ] ⏳ **Cobrança de dívidas via WhatsApp** (`Administrador.tsx`):
  - Adicionar cálculo de idade da dívida (ex: "há 3 semanas").
  - Adicionar botão "Copiar Cobrança" com texto pré-formatado com emojis e valor total para envio no WhatsApp.
- [ ] ⏳ **Comparador cara-a-cara** (`/comparar` ou aba em `Estatisticas.tsx`):
  - Criar interface com 2 seletores de jogadores.
  - Exibir comparativo de métricas lado a lado e histórico de confrontos (quando jogaram juntos vs quando foram adversários).

### 🟡 Prioridade Média (Ajustes de UX e Ferramentas)
- [ ] ⏳ **Configurar ESLint + Prettier**:
  - Instalar dependências de desenvolvimento.
  - Criar `.prettierrc`, `.editorconfig` e `eslint.config.js`.
  - Executar formatação em lote para unificar estilo de código.
- [ ] ⏳ **Ocultar Tab Bar em fluxos focados**:
  - Em telas como `/partida/:id/votar`, `/partida/:id/editar` e `/partida/:id/ao-vivo`, esconder a barra inferior para maximizar a área útil da tela mobile.
- [ ] ⏳ **Ajuste de tipo no `DuplaCard.tsx`**:
  - Importar `ColunaOrdenacaoDuplas` de `EstatisticasRacha.tsx` em vez de redeclarar tipo inline.

### 🟢 Prioridade Baixa (Documentação e Cache)
- [ ] ⏳ **Atualizar PLANO.md / Criar ADDENDUM.md**:
  - Documentar recursos adicionados que divergiram do plano original (Push VAPID, status `live`, gestão financeira).
- [ ] ⏳ **Cache Stale-While-Revalidate no SW (Opcional)**:
  - Permitir carregamento offline de leitura para rotas do Supabase já visitadas.
- [ ] ⏳ **Splash screens iOS (Opcional)**:
  - Gerar meta tags de startup images para evitar tela branca momentânea no carregamento PWA em iPhones antigos.
