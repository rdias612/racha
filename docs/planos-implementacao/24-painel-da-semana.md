# 24 · Painel da Semana: confirmar presença em 1 toque na home — Plano de Implementação

> Ref.: item **E2** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#24 (nota 1,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S–M · Risco: baixo · Prioridade global do plano: P1

## 1. Objetivo

Transformar o card "PRÓXIMA QUINTA" da home em um **Painel da Semana contextual**: hoje ele promete "Toque para confirmar presença" mas apenas navega ao detalhe, onde o "Vou jogar" vive no fim da lista de confirmações — 3 toques + scroll para a tarefa que todo jogador faz toda semana. O painel passa a mostrar o **estado do próprio jogador** (confirmado/pendente/recusado/não convocado), as vagas `x/14` e um botão inline **"Vou jogar"** que confirma direto da home, reusando integralmente os padrões já consagrados em `ConfirmacoesPartida` (haptics + atualização otimista + rollback + revalidação) e os mesmos guards de vaga (`podeConfirmar`). Quando há votação aberta, o painel assume o CTA **"Votar no Craque"**, complementando o `BannerLembrete` (que permanece, sem polling duplicado).

> **Dependência obrigatória — decisão do dono antes de executar.** Este é o **único item do plano que adiciona UI nova** (motivo da nota baixa no ranking anti-slop: bom reuso de primitivas, mas zero deduplicação). A aprovação do escopo e do visual é pré-condição absoluta dos 3 passos; a referência visual é o Draft 1 do canvas Superdesign (seção 2 e Apêndice do plano de origem). Sem aprovação, este plano não é executado.

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#24, nota 1,0) — o critério daquele ranking mede deduplicação, não valor de UX; pelo critério do plano de origem, E2 é **P1, Fase 4** (3º item da fase de UX funcional, após E1/E3). O `README.md` deste diretório manda seguir as fases do plano para o Tier 4.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; divergências de linha do doc de origem corrigidas abaixo:

