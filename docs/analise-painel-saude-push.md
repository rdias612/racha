# Análise — Painel de Saúde das Entregas Push: tela apartada, filtros e push por atleta

> **Base**: `main` @ `fffd2d2` · **Origem**: pedidos do usuário pós-implementação do P6 (commit
> `442b036`). **Escopo fechado**: os 3 pedidos explícitos + no máximo 2 melhorias pontuais já
> identificadas no conjunto (classificadas). Nada além disso — sem bônus, sem refatorações
> adjacentes.

---

## 1. Contexto e objetivo

O painel P6 (**"4. Saúde das Entregas por Atleta"**) foi implementado como uma seção
somente-leitura dentro da tela admin `/notificacoes`:

- RPC `obter_painel_entregas_push(bigint, integer)` — migration
  `supabase/migrations/106_painel_entregas_push.sql:10-123`: uma linha por atleta ativo não-random
  (`106:113-114`), com `qtd_aparelhos`, JSONB `aparelhos` (endpoint truncado a 16 chars, `106:54`),
  entregas/erros do ledger `push_reminder_deliveries`, gate admin (`106:39-43`) e ordenação
  piores-primeiro (`106:115-118`).
- Componente `src/components/SecaoNotificacaoSaude.tsx`: presentacional, badges Em dia / Observar /
  Verificar aparelho / Sem aparelho (limiares 3/14 dias, `SecaoNotificacaoSaude.tsx:20-21,40-52`),
  drill-down accordion itemizado por aparelho (`:144-177`) e botão atualizar (`:81-88`).
- Rota `src/routes/Notificacoes.tsx`: seção renderizada **fora** do `<form>` de configuração
  (`Notificacoes.tsx:259-265`), com estados e efeito próprios isolados do formulário
  (`:50-53,103-131`).
- Camada de dados: `obterPainelEntregasPush` + tipos em `src/lib/notificacoes.ts:116-148`; entrada
  manual da RPC em `src/lib/database.types.ts:1024`.

O uso real mostrou três atritos, que são os pedidos deste documento:

1. O painel é **conteúdo de leitura/monitoramento**, mas vive acoplado a uma tela de
   **configuração com formulário** — alonga a página, mistura propósitos e herda o skeleton
   `SkeletonNotificacoes` (que espelha o formulário, não o quadro).
2. O quadro lista ~30-50 atletas sem filtro — encontrar um atleta específico exige scroll + olho.
3. Não há como **testar o push de UM atleta específico** a partir do drill-down (hoje o teste da
   `SecaoNotificacaoTestes` vai sempre para o próprio admin — `104_fix_push_cron_fire_and_forget.sql:165`).

---

## 2. Estado atual medido (verificado no código @ `fffd2d2`)

### 2.1 Roteamento e Layout

- **Rotas**: `src/App.tsx:62` declara `/notificacoes`; a fonte única dos lazy imports é
  `src/lib/rotas.ts:32,77-79` (carregador + `lazy`) e `:106` (entrada de prefetch
  `/^\/notificacoes/` na `TABELA_PRE_CARREGAMENTO`). AGENTS §6.7 manda registrar rotas novas
  exclusivamente aqui.
- **Skeleton por pathname**: `SKELETONS_POR_ROTA` em `src/routes/Layout.tsx:43-54`; entrada atual
  `/^\/notificacoes/` → `SkeletonNotificacoes` (`Skeletons.tsx:353-414`). **Atenção**: a regex
  atual casa com prefixo, então `/notificacoes/saude` cairia no skeleton do _formulário_ — uma
  entrada mais específica precisa vir **antes** (o mapa usa `find` na ordem, `Layout.tsx:57`).
- **TabBar**: oculta apenas em fluxo focado via
  `const isFluxoFocado = /^\/partida\/(nova|\d+\/(votar|editar|ao-vivo|times))/.test(pathname)`
  (`Layout.tsx:103,248`). Telas admin de leitura/formulário (`/notificacoes`, `/administrador`,
  `/gestao-jogadores`) **mantêm a TabBar** — e o comentário de `Layout.tsx:39-41` documenta que
  formulários/painéis admin caem no `CarregandoGeral` quando não há skeleton específico.
- **Menu admin**: link "Notificações Push" no dropdown ADMIN (`Layout.tsx:216-225`).

### 2.2 Caminho real do push de teste (mapeado)

