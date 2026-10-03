# 16 · E3 — Recuperação de erro e consistência de feedback nas telas de partida — Plano de Implementação

> Ref.: item **E3** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#16 (nota 2,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S–M · Risco: baixo · Prioridade global do plano: P1 (roadmap: Fase 4, item 2)

## 1. Objetivo

Dar saída de erro recuperável nas três telas de partida (Detalhe, Ao Vivo, Votar) — hoje uma mensagem morta sem retry — e garantir o haptic de sucesso (`vibrateSuccess`) no fluxo de partida, hoje limitado ao gol (`vibrateGoal`) e às confirmações de presença. É um item de **composição de primitivas existentes** (`Estado`, `PullToRefresh`, `haptics`): adiciona comportamento, quase não remove duplicação. O único efeito anti-slop, e preventivo, é a prop `acao` em `MensagemEstado` — evita que retry seja reimplementado por tela no futuro.

## 2. Estado atual (evidências verificadas)

Evidências re-mediadas no código em 2026-10-03 (após a execução dos planos Tier 1–2):

- **`src/components/Estado.tsx:68-89`** — `MensagemEstado` aceita apenas `children`, `tipo`, `className`, `icone` (`Estado.tsx:49-54`). Sem prop de ação; erro de carregamento é beco sem saída para o usuário.
- **PullToRefresh presente só em 7 rotas** (grep confirmado): `Resumo.tsx:133`, `Jogos.tsx:75`, `Ranking.tsx:171`, `Estatisticas.tsx:133`, `EstatisticasRacha.tsx:116`, `Comparador.tsx:193`, `Administrador.tsx:191`. **Ausente** em `PartidaDetalhe.tsx`, `PartidaAoVivo.tsx`, `PartidaVotar.tsx`.
- **Detalhe importante, não registrado no plano de origem**: as 7 rotas atuais passam `onRefresh={recarregar}` do `useCache`, que **nunca rejeita** (erros viram estado `erro` do hook). Já as telas de partida carregam **direto da rede** via `lib/partidas` (sem `useCache`), com comportamentos distintos: o `carregar` de `PartidaDetalhe.tsx:57-114` e o de `PartidaVotar.tsx:83-198` **capturam o erro internamente** (`try/catch` + `setErro`, sem rethrow — nunca rejeitam); só o `recarregar` de `PartidaAoVivo.tsx:63-73` **rejeita** em falha. E `PullToRefresh.tsx:102-104` faz `try { await onRefresh(); } finally { … }` **sem `catch`** — rejeição viraria unhandled rejection. Logo, só o AoVivo precisa de wrapper com `try/catch`; Detalhe e Votar podem passar o `carregar` direto.
- **`src/routes/PartidaAoVivo.tsx:91-97`** — polling de 10s quando `partida.status === 'live'`, chamando o mesmo `recarregar` (`:63-73`) com `.catch(() => {})`. Um pull simultâneo dispararia segunda instância concorrente do `recarregar` (risco de escrita fora de ordem nos estados).
- **Erros de carga em tela cheia, sem retry**: `PartidaDetalhe.tsx:148-153` (carga via `carregar` `useCallback` `:57-114` + `useEffect` `:137-143`), `PartidaAoVivo.tsx:110-116` (carga no `useEffect` `:75-89`) e `PartidaVotar.tsx:207-208` (carga no `useEffect` `:81-203`, com a função `carregar` **local ao efeito** — o retry exigirá extraí-la).
- **`src/routes/PartidaNova.tsx:204-206`** — erro de criação renderizado **no topo** da página (`{(erroCarregamento ?? erro) && <MensagemEstado>…</MensagemEstado>}`), enquanto o dedo do usuário está na `BarraAcaoInferior` (`:272-284`), fora do campo de visão.
- **Sucesso sem haptic no fluxo de partida**: `PartidaVotar.tsx:41,376` usa estado local `feedback` + `MensagemEstado tipo="sucesso"` **sem haptic** — e, desde a execução dos Tier 1–2, **já é efêmero**: a tela navega 800ms após aceitar os votos (`setFeedback` `:268`, `setTimeout(navigate)` `:272-275`, limpeza do timer `:45-53`). `PartidaEditar.tsx:331-332` segue o padrão (persistente). Enquanto isso `useSnackbar.ts:49-53` já dispara `vibrateSuccess`/`vibrateError` automaticamente, e `ConfirmacoesPartida.tsx:203` vibra no "Vou jogar". Gol já tem haptic próprio (`DialogoEvento.tsx:50`, `vibrateGoal`) — não tocar. Finalizar partida (`PartidaAoVivo.tsx:212-236`) só navega, sem vibração.
- **`src/lib/haptics.ts:26-28`** — `vibrateSuccess()` ([30, 40, 30]) já existe e é consumido em 5+ arquivos.

