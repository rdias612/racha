# 29 · DESIGN.md em ordem — Plano de Implementação

> Ref.: item **C5** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#29 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: nenhum (mudança só de doc) · Prioridade global do plano: P2

## 1. Objetivo

Deixar o `DESIGN.md` — que o próprio `AGENTS.md:147` declara **fonte canônica do Design System** — de fato apto a cumprir esse papel sem que o leitor precise abrir o CSS. Hoje o documento (a) abre com o **H1 errado** (título do `AGENTS.md`), (b) **não contém a tabela de tokens `--cor-*`** que seus próprios trechos de texto citam, (c) não registra a micro-escala de rótulos (9/10/11px) nem os raios canônicos que o app já usa de forma consistente, e (d) não documenta que os hexes de fundo (`#12100d` / `#f3efe4`) existem **duplicados em 3 arquivos executáveis** — o comentário cruzado é prevenção de drift barata (justificativa do item no ranking). **Nenhuma linha de código é alterada**: o CSS continua sendo a fonte executável dos tokens; o `DESIGN.md` passa a espelhá-la e a apontar para ela.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

- `DESIGN.md:1` — H1 errado: `# ⚽ AGENTS.md — Diretrizes Canônicas de Contribuição (Racha Gragoatá CBO)` (cópia do título do `AGENTS.md`; verificado).
- `DESIGN.md` **não contém** nenhuma tabela dos tokens `--cor-*`; a seção 4 ("Identidade Visual") lista os nomes semânticos em prosa (`AGENTS.md:161`) e auto-referencia o próprio `DESIGN.md` como detentor dos detalhes, que não estão lá.
- Fonte executável dos tokens: `src/index.css` — `:root` em `:34-54`, `.dark` em `:56-76`, mapeamento `@theme` (`--color-*: var(--cor-*)`) em `:5-32`. Valores que divergem entre temas: `--cor-fundo`, `--cor-superficie`, `--cor-superficie-2`, `--cor-borda`, `--cor-giz`, `--cor-giz-fraco`, `--cor-destaque-texto` (`#92400e` claro vs `#ffb300` escuro), `--cor-campo`, `--cor-campo-linha`; os demais são idênticos nos dois temas.
- **Micro-escala de rótulos**: grep em `src/**/*.tsx` confirma **138 usos** de `text-[9px]`, `text-[10px]` ou `text-[11px]` distribuídos em **58 arquivos** — escala informal já consolidada no app, porém ausente de qualquer doc. (Não confundir com a regra `text-base` anti-zoom, que vale para inputs/`select` — `src/index.css:106-110`.)
- **Raios canônicos**: grep em `src/**/*.tsx` confirma `rounded-[2px]` ×101, `rounded-[3px]` ×81, `rounded-[4px]` ×234, `rounded-[6px]` ×2 — e **nenhum outro** raio arbitrário `rounded-[*px]`. O `AGENTS.md:167` descreve o teto ("no máximo `rounded-[6px]`"), mas o `DESIGN.md` não consolida a escala.
- **Hexes duplicados** (tema de fundo, 3 arquivos executáveis + o CSS):
  - `src/lib/tema.ts:18-19` — `COR_FUNDO_DARK = '#12100d'`, `COR_FUNDO_LIGHT = '#f3efe4'` (alimentam a `meta theme-color` em runtime, `tema.ts:36-48`);
  - `index.html:7` — `<meta name="theme-color" content="#12100d" />` (valor inicial pré-script) e `index.html:19` — fallback inline do script anti-FOUC (`'#12100d'` / `'#f3efe4'`);
  - `public/manifest.webmanifest:10-11` — `"background_color": "#12100d"`, `"theme_color": "#12100d"`;
  - `src/index.css:57` (`.dark --cor-fundo: #12100d`) e `:35` (`:root --cor-fundo: #f3efe4`) — os valores batem hoje; qualquer troca de paleta de fundo exige edição coordenada nos 4 arquivos, e nada no repo registra isso.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** Este plano é só doc e pode rodar a qualquer momento; nada de código é tocado.
- **Coordenação com planos 12 (`--cor-scrim`), 13 (tokens/dados mortos) e 23 (`--cor-ok-texto`/`--cor-perigo-texto`)**:
  - Se **12, 13 e 23 executarem antes** deste, a tabela do passo 1 já nasce com o **estado final**: com `--cor-scrim` (plano 12), **sem** `--cor-oliva` e `--cor-led-fundo-hover` (plano 13) e **com** `--cor-ok-texto`/`--cor-perigo-texto` (plano 23).
  - Se este plano executar **antes**, a tabela registra o estado corrente do `src/index.css` e a nota "fonte executável" já prevista no passo 1 orienta os planos 12/13/23 a **atualizarem as linhas correspondentes da tabela** nos commits deles (custo de 1 linha por plano).
  - Nenhuma ordem quebra; escolher por conveniência de revisão.
- **Decisão do dono exigida**: nenhuma — o conteúdo da tabela é espelho literal do CSS existente, sem valores novos.
- **Restrição de janela**: nenhuma (sem tocar em código, não afeta partida ao vivo).

## 4. Plano de execução (1 passo = 1 commit)

**Passo 1 — Corrigir o H1 e incluir a tabela de tokens `--cor-*` (commit 1).**
Arquivo único: `DESIGN.md`.