- **`src/routes/Resumo.tsx:194-222`** — `CardProximaPartida` é um `<Link>` único para `/partida/:id` (`:201-220`): badge "PRÓXIMA QUINTA" (`:206-208`), vagas `ocupadas/CAPACIDADE_PARTIDA VAGAS` (`:209-211`) e o texto **"Toque para confirmar presença ou consultar a súmula"** (`:217-219`; doc citava `:217-219` — confere) que hoje só leva ao detalhe. Instanciado em `:140` com `proxima={proxima}`.
- **`src/routes/Resumo.tsx:39-56`** — o `buscar` do `useCache(chaveResumo(ano), buscar)` (`:58`) já carrega os participantes da próxima partida (`carregarParticipantes(draftAtual.id)`, `:47`) mas os **descarta**, agregando só `{ id, data_jogo, ocupadas }` (`:48-52`) — o estado do próprio jogador está disponível na fonte e não chega à tela. O `Resumo` **não conhece o jogador logado** (nenhum `useJogadorLogado`/`useSessao` no arquivo) e não importa `supabase` (tudo via `lib`).
- **`src/routes/Resumo.tsx:120`** — a tela já vive dentro de `PullToRefresh onRefresh={recarregar}`; `recarregar` é o gatilho de revalidação a reusar após a confirmação.
- **`src/components/ConfirmacoesPartida.tsx:36-75`** — `BotoesSelf`: "Vou jogar" (`:42-52`, `onAtualizar('confirmado')`, desabilitado por `processando || !podeConf`, `title="Vagas esgotadas"` quando lotado), "Desconfirmar" (`:53-62`) e "Essa quinta não rola" (`:63-72`). Doc citava `:36-75` — confere.
- **`src/components/ConfirmacoesPartida.tsx:181-211`** — `atualizar()`, padrão a reusar: `vibrateSuccess()` quando o alvo é `confirmado`, `vibrateLight()` caso contrário (`:184-185`); atualização otimista do status local (`:187-191`); `confirmarPresenca(...)` no caminho self (`:198`); rollback do snapshot anterior + erro local quando a RPC retorna `false` (`:199-201`) ou lança (`:205-207`, via `formatarMensagemErro`); **revalidação** `await onAtualizar()` no sucesso (`:203`). Doc citava `:181-211` — confere.
- **`src/lib/partidas.ts:340-350`** — `podeConfirmar(participante, alvo, participantes)`: espelha a regra server-side (alvo `confirmado` exige menos de 14 outros confirmados; demais alvos sempre permitidos). Usado em `ConfirmacoesPartida.tsx:289`.
- **`src/lib/partidas.ts:353-365`** — `confirmarPresenca(partidaId, jogadorId, status)` → RPC `confirmar_presenca`, retorna `boolean`. **`src/lib/partidas.ts:330`** — `CAPACIDADE_PARTIDA = 14`; **`:333-335`** — `vagasOcupadas` (conta `status_confirmacao === 'confirmado'`).
- **`src/lib/partidas.ts:480-492`** — `obterPartidaDraftAtual()` já seleciona `id, data_jogo, confirmacao_closes_at` — o dado de prazo chega à home sem nova query; `Resumo.tsx` simplesmente não o propaga para `DadosResumo.proxima` (`:22-24`).
- **`src/components/BannerLembrete.tsx:29-65`** — o lembrete de urna é **polling próprio e global** (renderizado no `src/routes/Layout.tsx:239`, fora da home): query `status = 'published'` + `voting_closes_at > now` (`:37-41`), filtro "ainda não votadas" com `carregarPartidasVotadas` + `votacaoAberta` (`:51-61`), countdown e geração de requisição inclusos. O painel **não** deve replicar esse polling — apenas derivar o CTA do estado já carregado no `buscar` da home.
- **Primitivas de exibição já existentes** (reuso direto, nada a criar): `Badge variante="status"` + `STATUS_CONFIRMACAO_LABEL` (`src/lib/partidas.ts`, usados em `ConfirmacoesPartida.tsx:303-305`); `vibrateSuccess`/`vibrateLight` (`src/lib/haptics.ts:26`); `formatarMensagemErro` (`src/lib/erros.ts`); `useJogadorLogado` (`src/hooks/useJogadorLogado.ts`, wrapper do `SessaoContext`); `formatarDataMobile`/`formatarDataCompleta` já usados no card (`Resumo.tsx:214-215`).
- **Referência visual (não fonte de verdade)**: Draft 1 — **Resumo · Painel da Semana** do canvas Superdesign — https://p.superdesign.dev/draft/a95e261a-f89f-404a-845c-fdb2c87ea68e (Apêndice do plano de origem, que lista também os Drafts 2 e 3, de E1/E3). Serve para visualizar a ideia; textos, layout final e escopo seguem este plano e a aprovação do dono.

## 3. Pré-condições e dependências

- **DECISÃO DO DONO OBRIGATÓRIA ANTES DE EXECUTAR** (os 3 passos): aprovar o escopo (4 estados do jogador + vagas + botão inline "Vou jogar" + CTA "Votar no Craque") e o visual, tomando o Draft 1 do Superdesign como referência. É o único item do plano que adiciona UI nova; nenhum passo começa sem esse OK.
- **Pré-requisito prático do Passo 3**: o plano **07** (`queries-fora-da-lib.md`, D5) cria `carregarPartidasComVotacaoAberta()` em `lib/partidas.ts` — a função que o `BannerLembrete` usa inline hoje. Ordem recomendada: **07 antes deste**. Se este plano precisar vir primeiro, executar apenas os Passos 1–2 e deixar o Passo 3 para depois do 07 (extrair a query aqui duplicaria o escopo do 07).
- **Nenhum outro plano pré-requisito**: os Passos 1–2 dependem só de funções que já existem em `lib/` (`carregarParticipantes`, `vagasOcupadas`, `podeConfirmar`, `confirmarPresenca`, `CAPACIDADE_PARTIDA`, `STATUS_CONFIRMACAO_LABEL`).
- **Sem dependência do plano 03** (helper de invalidação): a revalidação é o `recarregar` do próprio `useCache` da home (mesma chave, sem chave nova).
- **Restrição de janela**: executar/validar **fora de partida ao vivo** (a home não é tela ao vivo, mas a confirmação mexe na partida draft corrente); a validação do estado "não convocado" e do CTA de votação exige dados específicos (seção 5).