- RPC `disparar_push_teste(p_admin_id)` (`104_fix_push_cron_fire_and_forget.sql:127-171`): gate
  admin (`:140-143`), lê `push_cron_secret` do vault (`:145-148`), chama
  `disparar_e_registrar_cron_http` contra `…/functions/v1/send-test-push` com corpo
  `jsonb_build_object('jogador_id', p_admin_id)` (`:161-167`) e **coleta com timeout de 2s**
  (`:166`) — o comentário do cabeçalho (`:18-20`) documenta o limite conhecido: _cold start da
  Edge Function pode registrar falso "Timeout" com o push entregue mesmo assim_.
- Edge Function `supabase/functions/send-test-push/index.ts`: autentica por
  `x-push-cron-secret` (`:41-43`), aceita `jogador_id` opcional no body (`:45-51`, default 1),
  retorna **404 JSON** quando o alvo não tem inscrições (`:60-62`), envia com TTL 5min/high
  (`:81-84`), limpa endpoints 404/410 (`:90-92`) e devolve resultados itemizados por endpoint
  (`:102-108`).
- **Implicação importante**: como a coleta é de 2s, o corpo com `resultados`/404 da function
  **não chega confiavelmente ao client** — qualquer feedback preciso de "não tem aparelho" tem de
  ser verificado **no banco, dentro da RPC**, antes do disparo.

### 2.3 Cache e carga

- A tela `/notificacoes` **não usa `useCache`** (padrão de tela admin com formulário; AGENTS §5.5
  restringe `useCache` às telas de aba). O painel hoje carrega com efeito próprio + flag `ativo`
  (`Notificacoes.tsx:103-131`), respeitando AGENTS §5.2.
- Volume: ~30-50 atletas ativos não-random, `p_limite` clamp 1..500 (`106:119`) — client-side
  filtra/ordena sem qualquer risco de performance.

---

## 3. Design das melhorias (alternativas e recomendação)

### 3.1 Pedido 1 — Tela apartada para o painel

**Alternativas consideradas**

| #   | Alternativa                                                                                       | Trade-offs                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | **Nova rota `/notificacoes/saude`**, seção "4." sai da `/notificacoes` e vira card/link de atalho | Separa leitura de configuração; aproveita o chunk/prefetch já existente do prefixo; URL fica agrupada sob o domínio de notificações. Custo: tocar 5 arquivos conhecidos. |
| B   | Rota top-level `/saude-push`                                                                      | Nenhuma vantagem funcional; fragmenta o agrupamento admin e exige nova entrada de prefetch/skeleton de qualquer forma.                                                   |
| C   | Manter na `/notificacoes` apenas com âncora/colapso                                               | Não resolve o atrito (página longa, skeleton errado, propósito misturado).                                                                                               |

**Recomendação: Alternativa A.** É coerente com o padrão existente de sub-rotas por domínio
(`/estatisticas/racha`, `/estatisticas/comparar`, `App.tsx:50-51`) e com o princípio de tela com
propósito único. Detalhes de desenho:

- **Rota**: `/notificacoes/saude`, declarada em `App.tsx` dentro do `<Route element={<Layout />}>`,
  lazy em `src/lib/rotas.ts` (novo carregador `carregarNotificacoesSaude` + `lazy` + entrada de
  prefetch — a regex `/^\/notificacoes/` já cobre o prefetch, bastando conferir a ordem).
- **Skeleton (CLS = 0, AGENTS §5.4)**: adicionar em `SKELETONS_POR_ROTA`
  (`Layout.tsx:43-54`) uma entrada **mais específica antes da existente**:
  `{ padrao: /^\/notificacoes\/saude/, Skeleton: … }`. Como a tela é uma lista contínua de linhas
  de 44px com cabeçalho, um `SkeletonNotificacoesSaude` espelhando "cabeçalho + 8 linhas de
  `h-11`" é barato e correto; alternativa aceitável (menos fiel): cair no `CarregandoGeral`, como
  faz `/administrador` (`Layout.tsx:39-41`). Recomendo o skeleton específico — a tela é
  justamente uma lista.
- **TabBar**: **NÃO aplicar `isFluxoFocado`**. A regex de `Layout.tsx:103` existe para fluxos
  transacionais de partida (criar/editar/votar/jogo), onde barras de ação ficam fixas na base. A
  tela de saúde é leitura admin de navegação livre, na mesma família de `/notificacoes` e
  `/gestao-jogadores`, que mantêm a TabBar. Não tocar na regex.
