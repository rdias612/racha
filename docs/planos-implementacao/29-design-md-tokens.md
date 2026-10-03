# 29 · DESIGN.md em ordem — Plano de Implementação

> Ref.: item **C5** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#29 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: nenhum (mudança só de doc) · Prioridade global do plano: P2

## 1. Objetivo

Deixar o `DESIGN.md` — que o próprio `DESIGN.md:147` declara **fonte canônica do Design System** — de fato apto a cumprir esse papel sem que o leitor precise abrir o CSS. Hoje o documento (a) abre com o **H1 errado** (título do `AGENTS.md`), (b) **não contém a tabela de tokens `--cor-*`** que seus próprios trechos de texto citam, (c) não registra a micro-escala de rótulos (9/10/11px) nem os raios canônicos que o app já usa de forma consistente, e (d) não documenta que os hexes de fundo (`#12100d` / `#f3efe4`) existem **duplicados em 4 arquivos executáveis** (5 contando o CSS) — o comentário cruzado é prevenção de drift barata (justificativa do item no ranking). **Nenhuma linha de código é alterada**: o CSS continua sendo a fonte executável dos tokens; o `DESIGN.md` passa a espelhá-la e a apontar para ela.

> Nota: o `AGENTS.md` real (174 linhas) não menciona o `DESIGN.md` em momento algum; toda a menção de fonte canônica, os pilares de interface e a matriz "Faça/Não Faça" vivem dentro do próprio `DESIGN.md`. Por isso, todas as referências deste plano apontam para o `DESIGN.md`.

## 2. Estado atual (evidências verificadas)

Verificado no código em **03/10/2026** (re-verificação completa; a medição anterior de 30/09/2026 estava defasada porque o plano 12 executou no intervalo); todas as linhas do doc de origem conferidas e corretas:

- `DESIGN.md:1` — H1 errado: `# ⚽ AGENTS.md — Diretrizes Canônicas de Contribuição (Racha Gragoatá CBO)` (cópia do título do `AGENTS.md`; verificado).
- `DESIGN.md` **não contém** nenhuma tabela dos tokens `--cor-*`; a seção 4 ("Identidade Visual") lista os nomes semânticos em prosa (`DESIGN.md:161`) e auto-referencia o próprio `DESIGN.md` como detentor dos detalhes, que não estão lá.
- Fonte executável dos tokens: `src/index.css` — `:root` com os tokens em `:34-51`, `.dark` em `:55-72`, mapeamento `@theme` (`--color-*: var(--cor-*)`) em `:5-31`. São **18 tokens `--cor-*`**, incluindo `--cor-scrim` (plano 12 já executado) e `--cor-destaque-texto`. Valores que divergem entre temas: `--cor-fundo`, `--cor-superficie`, `--cor-superficie-2`, `--cor-borda`, `--cor-giz`, `--cor-giz-fraco`, `--cor-destaque-texto` (`#92400e` claro vs `#ffb300` escuro), `--cor-campo`, `--cor-campo-linha`; os demais (incluindo `--cor-scrim`) são idênticos nos dois temas.
- **Micro-escala de rótulos**: escala informal já consolidada no app, porém ausente de qualquer doc. Medição de referência de 03/10/2026: **122 usos** de `text-[9px]`/`text-[10px]`/`text-[11px]` em **54 arquivos** de `src/**/*.tsx`. (Não confundir com a regra `text-base` anti-zoom, que vale para inputs/`select` — `src/index.css:103-107`.)
- **Raios canônicos**: escala `rounded-[2px]` / `rounded-[3px]` / `rounded-[4px]` / `rounded-[6px]`, **sem nenhum outro raio arbitrário** `rounded-[*px]`. Medição de referência de 03/10/2026: ×95, ×71, ×203 e ×1, respectivamente. O `DESIGN.md:167` descreve o teto ("no máximo `rounded-[6px]`"), mas o `DESIGN.md` não consolida a escala.
- **Hexes duplicados** (tema de fundo, 4 arquivos executáveis + o CSS):
  - `src/lib/tema.ts:18-19` — `COR_FUNDO_DARK = '#12100d'`, `COR_FUNDO_LIGHT = '#f3efe4'` (alimentam a `meta theme-color` em runtime, `tema.ts:36-48`);
  - `index.html:7` — `<meta name="theme-color" content="#12100d" />` (valor inicial pré-script) e `index.html:19` — fallback inline do script anti-FOUC (`'#12100d'` / `'#f3efe4'`);
  - `public/manifest.webmanifest:10-11` — `"background_color": "#12100d"`, `"theme_color": "#12100d"`;
  - `public/offline.html:15` — `--cor-fundo: #12100d` no fallback offline servido pelo Service Worker;
  - `src/index.css:34` (`:root --cor-fundo: #f3efe4`) e `:55` (`.dark --cor-fundo: #12100d`) — os valores batem hoje; qualquer troca de paleta de fundo exige edição coordenada nos 5 arquivos, e nada no repo registra isso.

