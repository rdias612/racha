# 16 · E3 — Recuperação de erro e consistência de feedback nas telas de partida — Plano de Implementação

> Ref.: item **E3** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#16 (nota 2,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S–M · Risco: baixo · Prioridade global do plano: P1 (roadmap: Fase 4, item 2)

## 1. Objetivo

Dar saída de erro recuperável nas três telas de partida (Detalhe, Ao Vivo, Votar) — hoje uma mensagem morta sem retry — e alinhar o feedback de sucesso do fluxo de partida ao padrão já consagrado (`Snackbar` via `useSnackbar` + `vibrateSuccess`). É um item de **composição de primitivas existentes** (`Estado`, `PullToRefresh`, `haptics`, `useSnackbar`): adiciona comportamento, quase não remove duplicação. O único efeito anti-slop, e preventivo, é a prop `acao` em `MensagemEstado` — evita que retry seja reimplementado por tela no futuro.

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em 2026-09-30 (divergências dos docs de origem corrigidas):

- **`src/components/Estado.tsx:68-89`** — `MensagemEstado` aceita apenas `children`, `tipo`, `className`, `icone` (`Estado.tsx:49-54`). Sem prop de ação; erro de carregamento é beco sem saída para o usuário.
- **PullToRefresh presente só em 7 rotas** (grep confirmado): `Resumo.tsx:120`, `Jogos.tsx:107`, `Ranking.tsx`, `Estatisticas.tsx`, `EstatisticasRacha.tsx`, `Comparador.tsx`, `Administrador.tsx`. **Ausente** em `PartidaDetalhe.tsx`, `PartidaAoVivo.tsx`, `PartidaVotar.tsx`.
- **Detalhe importante, não registrado no plano de origem**: as 7 rotas atuais passam `onRefresh={recarregar}` do `useCache`, que **nunca rejeita** (erros viram estado `erro` do hook). Já as telas de partida carregam **direto da rede** via `lib/partidas` (sem `useCache`) e seus `recarregar`/`carregar` **rejeitam** em falha. E `PullToRefresh.tsx:102-104` faz `try { await onRefresh(); } finally { … }` **sem `catch`** — rejeição viraria unhandled rejection. Logo, o `onRefresh` das telas de partida precisa capturar o erro internamente.
- **`src/routes/PartidaAoVivo.tsx:90-96`** — polling de 10s quando `partida.status === 'live'`, chamando o mesmo `recarregar` (`:62-72`) com `.catch(() => {})`. Um pull simultâneo dispararia segunda instância concorrente do `recarregar` (risco de escrita fora de ordem nos estados).
- **`src/routes/PartidaVotar.tsx:92,203-204`** — carrega da rede (`carregarPartida`); erro de carga renderiza `MensagemEstado` em tela cheia **sem retry**. `PartidaDetalhe.tsx:53-127,134` — mesmo padrão (`carregar` via `useCallback` + `useEffect`, rede, erro sem ação). `PartidaAoVivo.tsx:109-115` — idem.
- **`src/routes/PartidaNova.tsx:197`** — erro de criação renderizado **no topo** da página (`{erro && <MensagemEstado>{erro}</MensagemEstado>}`), enquanto o dedo do usuário está na `BarraAcaoInferior` (`:263-279`), fora do campo de visão.
- **Sucesso inconsistente no fluxo de partida**: `PartidaVotar.tsx:37,366` usa estado local `feedback` + `MensagemEstado tipo="sucesso"` **persistente e sem haptic**; `PartidaEditar.tsx:333` segue o mesmo padrão. Enquanto isso `useSnackbar.ts:48-51` já dispara `vibrateSuccess`/`vibrateError` automaticamente, e `ConfirmacoesPartida.tsx:184` vibra no "Vou jogar". Gol já tem haptic próprio (`DialogoEvento.tsx:55`, `vibrateGoal`) — não tocar. Finalizar partida (`PartidaAoVivo.tsx:212-237`) só navega, sem vibração.
- **`src/lib/haptics.ts`** — `vibrateSuccess()` ([30, 40, 30]) já existe e é consumido em 5+ arquivos.

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