- **Gate admin**: `useAdmin()` + guard `if (!isAdmin) return <Navigate to="/" replace />` **após
  todos os hooks** (AGENTS §5.1; padrão de `Notificacoes.tsx:37,134`).
- **Volta**: `BotaoVoltar` com `voltar(navigate, '/notificacoes')` (AGENTS §6.3) — o fallback
  natural é a tela-mãe.
- **O que sobra na `/notificacoes`**: remover a seção "4." e os estados do painel
  (`Notificacoes.tsx:50-53,103-131,259-265`) e incluir um **card de atalho** (badge com contagem
  "N de M atletas com inscrição" exigiria manter a RPC na tela — desnecessário; basta card estático
  estilo `SecaoNotificacaoTestes`, `bg-superficie-2`, com seta). Recomendo card estático simples
  para não manter duas fontes dos dados.
- **Reaproveitamento do componente**: `SecaoNotificacaoSaude` passa a ser consumido só pela nova
  rota; o título "4. Saúde das Entregas por Atleta" (`SecaoNotificacaoSaude.tsx:71`) deixa de fazer
  sentido numerado — viraria `Saude das Entregas por Atleta` (props/constante, sem "4."). Os
  limiares `DIAS_OBSERVAR`/`DIAS_VERIFICAR` (`:20-21`) seguem encapsulados no componente.
- **Esboço da rota** (sem código completo):
  `NotificacoesSaude()` → hooks: `useAdmin`, `useJogadorLogado`, estados
  `dados/carregando/erro`, `carregar` com flag `ativo` (padrão AGENTS §5.2, copiando
  `Notificacoes.tsx:105-131`), guard admin, `BotaoVoltar fallback="/notificacoes"`, cabeçalho
  `sumula-header` (ícone de atividade/sinal), `<SecaoNotificacaoSaude … />`, `<Snackbar/>` não é
  necessário (não há mutação nesta tela inicialmente).

**Esforço: M (~3-4h com skeleton e ajustes de copy). Risco: baixo** (tudo é front; a RPC não muda).

### 3.2 Pedido 2 — Filtros no quadro de atletas

**Filtrar no client ou na RPC?** **No client, sem hesitar.** O elenco é ~30-50 linhas e a RPC já
devolve todas as colunas necessárias (`username`, `is_mensalista`, badge derivável de
`ultima_entrega_em`/`ultima_inscricao_em`/`qtd_aparelhos`). Filtrar na RPC (parâmetros
`p_somente_badge`, `p_mensalista`…) multiplicaria variants da query, exigiria nova migration e
nova entrada em `database.types.ts` para um ganho nulo nesse volume — viola o espírito de
proporção do AGENTS (§7.5 exige SQL para agregações pesadas, não para filtrar 50 linhas).

**Recomendação** (mínimo viável, sem inflar):

1. **Busca por nome/username** (input `text-base`, `bg-superficie-2`, foco visível — AGENTS §4.2.5)
   normalizando sem acento (já existe helper de nomes em `src/lib/formatacao.ts`).
2. **Filtro por badge de saúde**: fileira de chips/segmented (Todos · Em dia · Observar · Verificar
   · Sem aparelho), `min-h-[44px]` (AGENTS §6.1), `haptics` light ao trocar.
3. **Mensalista/Avulso**: opcional — só se vier de graça com os chips (todos · mensalistas ·
   avulsos). Classifico como _interessante_, não essencial.

**Cuidados de norma**:

- A função `saude(r)` (`SecaoNotificacaoSaude.tsx:40-52`) é quem deriva o badge — **hoist** para
  export do componente (ou helper do módulo) para o filtro agrupar pela mesma regra. Não duplicar
  a lógica de limiares.
- A tela **não deve usar `useCache`** (não é tela de aba; AGENTS §5.5). Estados locais `useState`
  para os filtros — a chave de cache com filtro (ex.: `saude:${badge}`) seria desnecessária e
  traria as obrigações de invalidação do §5.5.5 sem benefício.
- Lista continua sendo **lista contínua** `divide-y` (design-system §"Listas contínuas"; AGENTS
  §4.2.1) — filtros são controles acima do quadro, não cards.

**Esforço: S (~1-2h). Risco: baixo** (zero mudança de banco/contrato).

### 3.3 Pedido 3 — "Enviar push de teste para UM jogador" no drill-down

**Alternativas consideradas**

