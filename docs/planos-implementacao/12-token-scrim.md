# 12 · Token `--cor-scrim` e unificação dos overlays — Plano de Implementação

> Ref.: item **C3** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#12 (nota 3,5)**, Tier 3 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P2

## 1. Objetivo

Criar o token semântico `--cor-scrim` (idêntico nos dois temas) e substituir os **3 overlays de modal hardcoded** (`bg-black/75`, `bg-black/70`, `bg-black/70`) por `bg-scrim`, eliminando a repetição de valor mágico com drift de opacidade. De quebra, o hover do fechar do `Snackbar` (que hoje carrega o **único `dark:` do app**, revalidado por grep) passa a usar `hover:bg-superficie`, aposentando o último `dark:` do código. É higiene de Tier 3: impacto visual ínfimo (75% → 72% de opacidade), custo mínimo, e fecha a contradição de hex de preto no JSX contra a regra de tokens semânticos do `DESIGN.md:162`.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

- `src/components/ModalBase.tsx:68` — overlay do shell canônico: `bg-black/75 backdrop-blur-xs animate-fade-in` (o único com 75%).
- `src/components/ConfirmDialog.tsx:44` — overlay: `bg-black/70 backdrop-blur-xs p-4 animate-fade-in`.
- `src/components/DialogoEvento.tsx:64` — overlay: `bg-black/70 p-0 backdrop-blur-xs sm:items-center sm:p-4 text-giz` (bottom-sheet no mobile).
- `src/components/Snackbar.tsx:73` — botão fechar: `hover:bg-black/10 dark:hover:bg-branco-time/20 transition-fast focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-1`; grep confirma que este é o **único** `dark:` em `src/**`.
- Estrutura de tokens em `src/index.css`: padrão de 3 camadas — `:root` (`:34-54`) e `.dark` (`:56-76`) definem `--cor-*`; o bloco `@theme` (`:5-32`) mapeia cada um como `--color-<nome>: var(--cor-<nome>)`. O token novo segue exatamente esse padrão.
- Consumidores para a validação (grep em `src/**`): o `ModalBase` serve 6 modais (`ModalNovoGoleiro`, `ModalEscalarJogador`, `ModalFiltrosRanking`, `ModalSelecionarGoleiro`, `ModalSelecionarAgendamento`, `ModalSelecionarOpcao`); o `ConfirmDialog` tem 11 arquivos chamadores (`Jogos`, `PartidaDetalhe`, `PartidaEditar`, `PartidaAoVivo`, `PartidaVotar`, `Administrador`, `GestaoGoleiros`, `GestaoJogadores`, `NotificacoesTestes`, `EventosAutomaticosFinanceiro`); o `DialogoEvento` tem call site único em `PartidaAoVivo` — todos herdam a troca sem alteração de props.
- Sem nenhuma outra ocorrência de `bg-black/` em `src/**` além dos 3 overlays citados.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** O passo 1 (token) é inerte até o passo 2 e não conflita com nada dos planos 01–09.
- **Coordenação com o plano 08 (`DialogoEvento` → `ModalBase`)**: se o plano 08 for executado **antes** deste, o `DialogoEvento` deixa de ter overlay próprio (herda o do `ModalBase`) e o passo 2 aqui cai de 3 para **2 overlays** (`ModalBase` e `ConfirmDialog`) — o token do passo 1 não muda. Se este plano for executado antes, o plano 08 simplesmente já escreve o shell migrado sem overlay hardcoded. Nenhuma ordem quebra; apenas ajustar a contagem de sites no commit.
- **Restrição de janela**: sem restrição de partida ao vivo para este plano (a troca é de classe CSS, não de comportamento). Se executado junto do plano 08, herda a janela "fora de ao vivo" daquele.
- **Decisão do dono**: nenhuma pendente — o valor `rgba(0,0,0,0.72)` já foi proposto no doc de origem (C3) como meio-termo entre 70% e 75%.

## 4. Plano de execução (1 passo = 1 commit)

**Passo 1 — Criar o token (commit inerte, sem efeito visual).**
Arquivo único: `src/index.css`.

1. Em `:root` (após `--cor-borda`, agrupando com as cores de superfície) adicionar `--cor-scrim: rgba(0,0,0,0.72);`.
2. Em `.dark`, adicionar o **mesmo valor** `--cor-scrim: rgba(0,0,0,0.72);` — scrim sobre preto não precisa adaptação por tema (a unificação é justamente o objetivo).
3. No `@theme`, adicionar `--color-scrim: var(--cor-scrim);` (perto de `--color-fundo`/`--color-superficie`, grupo de superfícies), habilitando a utility `bg-scrim`.
4. Nada mais muda; commit reversível isolado (a utility ainda não tem consumidores).

