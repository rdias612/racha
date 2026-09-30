# 31 · Detalhes finos — Plano de Implementação

> Ref.: item **C6** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#31 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S (4 micro-passos independentes, cada um trivial) · Risco: baixo · Prioridade global do plano: P3

## 1. Objetivo

Fechar os quatro detalhes finos do item C6 do plano PWA, **cada um como micro-passo independente e revertível**, respeitando o critério de aplicação de cada um: (1) trocar o chevron desenhado como SVG inline no Login pelo `ChevronDown` do lucide — **só se o arquivo for tocado** por outro motivo; (2) extrair o text-shadow do LED para um `@utility glow-led` — **condicional ao surgimento de uma 3ª variante; hoje NÃO fazer**; (3) uniformizar o `outline-offset` do foco do `Snackbar` (hoje `offset-1` contra o `offset-2` global); (4) mover o hex `#b37d00` de `shadow-carimbo-destaque` para variável — mudança puramente cosmética, no padrão de tokens do projeto.

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#31, nota 0,5 — "pontuais, ao tocar o arquivo"), sem valor de deduplicação relevante; o mérito é higiene pontual de custo quase zero. O doc de origem manda aplicar **"ao tocar os arquivos"** — a exceção são os Passos 3 e 4, que são correções de uma linha e podem entrar por conta própria.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; divergências do doc de origem corrigidas abaixo:

- **Chevron inline no Login**: `src/routes/Login.tsx:168-178` (o doc de origem cita apenas `Login.tsx:168-178`; o arquivo real fica em `src/routes/`, não em `src/components/`) desenha o indicador de abrir/fechar da lista de usernames como `<svg viewBox="0 0 20 20">` com `<path>` manual, com rotação condicional (`rotate-180` quando `aberto`) e cor `text-destaque-texto`. O `Login.tsx` **não importa nada do lucide hoje** — a troca exige adicionar o import.
- **`ChevronDown` do lucide já é o padrão do app**: importado e usado em `src/components/SecaoNotificacaoSaude.tsx:135`, `src/components/SelectSumula.tsx:84`, `src/components/SeletorNota.tsx:85`, `src/components/ListaReceitasAbertas.tsx:98` e `src/routes/Layout.tsx:164`. O SVG do Login é a única exceção (confirmado por grep por `ChevronDown` + inspeção).
- **Text-shadow do LED tem exatamente 2 variantes**, ambas como classe arbitrária inline em `src/components/PainelPlacar.tsx`: `:48` (`[text-shadow:0_0_10px_rgba(255,179,0,0.5)]`, painel compacto) e `:134` (`[text-shadow:0_0_14px_rgba(255,179,0,0.55)]`, painel grande) — inclusive com leve drift de blur/opacidade entre elas, o que reforça que hoje são dois valores intencionais, não cópia. Grep por `glow-led` em `src/`: **zero usos** (a utility não existe). Condição da 3ª variante **não satisfeita hoje**.
- **`outline-offset` divergente no Snackbar**: `src/components/Snackbar.tsx:73` usa `focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-1` no botão fechar. O seletor global (`src/index.css:158-165`) aplica a todos os `button:focus-visible` etc. `outline: 2px solid var(--cor-destaque-texto)` com `outline-offset: 2px` — ou seja, cor e largura do Snackbar já coincidem com o global; **só o offset diverge** (1 vs 2). Basta remover a classe `focus-visible:outline-offset-1` para o botão herdar o global.
- **Hex hardcoded em `shadow-carimbo-destaque`**: `src/index.css:224-226` — `@utility shadow-carimbo-destaque { box-shadow: 3px 3px 0 #b37d00; }`. Grep por `b37d00` em `src/`, `public/` e `index.html`: **ocorrência única**, só nessa linha. A utility é consumida em 4 arquivos (`src/components/CardNotificacoes.tsx:135`, `ConfirmDialog.tsx:82`, `ModalFiltrosRanking.tsx:108`, `BotaoInstalar.tsx:48`) — **nenhum call site muda**; a alteração é só no corpo do `@utility`.
- **Padrão de tokens já estabelecido**: variáveis `--cor-*` em `:root` e `.dark` (`index.css:43-45` e `:65-67`, ex. `--cor-destaque: #ffb300`) mapeadas no `@theme` como `--color-*` (`index.css:19-21`). O `#b37d00` é o tom escurecido do âmbar usado como sombra dos botões primários em destaque.

## 3. Precondições e dependências