> **Decisão sobre números congelados**: contagens de usos (`text-[9/10/11px]`, raios) mudam a cada PR e tendem a defasar o doc. Os passos 2.1 e 2.2 abaixo mandam **medir na data da execução** (grep simples, descrito no próprio passo) e registram os números de 03/10/2026 apenas como referência de comparação — se a medição da execução divergir muito, o texto do doc cita a faixa/escala, não o número absoluto.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** Este plano é só doc e pode rodar a qualquer momento; nada de código é tocado.
- **Coordenação com planos que alteram tokens**:
  - **Plano 12 (`--cor-scrim`) já executou** antes desta re-verificação — a tabela do passo 1 já nasce com `--cor-scrim` incluído (18 tokens).
  - Planos **13** (tokens/dados mortos) e **23** (`--cor-ok-texto`/`--cor-perigo-texto`) ainda não executaram. Se executarem **antes** deste, a tabela do passo 1 já nasce com o **estado final**: **sem** `--cor-oliva` e `--cor-led-fundo-hover` (plano 13) e **com** `--cor-ok-texto`/`--cor-perigo-texto` (plano 23) — medir o `src/index.css` na execução, como manda o passo 1.
  - Se este plano executar **antes**, a tabela registra o estado corrente do `src/index.css` e a nota "fonte executável" já prevista no passo 1 orienta os planos 13/23 a **atualizarem as linhas correspondentes da tabela** nos commits deles (custo de 1 linha por plano).
  - Nenhuma ordem quebra; escolher por conveniência de revisão.
- **Decisão do dono exigida**: nenhuma — o conteúdo da tabela é espelho literal do CSS existente, sem valores novos.
- **Restrição de janela**: nenhuma (sem tocar em código, não afeta partida ao vivo).

## 4. Plano de execução (1 passo = 1 commit)

**Passo 1 — Corrigir o H1 e incluir a tabela de tokens `--cor-*` (commit 1).**
Arquivo único: `DESIGN.md`.

1. Trocar o H1 da linha 1 por um título próprio do documento, ex.: `# 🎨 DESIGN.md — Guia Canônico do Design System "Súmula de Quinta" (Racha Gragoatá CBO)` (mantém o espírito do título atual, sem colidir com o `AGENTS.md`).
2. Na seção 4, logo após a nota de fonte canônica (`DESIGN.md:147-149`), incluir a **tabela `--cor-*`** com 3 colunas — Token | Valor claro (`:root`) | Valor escuro (`.dark`) — espelhando **literalmente** o `src/index.css` corrente na data da execução (medir os blocos `:root` e `.dark`; referência de 03/10/2026: tokens em `:34-51` e `:55-72`). A tabela deve conter **todos os 18 tokens atuais**, incluindo `--cor-scrim` e `--cor-destaque-texto`, com as linhas que divergem por tema destacadas.
3. Encimar a tabela com a **nota de precedência**: *"Os valores abaixo são espelho de `src/index.css` (`:root`, `.dark` e `@theme`), que é a **fonte executável** dos tokens; em caso de divergência, vale o CSS — e esta tabela deve ser corrigida no mesmo commit."*
4. Nada mais muda no documento; commit reversível isolado.

**Passo 2 — Registrar micro-escala, raios canônicos e comentário cruzado dos hexes (commit 2).**
Arquivo único: `DESIGN.md`.