## 4. Plano de execução (1 passo = 1 commit)

Todo o trabalho vive em **`src/routes/Resumo.tsx`** (evolução do `CardProximaPartida` local); nenhum componente novo em `src/components/`, nenhuma mudança em `lib/` (com a ressalva do Passo 3/07), nenhuma biblioteca nova.

### Passo 1 — Propagar o estado do jogador e o prazo nos dados da home · 1 commit

- **`src/routes/Resumo.tsx`**:
  1. Importar `useJogadorLogado` (`../hooks/useJogadorLogado`) e, de `../lib/partidas`, os tipos/utilitários que faltam: `type Participante`, `type StatusConfirmacao`, `STATUS_CONFIRMACAO_LABEL` (os demais — `vagasOcupadas`, `CAPACIDADE_PARTIDA` — já são importados em `:10-16`).
  2. Expandir `DadosResumo.proxima` (`:22-24`) de `{ id, data_jogo, ocupadas }` para `{ id, data_jogo, confirmacao_closes_at: string | null, participantes: Participante[] }`; no `buscar` (`:45-53`), guardar o array de `parts` em vez de descartá-lo (o `ocupadas` passa a ser derivado na renderização com `vagasOcupadas(parts)`, como já feito hoje dentro do `buscar`).
  3. No componente, obter `const jogador = useJogadorLogado()` e derivar o estado do próprio jogador: `const meuParticipante = proxima?.participantes.find(p => p.jogador_id === jogador?.id) ?? null` — `null` com jogador logado = **não convocado**; sem jogador logado = comportamento de hoje (card-links simples).
- Nenhuma query nova: `carregarParticipantes` e `obterPartidaDraftAtual` (que já traz `confirmacao_closes_at`) permanecem como estão; a chave de cache `chaveResumo(ano)` e o `useCache` não mudam.
- Commit: "resumo: propaga participantes e prazo da próxima partida para o card (E2)".

### Passo 2 — Card vira Painel da Semana com "Vou jogar" inline · 1 commit

- **`src/routes/Resumo.tsx`** — evoluir `CardProximaPartida` (`:194-222`) para o painel contextual, **preservando o `<Link>` para o detalhe** (a súmula continua sendo o destino do toque no card, fora do botão):
  1. **Cabeçalho**: manter badge "PRÓXIMA QUINTA" e vagas `x/14 VAGAS` (`:206-211`), agora derivadas com `vagasOcupadas(participantes)` + `CAPACIDADE_PARTIDA` (conferir singular/plural como o detalhe faz).
  2. **Estado do jogador** (substitui o texto fixo de `:217-219`): Badge `variante="status"` + `STATUS_CONFIRMACAO_LABEL` para confirmado/pendente/recusado; texto próprio ("Você não foi convocado nesta quinta — fale com a organização" ou similar aprovado) para não convocado. Sem jogador logado, manter o texto atual "Toque para confirmar presença ou consultar a súmula".
  3. **Botão inline "Vou jogar"** — renderizado apenas quando `meuParticipante` existe e `meuParticipante.status_confirmacao !== 'confirmado'`; espelhar `BotoesSelf` (`ConfirmacoesPartida.tsx:42-52`): classes/idênticas (min 44px, tokens de borda/destaque), `disabled={processando || !podeConfirmar(meuParticipante, 'confirmado', participantes)}`, `title="Vagas esgotadas"` quando `ocupadas >= CAPACIDADE_PARTIDA`. O botão fica **fora** do `<Link>` (o card passa a ser um contêiner com link no corpo + botão próprio, ou o link migra para o bloco de texto — decidir na aprovação do dono, sem aninhar `<button>` dentro de `<a>`). Status `confirmado` exibe o badge e nenhum botão (desconfirmar/recusa continuam só no detalhe).
  4. **Confirmação** — replicar o padrão de `atualizar` (`ConfirmacoesPartida.tsx:181-211`) restrito ao self: `vibrateSuccess()`; snapshot anterior; atualização otimista do status **em cópia local de `dados`** (não mutar o cache do `useCache` diretamente — guardar `override` local no estado do card, limpo no sucesso); `await confirmarPresenca(proxima.id, jogador.id, 'confirmado')`; em `false`/exceção: rollback + mensagem inline no card com `formatarMensagemErro` (mesmo padrão do `erroLocal` do detalhe, `ConfirmacoesPartida.tsx:376-380`); no sucesso: `await recarregar()` — **a revalidação é obrigatória** para as vagas e o status refletirem o servidor (nada de estado mentiroso com cache velho). Estados de processamento/erro morrem com o card; nenhum `useEffect` de polling.
  5. Prazo: exibir a linha informativa de `confirmacao_closes_at` (mesma mensagem de `ConfirmacoesPartida.tsx:278-284`, via `formatarFechamento`) quando existir. O bloqueio de prazo permanece server-side + guard de vagas no cliente, exatamente como o detalhe faz hoje (o `BotoesSelf` também não desabilita por prazo — não inventar regra nova).
