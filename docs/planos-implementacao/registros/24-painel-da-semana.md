# 24 · Painel da Semana — Registro de Execução e Validação

> Registro da execução do plano 24 em **04/10/2026**, na branch `main`. Veredito da auditoria: **aprovado com ressalvas** — 2 Important corrigidos em commit próprio (resiliência do override otimista e das queries da urna); 2 Minor deferidos. Ciclo executor → auditor → corretor fechado.

## 1. Contexto

Item E2: o card "PRÓXIMA QUINTA" da home virou Painel da Semana — estado do próprio jogador (Badge de status), vagas `x/14`, botão inline "Vou jogar" e CTA "Votar no Craque" quando há urna aberta pendente. **A decisão obrigatória de escopo/UI (seção 1/3) foi fechada pelo pedido de execução do dono.** Todo o trabalho em `src/routes/Resumo.tsx`; `ConfirmacoesPartida`, `BannerLembrete` e `lib/` intocados. BASE: `66dd6bb`.

## 2. Execução (1 passo = 1 commit)

Scripts: `build` = `tsc -b && vite build`; `lint` = `tsc -b && eslint src public/sw.js`. Exit 0 em todos os passos.

- **Passo 1 — dados** · commit `180b5d7` · `resumo: propaga participantes e prazo da próxima partida para o card (E2)`
  - `DadosResumo.proxima` expandido para `{ id, data_jogo, confirmacao_closes_at, participantes: Participante[] }` (novo tipo local `ProximaPartida`); `parts` guardado no `buscar` em vez de descartado; vagas derivadas na renderização com `vagasOcupadas(parts)`. Nenhuma query nova, chave de cache inalterada.
- **Passo 2 — painel** · commit `9a441b3` · `resumo: Painel da Semana com confirmação em 1 toque na home (E2)`
  - Card vira contêiner com `<Link>` no corpo (data + estado do jogador) e botão fora dele — **sem `<button>` dentro de `<a>`**. Badge `variante="status"` + `STATUS_CONFIRMACAO_LABEL`; texto próprio para não convocado; fallback deslogado igual ao texto antigo. Botão "Vou jogar" espelhando `BotoesSelf` (min 44px, `disabled={processando || !podeConfirmar(...)}`, `title="Vagas esgotadas"`). Confirmação self: `vibrateSuccess()` + override otimista local sem mutar o cache do `useCache` + rollback + `formatarMensagemErro` + `await recarregar()`. Linha de prazo via `formatarFechamento` igual ao detalhe; bloqueio de prazo permanece server-side.
- **Passo 3 — CTA de votação** · commit `a49ce72` · `resumo: CTA Votar no Craque no Painel da Semana quando a urna está aberta (E2)`
  - `votacaoAbertaPendente` derivado no `buscar` com a mesma composição do `verificar` do `BannerLembrete` (`carregarPartidasComVotacaoAberta()` + `carregarPartidasVotadas()`, predicado `!votadas.has`), sem polling/countdown. CTA primário âmbar para `/partida/:id/votar`, "Vou jogar" secundário. `BannerLembrete` no `Layout` intocado.
- **Correção de auditoria** · commit `c609934` · `Tornar painel da home resiliente a falha de revalidação e urna` — ver seção 4, itens 1-3.

Superfície total: só `src/routes/Resumo.tsx` (+171/−21 nos passos; +43/−21 na correção).

## 3. Auditoria

Auditor read-only com review package em `.superpowers/sdd/24-painel-da-semana/etapa-1-review-package.md`. **Veredito: aprovado com ressalvas** (2 Important, 3 Minor).

- Fidelidade aos 3 passos e à seção 6: PASS (sem polling novo — grep zero `setInterval`/realtime; sem função nova em `lib/`; sem chave de cache nova; `BannerLembrete`/`ConfirmacoesPartida` intocados).
- Análise própria: duplo toque não explorável (botão sai do DOM com o override); desmonte durante Promise inofensivo; `confirmacao_closes_at` nulo guardado; jogador sem participantes → "não convocado"; deslogado guardado no Passo 3.
- 2 Important (corrigidos) + 3 Minor (2 deferidos, 1 tratado junto da correção) — seção 4.

## 4. Divergências plano × código real / decisões

1. **Important corrigido — override descartado mesmo com revalidação falha** (`Resumo.tsx:331-336` original): se a RPC retornava `true` mas o `recarregar` falhava silenciosamente (o `useCache` engole o erro com dados em tela — `useCache.ts:166-178`), o `setStatusOtimista(null)` fazia o badge voltar ao status stale sem mensagem. Correção: o override passa a valer **até prova em contrário** — um `useEffect` limpa `statusOtimista` só quando os participantes vindos do servidor mostram o jogador confirmado; rollback por RPC `false`/exceção inalterado. Sem polling/timers.
2. **Important corrigido — queries da urna derrubavam a home**: awaits diretos no `buscar` rejeitavam o boletim inteiro (na 1ª visita, trocava a home por `MensagemEstado`). Correção: bloco da urna com try/catch interno degradando para `null` — mesmo tratamento do `BannerLembrete` (dado opcional não-bloqueante).
3. **Minor tratado junto** — queries da urna paralelizadas no `Promise.all` existente do `buscar` (`jogadorId` nos deps do `useCallback`), eliminando os awaits sequenciais.
4. **Divergências do executor deferidas pela auditoria**: imports postergados para o passo de consumo (evitar TS6133 no gate); `meuParticipante` derivado dentro do card (único consumidor, mais coeso); override `statusOtimista` em vez de cópia de `dados` (mais enxuto, `podeConfirmar` imune ao override); botão full-width e hover do link com `hover:opacity-85` (padrão do `BannerLembrete`) — layout reservado à aprovação do dono.
5. **Minor deferidos**: `prazoPassou` avaliado só no render (idêntico ao detalhe, sem timer — não é regressão); corrida teórica de override entre drafts (auto-corrige na revalidação obrigatória, improvável).

## 5. Observações operacionais

- Nenhum push nesta etapa: os commits dos planos 16-24 seguem locais, aguardando o dono.
- Um typo de import no Passo 3 (`carregarParticipantesComVotacaoAberta`) foi pego pelo tsc e corrigido antes do commit — nenhum commit com build quebrado.
- Débito informado (não corrigido): se o usuário sair da rota antes de qualquer revalidação bem-sucedida, o override persiste até o desmonte — inofensivo e dentro do padrão existente.

## 6. Pendente de validação humana (dono)

Checklist da seção 5 do plano, no dev/aparelho, fora de partida ao vivo:

- [ ] Os 4 estados do jogador (pendente com confirmação otimista + revalidação; confirmado sem botão; recusado com botão; não convocado sem botão) + deslogado (card de hoje).
- [ ] Guard de vaga com 14 confirmados ("Vagas esgotadas"); falha offline no toque (rollback + erro inline + vagas corretas pós-revalidação).
- [ ] Linha de prazo com `confirmacao_closes_at` definido.
- [ ] CTA "Votar no Craque": aparece com urna aberta e voto pendente; some após votar + PTR; **nenhum polling novo na home** (DevTools Network); conferir se CTA para partida diferente da "PRÓXIMA QUINTA" não confunde.
- [ ] Link do corpo do card abre `/partida/:id`; PTR revalida o painel.
- [ ] Aceite visual do layout (botão full-width, hover `opacity-85`, referência Draft 1 do Superdesign).