- Renderizar, quando `acao` presente, um `<button type="button">` inline à direita do texto com as classes de botão secundário já usadas no app (`min-h-[44px]`, borda/cor herdadas do `tipo`, padrão dos botões "Editar"/"Desfazer" de `PartidaAoVivo.tsx:346-360`). Sem novo componente, sem ícone novo.
- **Migração dos call sites** (os 3 erros de carga em tela cheia, todos já têm callback de recarga):
  - `PartidaDetalhe.tsx:134` → `acao={{ rotulo: 'Tentar novamente', aoClicar: () => carregar(() => ativo) }}` (reusar o mecanismo de cancelamento já existente em `:53-127`).
  - `PartidaAoVivo.tsx:111` → `acao={{ rotulo: 'Tentar novamente', aoClicar: recarregar }}` com `try/catch` que re-seta `erro` (mesmo padrão do `useEffect` de `:74-88`).
  - `PartidaVotar.tsx:204` → análogo, apontando para o `useEffect` de carga existente.
- Fora do escopo do passo: não adicionar `acao` em nenhum outro `MensagemEstado` do app.

### Passo 2 — `PullToRefresh` nas 3 telas de partida

- **Arquivos**: `PartidaDetalhe.tsx`, `PartidaAoVivo.tsx`, `PartidaVotar.tsx`.
- Envolver o conteúdo principal no `PullToRefresh` existente, padrão idêntico às 7 rotas atuais (`<PullToRefresh onRefresh={…}>`).
- **Revalidação sem `useCache` (documentado porque diverge das rotas atuais)**: o `onRefresh` **não** pode ser o `recarregar`/`carregar` puro — ele rejeita e `PullToRefresh.tsx:102-104` não tem `catch`. Criar wrapper local por tela:

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

  Ou seja: falha de pull vira `MensagemEstado` com a `acao` do passo 1 — o mesmo caminho de erro de carga, sem novo estado.
- **Pull vs polling no AoVivo (`:90-96`)**: durante `status === 'live'`, o pull e o `setInterval` de 10s chamam o mesmo `recarregar`. Serializar com uma ref local `recarregandoRef` (compartilhada por polling e pull): se já há recarga em voo, o pull retorna imediatamente — o polling de 10s já garantirá o dado fresco, então pular a batida é inofensivo. Fora de `live` não há polling e o risco não existe. **Não** mexer no intervalo nem no `recarregar` em si.
- Ordem de execução dentro do passo: `PartidaDetalhe` → `PartidaVotar` → `PartidaAoVivo` (o último, por causa do polling, é o único com risco real; se algo escapar na validação, revertê-lo isoladamente não perde os outros dois).

### Passo 3 — Sucesso padronizado em `Snackbar` + `vibrateSuccess`

- **Arquivos**: `PartidaVotar.tsx`, `PartidaAoVivo.tsx`.
- `PartidaVotar.tsx`: trocar o par estado `feedback` + `MensagemEstado tipo="sucesso"` (`:37,366`) por `useSnackbar().mostrarSucesso(…)` + `<Snackbar {...snackbarProps} />` — `useSnackbar` já dispara `vibrateSuccess` (`useSnackbar.ts:48-51`), então o haptic vem de graça. Remover o estado `feedback` se sobrar sem uso.
- `PartidaAoVivo.tsx:212-237` (`confirmarFinalizar`): a tela navega ao finalizar, logo **não** há Snackbar (desmontaria com a rota); adicionar apenas `vibrateSuccess()` imediatamente antes do `navigate` de `:230`. Feedback de sucesso continua sendo a própria navegação para a súmula publicada.
- Não tocar em: `DialogoEvento` (gol tem `vibrateGoal` próprio), `ConfirmacoesPartida` (já vibra), nem nos sucessos de telas fora do fluxo de partida (Perfil, NovoJogador, GestaoJogadores, PartidaEditar — este último fica registrado como candidato futuro, mesmo padrão, se o dono quiser).

### Passo 4 — Erro de `PartidaNova` junto da barra de ação

- **Arquivo**: `src/routes/PartidaNova.tsx`.
- Mover o bloco `{erro && <MensagemEstado>{erro}</MensagemEstado>}` da posição atual (**linha 197**, topo da página) para imediatamente **acima** da `BarraAcaoInferior` (**linha 263**), dentro do fluxo do formulário — onde o dedo está ao tocar "Criar partida".
- Nenhuma mudança de comportamento: mesmo estado `erro`, mesmo componente, só reposição. (A `acao` do passo 1 aqui é dispensável: o botão da própria barra é o retry.)