- **Nenhum plano pré-requisito.** Os 4 micro-passos são independentes entre si e de qualquer outro plano.
- **Critério de aplicação por passo** (do doc de origem, regra "ao tocar os arquivos"):
  - **Passo 1 (Chevron)**: executar **somente quando `src/routes/Login.tsx` for tocado por outro motivo** (feature, correção ou outro plano). Não abrir um trabalho só para isso hoje.
  - **Passo 2 (glow-led)**: **não executar hoje**. Condicional explícita do plano de origem: só criar o `@utility glow-led` **se surgir uma 3ª variante** do text-shadow (ex.: novo painel/tema de LED). Com 2 usos e valores já divergentes de propósito, extrair agora seria abstração sem demanda (AGENTS.md: DRY com critério; YAGNI). Registrar como gatilho de vigilância.
  - **Passos 3 e 4**: aplicáveis imediatamente — correções de uma linha, sem decisão de dono.
- **Decisão do dono**: nenhuma. No Passo 4, o nome da variável segue o padrão existente (`--cor-destaque-sombra` como sugestão); se o dono preferir outro nome, o custo de renomear depois é uma linha.
- **Restrição de janela**: nenhuma. Nenhum passo altera fluxo de dados, mutação ou tela de negócio; nada depende de partida ao vivo.

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Chevron do Login via lucide `ChevronDown` · 1 commit · **APENAS AO TOCAR O ARQUIVO**

- **Gatilho**: executar somente quando `src/routes/Login.tsx` já estiver sendo modificado por outro trabalho. Não tocá-lo só para este passo.
- **Arquivo**: apenas `src/routes/Login.tsx`.
- Adicionar `ChevronDown` ao import de `lucide-react` (arquivo hoje não importa nada do lucide).
- Substituir o bloco `<svg>…</svg>` de `Login.tsx:168-178` por `<ChevronDown className="w-4 h-4 text-destaque-texto transition-transform" strokeWidth={2.5} />` com a rotação condicional existente (`aberto ? 'rotate-180' : ''`) preservada no `className` — o padrão dos outros chevrons do app (`SelectSumula.tsx:84`, `SeletorNota.tsx:85`) usa o ícone com classe e transição equivalentes.
- O SVG atual usa `fill="currentColor"` com stroke implícito nulo; o `ChevronDown` do lucide é baseado em stroke — o resultado visual é um chevron levemente mais fino, dentro do padrão dos demais chevrons do app. Não compensar com `strokeWidth` exagerado; igualar ao que os outros usam.
- Manter intactos o `<button>` pai (`aria-label`, `aria-expanded`, tamanho 44px) e a lista `role="listbox"`.
- Commit: "troca chevron SVG inline do Login por ChevronDown do lucide (C6.1)".

### Passo 2 — `@utility glow-led` · **NÃO EXECUTAR HOJE** (condicional a 3ª variante)

- **Estado**: registrado como débito condicional, não como trabalho. **Hoje não fazer** — há exatamente 2 variantes (`PainelPlacar.tsx:48` e `:134`) com blur/opacidade intencionalmente diferentes entre si; uma `@utility` única ou um parâmetro hoje forçaria unificação visual sem demanda.
- **Gatilho de execução**: surgir uma **3ª ocorrência** de text-shadow de LED em `src/` (novo painel, tema ou variação de placar). Nesse momento:
  - Criar `@utility glow-led { … }` em `src/index.css`, junto das demais utilities (`:212+`), seguindo o padrão das existentes (`transition-fast`, `shadow-carimbo`);
  - Substituir as 3 ocorrências pela classe `glow-led`, parametrizando por variável se as intensidades continuarem distintas (ex.: `--glow-led-forca`), ou padronizando se a divergência for drift;
  - Commit próprio: "extrai text-shadow do LED para @utility glow-led (C6.2)".
- Enquanto o gatilho não ocorrer, este passo permanece fechado (o par atual de classes arbitrárias inline é aceitável — 2 usos, 1 arquivo).

### Passo 3 — Uniformizar `outline-offset` do Snackbar · 1 commit

- **Arquivo**: apenas `src/components/Snackbar.tsx` (linha 73).
- Remover a classe `focus-visible:outline-offset-1` do `className` do botão fechar. As classes `focus-visible:outline-2` e `focus-visible:outline-destaque-texto` podem permanecer (reforçam o que o global já faz) ou ser removidas junto — preferência: **manter só a remoção do offset**, mudança mínima; o seletor global `index.css:158-165` passa a fornecer `outline-offset: 2px`, igual aos demais botões do app.
- Efeito: o anel de foco fica 1px mais afastado do botão — diferença imperceptível, agora consistente com todo o app.
- Não tocar no `dark:hover:bg-branco-time/20` da mesma linha: ele é objeto do plano C3/token scrim (`12-token-scrim.md`), fora de escopo aqui.
- Commit: "uniformiza outline-offset do botão fechar do Snackbar com o global (C6.3)".

### Passo 4 — Hex `#b37d00` → variável em `shadow-carimbo-destaque` · 1 commit (cosmético)

