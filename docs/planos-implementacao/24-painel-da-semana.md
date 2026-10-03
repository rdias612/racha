# 24 · Painel da Semana: confirmar presença em 1 toque na home — Plano de Implementação

> Ref.: item **E2** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#24 (nota 1,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S–M · Risco: baixo · Prioridade global do plano: P1

## 1. Objetivo

Transformar o card "PRÓXIMA QUINTA" da home em um **Painel da Semana contextual**: hoje ele promete "Toque para confirmar presença" mas apenas navega ao detalhe, onde o "Vou jogar" vive no fim da lista de confirmações — 3 toques + scroll para a tarefa que todo jogador faz toda semana. O painel passa a mostrar o **estado do próprio jogador** (confirmado/pendente/recusado/não convocado), as vagas `x/14` e um botão inline **"Vou jogar"** que confirma direto da home, reusando integralmente os padrões já consagrados em `ConfirmacoesPartida` (haptics + atualização otimista + rollback + revalidação) e os mesmos guards de vaga (`podeConfirmar`). Quando há votação aberta, o painel assume o CTA **"Votar no Craque"**, complementando o `BannerLembrete` (que permanece, sem polling duplicado).

> **Dependência obrigatória — decisão do dono antes de executar.** Este é o **único item do plano que adiciona UI nova** (motivo da nota baixa no ranking anti-slop: bom reuso de primitivas, mas zero deduplicação). A aprovação do escopo e do visual é pré-condição absoluta dos 3 passos; a referência visual é o Draft 1 do canvas Superdesign (seção 2 e Apêndice do plano de origem). Sem aprovação, este plano não é executado.

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#24, nota 1,0) — o critério daquele ranking mede deduplicação, não valor de UX; pelo critério do plano de origem, E2 é **P1, Fase 4** (3º item da fase de UX funcional, após E1/E3). O `README.md` deste diretório manda seguir as fases do plano para o Tier 4.

## 2. Estado atual (evidências verificadas)

Verificado no código em **03/10/2026** (re-medição completa após o commit `3e82a6f`, que moveu o `Resumo` e outras peças; divergências de linha do doc de origem corrigidas abaixo):