## 5. Validação manual

Checklist no aparelho/build (sem testes automáticos, conforme AGENTS.md), com partida **de teste**:

- **Passo 1**: com DevTools offline, abrir `/partida/:id` (Detalhe, Ao Vivo, Votar) → erro aparece com botão "Tentar novamente"; voltar online e tocar → tela carrega, erro some. Em telas de outras rotas, `MensagemEstado` continua idêntico (sem botão).
- **Passo 2**: puxar para atualizar em cada uma das 3 telas → indicador aparece, dado revalida (alterar um dado no Supabase e conferir). Offline + pull → mensagem de erro com retry, **sem erro de console** (unhandled rejection). No AoVivo com partida de teste `live`: deixar o polling rodar e puxar várias vezes durante e entre batidas → placar consistente, sem "piscar" para dado antigo.
- **Passo 3**: enviar votos em `PartidaVotar` → Snackbar de sucesso + vibração (não mais mensagem verde persistente). Finalizar partida de teste no AoVivo → vibração + navegação para a súmula. Registrar gol → `vibrateGoal` inalterado.
- **Passo 4**: forçar erro na criação (ex.: `criar_partida` com data inválida via rede bloqueada) → mensagem visível **sem rolar**, junto ao botão da `BarraAcaoInferior`.
- Regressão geral: puxar para atualizar nas 7 rotas que já têm PTR (comportamento inalterado); haptics e Snackbar das demais telas inalterados.

## 6. Fora de escopo

- Não migrar os demais `MensagemEstado tipo="sucesso"` do app (Perfil, NovoJogador, GestaoJogadores, EscalacaoTimesEditor, PartidaEditar) para Snackbar — padronização ampla é migração cosmética; registrar como débito se o dono quiser.
- Não criar skeleton dedicado nem ajustar o texto do banner offline (pertencem ao E7).
- Não migrar as telas de partida para `useCache` (é o D2/D5, com desenho de invalidação próprio).
- Não adicionar `acao`/retry em erros de mutação que já têm tratamento adequado (Snackbar no AoVivo, ConfirmDialog etc.) — só nos erros de **carga** em tela cheia.
- Não alterar `PullToRefresh.tsx` (nem adicionar `catch` genérico nele — o contrato atual, `onRefresh` não rejeita, está correto e documentado).
- Não tocar em `SeletorNota`, `DialogoEvento` ou fluxo de haptics de gol.

## 7. Riscos e rollback

| Risco | Mitigação | Rollback |
|---|---|---|
| **Pull vs polling no AoVivo** — pull e `setInterval` de 10s disparam `recarregar` concorrentes; escrita fora de ordem exibiria placar momentaneamente obsoleto. | Ref `recarregandoRef` serializando (passo 2): pull em voo é ignorado, polling cobre a atualização. Partida de teste `live` antes de valer em produção. | `git revert` do commit do passo 2 restrito a `PartidaAoVivo.tsx` (commit separado por tela, se preferir). |
| **PTR em tela que carrega da rede** — `onRefresh` rejeitando vira unhandled rejection e indicador "solto". | Wrapper com `try/catch` + `setErro` por tela (passo 2), alinhado ao contrato de fato do componente (`onRefresh` não rejeita). | Revert do passo 2; telas voltam ao estado sem PTR, sem dependência entre telas. |
| **Sucesso persistente vira efêmero** — quem não viu o Snackbar dos votos perde a confirmação. | O estado dos votos já é visível na própria cédula após envio (`votosEnviados`); Snackbar é confirmação, não registro. Validar em aparelho que o fluxo continua claro. | Revert do passo 3 restaura `MensagemEstado tipo="sucesso"`. |
| **Erro movido em `PartidaNova` quebra layout do formulário** | Só reposição de bloco, sem mudar estado nem estilos; validar com erro forçado. | Revert do passo 4 (commit de 1 linha movida). |

Todos os passos são commits independentes e revertíveis isoladamente por `git revert`; a ordem 1→2→3→4 é recomendada (2 depende da `acao` do 1 para o caminho de erro do pull; 3 e 4 são independentes entre si).