## 3. Pré-condições e dependências

- **Nenhuma dependência de outros planos do ranking** — todas as primitivas já existem. (D1, se executado antes, não altera nada aqui: as telas de partida já fazem `invalidarCache` manual nos pontos certos.)
- **Janela de execução: fora de período de partidas ao vivo do racha** (roadmap Fase 4 já condiciona). O passo 2 toca a tela usada pelo administrador em campo; validar com partida de teste, nunca numa partida real.
- Sem decisão de dono pendente — nada de UI nova além do botão de retry dentro do padrão visual existente.

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Prop `acao` em `MensagemEstado` + retry nas 3 telas de partida

- **Arquivo**: `src/components/Estado.tsx`.
- **Assinatura proposta** (seguir nomenclatura pt-BR do arquivo: `tipo`, `icone`):

  ```ts
  export interface MensagemEstadoProps {
    children: ReactNode;
    tipo?: TipoMensagemEstado;
    className?: string;
    icone?: ReactNode;
    acao?: { rotulo: string; aoClicar: () => void };
  }
  ```

- Renderizar, quando `acao` presente, um `<button type="button">` inline à direita do texto com as classes de botão secundário já usadas no app (`min-h-[44px]`, borda/cor herdadas do `tipo`, padrão dos botões "Editar"/"Desfazer" de `PartidaAoVivo.tsx:347-360`). Sem novo componente, sem ícone novo.
- **Migração dos call sites** (os 3 erros de carga em tela cheia; nos casos Detalhe/AoVivo a mensagem também cobre "Partida não encontrada." com `tipo="info"` — passar `acao` apenas quando houver `erro`):
  - `PartidaDetalhe.tsx:148-153` → `acao={erro ? { rotulo: 'Tentar novamente', aoClicar: () => carregar() } : undefined}` (o `carregar` `useCallback` de `:57-114` já existe; no retry manual a rota está montada, então chamar sem a flag `isAtivo` do `useEffect` `:137-143` é seguro).
  - `PartidaAoVivo.tsx:110-116` → `acao={{ rotulo: 'Tentar novamente', aoClicar: tentarNovamente }}`, com `tentarNovamente` async envolvendo `recarregar` (`:63-73`, que rejeita) em `try/catch` que re-seta `erro` — mesmo padrão do `useEffect` de `:75-89`.
  - `PartidaVotar.tsx:207-208` → análogo, mas exige extração: a função `carregar` é local ao `useEffect` (`:81-203`). Extraí-la para `useCallback` no escopo do componente, com a flag `ativo` via parâmetro opcional (mesmo mecanismo de `PartidaDetalhe.tsx:57-114,137-143`) e `aoClicar: () => carregar()`. O retry reexecuta a carga; para erros de regra (votação fechada, goleiro), a reexecução apenas re-exibe a mesma mensagem — inofensivo.
- Fora do escopo do passo: não adicionar `acao` em nenhum outro `MensagemEstado` do app.

### Passo 2 — `PullToRefresh` nas 3 telas de partida

