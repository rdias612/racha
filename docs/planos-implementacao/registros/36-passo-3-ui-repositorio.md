# 36 · Passo 3 — UI: abas do painel + aba Repositório — Registro de Execução e Validação

> Registro da execução do passo 3 do plano 36 (repositório + exclusão manual de clipes em `/clipes/admin`) em 02/10/2026, na branch `main`, no fluxo de três agentes: **executor** (commit `7a9247c`), **revisor** (read-only) e **corretor/registrador** (correções de melhoria + este registro). Veredito da validação: **APROVADO COM RESSALVAS** (zero bloqueantes).

## 1. Contexto

Este passo 3 é a **UI** do repositório de clipes: abas Importação/Repositório no painel `/clipes/admin` (padrão `AbasNotificacoes`, com rotas separadas para cada aba) e a aba Repositório em si — seletor de partida, grade de clipes com checkbox de seleção (props opcionais em `GradeClipesPartida`) e exclusão em lote via `ConfirmDialog` com tom de perigo, consumindo a lib do passo 2 e a edge function do passo 1.

## 2. Implementação

- **Commit `7a9247c`** — seis arquivos:
  - **`src/components/AbasClipesAdmin.tsx`** (novo): barra de abas com NavLink; o link Importação usa `end` porque `/clipes/admin` é prefixo da rota do Repositório (sem `end`, ambos ficariam ativos em `/clipes/admin/repositorio`).
  - **`src/routes/ClipesRepositorio.tsx`** (novo): guarda admin com redirecionamento (`Navigate`, padrão de `ClipesAdmin`); carregamento em duas fontes com `isAtivo` (cancelamento) e erro isolado por fonte; `Set` de seleção zerado na troca de partida (os ids marcados pertencem à anterior); `BarraAcaoInferior` + `ConfirmDialog` com `tomConfirmar="perigo"`; snackbar de sucesso com bytes liberados; recarga de partidas + clipes após a exclusão; a partida que ficou sem clipes sai do seletor (a lib só lista partidas com clipes) e, se for a atual, limpa a partida selecionada.
  - **`src/routes/ClipesAdmin.tsx`**: única mudança — a barra de abas.
  - **`src/components/GradeClipesPartida.tsx`**: props opcionais `selecionadoIds`/`onToggleSelecao`/`desabilitarSelecao`; checkbox renderizado só quando `onToggleSelecao` é informado; sem as props o DOM é bit-a-bit igual ao anterior (compatibilidade com os demais usos da grade); contrato do topo atualizado.
  - **`src/lib/rotas.ts`**: rota lazy do Repositório com prefetch específico ANTES da genérica (senão a genérica ganharia o match por prefixo).
  - **`src/App.tsx`**: rota `/clipes/admin/repositorio`.

## 3. Divergências aceitas do plano (do relatório do implementador)

1. **Mapeamento `ClipeComUrl` já feito dentro de `carregarClipesDaPartida`** — a rota só consome a lista pronta, sem remapear.
2. **`Promise.allSettled` apenas na recarga pós-exclusão** — no carregamento inicial as fontes são sequenciais por dependência (a grade depende da partida escolhida no seletor), cada uma com erro isolado.
3. **Seletor via `SelectSumula`** — componente padrão de seletor da súmula já usado nas telas irmãs.
4. **Ícone `Archive` no cabeçalho** — segue o padrão de ícone do `CabecalhoSumula` nas telas admin.

## 4. Validação (aprovado com ressalvas)

- Revisão item a item pelo agente revisor: **zero achados bloqueantes**. Guarda admin, cancelamento (`isAtivo`) e race de troca de partida cobertos.
- **Regressão zero em `GradeClipesPartida`**: DOM legado comparado bit-a-bit contra `7a9247c^` sem as props novas.
- `tsc --noEmit` e lint limpos no commit do executor.

## 5. Correção pós-validação (achados 1, 2 e 4; nits 3 e 5 fora de escopo)

- **Achado 1 (melhoria)**: se a recarga das partidas pós-exclusão tem sucesso mas a dos clipes rejeita, a grade continuaria mostrando clipes já excluídos como disponíveis. Correção: no ramo de erro da fonte de clipes, refetch pelo mesmo caminho do carregamento normal (`carregarClipesDaSelecionada(id)`); se o refetch também falhar, mantém-se o snackbar de erro do próprio caminho de carga — sem silenciar.
- **Achado 2 (melhoria)**: mensagem do vazio diferenciada — sem partida selecionada (`partidaId == null`, caso da partida esvaziada pós-exclusão) mostra "Selecione uma partida no seletor acima."; com partida selecionada e grade vazia, mantém "Esta partida não tem mais clipes." (exclusão concorrente de outro admin).
- **Achado 4 (nit)**: guarda `excluindo` no topo de `confirmarExclusao`, eliminando o resíduo teórico de duplo-clique no diálogo de confirmação.
- Commit desta tarefa (o mesmo que grava este registro).

## 6. Pendente de validação humana (dono)

- [ ] Deploy da edge function do passo 1: `npx supabase functions deploy admin-excluir-clipes --no-verify-jwt`.
- [ ] Validação E2E no dispositivo: selecionar partida; marcar 1 clipe e depois vários; excluir; conferir no painel do Supabase que os objetos saíram do bucket `clipes`; conferir ledger (`limpeza`/`manual`); partida esvaziada sai do seletor; não-admin é redirecionado; payload inválido → 400.
- [ ] Push do commit da implementação (`7a9247c`) + deste commit de correção/registro.
