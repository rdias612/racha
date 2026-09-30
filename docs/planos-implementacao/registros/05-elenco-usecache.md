# 05 · Servir elenco e derivados pelo cache SWR existente — Registro de Execução e Validação

> Registro da execução do plano [05-elenco-usecache.md](../05-elenco-usecache.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (4 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO COM RESSALVAS** — nada bloqueante; a única correção sugerida (formatação de 1 linha) foi aplicada em commit próprio após a auditoria. Executado após o plano 07 (pré-requisito da cadeia 07 → 05 → 06), executado e registrado na mesma sessão.

## 1. Execução

- **4 commits** (`2ffc484` → `1a2b31f`), 1 passo = 1 commit, build e lint verdes em todos. Diff total: 14 arquivos, +244/−174.
- **Passo 1 (commit inerte)**: 6 chaves + 2 funções de chave em `lib/chavesCache.ts` (`CHAVE_ELENCO_ATIVO`, `CHAVE_ELENCO_TODOS`, `CHAVE_ELENCO_SEM_RANDOM`, `CHAVE_GOLEIROS`, `CHAVE_USERNAMES`, `CHAVE_MEDIAS_NOTAS`, `chavePartidasRecentesJogadores(meses)`, `chaveStatsJogador(id)`); helper `invalidarCachesDependentesDePartida()` estendido com `CHAVE_MEDIAS_NOTAS` + `chavePartidasRecentesJogadores(2)` (stats por jogador FORA — decisão da seção 3, aceita); invalidações nos pontos de mutação: NovoJogador (5 chaves), GestaoJogadores (3), GestaoGoleiros (3, nos 3 pontos), PartidaTimes (3), PartidaVotar (`CHAVE_MEDIAS_NOTAS` pós-`registrarVotos`).
- **Passo 2** (`0726a03`): PartidaNova, PartidaEditar, PartidaTimes, ConfirmacoesPartida migrados; refetch local de `listarGoleiros` removido em PartidaTimes (revalida via invalidação); localStorage/rascunho/`criarPartida` intactos.
- **Passo 3** (`c2741e0`): Administrador (filtro `isRandomUsername` e tolerância a falha preservados) e Login.
- **Passo 4** (`1a2b31f`): Comparador (elenco dos seletores + médias fora do fetcher do par) e Perfil (4b).
- **Inventário final: 13 call sites migrados.** Exceções (são 6 pontos, não 2 — aritmética do plano corrigida no doc): GestaoJogadores:60, GestaoGoleiros:63+3 refetches (exceção PIX/telefone), Estatisticas:57+:86 (plano 06), stats lote + `compararJogadores` sob `chaveComparador` (decisão do passo 4).
- Arquivos proibidos intocados (auditado): `lib/jogadores.ts`, `hooks/useCache.ts`, `sw.js`, `Estatisticas.tsx`, `PartidaDetalhe/AoVivo/Votar`.
- **Débito registrado pelo implementador**: obsolescência de `stats-jogador:*` pós-publicação de partida (aguarda mecanismo por prefixo) adicionado como Passo 5 em [34-debitos-registrados.md](../34-debitos-registrados.md), no formato do arquivo, coerente com as seções 3/7 do plano.

## 2. Divergências plano × código real (justificadas e aceitas pela auditoria)

1. **Fetchers estáveis** (contrato `useCache.ts:109-110` — fetcher inline instável revalidaria em loop): `carregarPartidasRecentes()` como função de módulo em PartidaNova/ConfirmacoesPartida; `useCallback([jogadorId])` em Perfil.
2. **Perfil**: `chaveStatsJogador(jogadorId ?? -1)` como chave sentinela para hook incondicional sem sessão (fetcher resolve `null` sem rede; regras do React respeitadas).
3. **Comparador**: default do `idA` para o atleta logado mantido em effect próprio; `ComparativoTela` sem campo `medias`; skeleton aguarda também `carregandoMedias` (equivalente ao comportamento anterior).
4. **Administrador**: `erro` do hook (pré-formatado) entra na `MensagemEstado`; dropdown vazio sem derrubar o financeiro.
5. **Lint**: 6 warnings de `react-hooks/exhaustive-deps` resolvidos com `useMemo` nos fallbacks, incorporados ao commit do Passo 2 (histórico local refeito antes de qualquer push — nada remoto foi reescrito).
6. **`ParticipanteNovo`/doc 34**: o débito entrou no commit do Passo 1 em vez de commit próprio (aceitável — o plano não exige commit próprio).

## 3. Observações da auditoria (registro de comportamento, sem ação obrigatória)

1. **PullToRefresh em Administrador** refresca só o financeiro; o dropdown de elenco não refresca no pull (antes refrescava) — consistente com a semântica SWR + invalidações, mas micro-mudança não listada no plano.
2. **PartidaNova**: mensagem de erro de carregamento mudou do texto custom para o default de `formatarMensagemErro` do hook (mesmo nível de informação).
3. **Falha silenciosa nos hooks novos** de PartidaTimes/Comparador/ConfirmacoesPartida (lista vazia sem banner de erro onde antes o `Promise.all` rejeitado mostrava erro) — padrão já usado no Comparador/Estatisticas; dado revalida ao remontar. Em PartidaNova foi compensado com `erroCarregamento`.
4. **ConfirmacoesPartida**: fetch lazy → no-mount (documentado e aceito no plano; cache hit/dedupe na prática).
5. **Imports duplicados** do mesmo módulo em PartidaTimes (`useCache` e `invalidarCache` em linhas separadas) — cosmético.
6. Linha "Total hoje" do doc 34 ficou levemente defasada após a inserção do Passo 5 — cosmético.

## 4. Correção aplicada pós-auditoria

- `src/routes/Administrador.tsx:107` — duas instruções coladas numa linha no `catch` (introduzidas em `c2741e0`); formatação corrigida em commit próprio (formatação apenas, zero mudança de comportamento).
- Plano 05, seção 4: aritmética de inventário corrigida ("13 dos ~15 / 2 exceções" → "13 migrados / 6 pontos não migrados").

## 5. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] Passo 1: executar cada mutação (criar jogador, salvar lote, criar/editar/ativar goleiro, salvar times, votar) sem erro visível.
- [ ] **Ganho principal**: DevTools/Network — Resumo → Jogos → Nova partida → voltar → Nova partida: 2ª visita sem fetch de `jogadores`/`partidas_recentes`.
- [ ] PartidaNova: rascunho do localStorage e erro de rede como hoje.
- [ ] PartidaTimes: goleiro rápido criado pelo modal aparece na listagem sem recarregar.
- [ ] PartidaEditar: campos e elenco corretos ao abrir edição.
- [ ] ConfirmacoesPartida: painel de avulsos popula; presença/recusa ok.
- [ ] Administrador: dropdown popula; falha offline deixa vazio sem quebrar; Login autocomplete + jogador novo aparece após criar.
- [ ] Comparador: trocar o par não re-busca médias; Perfil: stats corretos ao abrir/trocar jogador.
- [ ] Consistência pós-mutação fim a fim (criar→listar, desativar→sai do elenco, PIX→refetch local, votar→médias após revalidação) e PullToRefresh nas telas que o têm.