- **Arquivos**: `PartidaDetalhe.tsx`, `PartidaAoVivo.tsx`, `PartidaVotar.tsx`.
- Envolver o conteúdo principal no `PullToRefresh` existente, padrão idêntico às 7 rotas atuais (`<PullToRefresh onRefresh={…}>`).
- **Revalidação sem `useCache` (documentado porque diverge das rotas atuais)**:
  - `PartidaDetalhe.tsx` e `PartidaVotar.tsx`: `onRefresh={() => carregar()}` direto — o `carregar` já captura o erro internamente (`setErro`), nunca rejeita, e a falha cai na mensagem tela cheia com a `acao` do passo 1. Sem wrapper.
  - `PartidaAoVivo.tsx`: o `recarregar` (`:63-73`) rejeita e `PullToRefresh.tsx:102-104` não tem `catch`; criar wrapper local:

    ```ts
    async function aoPuxar() {
      try {
        await recarregar();
        setErro(null);
      } catch (e: unknown) {
        setErro(formatarMensagemErro(e, 'Não foi possível atualizar.'));
      }
    }
    ```

    A falha de pull reaproveita o estado `erro` existente — exibida inline (`:369`) quando a partida já está carregada; um novo pull (ou o polling, se `live`) cobre a revalidação.
- **Pull vs polling no AoVivo (`:91-97`)**: durante `status === 'live'`, o pull e o `setInterval` de 10s chamam o mesmo `recarregar`. Serializar com uma ref local `recarregandoRef` (compartilhada por polling e pull): se já há recarga em voo, o pull retorna imediatamente — o polling de 10s já garantirá o dado fresco, então pular a batida é inofensivo. Fora de `live` não há polling e o risco não existe. **Não** mexer no intervalo nem no `recarregar` em si.
- Ordem de execução dentro do passo: `PartidaDetalhe` → `PartidaVotar` → `PartidaAoVivo` (o último, por causa do polling e do wrapper, é o único com risco real; se algo escapar na validação, revertê-lo isoladamente não perde os outros dois).

### Passo 3 — Haptic de sucesso padronizado (`vibrateSuccess`)

- **Arquivos**: `PartidaVotar.tsx`, `PartidaAoVivo.tsx`.
- `PartidaVotar.tsx`: o sucesso já é efêmero por navegação (800ms, `:272-275`), então **não** há troca por `Snackbar` — ele desmontaria junto com a rota antes de completar. Adicionar apenas `vibrateSuccess()` imediatamente após aceitar os votos (junto ao `setFeedback` de `:268`, antes do `setTimeout` de navegação), mesmo padrão do "Vou jogar" em `ConfirmacoesPartida.tsx:203`. O estado `feedback` e a mensagem verde permanecem como estão.
- `PartidaAoVivo.tsx:212-236` (`confirmarFinalizar`): a tela navega ao finalizar, logo **não** há Snackbar (desmontaria com a rota); adicionar apenas `vibrateSuccess()` imediatamente antes do `navigate` de `:229`. Feedback de sucesso continua sendo a própria navegação para a súmula publicada.
- Não tocar em: `DialogoEvento` (gol tem `vibrateGoal` próprio), `ConfirmacoesPartida` (já vibra), `Snackbar`/`useSnackbar` (já vibram por conta própria) nem nos sucessos de telas fora do fluxo de partida (Perfil, NovoJogador, GestaoJogadores, PartidaEditar — este último fica registrado como candidato futuro, mesmo padrão, se o dono quiser).

### Passo 4 — Erro de `PartidaNova` junto da barra de ação

- **Arquivo**: `src/routes/PartidaNova.tsx`.
- Mover o bloco de erro da posição atual (**`:204-206`**, topo da página) para imediatamente **acima** da `BarraAcaoInferior` (**`:272`**), dentro do fluxo do formulário — onde o dedo está ao tocar o botão.
- O bloco atual combina `{(erroCarregamento ?? erro) && …}` — mover **o bloco inteiro** (opção mais simples): o erro de carga do elenco (`erroCarregamento`) também passa a aparecer junto à barra; nesse cenário a página fica curta (sem elenco), então o erro continua visível sem rolar.
- Mesmo estado, mesmo componente, só reposição de bloco. (A `acao` do passo 1 aqui é dispensável: o botão da própria barra é o retry.)