- `tsc -b`/build sem referência quebrada (`ocupadas` saiu da interface).
- Commit: "resumo: Painel da Semana com confirmação em 1 toque na home (E2)".

### Passo 3 — CTA "Votar no Craque" quando há votação aberta · 1 commit (após plano 07)

- **`src/routes/Resumo.tsx`** — no `buscar` (`:39-56`), derivar `votacaoAbertaPendente` reusando `carregarPartidasComVotacaoAberta()` (criada pelo plano 07 no lugar da query inline de `BannerLembrete.tsx:37-41`) + `carregarPartidasVotadas(jogadorId, ids)` + `votacaoAberta()` — a mesma composição de `BannerLembrete.tsx:36-61`, **sem** o polling/countdown (a home revalida no mount, no PTR e após qualquer `recarregar`; o banner global continua dono do tempo real). Condição: existe partida `published` com urna aberta que o jogador logado ainda não votou.
- Na renderização do painel: quando `votacaoAbertaPendente`, o CTA primário do painel vira **"Votar no Craque"** (link para `/partida/:id/votar`, alvo 44px, destaque âmbar padrão), mantendo o "Vou jogar" secundário abaixo quando aplicável — o painel **assume** o CTA de votação sem remover o de confirmação. Sem votação aberta (ou jogador já votou, ou deslogado), nada muda no Passo 2.
- **Complementar, não duplicar**: o `BannerLembrete` permanece intocado no `Layout.tsx:239` (tira global com countdown). O painel não repete countdown, não faz polling e não elimina o banner — é a versão acionável no contexto da home.
- Commit: "resumo: CTA Votar no Craque no Painel da Semana quando a urna está aberta (E2)".

Total: 3 commits, cada um reversível isoladamente; o Passo 3 pode ficar para depois do plano 07 sem afetar 1–2.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). No build de dev (`npm run dev`), aparelho/emulação mobile, cobrindo **os 4 estados do jogador** e os caminhos de falha:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Pendente (estado padrão)**: card mostra badge "Pendente", vagas `x/14` corretas e botão "Vou jogar"; tocar nele vibra (padrão do `vibrateSuccess`), o status vira "Confirmado" imediatamente (otimista), e após a resposta as vagas e o badge refletem o servidor (revalidação) — sem Flash de estado antigo.
- [ ] **Confirmado**: badge "Confirmado", **sem** botão "Vou jogar"; desconfirmar/recusar só é possível indo ao detalhe (fluxo intacto lá, inclusive "Desconfirmar" e "Essa quinta não rola").
- [ ] **Recusado**: badge de recusado e botão "Vou jogar" presente; confirmar a partir da recusa funciona e o badge atualiza.
- [ ] **Não convocado**: com um jogador logado que não está na lista de participantes do draft, o card mostra o estado "não convocado", sem botão de confirmação.
- [ ] **Sem jogador logado**: card igual ao de hoje (texto "Toque para confirmar presença…", link ao detalhe) — nenhum estado de jogador renderizado.
- [ ] **Guard de vaga**: com 14 confirmados, "Vou jogar" desabilitado com `title` "Vagas esgotadas" (espelho do `BotoesSelf`).
- [ ] **Falha honesta**: DevTools → Network offline no momento do toque — vibração pode ocorrer (padrão atual do detalhe), mas o status **volta** ao anterior (rollback), mensagem de erro inline aparece no card e as vagas permanecem corretas após `recarregar`.
- [ ] **Prazo**: com `confirmacao_closes_at` definido, a linha "Reservas liberadas …" aparece no painel como no detalhe; após o prazo, o servidor segue mandando (comportamento inalterado).
- [ ] **CTA de votação (Passo 3)**: com urna aberta e voto pendente — painel mostra "Votar no Craque" apontando para `/partida/:id/votar`; após votar e voltar (PTR), o CTA some; o `BannerLembrete` continua aparecendo/desaparecendo como hoje (nenhum polling novo na home: conferir via DevTools Network que a home não passa a periodizar).
- [ ] **Link do card preservado**: tocar no corpo do card (fora do botão) continua abrindo `/partida/:id` com a súmula e a lista de confirmações intactas.
- [ ] Pull-to-refresh da home revalida o painel (trocar a confirmação em outro dispositivo/aparelho e puxar para atualizar).