- **`src/routes/Resumo.tsx:238-266`** — `CardProximaPartida` é um `<Link>` único para `/partida/:id` (`:245-264`): badge "PRÓXIMA QUINTA" (`:250-252`), vagas `ocupadas/CAPACIDADE_PARTIDA VAGAS` (`:253-255`) e o texto **"Toque para confirmar presença ou consultar a súmula"** (`:261-263`) que hoje só leva ao detalhe. Instanciado em `:156` com `proxima={proxima}`.
- **`src/routes/Resumo.tsx:44-61`** — o `buscar` do `useCache(chaveResumo(ano), buscar)` (`:63`) já carrega os participantes da próxima partida (`carregarParticipantes(draftAtual.id)`, `:52`) mas os **descarta**, agregando só `{ id, data_jogo, ocupadas }` (`:53-57`) — o estado do próprio jogador está disponível na fonte e não chega à tela. O `Resumo` **não conhece o jogador logado** (nenhum `useJogadorLogado`/`useSessao` no arquivo) e não importa `supabase` (tudo via `lib`).
- **`src/routes/Resumo.tsx:133`** — a tela já vive dentro de `PullToRefresh onRefresh={recarregar}`; `recarregar` é o gatilho de revalidação a reusar após a confirmação.
- **`src/components/ConfirmacoesPartida.tsx:44-84`** — `BotoesSelf`: "Vou jogar" (`:50-60`, `onAtualizar('confirmado')`, desabilitado por `processando || !podeConf`, `title="Vagas esgotadas"` quando lotado), "Desconfirmar" (`:61-71`) e "Essa quinta não rola" (`:72-81`).
- **`src/components/ConfirmacoesPartida.tsx:200-230`** — `atualizar()`, padrão a reusar: `vibrateSuccess()` quando o alvo é `confirmado`, `vibrateLight()` caso contrário (`:203-204`); atualização otimista do status local (`:206-210`); `confirmarPresenca(...)` no caminho self (`:217`); rollback do snapshot anterior + erro local quando a RPC retorna `false` (`:218-220`) ou lança (`:224-226`, via `formatarMensagemErro`); **revalidação** `await onAtualizar()` no sucesso (`:222`).
- **`src/lib/partidas.ts:427-437`** — `podeConfirmar(participante, alvo, participantes)`: espelha a regra server-side (alvo `confirmado` exige menos de 14 outros confirmados; demais alvos sempre permitidos). Usado em `ConfirmacoesPartida.tsx:296`.
- **`src/lib/partidas.ts:440-451`** — `confirmarPresenca(partidaId, jogadorId, status)` → RPC `confirmar_presenca`, retorna `boolean`. **`src/lib/partidas.ts:417`** — `CAPACIDADE_PARTIDA = 14`; **`:420-422`** — `vagasOcupadas` (conta `status_confirmacao === 'confirmado'`).
- **`src/lib/partidas.ts:566-578`** — `obterPartidaDraftAtual()` já seleciona `id, data_jogo, confirmacao_closes_at` (`:569`) — o dado de prazo chega à home sem nova query; `Resumo.tsx` simplesmente não o propaga para `DadosResumo.proxima` (`:26-29`).
- **`src/components/BannerLembrete.tsx`** — o lembrete de urna é **polling próprio e global** (renderizado no `src/routes/Layout.tsx:255`, fora da home): `verificar` (`:27-54`) usa `carregarPartidasComVotacaoAberta()` de `lib/partidas.ts:239` (extraída daqui pelo plano **07**, já executado) e filtra "ainda não votadas" com `carregarPartidasVotadas` (`:45-48`); polling em intervalos (`:61-67`, 30s com pendentes / 5min sem), re-verificação no `visibilitychange` (`:70-76`) e countdown (`:78-83`) inclusos. O painel **não** deve replicar esse polling — apenas derivar o CTA do estado já carregado no `buscar` da home.
- **Primitivas de exibição já existentes** (reuso direto, nada a criar): `Badge variante="status"` + `STATUS_CONFIRMACAO_LABEL` (`src/lib/partidas.ts:9`, usados em `ConfirmacoesPartida.tsx:310-312`); `vibrateSuccess`/`vibrateLight` (`src/lib/haptics.ts:26` e `:19`); `formatarMensagemErro` (`src/lib/erros.ts`); `useJogadorLogado` (`src/hooks/useJogadorLogado.ts`, wrapper do `SessaoContext`); `formatarDataMobile`/`formatarDataCompleta` já usados no card (`Resumo.tsx:258-259`).
- **Referência visual (não fonte de verdade)**: Draft 1 — **Resumo · Painel da Semana** do canvas Superdesign — https://p.superdesign.dev/draft/a95e261a-f89f-404a-845c-fdb2c87ea68e (Apêndice do plano de origem, que lista também os Drafts 2 e 3, de E1/E3). Serve para visualizar a ideia; textos, layout final e escopo seguem este plano e a aprovação do dono.

## 3. Pré-condições e dependências

- **DECISÃO DO DONO OBRIGATÓRIA ANTES DE EXECUTAR** (os 3 passos): aprovar o escopo (4 estados do jogador + vagas + botão inline "Vou jogar" + CTA "Votar no Craque") e o visual, tomando o Draft 1 do Superdesign como referência. É o único item do plano que adiciona UI nova; nenhum passo começa sem esse OK.
- **Pré-requisito prático do Passo 3 já atendido**: o plano **07** (`queries-fora-da-lib.md`, D5) já foi **executado** e criou `carregarPartidasComVotacaoAberta()` em `lib/partidas.ts:239` (antes, a query morava inline no `BannerLembrete`). Os 3 passos podem ser executados em sequência, sem esperar nada.
- **Nenhum outro plano pré-requisito**: os Passos 1–2 dependem só de funções que já existem em `lib/` (`carregarParticipantes`, `vagasOcupadas`, `podeConfirmar`, `confirmarPresenca`, `CAPACIDADE_PARTIDA`, `STATUS_CONFIRMACAO_LABEL`).
- **Sem dependência do plano 03** (helper de invalidação): a revalidação é o `recarregar` do próprio `useCache` da home (mesma chave, sem chave nova).
- **Restrição de janela**: executar/validar **fora de partida ao vivo** (a home não é tela ao vivo, mas a confirmação mexe na partida draft corrente); a validação do estado "não convocado" e do CTA de votação exige dados específicos (seção 5).

## 4. Plano de execução (1 passo = 1 commit)

Todo o trabalho vive em **`src/routes/Resumo.tsx`** (evolução do `CardProximaPartida` local); nenhum componente novo em `src/components/`, nenhuma mudança em `lib/` (com a ressalva do Passo 3/07), nenhuma biblioteca nova.

### Passo 1 — Propagar o estado do jogador e o prazo nos dados da home · 1 commit

