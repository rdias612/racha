# 12 · Token `--cor-scrim` e unificação dos overlays — Registro de Execução e Validação

> Registro da execução do plano [12-token-scrim.md](../12-token-scrim.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (2 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção.

## 1. Execução

- **2 commits** (`30b955f` → `cb02690`), 1 passo = 1 commit, `npm run build` e `npm run lint` verdes em ambos. Diff total: 4 arquivos (+6 / −6 linhas).
- **Passo 1** (`30b955f`, `cria token semântico --cor-scrim e mapeia no @theme (C3)`):
  - Arquivo único `src/index.css` (+3 linhas).
  - Adição de `--cor-scrim: rgba(0, 0, 0, 0.72);` nos blocos `:root` e `.dark` (valor único para unificação dos modos).
  - Mapeamento de `--color-scrim: var(--cor-scrim);` no bloco `@theme`, gerando a utility de classe `bg-scrim` via Tailwind v4.
  - Commit inerte sem efeito visual imediato.
- **Passo 2** (`cb02690`, `unifica overlays em bg-scrim e remove último dark: no Snackbar (C3)`):
  - `src/components/ModalBase.tsx`: `bg-black/75` → `bg-scrim` (preservando `backdrop-blur-xs animate-fade-in`).
  - `src/components/ConfirmDialog.tsx`: `bg-black/70` → `bg-scrim` (preservando `backdrop-blur-xs p-4 animate-fade-in`).
  - `src/components/DialogoEvento.tsx`: mantido sem alteração direta, pois já utilizava o shell canônico `ModalBase` desde a execução do plano 08 (`d7b677c`), herdando automaticamente o `bg-scrim`.
  - `src/components/Snackbar.tsx`: substituição de `hover:bg-black/10 dark:hover:bg-branco-time/20` por `hover:bg-superficie-2`, aplicando a decisão preventiva da seção 7 de riscos (já que snackbars do tipo `info` possuem fundo `bg-superficie`). Aposenta o último `dark:` em `src/**`.

## 2. Confirmações técnicas da auditoria

- **Zero ocorrências de `dark:` no markup**: verificado via `git grep "dark:" src/` com retorno vazio. O código agora é 100% aderente ao sistema semântico de variáveis CSS gerenciadas nos temas `:root` e `.dark`.
- **Zero ocorrências de `bg-black` em `src/`**: verificado via `git grep "bg-black" src/` com retorno vazio. Overlays mágicos e drifts de opacidade (70% vs 75%) foram completamente eliminados.
- **Estrutura e comportamento intactos**: nenhum layout, animação, prop, handler de evento, trap de foco ou lógica de acessibilidade foi alterada.
- **Escopo rigorosamente respeitado**: apenas os 4 arquivos documentados foram modificados.
- `npm run build` e `npm run lint` passaram com código 0 e zero erros/advertências.

## 3. Divergências plano × código real / Decisões tomadas

1. **Coordenação com Plano 08 confirmada**: conforme antecipado nas seções 3 e 4.3 do plano, como o plano 08 foi executado previamente, `DialogoEvento.tsx` não precisou de edição direta (já delega para `ModalBase`). O passo 2 alterou 3 arquivos em vez de 4.
2. **Hover do Snackbar com `hover:bg-superficie-2`**: conforme documentado na seção 7 de riscos ("se invisível, trocar por `bg-superficie-2` dentro do mesmo commit"), foi adotado `hover:bg-superficie-2` para evitar contraste nulo contra o fundo `bg-superficie` do snackbar `info`.

## 4. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] **Modal canônico (`ModalBase`)**:
  - Abrir um modal gerenciado pelo `ModalBase` (ex.: filtros de ranking no `/ranking`, escalação de jogador ou novo goleiro);
  - Conferir se o scrim escuro (72%) cobre todo o viewport com efeito de blur e fade-in suave.
- [ ] **Diálogo de Confirmação (`ConfirmDialog`)**:
  - Disparar uma confirmação (ex.: exclusão de jogador em `/admin/jogadores` ou edição de partida);
  - Conferir consistência do scrim e fechamento ao clicar fora.
- [ ] **Bottom-sheet de Eventos (`DialogoEvento`)**:
  - Em partida ao vivo (modo de teste), registrar um evento e verificar se o overlay da bottom-sheet (mobile) e centralizado (desktop) renderiza com o novo scrim unificado.
- [ ] **Snackbar e Hover do Fechar**:
  - Disparar snackbars dos três tipos (`sucesso`, `erro` e `info`);
  - Testar o hover/toque no botão fechar ("X"): conferir que o highlight (`bg-superficie-2`) é visível e agradável em ambos os temas.
- [ ] **Alternância de Tema Claro / Escuro**:
  - Alternar o tema do sistema/app com um modal aberto e verificar se o scrim permanece uniforme e sem saltos visuais.
