# 26 · Perfil reordenado + "Minhas Dívidas" — Plano de Implementação

> Ref.: item **E5** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#26 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P2

## 1. Objetivo

Apoiar a **ideia #1 do roadmap do dono** (`docs/ideias-novas-funcionalidades.md` — extrato "Minhas Dívidas" para o jogador) **sem duplicá-la**: hoje o financeiro é 100% admin e o formulário de username/senha domina o meio do `Perfil.tsx`, de modo que o jogador não vê nada das suas pendências. Este plano (a) adiciona uma seção **"Minhas Dívidas"** ao Perfil — lançamentos em aberto do próprio jogador, com o total devido em `font-mono` visível sem tocar — e (b) move username/senha para um bloco único **"Acesso"** abaixo das estatísticas, devolvendo a hierarquia da tela. Nesta fase **não** se cria a tela `/financas` nem CTA de pagamento — quando o dono priorizar a ideia #1 completa, ela parte daqui.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; divergências de linha do doc de origem corrigidas abaixo:

- **`src/routes/Perfil.tsx:154-292`** — ordem atual da tela: cartão de identidade (`:157-175`) → Estatísticas "Números na Temporada" (`:177-193`, grid de 5 `StatBox`) → **formulário "Nome de Usuário"** (`:195-226`, seção inteira com input + submit) → `CardNotificacoes` (`:229`) → **formulário "Alterar Senha de Acesso"** (`:231-274`, 3 inputs + submit) → Logout (`:276-284`) → footer (`:286-291`). Os dois formulários de acesso ocupam o centro da tela (doc de origem citava os blocos sem linha exata — conferidos).
- **`src/routes/Perfil.tsx:21,41`** — o jogador logado já está em escopo via `useSessao()` (`src/context/SessaoContext.tsx:17`, `jogador: JogadorLogado | null`) e `jogadorId = jogador?.id` (`:41`); o guard `if (!jogador) return null` está em `:68`. Nenhum hook novo é necessário para identificar o jogador.
- **`src/routes/Perfil.tsx:43-66`** — padrão de fetch da tela: effect `carregandoStats` + `carregarStatsJogador(jogadorId)` com flag `ativo` de desmonte. **O Perfil não usa `useCache` hoje** e não está entre as 7 rotas com `PullToRefresh` (grep confirmado; ver plano 24).
- **`src/lib/dividas.ts:71-79`** — `listarDividasEmAberto(): Promise<Divida[]>` lista **todos** os lançamentos `paga = false` do app (usado pelo admin), ordenados por `data_divida` desc. **Hoje não há filtro por `jogador_id`** — o doc de origem diz "o filtro por jogador_id disponível", mas o parâmetro ainda não existe na assinatura; adicioná-lo é o Passo 1. Único call site: `src/routes/Administrador.tsx:54` (sem argumento — compatível com parâmetro opcional).
- **`src/lib/dividas.ts:25-44`** — tipo `Divida`: campos úteis para o extrato são `tipo` (via `labelTipoDivida`, `:140-142`), `valor`, `descricao`, `referencia`, `data_divida`. **`jogador_id` é `number | null`** (`:27`) — lançamentos sem jogador (ex.: despesas de campo) existem; com filtro `.eq('jogador_id', id)` eles simplesmente não aparecem para o jogador, comportamento correto. **`natureza`**: `receita` = dívida do jogador, `despesa` = racha a pagar (`:3-4`); a view `dividas_resumo` usada pelo admin conta **só receitas** (`:81`), então "Minhas Dívidas" deve filtrar `natureza === 'receita'` para o total bater com o que o admin cobra.
- **`src/lib/formatacao.ts:51`** — `formatarReais(valor: number)`; **`:34`** — `formatarDataLista(data: string)`. Ambos já usados no módulo financeiro (via `montarLembreteWhatsApp`, `dividas.ts:158-159`).
- **`src/hooks/useCache.ts:112`** — `useCache<T>(chave, buscar)` existe; **não será usado nesta fase** (justificativa na seção 3).
- **Segurança/RLS**: a tabela `dividas` já é legível pelo client (o admin consulta direto do app e o doc `ideias-novas-funcionalidades.md` §1 confirma "legível pelo client"). O filtro por `jogador_id` é de UX (não trazer dado alheio), não de segurança — nada de migration neste plano.

## 3. Pré-condições e dependências