- **Arquivo**: apenas `src/index.css`.
- Criar `--cor-destaque-sombra: #b37d00;` em `:root` (ao lado das demais `--cor-destaque-*`, `:43-45`) e em `.dark` (mesmo valor, `:65-67`), e mapear `--color-destaque-sombra: var(--cor-destaque-sombra);` no `@theme` (ao lado de `:19-21`) — mesmo mecanismo dos tokens existentes.
- Trocar o corpo do `@utility shadow-carimbo-destaque` (`:224-226`) para `box-shadow: 3px 3px 0 var(--cor-destaque-sombra);`.
- Os 4 call sites (`CardNotificacoes.tsx:135`, `ConfirmDialog.tsx:82`, `ModalFiltrosRanking.tsx:108`, `BotaoInstalar.tsx:48`) **não mudam** — continuam consumindo a classe `shadow-carimbo-destaque`.
- Comportamento visual: idêntico (mesmo hex); o ganho é o hex sair de valor mágico para o sistema de tokens (e, no futuro, poder variar por tema como as demais `--cor-*`).
- Commit: "move #b37d00 da shadow-carimbo-destaque para variável de token (C6.4)".

Total: 2 commits aplicáveis de imediato (Passos 3 e 4); Passo 1 fica armado para a próxima edição de `Login.tsx`; Passo 2 fica registrado como condicional. Todos independentes e revertíveis.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no build de dev/aparelho:

- [ ] `npm run build` (ou `tsc -b`) sem erros após cada passo executado.
- [ ] **Passo 1 (quando executado)**: na tela de login, abrir a lista de usernames — o chevron aparece, gira 180° ao abrir/fechar (transição suave) e mantém a cor âmbar de texto; o botão continua com 44px e o teclado/leitor de tela continuam funcionando (foco volta ao input).
- [ ] **Passo 3**: focar o botão fechar do Snackbar por teclado (Tab) — anel de foco âmbar presente, com o mesmo afastamento visual (2px) dos outros botões do app; o fechamento da notificação continua funcionando.
- [ ] **Passo 4**: visualmente nada muda — comparar os 4 pontos onde `shadow-carimbo-destaque` aparece (ex.: botão primário do `ConfirmDialog`, `BotaoInstalar`) antes/depois: sombra dura deslocada 3px no mesmo tom âmbar escuro.
- [ ] **Passo 2 (quando executado)**: brilho do LED do placar (painéis compacto e grande) idêntico ao atual em estado `isLive`, sem regressão nos estados fechado/normal.

## 6. Fora de escopo

- **Não** criar o `@utility glow-led` com apenas 2 variantes (Passo 2 permanece fechado até a 3ª aparecer) — nem unificar as duas intensidades atuais, que divergem de propósito entre os painéis.
- **Não** abrir `Login.tsx` só para o Passo 1; e não migrar nenhum outro ícone SVG além do chevron ali citado (nenhum outro foi apontado pelo plano de origem).
- **Não** tocar no `dark:hover:bg-branco-time/20` do `Snackbar.tsx:73` (objeto do plano `12-token-scrim.md`) nem nos outros overlays de scrim.
- **Não** alterar os call sites de `shadow-carimbo-destaque` nem introduzir variação de sombra por tema além do que o token novo permite.
- **Não** padronizar `strokeWidth`/visual de todos os ícones do app — só o chevron do Login entra no padrão lucide já usado pelos demais.
- **Não** criar testes automáticos, dependências novas ou abstrações (`lucide-react` já é dependência; `@utility` é mecanismo existente do `index.css`).

## 7. Riscos e rollback

- **Risco funcional: mínimo em todos os passos.** Nenhum toca fluxo de dados, estado ou navegação; todos são apresentação.
- **Risco do Passo 1 (baixo)**: diferença sutil de desenho entre o SVG fill e o ícone stroke do lucide — mitigada por igualar ao `ChevronDown` já consagrado nas outras 5 telas; o resultado fica mais consistente, não menos. Rollback: `git revert` do commit restaura o `<svg>` inline.
- **Risco do Passo 2 (nulo hoje, pois não executa)**: quando executado, o risco é unificar intensidades que eram intencionais — mitigado pelo critério de parametrização/preservação de valores descrito na seção 4. Rollback: `git revert` do commit devolve as classes arbitrárias inline.
- **Risco do Passo 3 (baixo)**: anel de foco 1px mais afastado — mudança de acessibilidade positiva (consistência), reversível sem efeito colateral. Rollback: `git revert` do commit recoloca `outline-offset-1`.
- **Risco do Passo 4 (praticamente nulo)**: mesmo hex, só mudou onde vive; único risco é erro de digitação no valor da variável, que aparece imediatamente na sombra dos 4 pontos de uso. Rollback: `git revert` do commit restaura o hex literal no `@utility`.
- Todos os passos executados são revertíveis por `git revert` isolado, sem dependência entre si nem de outros planos.