- **`src/routes/Resumo.tsx`**:
  1. Importar `useJogadorLogado` (`../hooks/useJogadorLogado`) e, de `../lib/partidas`, os tipos/utilitários que faltam: `type Participante`, `type StatusConfirmacao`, `STATUS_CONFIRMACAO_LABEL` (os demais — `vagasOcupadas`, `CAPACIDADE_PARTIDA` — já são importados em `:10-17`).
  2. Expandir `DadosResumo.proxima` (`:26-29`, campo `proxima` em `:28`) de `{ id, data_jogo, ocupadas }` para `{ id, data_jogo, confirmacao_closes_at: string | null, participantes: Participante[] }`; no bloco de montagem do `proxima` dentro do `buscar` (`:52-57`), guardar o array de `parts` em vez de descartá-lo (o `ocupadas` passa a ser derivado na renderização com `vagasOcupadas(parts)`, como já feito hoje dentro do `buscar`).
  3. No componente, obter `const jogador = useJogadorLogado()` e derivar o estado do próprio jogador: `const meuParticipante = proxima?.participantes.find(p => p.jogador_id === jogador?.id) ?? null` — `null` com jogador logado = **não convocado**; sem jogador logado = comportamento de hoje (card-links simples).
- Nenhuma query nova: `carregarParticipantes` e `obterPartidaDraftAtual` (que já traz `confirmacao_closes_at`) permanecem como estão; a chave de cache `chaveResumo(ano)` e o `useCache` não mudam.
- Commit: "resumo: propaga participantes e prazo da próxima partida para o card (E2)".

### Passo 2 — Card vira Painel da Semana com "Vou jogar" inline · 1 commit

- **`src/routes/Resumo.tsx`** — evoluir `CardProximaPartida` (`:238-266`) para o painel contextual, **preservando o `<Link>` para o detalhe** (a súmula continua sendo o destino do toque no card, fora do botão):
  1. **Cabeçalho**: manter badge "PRÓXIMA QUINTA" e vagas `x/14 VAGAS` (`:250-255`), agora derivadas com `vagasOcupadas(participantes)` + `CAPACIDADE_PARTIDA` (formato igual ao do detalhe, `ConfirmacoesPartida.tsx:281`).
  2. **Estado do jogador** (substitui o texto fixo de `:261-263`): Badge `variante="status"` + `STATUS_CONFIRMACAO_LABEL` para confirmado/pendente/recusado; texto próprio ("Você não foi convocado nesta quinta — fale com a organização" ou similar aprovado) para não convocado. Sem jogador logado, manter o texto atual "Toque para confirmar presença ou consultar a súmula".
  3. **Botão inline "Vou jogar"** — renderizado apenas quando `meuParticipante` existe e `meuParticipante.status_confirmacao !== 'confirmado'`; espelhar `BotoesSelf` (`ConfirmacoesPartida.tsx:50-60`): classes/idênticas (min 44px, tokens de borda/destaque), `disabled={processando || !podeConfirmar(meuParticipante, 'confirmado', participantes)}`, `title="Vagas esgotadas"` quando `ocupadas >= CAPACIDADE_PARTIDA`. O botão fica **fora** do `<Link>` (o card passa a ser um contêiner com link no corpo + botão próprio, ou o link migra para o bloco de texto — decidir na aprovação do dono, sem aninhar `<button>` dentro de `<a>`). Status `confirmado` exibe o badge e nenhum botão (desconfirmar/recusa continuam só no detalhe).
  4. **Confirmação** — replicar o padrão de `atualizar` (`ConfirmacoesPartida.tsx:200-230`) restrito ao self: `vibrateSuccess()`; snapshot anterior; atualização otimista do status **em cópia local de `dados`** (não mutar o cache do `useCache` diretamente — guardar `override` local no estado do card, limpo no sucesso); `await confirmarPresenca(proxima.id, jogador.id, 'confirmado')`; em `false`/exceção: rollback + mensagem inline no card com `formatarMensagemErro` (mesmo padrão do `erroLocal` do detalhe, `ConfirmacoesPartida.tsx:383-387`); no sucesso: `await recarregar()` — **a revalidação é obrigatória** para as vagas e o status refletirem o servidor (nada de estado mentiroso com cache velho). Estados de processamento/erro morrem com o card; nenhum `useEffect` de polling.
  5. Prazo: exibir a linha informativa de `confirmacao_closes_at` (mesma mensagem de `ConfirmacoesPartida.tsx:285-291`, via `formatarFechamento`) quando existir. O bloqueio de prazo permanece server-side + guard de vagas no cliente, exatamente como o detalhe faz hoje (o `BotoesSelf` também não desabilita por prazo — não inventar regra nova).