| #   | Alternativa                                                                                                                | Trade-offs                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | **Estender `disparar_push_teste` com `p_jogador_id_alvo bigint DEFAULT NULL`** (NULL = próprio admin, comportamento atual) | Uma RPC só, gate admin já existente (`104:140-143`), retrocompatível com `SecaoNotificacaoTestes` e com `database.types.ts:964`. Permite **pré-checar aparelhos no banco** e falhar com mensagem clara antes do disparo. |
| B   | Nova RPC `disparar_push_teste_para(p_admin_id, p_jogador_id)`                                                              | Duplica vault/headers/coleta; duas funções com mesma assinatura de propósito; sobrecarga é o padrão que o projeto já teve de remover (ex. `088_drop_abrir_partida_overload_antigo.sql`).                                 |
| C   | Client chama a Edge Function direto                                                                                        | **Descartado**: exigiria expor `PUSH_CRON_SECRET` no bundle (quebra grave de segurança, AGENTS §9) — a function só autentica por `x-push-cron-secret` (`send-test-push/index.ts:41-43`).                                 |

**Recomendação: Alternativa A**, com estes pontos de desenho:

- **Assinatura** (migration `108`):

  ```sql
  CREATE OR REPLACE FUNCTION disparar_push_teste(
    p_admin_id        bigint,
    p_jogador_id_alvo bigint DEFAULT NULL   -- NULL = o próprio admin (comportamento atual)
  ) RETURNS boolean
  ```

  - Gate admin inalterado; quando `p_jogador_id_alvo` não é nulo: validar que o alvo existe,
    `is_ativo` e **não é random** (`username NOT ILIKE 'random%'` — AGENTS §8.6) com
    `RAISE EXCEPTION` de mensagem amigável.
  - **Pré-checagem de aparelhos (essencial)**: `SELECT count(*) FROM push_subscriptions WHERE
jogador_id = alvo`; se 0, `RAISE EXCEPTION 'Atleta sem aparelho inscrito…'` **antes** do
    `net.http_post`. Justificativa: a Edge Function devolve 404 nesse caso
    (`send-test-push/index.ts:60-62`), mas a coleta de 2s (`104:166`) torna essa resposta
    não-confiável para o client (falso "Timeout" — `104:18-20`). A verificação no banco dá
    feedback determinístico.
  - Mantém `GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint, bigint) TO anon, authenticated;`
    (AGENTS §7.3) e a entrada correspondente em `database.types.ts`.

- **Front**: no drill-down do `SecaoNotificacaoSaude`, botão "Enviar push de teste" (`min-h-[44px]`),
  com `ConfirmDialog` (AGENTS §5.3.3 / matriz §10 — proibido `window.confirm`) quando `qtd_aparelhos
  > 0`, ou estado desabilitado com explicação quando `qtd_aparelhos = 0`(o dado já está na linha).
Após disparo: **Snackbar honesto** — "Push de teste enfileirado; confirme a entrega no quadro em
alguns instantes" — e sugerir (ou disparar)`carregar()`do painel após ~10s, porque a entrega
real aparece no ledger, não na resposta do disparo (P5: "disparo enfileirado ≠ entrega",`104:10-13`). `vibrateLight`no toque /`vibrateSuccess`-`vibrateError` no resultado (AGENTS §6.4).
  > A própria linha do quadro passa a refletir a entrega do teste na próxima atualização — o loop de
  > diagnóstico fecha no painel, que é o modelo rastreável que o usuário prefere.
- **Limite conhecido (documentar na UI ou no doc)**: com cold start, o `cron_execucoes` pode
  registrar "Timeout" mesmo com push entregue (`104:18-20`); o feedback de verdade é a linha do
  atleta no quadro, não o status do disparo.

**Esforço: M (~2-3h: migration + lib + drill-down). Risco: médio-baixo** — tocar em RPC existente
usada pela `SecaoNotificacaoTestes`; mitigado pelo `DEFAULT NULL` retrocompatível (chamada atual de
`notificacoes.ts:90-96` nem precisa mudar, embora seja desejável passar o alvo explicitamente).

### 3.4 Outras melhorias identificadas (classificadas — não inflar)