1. Na seção de tipografia, registrar a **micro-escala de rótulos**: `text-[9px]` / `text-[10px]` / `text-[11px]` como escala canônica para micro-rótulos não interativos (eyebrows de seção, metadados, contadores, badges compactas — sempre com `font-display uppercase tracking-*`). Antes de escrever, **medir na data da execução** com grep em `src/**/*.tsx` (referência de 03/10/2026: 122 usos em 54 arquivos) e citar o resultado corrente — a escala é o que vale canonicamente, não o número absoluto de usos. Deixar explícito que a regra não altera as exceções existentes: inputs permanecem `text-base` (anti-zoom iOS) e alvos de toque permanecem ≥ 44px.
2. Na seção de geometria, consolidar a **escala de raios canônicos**: `rounded-[2px]` (badges/chips compactos), `rounded-[3px]` (elementos pequenos), `rounded-[4px]` (padrão para botões, inputs, cards e modais), `rounded-[6px]` (teto, reservado a diálogos tela cheia) — vedado qualquer raio Tailwind genérico (`rounded-xl` etc.), como já manda a matriz do `DESIGN.md:466`. Antes de escrever, **medir na data da execução** que esses 4 valores continuam sendo os únicos `rounded-[*px]` de `src/**/*.tsx` (referência de 03/10/2026: ×95, ×71, ×203 e ×1); se surgir um 5º raio, a escala do doc deve refleti-lo ou o passo deve sinalizar a divergência no PR.
3. Na mesma região dos hexes de fundo da tabela, acrescentar o **comentário cruzado de edição coordenada** (só no doc, sem tocar código): *"Os hexes de fundo `#12100d` (dark) e `#f3efe4` (light) existem duplicados em `src/lib/tema.ts:18-19`, `index.html:7,19` (meta theme-color + fallback do script), `public/manifest.webmanifest:10-11`, `public/offline.html:15` (fallback offline), além de `src/index.css`. Alterar qualquer um deles exige atualizar **todos os 5 arquivos no mesmo commit**; a `meta` do `index.html`, o `manifest` e o `offline.html` não leem o CSS."* (Hoje os valores batem; o comentário existe para impedir o drift silencioso.)
4. Revisar o sumário/âncoras internas do documento para refletir apenas o que de fato mudou (os títulos de seção não mudam; conferir apenas se algum link relativo citava o título antigo). Commit reversível isolado.

## 5. Validação manual

- [ ] Renderizar o `DESIGN.md` (preview do editor/GitHub) e conferir que o novo H1, a tabela e as notas aparecem sem quebra de markdown (colunas alinhadas, sem célula vazia).
- [ ] **Conferir a tabela contra `src/index.css`** token a token (18 linhas × 2 temas, na data da execução) — leitura lado a lado; qualquer valor divergente é erro do plano, não do CSS.
- [ ] Grep de sanidade no doc: os hexes citados no comentário cruzado (`#12100d`, `#f3efe4`) aparecem em `tema.ts`, `index.html`, `manifest.webmanifest`, `offline.html` e `src/index.css` nos arquivos/linhas indicados.
- [ ] Grep de raios/micro-escala **na data da execução**: os valores registrados no doc (2/3/4/6px; 9/10/11px) são exatamente os únicos `rounded-[*px]` e os únicos tamanhos arbitrários de rótulo em `src/**/*.tsx`; as contagens citadas batem com a medição feita no mesmo momento.
- [ ] `npm run lint` e `npm run build` seguem passando (nada de código mudou — verificação de que nenhum arquivo de código entrou no commit por engano: `git show --stat` de cada commit deve listar **somente `DESIGN.md`**).

## 6. Fora de escopo

- **Não alterar nenhum arquivo de código** — em particular, não extrair os hexes de `tema.ts`/`index.html`/`manifest.webmanifest` para um token ou constante compartilhada (não há mecanismo atual para `manifest`/`meta` lerem o CSS; seria mudança de build, fora do escopo de um item de doc).
- **Não criar script de geração/sync da tabela de tokens** (YAGNI: 18 linhas, mudança rara; a nota de precedência já obriga o sync manual no mesmo commit).
- **Não reescrever nem reorganizar seções inteiras do `DESIGN.md`** — apenas o H1 e os acréscimos dos passos 1–2; reforma ampla dificultaria o review sem ganho.
- **Não criar valores novos de token** (ex.: propor `--cor-ok-texto`/`--cor-perigo-texto` aqui — isso é do plano 23; `--cor-scrim` já existe via plano 12 e entra na tabela como estado atual).
- **Não alterar valores existentes** de nenhum token, raio ou tamanho de fonte; o plano registra o que o app já faz.

## 7. Riscos e rollback

- **Risco 1 — Tabela defasada**: se os planos 13, 23 (ou qualquer plano futuro que altere tokens) executarem **depois** deste e esquecerem de atualizar a tabela, o doc volta a divergir do CSS (exatamente o problema que o plano ataca). Mitigação: a nota de precedência do passo 1 obriga o sync no mesmo commit de cada plano; registrar essa obrigação na descrição do PR dos planos 13/23.
- **Risco 2 — Erro de transcrição de hex/token** na tabela (doc errado pior que doc ausente). Mitigação: validação item a item contra `src/index.css` (seção 5); como o CSS é declarado fonte executável, o erro não afeta runtime.
- **Rollback**: ambos os commits tocam somente `DESIGN.md` e são independentes entre si — cada um é revertível por `git revert` isolado, na ordem inversa (2 antes de 1). Nenhum impacto em build, runtime ou PWA em nenhum momento.
