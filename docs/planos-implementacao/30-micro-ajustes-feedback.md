# 30 · Micro-ajustes de feedback — Plano de Implementação

> Ref.: item **E7** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#30 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S–M (3 passos independentes, cada um S) · Risco: baixo · Prioridade global do plano: P3

## 1. Objetivo

Fechar os três micro-ajustes de feedback tátil/visual/ textual do item E7 do plano PWA, **cada um como passo independente e revertível**: (1) retorno háptico (`vibrateLight`) no toque das abas da TabBar, hoje silencioso — o único gesto de navegação frequente do app sem haptics; (2) skeleton dedicado para os fluxos focados de partida, que hoje caem no `CarregandoGeral` genérico como fallback do Suspense do Outlet; (3) texto do banner global offline que hoje promete "dados locais salvos" em **todas** as telas, inclusive nas que não leem cache (`Detalhe`/`Ao Vivo`/`Votar`, onde offline é erro de carregamento, não dado local).

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#30, nota 0,5 — "ajustes pontuais"), sem valor de deduplicação; o mérito é de polimento de UX, preservado pelo critério original do plano. Conforme o próprio doc de origem (E7 · "junto de qualquer P0/P1 que toque a área"), os passos não têm pré-requisito duro e podem entrar isoladamente ou aproveitar a janela de outro plano que toque `Layout.tsx`/`Skeletons.tsx`.

## 2. Estado atual (evidências verificadas)

Verificado no código em **03/10/2026**; divergências do doc de origem corrigidas abaixo:

- **TabBar sem haptics**: os 5 `NavLink` da navegação inferior ficam em `src/routes/Layout.tsx:277-350` (o doc de origem citava apenas "Layout.tsx:261-334"; o arquivo real é `src/routes/Layout.tsx`, não `src/components/`). Nenhum dos 5 tem retorno háptico; o único handler de interação é o spread `preCarregarAoInteragir` (`Layout.tsx:66-72`), que só faz prefetch de chunk (`onTouchStart`/`onMouseEnter`/`onFocus`).
- **Primitiva de haptics já existe**: `vibrateLight()` em `src/lib/haptics.ts:19-21` (`vibrate(15)`), já consumida no app — `src/lib/tema.ts:59` (alternar tema). Não há nada a criar, só a importar e ligar.
- **Fluxos focados caem no skeleton genérico**: `SKELETONS_POR_ROTA` (`src/routes/Layout.tsx:46-58`) **não** tem entrada para `/partida/nova`, `/partida/:id/votar`, `/partida/:id/editar`, `/partida/:id/ao-vivo` nem `/partida/:id/times`; o fallback é `CarregandoGeral` (`Layout.tsx:60-62`, componente em `src/components/Skeletons.tsx:470`). O comentário do próprio arquivo (`Layout.tsx:40-45`) reconhece o caso: "rotas sem skeleton específico (fluxos focados de partida, formulários e painel financeiro) caem no CarregandoGeral padrão". A regex `isFluxoFocado` (`Layout.tsx:110`) já enumera exatamente essas rotas de fluxo focado (usada para padding da área de conteúdo e ocultação da TabBar) — o Passo 2 pode citá-la como referência de consistência ao registrar os padrões novos.
- **`Skeletons.tsx` tem 10 skeletons específicos** (`SkeletonResumo`…`SkeletonNotificacoesSaude`, `src/components/Skeletons.tsx:6-399`) e nenhum para fluxo focado — o ajuste é criar 1 skeleton novo e registrar 2 padrões na tabela existente, sem tocar nas telas.
- **Banner offline com texto fixo e global**: `src/routes/Layout.tsx:121-131`, renderizado sempre que `!navigator.onLine`, com texto único "Modo offline — exibindo dados locais salvos" (`:129`), independente da rota atual.
- **Em Detalhe/Ao Vivo/Votar o dado NÃO vem do cache de dados do app**: as 3 telas tocam a infraestrutura de cache apenas para **invalidar** após mutações — `PartidaDetalhe.tsx` importa `invalidarCachesDependentesDePartida` de `../lib/chavesCache` (`src/routes/PartidaDetalhe.tsx:5`); `PartidaVotar.tsx` importa `invalidarCache` de `../hooks/useCache` (`src/routes/PartidaVotar.tsx:20`); `PartidaAoVivo.tsx` importa `invalidarCachesDependentesDePartida` de `../lib/chavesCache` (`src/routes/PartidaAoVivo.tsx:12`). Nenhuma delas **lê** dado do `useCache`: carregam via fetch direto — `PartidaDetalhe` via `carregarPartida`/`carregarPlacar`/`carregarParticipantes`/`carregarNotas` com `setErro` em falha (`:108`); `PartidaVotar` via `carregarPartida`/`carregarParticipantes`/`carregarMeusVotos` (`src/routes/PartidaVotar.tsx:7-15`), tratando falha como erro (`setErro`, `:40` e `:193`); `PartidaAoVivo` também trata falha com `setErro` (`:81`). Ou seja: nessas telas "exibindo dados locais salvos" é afirmativa imprecisa — offline é erro de carregamento, não dado local do `useCache`.
- **Nuance do service worker (ressalva honesta)**: `public/sw.js:174-191` usa NetworkFirst com fallback para `CACHE_API` para GETs da API Supabase — offline, uma requisição pode ser atendida pela última resposta conhecida em cache HTTP. Portanto, mesmo nas telas de partida, o banner não pode prometer categoricamente "erro": pode haver (ou não) uma cópia em cache do SW, dependendo do histórico de requisições. Essa ambiguidade é o que torna o passo 3 decisão de dono (seção 3).
- **Texto de referência para falha de rede já existe no tom do app**: `formatarMensagemErro` retorna "Sem conexão com o servidor. Verifique sua internet e tente novamente." em `src/lib/erros.ts:33`.