## 5. Validação manual

Checklist no aparelho/build (sem testes automáticos, conforme AGENTS.md), com partida **de teste**:

- **Passo 1**: com DevTools offline, abrir `/partida/:id` (Detalhe, Ao Vivo, Votar) → erro aparece com botão "Tentar novamente"; voltar online e tocar → tela carrega, erro some. Em telas de outras rotas, `MensagemEstado` continua idêntico (sem botão).
- **Passo 2**: puxar para atualizar em cada uma das 3 telas → indicador aparece, dado revalida (alterar um dado no Supabase e conferir). Offline + pull → mensagem de erro (tela cheia com retry no Detalhe/Votar; inline no AoVivo), **sem erro de console** (unhandled rejection). No AoVivo com partida de teste `live`: deixar o polling rodar e puxar várias vezes durante e entre batidas → placar consistente, sem "piscar" para dado antigo.
- **Passo 3**: enviar votos em `PartidaVotar` → vibração no aceite + mensagem de sucesso + navegação automática após 800ms (comportamento de navegação inalterado). Finalizar partida de teste no AoVivo → vibração + navegação para a súmula. Registrar gol → `vibrateGoal` inalterado.
- **Passo 4**: forçar erro na criação (ex.: `criar_partida` com data inválida via rede bloqueada) → mensagem visível **sem rolar**, junto ao botão da `BarraAcaoInferior`.
- Regressão geral: puxar para atualizar nas 7 rotas que já têm PTR (comportamento inalterado); haptics e Snackbar das demais telas inalterados.

## 6. Fora de escopo

- Não migrar para `Snackbar` o sucesso de `PartidaVotar` (a navegação em 800ms desmontaria o Snackbar antes de completar) nem os demais `MensagemEstado tipo="sucesso"` do app (Perfil, NovoJogador, GestaoJogadores, EscalacaoTimesEditor, PartidaEditar) — padronização ampla é migração cosmética; registrar como débito se o dono quiser.
- Não criar skeleton dedicado nem ajustar o texto do banner offline (pertencem ao E7).
- Não migrar as telas de partida para `useCache` (é o D2/D5, com desenho de invalidação próprio).
- Não adicionar `acao`/retry em erros de mutação que já têm tratamento adequado (Snackbar no AoVivo, ConfirmDialog etc.) — só nos erros de **carga** em tela cheia.
- Não alterar `PullToRefresh.tsx` (nem adicionar `catch` genérico nele — o contrato atual, `onRefresh` não rejeita, está correto e documentado).
- Não tocar em `SeletorNota`, `DialogoEvento` ou fluxo de haptics de gol.

## 7. Riscos e rollback

| Risco | Mitigação | Rollback |
|---|---|---|
| **Pull vs polling no AoVivo** — pull e `setInterval` de 10s disparam `recarregar` concorrentes; escrita fora de ordem exibiria placar momentaneamente obsoleto. | Ref `recarregandoRef` serializando (passo 2): pull em voo é ignorado, polling cobre a atualização. Partida de teste `live` antes de valer em produção. | `git revert` do commit do passo 2 restrito a `PartidaAoVivo.tsx` (commit separado por tela, se preferir). |
| **PTR em tela que carrega da rede** — `onRefresh` rejeitando vira unhandled rejection e indicador "solto". | Detalhe/Votar passam `carregar` direto (nunca rejeita); AoVivo usa wrapper com `try/catch` + `setErro` (passo 2), alinhado ao contrato de fato do componente (`onRefresh` não rejeita). | Revert do passo 2; telas voltam ao estado sem PTR, sem dependência entre telas. |
| **Erro movido em `PartidaNova` quebra layout do formulário** | Só reposição de bloco, sem mudar estado nem estilos; validar com erro forçado. | Revert do passo 4 (commit de bloco movido). |

Todos os passos são commits independentes e revertíveis isoladamente por `git revert`; a ordem 1→2→3→4 é recomendada (2 reaproveita o caminho de erro com `acao` do 1 no Detalhe e no Votar; 3 e 4 são independentes entre si).