- **DEPENDÊNCIA — sincronizar com o dono antes de executar.** A ideia "Minhas Dívidas" é do **roadmap do dono** (ideia #1 de `docs/ideias-novas-funcionalidades.md`, impact "Alto"). O `plano-melhorias-frontend-pwa.md` (seção 4, Fase 4; e seção "Decisões do dono antes de executar") manda **E5 apoiar a ideia #1 sem duplicá-la**. Confirmar com o dono que esta versão reduzida (seção do Perfil, sem `/financas`, sem CTA de pagamento) está OK e não colide com plano próprio dele.
- **Coordenação com o plano 05 (`05-elenco-usecache.md`) — se aplicar.** O Passo 4 daquele plano migra o fetch de stats do Perfil para `useCache(chaveStatsJogador(jogadorId))`. Se o 05 já tiver sido executado, esta seção nova pode seguir o mesmo padrão (`useCache(chaveMinhasDividas(jogadorId), ...)`). **Recomendação deliberada (KISS): enquanto o 05 não passar por aqui, manter o fetch com o effect simples do padrão local** (`Perfil.tsx:43-66`) — a quitação de dívida é feita só pelo admin (`quitarDivida`/`quitarDividasJogador`, `dividas.ts:127-138`), não há caminho de invalidação na sessão do jogador e um cache de sessão poderia exibir total vencido errado; o effect re-busca a cada visita. Se optar por `useCache` na esteira do 05, registrar a chave e o risco de staleness pós-quitação no commit.
- **Sem dependência dos planos 01–04**: a seção nova usa markup direto como o resto do Perfil; a migração dos formulários para `CampoTexto` (A3/plano 04) ou `Botao` (A2/plano 02) é débito separado — não antecipar.
- **Restrição de janela**: nenhuma (não toca partida ao vivo). Executar fora de horário de cobrança intensa é cortesia, não regra.

## 4. Plano de execução (1 passo = 1 commit)

Três passos pequenos e independentes; os Passos 2 e 3 tocam apenas `src/routes/Perfil.tsx` e nenhum cria componente em `src/components/` nem biblioteca nova.

### Passo 1 — Filtro opcional por jogador em `listarDividasEmAberto` · 1 commit

- **`src/lib/dividas.ts`** — mudar a assinatura para `listarDividasEmAberto(opcoes?: { jogadorId?: number }): Promise<Divida[]>`; quando `opcoes?.jogadorId` estiver presente, acrescentar `.eq('jogador_id', opcoes.jogadorId)` à query existente (`:72-76`), preservando `paga = false` e a ordenação. Sem mudança de retorno nem de `SELECT_DIVIDA`.
- **Call site `src/routes/Administrador.tsx:54`** — não muda (chamada sem argumento continua listando tudo). Nenhuma outra migração.
- Commit: "dividas: filtro opcional por jogador em listarDividasEmAberto (E5)".

### Passo 2 — Seção "Minhas Dívidas" no Perfil · 1 commit

- **`src/routes/Perfil.tsx`** — nova `<section>` entre "Números na Temporada" (`:193`) e o bloco de username (`:195`):
  1. **Estado/fetch**: `dividas`, `carregandoDividas`, `erroDividas` + effect no padrão de `:43-66` (flag `ativo`, guarda `if (!jogadorId) return`), chamando `listarDividasEmAberto({ jogadorId })` e filtrando client-side `natureza === 'receita'` (mesma semântica da view `dividas_resumo`, `dividas.ts:81`).
  2. **Cabeçalho da seção**: título "Minhas Dívidas" no estilo dos demais `h3` da tela (`:179-181`) e, ao lado, **total devido** = `dividasFiltradas.reduce(...)` renderizado com `formatarReais` em `font-mono`, direto no cabeçalho — **sem accordion/expansão** (o requisito "visível sem tocar"). A posição logo abaixo da grade de stats mantém o total dentro da primeira dobra.
  3. **Lista**: linhas contínuas com `divide-y` (padrão recomendado pelo doc de ideias §1 — **não empilhar cards**), cada linha com `labelTipoDivida(tipo)` + `descricao` (quando houver) + `formatarDataLista(data_divida)` e o `valor` em `font-mono`/`formatarReais`. Sem ações por linha (quitação continua exclusiva do admin).
  4. **Estados**: carregando → `Carregando compacto` (como `:183`); erro → `MensagemEstado tipo="erro"` com `formatarMensagemErro`; lista vazia → linha única positiva (ex.: "Nenhuma pendência em aberto") em `text-giz-fraco` — dívida zero merece feedback, não silêncio.
  5. **Sem CTA de pagamento/aviso** ("Já paguei, avisar admin" fica para a ideia #1 completa do dono).
- Commit: "perfil: seção Minhas Dívidas com total em aberto (E5)".

### Passo 3 — Bloco "Acesso" abaixo das estatísticas · 1 commit

- **`src/routes/Perfil.tsx`** — **apenas reordenação e um título, sem mudança de comportamento**:
  1. Agrupar as seções "Nome de Usuário" (`:195-226`) e "Alterar Senha de Acesso" (`:231-274`) num único bloco com título de grupo **"Acesso"** (mesmo estilo de `h3` dos demais), posicionado **abaixo das estatísticas e de Minhas Dívidas**, antes do `CardNotificacoes`/Logout. Ordem final: identidade → estatísticas → Minhas Dívidas → Acesso (usuário/senha) → notificações → logout → footer.
  2. Forms, estados, mensagens e botões são **movidos intactos** ( nenhum handler, validação ou classe alterada — a reorganização de layout não deve se misturar com regra de negócio no review).
- Conferir que o `SkeletonPerfil` (`:150-152`) continua coerente com a nova ordem (se o skeleton renderizar os blocos em ordem, atualizar a ordem dele no mesmo commit — `src/components/Skeletons.tsx`).
- Commit: "perfil: agrupa username e senha em bloco Acesso abaixo das estatísticas (E5)".

## 5. Validação manual

Checklist no aparelho/build (sem testes automáticos, conforme AGENTS.md):

- [ ] **Passo 1**: `Administrador` continua listando **todas** as dívidas em aberto como antes (regressão do único call site); build/tsc sem erro.
- [ ] **Passo 2**: com jogador **com pendências** — seção mostra só os lançamentos `receita` em aberto dele (conferir contra o painel admin: mesmos itens, mesmo total); total em `font-mono` visível ao abrir a tela, sem expandir nada.
- [ ] **Passo 2**: com jogador **sem pendências** — mensagem de vazio; com lançamento `despesa` em aberto do sistema — ele **não** aparece para o jogador.
- [ ] **Passo 2**: lançamento quitado pelo admin (via painel) **desaparece** do Perfil ao reabrir a tela (confirma o re-fetch por visita, sem cache velho).
- [ ] **Passo 2**: erro de rede (offline) mostra `MensagemEstado` de erro, sem crash e sem tela branca.
- [ ] **Passo 3**: formulários de username e senha continuam funcionando idênticos após a movimentação (alterar username com sucesso; erro de senha atual incorreta; validação de confirmação).
- [ ] **Geral**: ordem final da tela confere (identidade → stats → dívidas → Acesso → notificações → logout); alvos de toque ≥ 44px preservados; valores alinhados em `font-mono`.

## 6. Fora de escopo

- **Não criar a tela `/financas`** (fora das abas) nem histórico de pagamentos — fica para a ideia #1 completa do dono, que parte do que este plano entrega.
- **Não duplicar CTA de pagamento** ("Já paguei, avisar admin") nem qualquer fluxo de quitação pelo jogador — quitação segue exclusiva do admin.
- **Não migrar formulários/botões do Perfil para `CampoTexto`/`Botao`** (planos 04 e 02) nem refatorar os efeitos da tela além do estrito necessário — débitos separados.
- **Não introduzir `useCache` na seção nova por conta própria** — apenas na coordenação explícita com o plano 05 (seção 3).
- **Nenhuma migration/RLS nova** — `dividas` já é legível pelo client; o filtro é de UX.
- Não alterar `Administrador.tsx` além do que o compilador exigir (espera-se: nada).

## 7. Riscos e rollback

- **Risco: regressão no admin** (Passo 1) — a assinatura com parâmetro opcional mantém a chamada sem argumento intata; mitigação validada no checklist. Rollback: `git revert` do commit do Passo 1 (mudança isolada em 1 arquivo de `lib/`).
- **Risco: dado financeiro errado na tela do jogador** (natureza/tipo filtrado errado, total divergente do admin) — mitigado por filtrar `receita` em aberto, mesma semântica de `dividas_resumo`, e pelo checklist cruzado com o painel admin. Rollback: `git revert` do Passo 2.
- **Risco: staleness de dívidas** — jogador quita por fora e o admin lança a baixa; a tela só reflete na próxima visita (re-fetch por mount, sem TTL). Comportamento aceitável e idêntico ao das stats hoje; se virem reclamação, a ideia #1 completa (com atualização/CTA) trata isso.
- **Risco de layout no Passo 3** — é movimentação pura de JSX; validação visual no aparelho cobre. Rollback: `git revert` do Passo 3 (não depende dos anteriores).
- Todos os passos são commits independentes e revertíveis isoladamente; o Passo 2 depende apenas do Passo 1, os Passos 1 e 3 são independentes entre si.