**Passo 2 — Trocar os 3 overlays e o hover do Snackbar (commit funcional).**
Quatro arquivos, uma classe por linha, sem mudança de props, handlers ou estrutura:

1. `src/components/ModalBase.tsx:68` — `bg-black/75` → `bg-scrim` (mantém `backdrop-blur-xs animate-fade-in`).
2. `src/components/ConfirmDialog.tsx:44` — `bg-black/70` → `bg-scrim`.
3. `src/components/DialogoEvento.tsx:64` — `bg-black/70` → `bg-scrim` (**pular este site se o plano 08 já tiver sido executado** — ver seção 3).
4. `src/components/Snackbar.tsx:73` — substituir o par `hover:bg-black/10 dark:hover:bg-branco-time/20` por `hover:bg-superficie` (herda o tema automaticamente; apaga o último `dark:` do app).

Ordem de verificação dos call sites: nenhum call site dos 4 componentes é tocado — a troca é interna às classes.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no build local (`npm run dev`) e num aparelho, nos dois temas (claro e escuro — o app inicia no escuro):

- [ ] Build passa sem erro/aviso novo (`bg-scrim` resolvida pelo Tailwind v4 via `@theme`).
- [ ] Abrir um modal do `ModalBase` (ex.: `ModalFiltrosRanking` no Ranking): scrim uniforme, blur e fade-in presentes; diferença de opacidade (75% → 72%) imperceptível.
- [ ] Disparar um `ConfirmDialog` (ex.: exclusão em `GestaoJogadores` ou `PartidaDetalhe`): scrim e clique-fora funcionam como antes.
- [ ] **Se o plano 08 ainda não rodou**: registrar um gol em `PartidaAoVivo` (modo de teste) e conferir o scrim do `DialogoEvento` (bottom-sheet mobile e centralizado desktop).
- [ ] `Snackbar`: disparar um snackbar com ação e passar o dedo/mouse sobre o botão fechar — hover visível em ambos os temas (agora via `bg-superficie`, sem `dark:` no markup).
- [ ] Alternar tema claro/escuro sobre um modal aberto: o scrim não muda (comportamento esperado, valor único nos dois temas).

## 6. Fora de escopo

- **Não tocar em nenhum outro hex/valor hardcoded fora dos 4 pontos citados**: `#b37d00` de `shadow-carimbo-destaque` (`index.css:224-226`) é item do C6; `#000000` de `shadow-carimbo-preto` (`index.css:228-230`) fica como está (sombra-carimbo, não scrim); hexes duplicados `tema.ts` ↔ `index.html` ↔ manifest são do C5.
- **Não tocar nos demais `dark:`-adjacentes**: não há outros (grep confirma 1 único), mas não ampliar o uso de `dark:` em nenhum lugar.
- Não unificar o `ConfirmDialog` no `ModalBase` (decisão do plano de origem — 11 chamadores exigiriam props de exceção no shell canônico).
- Não alterar opacidades individuais por modal, `z-index`, animações ou qualquer comportamento de fechamento.
- Não documentar o token no `DESIGN.md` agora (tabela de tokens é o plano 29 / C5).

## 7. Riscos e rollback

- **Risco principal — visual**: a unificação em 72% escurece imperceptivelmente os dois modais que hoje usam 70% e clareia o do `ModalBase` (75% → 72%). Ambos imperceptíveis em uso real; validado na seção 5.
- **Risco — utility não gerada**: se o mapeamento do `@theme` ficar ausente ou com nome divergente, `bg-scrim` não resolve e o overlay fica **transparente** (modal legível mas sem scrim). Detectável no 1º modal aberto da validação; nenhum usuário é afetado se a validação preceder o deploy.
- **Risco — hover do Snackbar**: `bg-superficie` sobre `bg-superficie` (fundo do snackbar) pode render o hover invisível se o snackbar usar exatamente `bg-superficie`. Verificar na validação; se invisível, trocar por `bg-superficie-2` dentro do mesmo commit (decisão registrada no commit, sem novo passo).
- **Rollback**: cada passo é 1 commit isolado e reversível por `git revert`. Reverter o passo 2 restaura os overlays e o `dark:` originais; reverter o passo 1 remove o token inerte. Nenhum dado, rota ou comportamento funcional é tocado em nenhum passo.
