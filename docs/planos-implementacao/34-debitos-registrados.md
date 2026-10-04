# 34 · Débitos registrados (corrigir só ao tocar os arquivos) — Plano de Implementação

> Ref.: item **A10** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#34 (nota 0,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S (4 débitos independentes, nenhum executável em lote de uma vez) · Risco: baixo · Prioridade global do plano: P3

## 1. Objetivo

**Este plano NÃO é backlog de execução imediata — é um registro de débitos.** Cada débito abaixo fica armado com um gatilho próprio ("corrigir quando tocar o arquivo X") e só é executado quando esse gatilho dispara, no espírito do AGENTS.md (mudanças pequenas, sem refactor cosmético amplo). São 4 registros: (a) 6 `<select>` nativos estilizados inline que migrariam para `SelectSumula` **condicionado a ele ganhar suporte a `optgroup`** — hoje não tem, e a decisão de adicionar é do dono; (b) convenção de nomenclatura de sufixo de componentes de card, valendo **apenas para código novo**; (c) 3 labels "Assists" em inglês a traduzir ao tocar os arquivos; (d) comentário de referência de geometria no topo de `Skeletons.tsx` apontando `CabecalhoSumula` — executável junto do plano 01 (A1).

> **Nota de prioridade**: no ranking anti-slop este item é o último (#34, nota 0,0 — "registro de débito, não execução"). O valor do plano é documentar os débitos e seus gatilhos para que sejam corrigidos no toque, e não esquecidos nem antecipados sem demanda.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; divergências do doc de origem corrigidas abaixo:

- **Os 6 `<select>` nativos estilizados inline confirmados** (contagem do doc de origem conferida — 6, não 5):
  - `src/components/DialogoEvento.tsx:94` — seleção de jogador ao editar evento, **com `optgroup` "Time Preto" / "Time Branco"** (`:103-120`);
  - `src/components/SeletorAtletasComparador.tsx:30` e `:52` — seletores Atleta A / Atleta B, com `<option value="">` de placeholder e opções `disabled` para impedir duplicar atleta;
  - `src/routes/Estatisticas.tsx:183` — seletor "Atleta em Análise", lista plana de jogadores;
  - `src/routes/NovoJogador.tsx:156` e `:180` — posição principal e secundária, listas planas derivadas de `POSICOES`/`POSICOES_B`.
- **`SelectSumula` existe** (`src/components/SelectSumula.tsx`) e já é o padrão do app: consumido por `FormEventoAutomatico.tsx` (5 usos, `:174`–`:245`) e `FormLancamentoFinanceiro.tsx` (2 usos, `:126`, `:154`). Ele renderiza `<button role="combobox">` + `<ul role="listbox">` a partir de uma lista **plana** `SelectSumulaOpcao[]` (`SelectSumula.tsx:4-13, 98-129`).
- **`SelectSumula` NÃO tem suporte a `optgroup` hoje** — nem na API (não há campo de grupo em `SelectSumulaOpcao`) nem no render (o `opcoes.map` produz apenas `<li role="option">` sem separador de grupo; a navegação de teclado vem de `useListbox` e indexa a lista plana).
- **Sufixos de card inconsistentes** (grep/inspeção em `src/components/`): `DueloCard.tsx`, `DuplaCard.tsx` e `CardNotificacoes.tsx` usam sufixo `Card`; `CardCraquePartida.tsx` usa prefixo `Card` + sujeito; `CartaoJogadorEdicao.tsx` usa "Cartao" traduzido. Três convenções convivendo, sem drift funcional — é inconsistência de nome, não de código.
- **Labels "Assists" em inglês confirmados**: `src/routes/Estatisticas.tsx:207` e `src/routes/Perfil.tsx:189` (ambos `<StatBox label="Assists" value={stats?.assistencias ?? 0} />`) e `src/components/CartaoJogadorEdicao.tsx:95` (`label="Assists"`; a prop de dado subjacente é `assistencias` — o domínio é pt-BR, só o rótulo saiu em inglês).
- **Comentário do topo de `Skeletons.tsx`**: `src/components/Skeletons.tsx:1-4` diz "Espelham fielmente a geometria Súmula de Quinta (cantos retos 4px, bordas duras, placares LED)" — **sem apontar a fonte canônica da geometria**. O `CabecalhoSumula` ainda não existe (será criado pelo plano `01-cabecalho-sumula.md`); os 7 pontos de espelhamento estão nas linhas 17, 60, 100, 145, 189, 362 e 413. O plano 01 explicitamente deixa este comentário como escopo **deste** plano (seção Fora de escopo do 01).

## 3. Pré-condições e dependências

- **Nenhum plano é pré-requisito dos débitos (a), (b) e (c)** — eles são disparados por edição de arquivo, não por ordem de execução.
- **Débito (d) depende do plano 01** (`01-cabecalho-sumula.md`): o comentário só pode apontar para `CabecalhoSumula` depois que ele existir. Executar no mesmo período do 01 (idealmente junto do último passo de migração), não antes.
- **Decisão do dono exigida (débito a)**: migrar os selects exige que o `SelectSumula` ganhe suporte a `optgroup`. Hoje ele não tem; adicionar isso é uma evolução de API de componente consagrado (7 usos) que **não será feita por este plano sem aprovação**. O que faltaria está descrito no Passo 1. Se o dono decidir não evoluir o `SelectSumula`, o débito (a) se restringe aos 5 selects **sem** grupos (`SeletorAtletasComparador` 2, `Estatisticas` 1, `NovoJogador` 2) e o `DialogoEvento.tsx:94` permanece `<select>` nativo — a única tela que precisa de agrupamento.
- **Critério de aplicação por débito** (regra do doc de origem, "corrigir só ao tocar os arquivos"):
  - **(a) selects**: executar **somente quando o arquivo do select for tocado por outro motivo** — e, no caso com `optgroup`, só após a decisão do dono acima. Não abrir trabalho só para isso.
  - **(b) sufixos de card**: **não é correção, é convenção** — vale para componentes novos a partir de agora; nada é renomeado retroativamente.
  - **(c) labels "Assists"**: corrigir quando tocar `Estatisticas.tsx`, `Perfil.tsx` ou `CartaoJogadorEdicao.tsx` por outro motivo (os 3 arquivos são independentes entre si).
  - **(d) comentário no Skeletons**: executável de imediato, junto do plano 01 (custo de 1 comentário).
- **Restrição de janela**: nenhuma para (b), (c) e (d). O débito (a) em `DialogoEvento.tsx` toca a tela de gols ao vivo — se executado, preferir janela fora de partida.

## 4. Plano de execução (1 passo = 1 commit)

> Cada passo abaixo é um débito independente, disparado pelo próprio gatilho. Nenhum passo é executado hoje em lote.

### Passo 1 — Selects nativos → `SelectSumula` · **APENAS AO TOCAR OS ARQUIVOS** · condicional a decisão do dono

- **Gatilho**: o arquivo que contém o select já está sendo modificado por outro trabalho (feature, correção ou outro plano).
- **Pré-condição (decisão do dono)**: para o select de `DialogoEvento.tsx:94`, o `SelectSumula` precisa **primeiro** ganhar suporte a `optgroup`. Isso exige, no mínimo:
  1. **API**: aceitar grupos — ex. `opcoes: (SelectSumulaOpcao | { rotulo: string; opcoes: SelectSumulaOpcao[] })[]` (ou prop `grupos` separada), sem quebrar os 7 usos atuais de lista plana;
  2. **Render**: no `<ul role="listbox">` (`SelectSumula.tsx:90-131`), renderizar separadores de grupo como itens não selecionáveis (`role="presentation"`, estilo `text-giz-fraco`/mono pequeno) e achatar os índices de opção para os refs/`aria-activedescendant` continuarem apontando só para opções;
  3. **Teclado**: garantir que o `onKeyDown` do `useListbox` ignore os separadores ao navegar (Home/End/setas não param num rótulo de grupo).
  - É uma mudança pequena porém em componente já consumido em 7 pontos — **só fazer com aprovação do dono**. Sem aprovação, o select do `DialogoEvento` fica como está (o `<select>` nativo com `optgroup` é funcionalmente correto).
- **Migração por arquivo** (um select por vez, sem big-bang), no padrão dos usos existentes (`FormLancamentoFinanceiro.tsx:126`):
  - Listas planas — trocar `<select>` + `<option>` por `<SelectSumula opcoes={...} />`, preservando: `value`/`onChange` equivalentes, placeholder via `<option value="">` → prop `placeholder`, opções `disabled` do comparador (`j.id === idB`) → campo `disabled` da opção, e `aria-label`/`htmlFor` (o `label` textual permanece como elemento próprio; associar via `aria-label` no `SelectSumula`, que já tem a prop);
  - `DialogoEvento.tsx` — mapear os dois `optgroup` para o formato de grupos acima; se o suporte não existir, **pular este arquivo**;
  - Atentar para o anti-zoom: os selects nativos usam `text-base sm:text-sm`; o `SelectSumula` já resolve isso internamente (`text-base` no gatilho, `:79`).
- Commits: "migra select de <arquivo> para SelectSumula (A10.1)" — um commit por arquivo.

### Passo 2 — Convenção de sufixo de cards · **CONVENÇÃO PARA CÓDIGO NOVO** (não é commit)

- **Gatilho**: criação de qualquer componente de card novo.
- **Convenção adotada**: componente de card = **`<Sujeito>Card`** (sufixo `Card` em inglês, sujeito em pt-BR) — alinha com os casos dominantes `DueloCard` e `DuplaCard` e com o padrão geral do app de sufixo técnico em inglês + domínio em português (como `CabecalhoSumula`/`BotaoVoltar` fazem com prefixo; aqui o sujeito vem antes). Ex.: um card de artilheiro seria `ArtilheiroCard`, não `CardArtilheiro` nem `CartaoArtilheiro`.
- **NÃO renomear retroativamente** `CardCraquePartida`, `CartaoJogadorEdicao`, `CardNotificacoes`, `DueloCard` ou `DuplaCard` — APIs já estabelecidas, renomeação cosmética ampla (AGENTS.md proíbe).
- Quando um dos arquivos existentes for tocado por outro motivo, é aceitável (não obrigatório) registrar a convenção num comentário de cabeçalho do arquivo tocado.
- Este passo não gera commit próprio; é registrado aqui como referência para revisão de código novo.

### Passo 3 — Labels "Assists" → "Assist." · **APENAS AO TOCAR OS ARQUIVOS**

- **Gatilho**: editar `Estatisticas.tsx`, `Perfil.tsx` ou `CartaoJogadorEdicao.tsx` por outro motivo.
- **Arquivos**: `src/routes/Estatisticas.tsx:207`, `src/routes/Perfil.tsx:189`, `src/components/CartaoJogadorEdicao.tsx:95`.
- Trocar `label="Assists"` por `label="Assist."` (abreviação pt-BR — rótulos de `StatBox` são curtos e as três telas compartilham o mesmo formato; usar a mesma string nos 3 pontos para não introduzir drift).
- Não tocar nas props de dado (`assistencias`), nem em `🅰️`/`gols_contra` nem em nenhum outro rótulo — escopo é só a tradução desses 3 labels.
- Commit (por arquivo tocado): "traduz label Assists para Assist. em <arquivo> (A10.3)".

### Passo 4 — Comentário de geometria em `Skeletons.tsx` → `CabecalhoSumula` · **EXECUTAR JUNTO DO PLANO 01**

- **Gatilho**: execução do plano `01-cabecalho-sumula.md` (o componente precisa existir). Pode ser um commit próprio ou o último passo do 01.
- **Arquivo**: apenas `src/components/Skeletons.tsx` (bloco de comentário do topo, linhas 1-4).
- Estender o comentário existente (sem reescrevê-lo) com uma linha do tipo: `A geometria dos skeletons de cabeçalho espelha src/components/ui/CabecalhoSumula.tsx — se o cabeçalho mudar de geometria, atualizar os pontos 17, 60, 100, 145, 189, 362 e 413.` (ajustar o caminho ao local final do componente — plano 17 prevê `src/components/ui/`).
- Os 7 pontos de espelhamento **não migram e não mudam** — o plano 01 já decidiu que Skeletons permanecem formas neutras para CLS=0; o comentário é só a mitigação barata de drift (o skeleton funciona como detector de geometria do 01, e o comentário diz onde comparar).
- Commit: "aponta CabecalhoSumula como referência de geometria no topo de Skeletons (A10.4)".

Total hoje: **1 commit aplicável** (Passo 4, junto do plano 01). Passos 1 e 3 ficam armados nos gatilhos "ao tocar o arquivo"; Passo 2 é convenção sem commit.

### Passo 5 — Invalidação de `stats-jogador:*` após publicação de partida · **AGUARDA MECANISMO POR PREFIXO** (registrado pelo plano 05)

- **Origem**: seção 7 do plano `05-elenco-usecache.md` — decisão do dono (seção 3 do 05) aceitou que stats por jogador (`chaveStatsJogador(jogadorId)`, introduzida pelo Passo 4 do 05) ficam obsoletos dentro da sessão que atravessa uma publicação de partida: o helper `invalidarCachesDependentesDePartida()` não tem como enumerar os ids para invalidar por chave. O grau de obsolescência é o mesmo já aceito no `Comparador` (`chaveComparador` nunca é invalidada na publicação).
- **Gatilho**: criação de um mecanismo de invalidação por prefixo/padrão em `hooks/useCache.ts`/`lib/chavesCache.ts` (YAGNI enquanto não houver segunda demanda por ele — Fora de escopo do 05, seção 6).
- **Correção**: com o mecanismo existindo, `invalidarCachesDependentesDePartida()` passa a invalidar `stats-jogador:*` junto de `CHAVE_MEDIAS_NOTAS` e `chavePartidasRecentesJogadores(2)`.
- Não criar testes, libs ou abstrações auxiliares para isso.

### Passo 6 — Extrair componente de abas genérico `<Abas>` · **APENAS AO TOCAR OS ARQUIVOS** (registrado pelo plano 36)

- **Origem**: passo 3 do plano 36 — `AbasClipesAdmin.tsx` foi criado replicando o padrão de barra de abas `NavLink` de `AbasNotificacoes.tsx` (nav + map sobre const `ABAS`, mesmas classes, `aria-label`, prop `className`), divergindo só no `end` por aba (necessário porque `/clipes/admin` é prefixo de `/clipes/admin/repositorio`).
- **Gatilho**: a 3ª ocorrência do padrão — **já alcançada**: `AbasNotificacoes.tsx`, `AbasEstatisticas.tsx` e `AbasClipesAdmin.tsx` em `src/components/` (as três são barras `NavLink` praticamente idênticas; `AbasEstatisticas` diverge em detalhes de classe e não usa `end`). Executar **ao tocar qualquer um dos três arquivos por outro motivo**, ou na criação da 4ª barra de abas. Não abrir trabalho dedicado — DRY com critério (AGENTS.md: remover duplicação real, sem abstração prematura).
- **Correção**: extrair `<Abas abas={...} ariaLabel ...>` genérico — lista de `{ to, label, end? }`, os estilos atuais como padrão único (com `no-scrollbar`), e migrar as 3 barras existentes; decidir no toque se `AbasNotificacoes`/`AbasEstatisticas`/`AbasClipesAdmin` viram wrappers de 1 linha ou são substituídas nos call sites (preferir a substituição direta — menos camadas).
- Não criar testes, libs ou abstrações auxiliares para isso.

### Passo 7 — Nomenclatura de edge functions: verbo-primeiro vs `admin-` · **CONVENÇÃO / EXCEÇÃO CONSCIENTE** (registrado pelo plano 36)

- **Origem**: passo 1 do plano 36 — as edge functions existentes seguem verbo-primeiro (`notificar-clipes`, `send-confirmation-requests`, `send-test-push`, `send-voting-reminders`); a função nova `admin-excluir-clipes` é sujeito-primeiro, quebrando o padrão.
- **Exceção consciente, mantida**: o prefixo `admin-` agrupa visualmente as funções que recebem a credencial de admin no corpo (modelo da migration 066) e são chamadas do browser — diferentemente das irmãs, todas server→server de automação/notificação. Renomear para `excluir-clipes-admin` perderia esse agrupamento.
- **Gatilho para revisar**: criação da 2ª edge function do grupo admin — decidir então se `admin-` vira o padrão das funções de painel; enquanto isso, funções de automação/notificação continuam verbo-primeiro.
- **NÃO renomear** as funções existentes retroativamente — o nome é identidade pública no Supabase (deploy, invoke, painel); renomeação cosmética ampla (AGENTS.md proíbe).

### Passo 8 — Componentes de `ui/` acoplados a domínio financeiro · **APENAS AO TOCAR OS ARQUIVOS** (registrado pelo plano 17)

- **Origem**: Passo 2 (validação de conformidade) do plano `17-pasta-ui.md`, em 04/10/2026 — `src/components/ui/ChipTipoLancamento.tsx` e `src/components/ui/LinhaMetaLancamento.tsx` (criados pelo plano 09) importam tipos/labels de `lib/dividas` (`TipoDivida`, `NaturezaLancamento`, `labelTipoDivida`), violando a regra de bolso da convenção `ui/` (primitiva sem domínio → `ui/`). A colocação deles em `ui/` foi decisão deliberada do plano 09; o desvio é de acoplamento, não de local.
- **Gatilho**: editar qualquer um dos dois arquivos por outro motivo. Avaliar então desacoplar (labels/tipos passados via props pelo call site, sem import de `lib/dividas` no componente) e/ou movê-los para fora de `ui/` se o acoplamento for intrínseco ao papel deles. Um arquivo por commit, junto da mudança funcional que os tocou.
- Não mover nem desacoplar fora do gatilho (sem refactor cosmético — AGENTS.md).

### Passo 9 — Tailwind gera utilities mortas a partir de classes citadas em `docs/` · **AO MEXER NA CONFIGURAÇÃO DE BUILD** (registrado pelo plano 23)

- **Origem**: auditoria do plano 23 (04/10/2026) — o Tailwind v4 escaneia todo o projeto fora do `.gitignore`, incluindo `docs/`; a menção literal de `bg-ok-texto` em `23-tokens-contraste.md:78` fez o Tailwind gerar a utility sem nenhum consumidor (~60 bytes de regra morta no bundle). Mesmo mecanismo vale para qualquer classe citada em planos/docs.
- **Gatilho**: mexer em `src/index.css` (bloco de build do Tailwind) ou na configuração de varredura por outro motivo.
- **Correção**: restringir a varredura do Tailwind a `src/` (ex.: `@source not docs` em `src/index.css`, ou equivalente da versão em uso), conferindo que nenhuma utility usada só via strings dinâmicas construídas em runtime deixe de ser gerada (revisar os casos antes).
- Não abrir trabalho dedicado fora do gatilho.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist por passo executado:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Passo 1 (quando executado)**: em cada tela migrada, abrir o dropdown — abre com os tokens do tema (sem azul de sistema), seleciona a opção correta, placeholder aparece esmaecido quando vazio; no comparador, o atleta já escolhido no outro lado aparece desabilitado; em `DialogoEvento` (se migrado), os grupos "Time Preto"/"Time Branco" aparecem separados e a seleção troca o jogador do evento corretamente; teclado (setas/Enter/Esc) navega só pelas opções, não pelos separadores; gatilho com 44px e foco âmbar.
- [ ] **Passo 3 (quando executado)**: nas telas de Estatísticas, Perfil e edição de cartão, o rótulo aparece como "Assist." na largura da `StatBox`/campo, sem quebra de linha ou truncamento novo.
- [ ] **Passo 4**: nenhum efeito visual — conferir que nenhum className foi alterado em `Skeletons.tsx` e que skeletons renderizam idênticos (só comentário mudou).
- [ ] **Passo 2**: não se aplica validação em runtime (convenção documental).

## 6. Fora de escopo

- **Não** evoluir o `SelectSumula` com `optgroup` sem decisão explícita do dono — nem migrar os selects em lotação "de uma vez" fora do gatilho de toque.
- **Não** renomear retroativamente nenhum componente de card existente (`DueloCard`, `DuplaCard`, `CardNotificacoes`, `CardCraquePartida`, `CartaoJogadorEdicao`) nem unificar as três convenções atuais — a convenção vale só para código novo.
- **Não** traduzir outros rótulos em inglês além dos 3 "Assists" citados, nem renomear props/campos de dado (`assistencias` já é pt-BR).
- **Não** migrar os 7 skeletons para `CabecalhoSumula` nem alterar sua geometria (decisão do plano 01: formas neutras para CLS=0) — o Passo 4 adiciona apenas comentário.
- **Não** abrir trabalho dedicado para executar este plano de ponta a ponta: é um registro de débitos; cada passo só existe quando o gatilho dispara.
- **Não** criar testes automáticos, dependências novas ou abstrações auxiliares.

## 7. Riscos e rollback

- **Risco geral: baixo** — nenhum passo altera fluxo de dados ou regra de negócio; são apresentação, nomenclatura e comentário.
- **Passo 1 (médio quando executado)**: o `SelectSumula` é listbox customizado — migrar um `<select>` nativo troca o comportamento de teclado/scroll e, malfeito, pode perder o anti-zoom ou o alvo de 44px. Mitigação: um select por commit, espelhando os 7 usos já consagrados; no `DialogoEvento`, executar fora de partida ao vivo. Rollback: `git revert` do commit do arquivo restaura o `<select>` nativo (troca isolada, sem dependência entre arquivos).
- **Passo 1 (risco da API de `optgroup`, se aprovada)**: evoluir o `SelectSumula` pode regredir os 7 usos atuais. Mitigação: manter a lista plana funcionando sem alteração (grupos são caso adicional), validar os formulários existentes no build antes de migrar qualquer select novo. Rollback: `git revert` do commit da API devolve o componente ao estado atual.
- **Passo 3 (mínimo)**: rótulo diferente pode quebrar layout se for mais largo — "Assist." é mais curto que "Assists"; risco nulo na prática. Rollback: `git revert` do commit.
- **Passo 4 (praticamente nulo)**: só comentário; nenhum runtime afetado. Rollback: `git revert` do commit.
- Todos os passos são revertíveis por `git revert` isolado, sem dependência entre si (exceto o Passo 4, que pressupõe o plano 01 concluído — revertê-lo não afeta o 01).
