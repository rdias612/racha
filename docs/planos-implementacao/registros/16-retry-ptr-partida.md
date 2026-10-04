# 16 · Recuperação de erro e feedback nas telas de partida — Registro de Execução e Validação

> Registro da execução do plano 16 em **04/10/2026**, na branch `main`. Veredito da auditoria: **aprovado**, sem achados Critical/Important — 1 Minor deferido com decisão registrada (seção 4). Ciclo executor → auditor fechado sem corretor.

## 1. Contexto

Item E3 do plano de melhorias PWA: retry nos 3 erros de carga em tela cheia, `PullToRefresh` nas 3 telas de partida, `vibrateSuccess` nos dois sucessos de navegação e erro de `PartidaNova` junto à `BarraAcaoInferior`. Composição de primitivas existentes (`MensagemEstado`, `PullToRefresh`, `lib/haptics`) — nenhuma primitiva foi alterada além da prop `acao` prevista. BASE: `95a12b6`. Janela respeitada: nada foi deployado; validação em partida de teste é do dono.

## 2. Execução (1 passo = 1 commit)

Scripts de `package.json` usados: `build` = `tsc -b && vite build`; `lint` = `tsc -b && eslint src public/sw.js`. Build e lint com exit 0 antes de cada commit (o executor também rodou `prettier --check` limpo nos arquivos tocados).

- **Passo 1 — retry** · commit `1a690eb` · `Adicionar retry nos erros de carga das telas de partida`
  - `src/components/Estado.tsx`: `MensagemEstadoProps` ganhou `acao?: { rotulo: string; aoClicar: () => void }` (`Estado.tsx:54`); botão `<button type="button">` inline à direita, `min-h-[44px]`, cor herdada do `tipo` via `border-current`/`text-current` sobre `ESTILOS_ESTADO` — abordagem mais simples e geral que copiar as classes dos botões "Editar"/"Desfazer", atendendo ao requisito de herança.
  - `PartidaDetalhe.tsx` / `PartidaAoVivo.tsx`: `acao` passada só quando `erro` ("Partida não encontrada." em `info` segue sem botão); AoVivo com `tentarNovamente` async (try/catch + `setErro`, pois `recarregar` rejeita).
  - `PartidaVotar.tsx`: `carregar` extraído do `useEffect` para `useCallback` no escopo do componente, flag `isAtivo?: () => boolean` opcional (mesmo mecanismo de `PartidaDetalhe`).
- **Passo 2 — PullToRefresh, 3 commits separados por tela** (opção prevista no plano, para revert isolado do AoVivo):
  - `bdb68bb` · `Adicionar PullToRefresh na tela PartidaDetalhe` — `onRefresh={() => carregar()}` direto (o `carregar` nunca rejeita).
  - `600b581` · `Adicionar PullToRefresh na tela PartidaVotar` — idem.
  - `f0e73f6` · `Adicionar PullToRefresh na tela PartidaAoVivo` — wrapper `aoPuxar` (try/catch + `setErro(formatarMensagemErro(e, 'Não foi possível atualizar.'))`) e ref `recarregandoRef` compartilhada entre polling (10s) e pull: o tick do polling e o pull checam a ref e pulam se há recarga em voo. Intervalo, condição `live` e `recarregar` inalterados. `PullToRefresh.tsx` intocado (sem `catch` genérico, conforme seção 6).
- **Passo 3 — haptics** · commit `6db4510` · `Vibrar sucesso ao aceitar votos e ao finalizar partida`
  - `vibrateSuccess()` de `lib/haptics.ts` em `PartidaVotar.tsx:281` (após `setFeedback`, antes do timer de navegação de 800ms) e `PartidaAoVivo.tsx:270` (`confirmarFinalizar`, antes do `navigate`). `DialogoEvento` (`vibrateGoal`), `ConfirmacoesPartida` e `useSnackbar` intocados.
- **Passo 4 — PartidaNova** · commit `b5090e0` · `Mover erro de PartidaNova para junto da barra de acao`
  - Bloco `{(erroCarregamento ?? erro) && …}` movido verbatim do topo para imediatamente antes da `BarraAcaoInferior` — mesmo estado, mesmo componente, diff de 4+/4-.

Superfície total: exatamente os 5 arquivos previstos (`Estado.tsx`, `PartidaDetalhe.tsx`, `PartidaAoVivo.tsx`, `PartidaVotar.tsx`, `PartidaNova.tsx`).