1. Trocar o H1 da linha 1 por um título próprio do documento, ex.: `# 🎨 DESIGN.md — Guia Canônico do Design System "Súmula de Quinta" (Racha Gragoatá CBO)` (mantém o espírito do título atual, sem colidir com o `AGENTS.md`).
2. Na seção 4, logo após a nota de fonte canônica (`DESIGN.md:147-149`), incluir a **tabela `--cor-*`** com 3 colunas — Token | Valor claro (`:root`) | Valor escuro (`.dark`) — espelhando **literalmente** `src/index.css:34-54` e `:56-76` (todos os 19 tokens atuais, incluindo `--cor-campo-linha`, `--cor-led-borda` etc.), com as linhas que divergem por tema destacadas.
3. Encimar a tabela com a **nota de precedência**: *"Os valores abaixo são espelho de `src/index.css` (`:root`, `.dark` e `@theme`), que é a **fonte executável** dos tokens; em caso de divergência, vale o CSS — e esta tabela deve ser corrigida no mesmo commit."*
4. Nada mais muda no documento; commit reversível isolado.

**Passo 2 — Registrar micro-escala, raios canônicos e comentário cruzado dos hexes (commit 2).**
Arquivo único: `DESIGN.md`.

1. Na seção de tipografia, registrar a **micro-escala de rótulos**: `text-[9px]` / `text-[10px]` / `text-[11px]` como escala canônica para micro-rótulos não interativos (eyebrows de seção, metadados, contadores, badges compactas — sempre com `font-display uppercase tracking-*`), citando o uso consolidado (138 usos em 58 arquivos na data do plano). Deixar explícito que a regra não altera as exceções existentes: inputs permanecem `text-base` (anti-zoom iOS) e alvos de toque permanecem ≥ 44px.
2. Na seção de geometria, consolidar a **escala de raios canônicos**: `rounded-[2px]` (badges/chips compactos), `rounded-[3px]` (elementos pequenos), `rounded-[4px]` (padrão para botões, inputs, cards e modais), `rounded-[6px]` (teto, reservado a diálogos tela cheia) — vedado qualquer raio Tailwind genérico (`rounded-xl` etc.), como já manda a matriz do `AGENTS.md:466`.
3. Na mesma região dos hexes de fundo da tabela, acrescentar o **comentário cruzado de edição coordenada** (só no doc, sem tocar código): *"Os hexes de fundo `#12100d` (dark) e `#f3efe4` (light) existem duplicados em `src/lib/tema.ts:18-19`, `index.html:7,19` (meta theme-color + fallback do script) e `public/manifest.webmanifest:10-11`, além de `src/index.css`. Alterar qualquer um deles exige atualizar **todos os 4 arquivos no mesmo commit**; a `meta` do `index.html` e o `manifest` não leem o CSS."* (Hoje os valores batem; o comentário existe para impedir o drift silencioso.)
4. Revisar o sumário/âncoras internas do documento para refletir apenas o que de fato mudou (os títulos de seção não mudam; conferir apenas se algum link relativo citava o título antigo). Commit reversível isolado.

## 5. Validação manual

- [ ] Renderizar o `DESIGN.md` (preview do editor/GitHub) e conferir que o novo H1, a tabela e as notas aparecem sem quebra de markdown (colunas alinhadas, sem célula vazia).
- [ ] **Conferir a tabela contra `src/index.css`** token a token (19 linhas × 2 temas) — leitura lado a lado; qualquer valor divergente é erro do plano, não do CSS.
- [ ] Grep de sanidade no doc: os hexes citados no comentário cruzado (`#12100d`, `#f3efe4`) aparecem em `tema.ts`, `index.html` e `manifest.webmanifest` nos arquivos/linhas indicados.
- [ ] Grep de raios/micro-escala: os valores registrados no doc (2/3/4/6px; 9/10/11px) são exatamente os únicos `rounded-[*px]` e os únicos tamanhos arbitrários de rótulo em `src/**/*.tsx` na data da validação.
- [ ] `npm run lint` e `npm run build` seguem passando (nada de código mudou — verificação de que nenhum arquivo de código entrou no commit por engano: `git show --stat` de cada commit deve listar **somente `DESIGN.md`**).

## 6. Fora de escopo

- **Não alterar nenhum arquivo de código** — em particular, não extrair os hexes de `tema.ts`/`index.html`/`manifest.webmanifest` para um token ou constante compartilhada (não há mecanismo atual para `manifest`/`meta` lerem o CSS; seria mudança de build, fora do escopo de um item de doc).
- **Não criar script de geração/sync da tabela de tokens** (YAGNI: 19 linhas, mudança rara; a nota de precedência já obriga o sync manual no mesmo commit).
- **Não reescrever nem reorganizar seções inteiras do `DESIGN.md`** — apenas o H1 e os acréscimos dos passos 1–2; reforma ampla dificultaria o review sem ganho.
- **Não criar valores novos de token** (ex.: propor `--cor-scrim` ou `ok-texto` aqui — isso é dos planos 12 e 23).
- **Não alterar valores existentes** de nenhum token, raio ou tamanho de fonte; o plano registra o que o app já faz.

## 7. Riscos e rollback

- **Risco 1 — Tabela defasada**: se os planos 12, 13 e/ou 23 executarem **depois** deste e esquecerem de atualizar a tabela, o doc volta a divergir do CSS (exatamente o problema que o plano ataca). Mitigação: a nota de precedência do passo 1 obriga o sync no mesmo commit de cada plano; registrar essa obrigação na descrição do PR dos planos 12/13/23.
- **Risco 2 — Erro de transcrição de hex/token** na tabela (doc errado pior que doc ausente). Mitigação: validação item a item contra `src/index.css` (seção 5); como o CSS é declarado fonte executável, o erro não afeta runtime.
- **Rollback**: ambos os commits tocam somente `DESIGN.md` e são independentes entre si — cada um é revertível por `git revert` isolado, na ordem inversa (2 antes de 1). Nenhum impacto em build, runtime ou PWA em nenhum momento.