| Melhoria                                                                                                                                             | Classificação                       | Decisão                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exibir `cron_execucoes` na tela** (saúde do disparo via `obter_execucoes_cron`, migration `104:29-68` — RPC pronta e hoje sem consumidor no front) | **Deixar para depois**              | Pertence à saúde do _pipeline_ (disparo), não do _aparelho por atleta_; a análise de push já a lista como item separado (`analise-notificacoes-push.md:270`). Se um dia entrar, cabe como segunda seção da tela `/notificacoes/saude`. Fora do escopo deste trabalho. |
| **Ordenação alternável** (piores-primeiro ↔ alfabética)                                                                                              | **Deixar para depois**              | A ordenação padrão da RPC (`106:115-118`) já responde à pergunta operacional ("quem verific?"). Com os filtros do §3.2, achar atleta fica trivial.                                                                                                                    |
| **Paginação / virtualização**                                                                                                                        | **Não fazer**                       | ~50 linhas; qualquer paginação é complexidade sem retorno (AGENTS filosofia "Zero Code Slop"). O `p_limite` 1..500 da RPC (`106:119`) já protege.                                                                                                                     |
| Extrair limiares/badge para módulo compartilhado ao mover de tela                                                                                    | **Essencial (faz parte do item 1)** | Não duplicar `DIAS_OBSERVAR`/`DIAS_VERIFICAR`/`saude()` — hoist dentro de `SecaoNotificacaoSaude.tsx`.                                                                                                                                                                |

---

## 4. Riscos e esforço

| Item                                   | Esforço   | Risco       | Mitigação                                                                                                                                                                                            |
| -------------------------------------- | --------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Tela apartada `/notificacoes/saude` | M (~3-4h) | Baixo       | Ordem das entradas de regex em `rotas.ts`/`Layout.tsx` (sub-rota antes do prefixo); não tocar em `isFluxoFocado`; gate admin pós-hooks.                                                              |
| 2. Filtros client-side                 | S (~1-2h) | Baixo       | Reusar `saude()` exportada; sem `useCache`; alvos de 44px.                                                                                                                                           |
| 3. Push por atleta (migration `108`)   | M (~2-3h) | Médio-baixo | `DEFAULT NULL` mantém compatibilidade com `SecaoNotificacaoTestes`; pré-checagem de aparelhos na RPC (resposta 2s não-confiável); `ConfirmDialog` + Snackbar honesto; atualizar `database.types.ts`. |
| **Total**                              | **~6-9h** |             | Executável em 1 PR único ou 3 commits sequenciais (recomendo: migration primeiro, depois tela, depois filtros).                                                                                      |

Riscos transversais: (a) deploy do front pode preceder o `db push` da 108 — manter a tolerância de
erro isolado já usada na seção 4 (`Notificacoes.tsx:103-104`); (b) a pré-checagem de aparelhos na
RPC tem TOCTOU minúsculo (inscrição apagada entre check e POST) — aceitável: o pior caso é o 404 da
function com cleanup automático (`send-test-push/index.ts:90-92`).

---

## 5. Escopo fechado — o que explicitamente NÃO fazer

- Não exibir `cron_execucoes` / `obter_execucoes_cron` nesta entrega (item §3.4, deixar para depois).
- Não filtrar/agregar na RPC (parâmetros novos em `obter_painel_entregas_push`).
- Não introduzir `useCache` na tela de saúde; não criar paginação ou virtualização.
- Não alterar `isFluxoFocado` nem a TabBar.
- Não chamar Edge Function do client; não expor nenhum secret; não tocar nas demais Edge Functions.
- Não criar segunda RPC de teste (alternativa B do §3.3).
- Não expor endpoint FCM completo, `p256dh` ou `auth` (a RPC já trunca; manter assim).

---

## 6. Nota de execução

- **Próxima migration livre: `108`** — confirmado por `ls supabase/migrations`: a última é
  `107_push_votacao_aberta.sql` (o briefing mencionava 106 como última, mas a 107 já existe no HEAD;
  reauditar antes de numerar).
- Padrão obrigatório da 108 (AGENTS §7.3): `CREATE OR REPLACE FUNCTION disparar_push_teste(bigint,
bigint)`, `SECURITY DEFINER SET search_path = public`, `GRANT EXECUTE … TO anon, authenticated`,
  parâmetros `p_`, nomes em português. Zero UUID (AGENTS §7.1) — não se aplica aqui, apenas bigint.
- **Reauditar premissas contra HEAD antes de executar**: este documento foi escrito @ `fffd2d2`;
  conferir que `SecaoNotificacaoSaude.tsx`, `Notificacoes.tsx`, `rotas.ts`, `Layout.tsx` e a
  `disparar_push_teste` da 104 seguem como descritos antes de qualquer PR.
- Checklist pós-implementação: `npm run lint` (0 erros), `npm run format`, `npm run build` e os
  itens 4-11 do checklist do AGENTS §11.2.