- `tsc -b`/build sem referência quebrada (`ocupadas` saiu da interface).
- Commit: "resumo: Painel da Semana com confirmação em 1 toque na home (E2)".

### Passo 3 — CTA "Votar no Craque" quando há votação aberta · 1 commit

- **`src/routes/Resumo.tsx`** — no `buscar` (`:44-61`), derivar `votacaoAbertaPendente` reusando `carregarPartidasComVotacaoAberta()` (`lib/partidas.ts:239`, já criada pelo plano 07) + `carregarPartidasVotadas(jogadorId, ids)` — a mesma composição do `verificar` do `BannerLembrete.tsx:27-54` (o predicado `votacaoAberta` já vive dentro de `carregarPartidasComVotacaoAberta`, `lib/partidas.ts:249-250`), **sem** o polling/countdown (a home revalida no mount, no PTR e após qualquer `recarregar`; o banner global continua dono do tempo real). Condição: existe partida `published` com urna aberta que o jogador logado ainda não votou.
- Na renderização do painel: quando `votacaoAbertaPendente`, o CTA primário do painel vira **"Votar no Craque"** (link para `/partida/:id/votar`, alvo 44px, destaque âmbar padrão), mantendo o "Vou jogar" secundário abaixo quando aplicável — o painel **assume** o CTA de votação sem remover o de confirmação. Sem votação aberta (ou jogador já votou, ou deslogado), nada muda no Passo 2.
- **Complementar, não duplicar**: o `BannerLembrete` permanece intocado no `Layout.tsx:255` (tira global com countdown). O painel não repete countdown, não faz polling e não elimina o banner — é a versão acionável no contexto da home.
- Commit: "resumo: CTA Votar no Craque no Painel da Semana quando a urna está aberta (E2)".

Total: 3 commits, cada um reversível isoladamente; nenhum passo depende de plano externo (o 07, único pré-requisito, já foi executado).

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
- **Não extrair nem duplicar a query de votação aberta neste plano** (Passo 3 consome a função já criada pelo 07) nem criar função nova em `lib/` para o painel — ele consome só o que já existe.
- **Não implementar realtime** (segue o plano próprio `docs/plano-escolha-times-realtime.md`; proibido por este plano de origem), **não** criar nova chave de cache/invalidação (usa `recarregar` da chave existente), **não** mexer na RPC `confirmar_presenca` nem nos guards server-side.
- **Não** antecipar itens de E3 (retry/PTR nas telas de partida — plano 16) nem de E7 (haptics na TabBar etc.).
- **Não** criar testes automáticos (diretriz atual do AGENTS.md).

## 7. Riscos e rollback

- **Risco funcional: baixo** — o fluxo novo é aditivo; a RPC e os guards são os mesmos do detalhe, que permanece como fonte de verdade. Pontos de atenção:
  - **Estado defasado entre visitas**: o `useCache` serve dado stale na revisita; o painel pode mostrar um status antigo até a revalidação em background completar. Mitigação já prevista: revalidação obrigatória após confirmar (Passo 2.4) + PTR; aceito para leitura (o mesmo vale hoje para as vagas), nunca após uma ação do próprio jogador.
  - **Aninhamento link/botão**: o card era um `<Link>` único; virar contêiner com botão próprio exige cuidado de markup (nada de `<button>` dentro de `<a>`) e de alvo de toque (44px) — é exatamente o ponto a validar na aprovação visual do dono.
  - **Duplicação de lógica `atualizar`**: o painel replica ~20 linhas do padrão do detalhe em contexto diferente (estado local próprio). Extração prematura de hook/componente compartilhado seria abstração sem segundo consumidor real — documentar na review; se um terceiro consumo surgir, aí sim avaliar extração.
- **Risco de regressão**: a home de jogador deslogado e o detalhe da partida ficam intocados; o pior caso é o painel novo não renderizar botão (degrada para o card de hoje, que continua com o link).
- **Rollback**: cada passo é um commit isolado, reversível por `git revert` sem efeitos colaterais — Passo 1 é só propagação de dados; Passo 2 restaura o card-links com o revert; Passo 3 é aditivo sobre o Passo 2. Nenhuma migração, nenhum dado persistido novo, nenhuma mudança em `lib/` neste plano (a função do 07, já incorporada, tem rollback próprio).