## 3. Precondições e dependências

- **Nenhum plano pré-requisito.** Os 3 passos são independentes entre si e de qualquer outro plano. Regra de aplicação do doc de origem: entrar **"junto de qualquer P0/P1 que toque a área"** (ex.: um plano que já modifique `Layout.tsx` ou `Skeletons.tsx`) — mas cada passo pode entrar sozinho, como commit próprio.
- **Decisão do dono exigida antes do Passo 3** (e apenas dele): como variar o texto do banner offline. O custo técnico é **baixo** — o `pathname` já está disponível no próprio `Layout` (`useLocation`, `src/routes/Layout.tsx:86`), então "saber a rota atual no contexto do banner" não exige infraestrutura nova, apenas um mapa análogo a `SKELETONS_POR_ROTA`. O que exige decisão é a **semântica**: por causa do fallback de `CACHE_API` do SW (`sw.js:174-191`), em `/partida/*` offline pode ser tanto erro (sem cópia em cache) quanto dado servido pelo SW (com cópia). Opções:
  - **Opção A (default conservador)**: manter texto único, mas trocar por um neutro que não prometa dado local (ex.: "Sem conexão — tente novamente"), aceitando a imprecisão inversa (não menciona o cache que de fato existe nas telas de mural).
  - **Opção B**: texto por família de rota — neutro nas rotas de partida (fetch direto) e "dados locais salvos" nas rotas que leem via `useCache`. Mais preciso, mas o mapeamento rota→garantia é uma regra nova a manter em sincronia com a arquitetura de dados (e o fallback do SW continua tornando a fronteira difusa).
  - Executar o Passo 3 **somente** após o dono escolher; Passos 1 e 2 não dependem desta decisão.
- **Restrição de janela**: nenhuma. Nenhum passo altera fluxo de dados, mutação ou tela de negócio; nada aqui depende de partida ao vivo (o Passo 1 toca a TabBar, que nem é renderizada em fluxo focado — `Layout.tsx:268`).

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — `vibrateLight` no toque de aba da TabBar · 1 commit

- **Arquivo**: apenas `src/routes/Layout.tsx`.
- Importar `vibrateLight` de `../lib/haptics` (mesmo módulo já consumido por `lib/tema.ts`).
- Seguir o padrão existente de handlers espalháveis (`preCarregarAoInteragir`, `Layout.tsx:66-72`): criar ao lado uma constante de spread com o retorno háptico, ex.:

  ```tsx
  /** Retorno háptico do toque de aba (E7): mesmo padrão de spread dos prefetch handlers. */
  const aoTocarAba = { onClick: () => vibrateLight() };
  ```

  e espalhar `{...aoTocarAba}` nos **5 `NavLink`** da navegação inferior (`Layout.tsx:277-350`), ao lado dos spreads `preCarregarAba*` existentes.