## 6. Fora de escopo

- **Não replicar a lista de confirmações no painel**: sem "Desconfirmar", sem "Essa quinta não rola", sem controles de admin, sem "Adicionar Avulso" — tudo continua exclusivo do detalhe (`ConfirmacoesPartida` **não é tocado**).
- **Não tocar no `BannerLembrete`** (removê-lo, fundi-lo com o painel ou replicar seu polling/countdown): o painel o complementa; a coordenação é só o CTA contextual.
- **Não reproduzir literalmente o Draft 1 do Superdesign**: referência visual apenas; o layout final é o aprovado pelo dono dentro do escopo deste plano.
- **Não extrair a query de votação aberta neste plano** (Passo 3 depende do plano 07) nem criar função nova em `lib/` para o painel — ele consome só o que já existe.
- **Não implementar realtime** (segue o plano próprio `docs/plano-escolha-times-realtime.md`; proibido por este plano de origem), **não** criar nova chave de cache/invalidação (usa `recarregar` da chave existente), **não** mexer na RPC `confirmar_presenca` nem nos guards server-side.
- **Não** antecipar itens de E3 (retry/PTR nas telas de partida — plano 16) nem de E7 (haptics na TabBar etc.).
- **Não** criar testes automáticos (diretriz atual do AGENTS.md).

## 7. Riscos e rollback

- **Risco funcional: baixo** — o fluxo novo é aditivo; a RPC e os guards são os mesmos do detalhe, que permanece como fonte de verdade. Pontos de atenção:
  - **Estado defasado entre visitas**: o `useCache` serve dado stale na revisita; o painel pode mostrar um status antigo até a revalidação em background completar. Mitigação já prevista: revalidação obrigatória após confirmar (Passo 2.4) + PTR; aceito para leitura (o mesmo vale hoje para as vagas), nunca após uma ação do próprio jogador.
  - **Aninhamento link/botão**: o card era um `<Link>` único; virar contêiner com botão próprio exige cuidado de markup (nada de `<button>` dentro de `<a>`) e de alvo de toque (44px) — é exatamente o ponto a validar na aprovação visual do dono.
  - **Duplicação de lógica `atualizar`**: o painel replica ~20 linhas do padrão do detalhe em contexto diferente (estado local próprio). Extração prematura de hook/componente compartilhado seria abstração sem segundo consumidor real — documentar na review; se um terceiro consumo surgir, aí sim avaliar extração.
- **Risco de regressão**: a home de jogador deslogado e o detalhe da partida ficam intocados; o pior caso é o painel novo não renderizar botão (degrada para o card de hoje, que continua com o link).
- **Rollback**: cada passo é um commit isolado, reversível por `git revert` sem efeitos colaterais — Passo 1 é só propagação de dados; Passo 2 restaura o card-links com o revert; Passo 3 é aditivo sobre o Passo 2. Nenhuma migração, nenhum dado persistido novo, nenhuma mudança em `lib/` neste plano (se executado após o 07, a função de lá tem rollback próprio).