## 3. Auditoria

Auditor read-only com review package em `.superpowers/sdd/16-retry-ptr-partida/etapa-1-review-package.md`. **Veredito: aprovado.**

- Critérios de conclusão executáveis por máquina: PASS — build/lint exit 0; `acao` em `MensagemEstadoProps`; `vibrateSuccess` importado de `lib/haptics`; PTR nas 7 rotas originais + exatamente as 3 novas (grep confirmado).
- Fidelidade às seções 4/6/7: PASS — contrato de `onRefresh` sem rejeição respeitado nas 3 telas; seção 6 respeitada (nenhum `MensagemEstado` adicional com `acao`, `PullToRefresh.tsx` sem `catch`, `haptics.ts` intocado).
- Riscos da seção 7 (serialização pull×polling no AoVivo): ref setada só após o check e sempre resetada no `finally` nos dois caminhos; `Promise.all` sempre settle; ref morre no unmount. Unhandled rejection impossível (pull captura; polling mantém `.catch(() => {})`). `tentarNovamente` só é alcançável na tela de erro, onde não há polling nem PTR.
- Divergências do executor validadas como benignas e necessárias: ver seção 4, itens 1-2.
- Único achado: **Minor** (deferido, seção 4, item 3).

## 4. Divergências plano × código real / decisões

1. **Guard `isAtivo` antes de aplicar estados em `PartidaVotar.tsx:185`** — o código original aplicava `setPartida` e afins sem guard nesse ponto; o plano manda seguir o mecanismo de `PartidaDetalhe`, que guarda. Sem o guard, a extração para `useCallback` teria introduzido regressão (estados de carga obsoleta aplicados após desmonte). Aprovada pela auditoria.
2. **Guard da `recarregandoRef` dentro do callback do `setInterval` (`PartidaAoVivo.tsx:126-136`)** — necessária para a exclusão mútua que o plano pede: sem ela, uma batida do intervalo durante um pull resetaria a ref enquanto o pull ainda roda. Intervalo e `recarregar` intactos. Aprovada pela auditoria.
3. **Minor deferido — guards `isAtivo` seletivos nos branches de regra de `PartidaVotar` (`:117-147`)**: os branches `!eu`, goleiro, random e sem elegíveis aplicam estado sem guard próprio. Hoje é inofensivo (síncronos, precedidos pelo guard de `:114`); a inconsistência é **herdada do código original**, não introduzida por esta execução, e padronizá-la seria refatoração fora do escopo (AGENTS.md). Fica registrado como débito de higiene; se um `await` entrar nesse trecho no futuro, o guard ausente vira corrida latente.
4. Comportamento observado pelo executor (não é desvio): em Detalhe/Votar o pull chama `carregar()`, que seta `carregando(true)` — durante o refresh a tela mostra carregando em vez de manter o conteúdo. É o comportamento especificado pelo plano ("direto"); se incomodar, um parâmetro opcional em `carregar` resolveria. Registrado como observação, não alterado.

## 5. Observações operacionais

- **Push fora do processo (repetido)**: os 6 commits de execução (`1a690eb` → `b5090e0`) estão em `origin/main` — o executor fez push novamente apesar da regra "nunca push" (verificado com `git fetch` + `rev-parse`). Mesmo caso do plano 15 na mesma data. Nada a reverter (código já auditado), mas o descumprimento do fluxo fica registrado; o commit de documentação deste registro seguiu local.
- Arquivos de rascunho não rastreados que existiam na raiz (`.playwright-mcp/`, PNGs de protótipo) não fazem parte do escopo e não foram commitados.

## 6. Pendente de validação humana (dono)

Checklist da seção 5 do plano, com partida **de teste**:

- [ ] Passo 1: DevTools offline nas 3 telas → erro com botão "Tentar novamente"; voltar online e tocar → carrega. Demais telas sem botão.
- [ ] Passo 2: pull nas 3 telas revalida o dado; offline + pull sem unhandled rejection no console; no AoVivo com partida `live`, polling + pulls simultâneos → placar consistente, sem piscar para dado antigo.
- [ ] Passo 3: vibração no aceite dos votos (navegação 800ms inalterada) e ao finalizar; gol com `vibrateGoal` inalterado.
- [ ] Passo 4: forçar erro de criação → mensagem visível junto à `BarraAcaoInferior`, sem rolar.
- [ ] Regressão: PTR das 7 rotas existentes inalterado; haptics/Snackbar das demais telas inalterados.