- **Por que `onClick` e não `onTouchStart`**: `onTouchStart` dispara em qualquer toque iniciado sobre a aba, inclusive toques que viram scroll e não navegam; `onClick` garante que o feedback coincide com o gesto de navegação e satisfaz a exigência de gesto do usuário da Vibration API. O toque (tap) é o único gesto relevante numa aba fixa de 3,5rem.
- Não tocar no `preCarregarMenuNotificacoes` nem em nenhum outro elemento (fora de escopo, seção 6).
- Commit: "adiciona vibrateLight no toque das abas da TabBar (E7.1)".

### Passo 2 — Skeleton dedicado para os fluxos focados · 1 commit

- **Arquivos**: `src/components/Skeletons.tsx` (criar o componente) e `src/routes/Layout.tsx` (registrar na tabela).
- Criar `SkeletonFluxoFocado` em `Skeletons.tsx`, seguindo o padrão dos skeletons existentes (blocos `animate-pulse` estruturais, CLS = 0): um skeleton **único e simples** que espelhe o shell comum dos fluxos focados — área de botão voltar + título, um bloco de conteúdo alto e um rodapé de ação — em vez de um skeleton por tela (gold-plating; as 5 rotas compartilham o mesmo shell de fluxo).
- Registrar em `SKELETONS_POR_ROTA` (`Layout.tsx:46-58`) duas entradas antes do fechamento da lista (sem conflito de ordem: o padrão existente `/^\/partida\/\d+\/?$/` não casa com subrotinas por causa do `$`). **Referência de consistência**: as regex propostas espelham a enumeração já feita pela `isFluxoFocado` (`Layout.tsx:110`), que cobre as mesmas 5 rotas de fluxo focado para padding e ocultação da TabBar — ao registrar as entradas, manter as duas listas em sincronia (o comentário do mapa pode apontar para `isFluxoFocado` como gêmeo a atualizar em caso de rota nova):

  ```tsx
  { padrao: /^\/partida\/nova$/, Skeleton: SkeletonFluxoFocado },
  { padrao: /^\/partida\/\d+\/(votar|editar|ao-vivo|times)$/, Skeleton: SkeletonFluxoFocado },
  ```

- Atualizar o comentário de `Layout.tsx:40-45` para refletir que os fluxos focados de partida passam a ter skeleton próprio (formulários e painel financeiro continuam no `CarregandoGeral` — fora de escopo, seção 6).
- Nenhuma tela de partida é tocada; o skeleton só aparece como fallback do Suspense durante o carregamento do chunk lazy (`Layout.tsx:262-264`).
- Commit: "skeleton dedicado para fluxos focados de partida (E7.2)".

### Passo 3 — Texto do banner offline honesto por contexto · 1 commit · **DECISÃO DO DONO**

- **Arquivo**: apenas `src/routes/Layout.tsx` (bloco do banner, `:121-131`).
- Executar **somente após** o dono escolher entre Opção A e Opção B (seção 3):
  - **Opção A**: substituir o texto único de `:129` por versão neutra que não prometa dado local, ex. "Sem conexão — tente novamente quando voltar o sinal". Duas linhas mudadas, zero lógica nova.
  - **Opção B**: adicionar um mapa de família de rota → texto (padrão visual de `SKELETONS_POR_ROTA`, já com `pathname` em mãos via `:86`): texto neutro ("Sem conexão — tente novamente") nas rotas de partida (`/partida/*`), texto atual ("dados locais salvos") nas rotas que leem via `useCache` (mural, ranking, resumo, estatísticas, perfil). Manter o mapa pequeno e documentado no comentário do bloco; **não** criar abstração nem módulo novo para isso.
- Em ambas as opções, preservar `role="status"`, `aria-live="polite"` e o ícone `WifiOff` (acessibilidade e visual intactos).
- Ressalva registrada no commit/código: em Detalhe/Ao Vivo/Votar, offline é erro de carregamento (`setErro` nas telas), não dado local — o texto neutro existe para não prometer o que a tela não garante; o fallback de `CACHE_API` do SW continua podendo servir cópias antigas em qualquer tela, e isso é comportamento do SW, não do banner.
- Commit: "ajusta texto do banner offline para não prometer dado local em telas sem cache (E7.3)".

Total: 3 commits independentes; Passos 1 e 2 são 1–2 arquivos cada; Passo 3 depende de decisão prévia do dono.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no aparelho (haptics e banner só são reais no celular) e no build de dev:

- [ ] `npm run build` (ou `tsc -b`) sem erros após cada passo.
- [ ] **Passo 1**: em aparelho Android (Vibration API), tocar cada uma das 5 abas da TabBar e sentir o pulso curto (~15ms) idêntico ao de alternar o tema; confirmar que rolar a página com o dedo apoiado sobre a barra **não** vibra sem toque/navegação; confirmar que a vibração não acontece em clique por teclado/mouse no desktop (sem erro, apenas sem efeito).
- [ ] **Passo 1**: navegação das abas continua correta (active state âmbar, `aria-current`, prefetch de chunk intactos — o spread novo não sobrescreve os existentes).
- [ ] **Passo 2**: com throttling de rede (DevTools → Slow/na primeira visita a cada chunk), tocar "Nova partida" e abrir `/partida/:id/votar` e `/partida/:id/ao-vivo`: o fallback exibido é o skeleton novo (shell de fluxo focado), sem o spinner/blocos genéricos do `CarregandoGeral`; comparar com rota já coberta (ex. `/ranking`) para garantir que os skeletons das demais rotas não mudaram.
- [ ] **Passo 2**: nenhum pulo de layout (CLS) perceptível entre skeleton e tela carregada nos 3 fluxos testados.
- [ ] **Passo 3 (Opção A)**: modo avião ativado com o app já carregado → banner mostra o texto neutro em qualquer tela; desativar → banner some.
- [ ] **Passo 3 (Opção B)**: modo avião → em `/jogos` o banner mantém "dados locais salvos"; navegar (dentro do app já carregado) para uma partida em `/partida/:id` → banner mostra o texto neutro; `role="status"`/`aria-live` intactos.
- [ ] **Passo 3**: em `/partida/:id` offline sem cópia em cache do SW, a tela segue exibindo seu estado de erro próprio (`MensagemEstado`), sem regressão causada pela mudança de texto.

## 6. Fora de escopo

- **Não** criar um skeleton por tela dos fluxos focados (espelhar votar/editar/ao-vivo/times individualmente é abstração sem demanda — um shell comum cobre os 5).
- **Não** estender o skeleton dedicado a formulários (`/jogador/novo`) e painel financeiro (`/administrador`), que seguem no `CarregandoGeral` conforme o comentário atual de `Layout.tsx:40-45`; reavaliar só se o dono pedir.
- **Não** aplicar haptics em outros elementos (menu admin, botões de formulário, abas internas) — o item E7 fala apenas da TabBar; novos haptics são decisão separada.
- **Não** alterar `public/sw.js` (estratégia NetworkFirst/`CACHE_API` permanece intocada) nem tentar fazer o banner detectar conectividade real da API (ping/heartbeat) — o banner continua refletindo `navigator.onLine` + eventos `online`/`offline`.
- **Não** tocar nas telas `PartidaDetalhe`/`PartidaAoVivo`/`PartidaVotar` nem na arquitetura de cache (`useCache`/`chavesCache`); a imprecisão do banner é tratada só pelo texto.
- **Não** criar testes automáticos, novos componentes genéricos de feedback, nem dependências novas (`vibrateLight` e o padrão de skeletons já existem).

## 7. Riscos e rollback

- **Risco funcional: mínimo em todos os passos.** Passo 1 adiciona apenas um handler de feedback (navegação e prefetch preservados); Passo 2 muda somente o fallback visual do Suspense (nenhuma tela, rota ou dado é alterado); Passo 3 muda apenas texto/mapa de texto de um elemento decorativo com `role="status"`.
- **Risco do Passo 1 (baixo)**: vibration mal aplicada em toques que não navegam — mitigado usando `onClick` em vez de `onTouchStart` (seção 4). Rollback: `git revert` do commit restaura os 5 `NavLink` originais.
- **Risco do Passo 2 (baixo)**: skeleton novo com estrutura que não casa com a tela real (CLS > 0 perceptível) — mitigado pelo checklist da seção 5; pior caso é estético e reversível. Rollback: `git revert` do commit remove as 2 entradas de `SKELETONS_POR_ROTA` e o componente volta ao desuso (removê-lo no mesmo revert).
- **Risco do Passo 3 (baixo, porém o único com decisão de produto)**: texto por rota (Opção B) cria uma regra a manter em sincronia com a arquitetura de dados — se uma rota passar a ler via `useCache` (ex.: desdobramento futuro do D2), o mapa pode ficar obsoleto em silêncio. Mitigação: comentário no mapa apontando essa manutenção; e é justamente por esse risco de drift que a escolha A/B é do dono. Rollback: `git revert` do commit restaura o texto fixo atual ("Modo offline — exibindo dados locais salvos").
- Todos os passos são revertíveis por `git revert` isolado, sem dependência entre si nem de outros planos.
