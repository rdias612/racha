# 02 · Extrair `Botao` com variantes e adotar em todo o app — Plano de Implementação

> Ref.: item **A2** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#2 (nota 9,0)**, Tier 1 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: L · Risco: médio · Prioridade global do plano: P1
> **Revisão 2 (2026-09-30)**: Opção A confirmada pelo dono; a migração oportunista (antigo passo 6, sem prazo) foi promovida a ondas nominais que cobrem todo o app.

## ⚠️ Decisões já tomadas (registradas, não reabrir durante a execução)

- **Opção A — componente `Botao`**: `src/components/ui/Botao.tsx` encapsula a assinatura visual e o elemento `<button>`. A alternativa de só exportar constantes de classe (Opção B, estilo `VARIANTE_CLASSES` do `Badge.tsx:56-63`) foi rejeitada: resolvia o drift visual mas mantinha o boilerplate estrutural e os 7 blocos de JSX repetidos.
- **Adoção em todo o projeto**: a migração não é mais oportunista. Este plano termina quando todos os `<button>` do app que se encaixam nas 3 variantes usam `<Botao>` (ver critério de encaixe no §3 e auditoria final no §4). Botões fora das variantes ficam como `<button>` cru e catalogados — ver §6.
- **Debate em aberto (não bloqueia este plano)**: os botões que não se encaixam nas 3 variantes (ícone quadrado, item de lista de seleção, chip X, botão-link) podem virar componentes próprios no futuro. Nada é criado sem decisão nova do dono.

## 1. Objetivo

Eliminar a maior duplicação do app em volume — **131 `<button>` estilizados à mão** (confirmado: 39 em `src/routes/`, 92 em `src/components/`) — e fazer do componente `Botao` o padrão de facto para todo botão de ação do app. A fórmula do primário âmbar está colada em ~29 usos (25 `<button>` de 21 arquivos + 4 CTAs-Link) e o drift visual já está instalado (`disabled:opacity-40` vs `-50`, `shadow-carimbo` vs `-destaque` vs `shadow-xs`, `font-bold` vs `font-black`, `rounded-[3px]` vs `rounded-[4px]`). A extração cria um ponto único para a assinatura visual: alvo de 44px, foco âmbar e `disabled` viram invariantes gratuitos, e cada botão futuro nasce correto sem ler DESIGN.md.

Ao final deste plano, sobrevivem como `<button>` cru apenas os botões fora das 3 variantes (catalogados no §6 e na auditoria final) e os do `DialogoEvento.tsx` (escopo do plano 08).

## 2. Estado atual (evidências verificadas)

Conferidas no código em 2026-09-30. Números corrigidos em relação ao doc de origem estão marcados com **(corrigido)**.

- **Volume**: 131 `<button>` estilizados à mão em 52 arquivos (39 em `src/routes/`, 92 em `src/components/`, incluindo os 6 do `DialogoEvento.tsx` que ficam fora deste plano) — recontado, bate com o plano.
- **Fórmula do primário âmbar** (`border-destaque bg-destaque text-destaque-tinta ... active:translate-y-px`): `Jogos.tsx:121-127` ("Nova partida", CTA-Link) e `PartidaDetalhe.tsx:272-277` **(corrigido; o doc de origem dizia 273-275)** ("Editar votos", CTA-Link). ~29 usos no total.
- **Par cancelar/confirmar duplicado**:
  - `ConfirmDialog.tsx:67-86` — cancelar com `shadow-carimbo`, confirmar âmbar com `font-black` + `shadow-carimbo-destaque` e `transition-fast` (drift intra-arquivo).
  - `ModalFiltrosRanking.tsx:90-112` **(corrigido; origem dizia 90-113)** — rodapé "Limpar"/"Aplicar Filtros": Limpar com `shadow-xs`, Aplicar com `font-black` + `shadow-carimbo-destaque`.
  - `FormLancamentoFinanceiro.tsx:221-236` — submit que muda de variante por natureza (`perigo`/`primario`), com `disabled:opacity-50`.
- **Rodapés "Fechar"/"Cancelar" de modal** (4 cópias quase iguais):
  - `ModalSelecionarOpcao.tsx:50-58` — Fechar, `shadow-xs`.
  - `ModalSelecionarGoleiro.tsx:67-75` — Fechar, `shadow-xs` (idêntico ao anterior, sem o `cursor-pointer`).
  - `ModalEscalarJogador.tsx:52-62` — Fechar com `rounded-[3px]`, **sem** `shadow` e sem `bg` (drift de forma).
  - `ModalSelecionarAgendamento.tsx:68-84` **(corrigido; origem citava 78-82, que é só o Cancelar)** — par Confirmar (`shadow-carimbo`, `font-bold`) / Cancelar (`shadow-xs`).
- **Drift `disabled:opacity`**: 16 usos de `disabled:opacity-40` (ex.: `DueloCard.tsx:29`, `PartidaVotar.tsx:372`, `DialogoEvento.tsx:130,142,173,190`, `ConfirmacoesPartida.tsx:38`) vs **20 usos** de `disabled:opacity-50` (ex.: `FormLancamentoFinanceiro.tsx:224`, `BotaoInstalar.tsx:48`, `CardNotificacoes.tsx:132`) — recontado, é pior do que os exemplos isolados do plano.
- **Drift de sombra no mesmo papel**: `shadow-carimbo` (fórmula majoritária do primário) vs `shadow-carimbo-destaque` (4 arquivos: `ConfirmDialog`, `ModalFiltrosRanking`, `BotaoInstalar`, `CardNotificacoes`) vs `shadow-xs` (rodapés secundários).
- **Drift de raio**: `rounded-[4px]` (majoritário) vs `rounded-[3px]` (`Jogos.tsx:123`, `ModalEscalarJogador.tsx:56`, `BarraRascunhoGestao.tsx:37,47`, `EscalacaoTimesEditor.tsx:255`).
- **Padrão de referência no repo**: `VARIANTE_CLASSES: Record<BadgeVariante, string>` em `Badge.tsx:56-63` — referência de estilo, não o modelo adotado (Opção A venceu).
- **Pasta `ui/` ainda não existe** — será criada pelo plano 17 (`pasta-ui.md`), junto do primeiro componente novo.

## 3. Pré-condições e dependências

- **Plano 17 · A9 · Pasta `ui/`** (item #17 do ranking): executar no mesmo commit do passo 1 — o `Botao.tsx` nasce direto em `src/components/ui/`. Se a pasta `ui/` for rejeitada, o componente nasce em `src/components/` e o resto do plano não muda.
- **Assinatura visual canônica** a adotar (forma majoritária do código hoje, para minimizar diffs visuais):
  `min-h-[44px]` (alvo de toque) · `rounded-[4px]` · `font-display font-bold uppercase tracking-wider text-xs` (sem `font-black`) · `inline-flex items-center justify-center gap-1.5` · `transition active:translate-y-px` · `disabled:opacity-50 disabled:cursor-not-allowed` (forma majoritária: 20 vs 16) · foco `focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2`.
  Variantes: `primario` = `border-destaque bg-destaque text-destaque-tinta shadow-carimbo hover:brightness-105` · `secundario` = `border-borda bg-superficie-2 text-giz shadow-xs hover:bg-superficie` · `perigo` = `border-perigo bg-perigo text-branco-time shadow-carimbo hover:brightness-110`.
  Call sites que divergem dessa canônica (ex.: `font-black`, `shadow-carimbo-destaque`) aceitam o ajuste visual mínimo ao migrar — validar em tela (§5).
- **Critério de encaixe** (regra objetiva para as ondas — decide o que migra e o que fica cru):
  - **Migra**: `<button>` de ação com rótulo textual (ícone opcional como children) e papel de confirmar/ação principal, cancelar/fechar/ação secundária ou ação destrutiva, com altura ≥ 44px.
  - **Fica cru** (catalogado no §6 e na auditoria): botão-ícone quadrado puro; item de seleção de lista (48px, estado selecionado, sublabel); X de chip; botão-link sublinhado; células de hora/minuto; qualquer botão cujo papel não seja um dos três e que exija escape de cor/sombra/papel.
- **Regra do escape `className`**: o `className` do chamador entra por último e só pode variar **layout/dimensão** (`flex-1`, `w-`/`px-` pontuais). Se precisar mudar cor, borda, sombra ou papel, o botão não encaixa — fica cru, e caso haja repetição real é sinal de variante/componente novo a discutir com o dono (não de escape criativo).
- **Restrição de janela**: a onda 4 (`PartidaAoVivo.tsx`) não pode ser executada nem validada em dia/horário de rodada (quintas à noite); `DialogoEvento.tsx` fica explicitamente fora deste plano (escopo do plano 08 · A5) — seus botões migram lá.
- **Convenção de nomenclatura** (consolidada no plano 14 · A4): props de dado em pt-BR, handlers `ao*`, APIs nativas do DOM em inglês (`disabled`, `type`, `onClick` via spread).

## 4. Plano de execução (1 passo = 1 commit)

Cada passo é independente, revertível por `git revert` isolado e deixa o build funcionando. Ondas podem ser fatiadas em mais commits (por arquivo, se ficar grande), mas **nunca fundidas entre si**. Sem big-bang: os passos 1–5 cobrem os 7 blocos duplicados; os passos 6–12 varrem o resto do app por área; o passo 13 fecha com auditoria.

**API proposta** — `src/components/ui/Botao.tsx`:

```tsx
type VarianteBotao = 'primario' | 'secundario' | 'perigo';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;      // default 'primario'
  larguraCompleta?: boolean;     // w-full (rodapés de modal, submits)
  className?: string;            // escape de layout; vence por último
}

export function Botao({ variante = 'primario', larguraCompleta, className, type = 'button', ...resto }: BotaoProps)
```

Sem `onClick` próprio, sem estado, sem ícone como prop (ícone vai como children, como hoje).

1. **Criar o componente** — `src/components/ui/Botao.tsx` com a assinatura canônica do §3, as 3 variantes, `larguraCompleta` e spread de props nativas. Nenhum call site migrado neste commit. Se ainda não existir, criar `src/components/ui/` no mesmo commit (plano 17).
2. **Migrar `ConfirmDialog.tsx`** (par cancelar/confirmar, linhas 67-86) — cancelar vira `secundario`, confirmar vira `primario` (tom perigo → `perigo`). Aceitar perda de `font-black` e `transition-fast` (canônica). Revisar os 10 chamadores visualmente.
3. **Migrar o rodapé de `ModalFiltrosRanking.tsx`** (linhas 90-112) — Limpar = `secundario` (mantém `disabled` via prop), Aplicar = `primario` + `larguraCompleta={false}` no flex do rodapé.
4. **Migrar o submit de `FormLancamentoFinanceiro.tsx`** (linhas 221-236) — `type="submit"`, variante condicionada a `fNatureza` (`perigo`/`primario`), `larguraCompleta`, `disabled={salvando}`.
5. **Migrar os 4 rodapés de modal** — um commit único, 4 arquivos, mesma troca mecânica: `ModalSelecionarOpcao.tsx:50-58`, `ModalSelecionarGoleiro.tsx:67-75`, `ModalEscalarJogador.tsx:52-62` (ganha a canônica: passa a ter `rounded-[4px]` e sombra), `ModalSelecionarAgendamento.tsx:68-84` (Confirmar = `primario` + `larguraCompleta`, Cancelar = `secundario` + `larguraCompleta`).
6. **Onda 1 · Confirmações de partida e notificações** (8 arquivos, 19 botões) — `ConfirmacoesPartida.tsx` (9), `CardNotificacoes.tsx` (1), `NotificacoesConfirmacao.tsx` (1), `NotificacoesVotacao.tsx` (1), `SecaoNotificacaoConfirmacao.tsx` (2), `SecaoNotificacaoVotacao.tsx` (1), `SecaoNotificacaoSaude.tsx` (2), `SecaoNotificacaoTestes.tsx` (2). Aplicar o critério de encaixe: itens de lista de 48px (ex.: em `SecaoNotificacaoConfirmacao`) ficam crus.
7. **Onda 2 · Votação e súmula** (5 arquivos, 6 botões) — `PartidaVotar.tsx` (1, o CTA "Publicar votos"), `PartidaDetalhe.tsx` (2), `SelectSumula.tsx` (1), `CampoPartida.tsx` (1), `SeletorNota.tsx` (1).
8. **Onda 3 · Criação/edição de partida e escalação** (4 arquivos, 15 botões) — `PartidaNova.tsx` (3), `PartidaEditar.tsx` (3), `EscalacaoTimesEditor.tsx` (7), `BarraRascunhoGestao.tsx` (2, ganha `rounded-[4px]` canônico).
9. **Onda 4 · Partida ao vivo** (1 arquivo, 5 botões) — `PartidaAoVivo.tsx`. `DialogoEvento.tsx` segue fora (plano 08). Respeitar a restrição de janela do §3: fora de dia/horário de rodada, com validação em tela de teste antes do deploy.
10. **Onda 5 · Gestão de jogadores e goleiros** (8 arquivos, ~14 botões) — `GestaoJogadores.tsx` (4), `GestaoGoleiros.tsx` (1), `LinhaJogadorGestao.tsx` (3), `LinhaGoleiro.tsx` (5 — só o que encaixa; os 4 botões-ícone quadrados e o "Copiar PIX" compacto ficam crus), `ModalNovoGoleiro.tsx` (2), `CartaoJogadorEdicao.tsx` (2), `NovoJogador.tsx` (2), `CampoBusca.tsx` (1 — só se encaixar; o X de limpar busca é fora-variante).
11. **Onda 6 · Financeiro** (5 arquivos, 11 botões) — `ListaReceitasAbertas.tsx` (3), `ListaDespesasAbertas.tsx` (2), `EventosAutomaticosFinanceiro.tsx` (3), `FormEventoAutomatico.tsx` (2), `SecaoExportacaoFinanceira.tsx` (1). Inclui conferir o botão restante de `FormLancamentoFinanceiro.tsx` fora do passo 4.
12. **Onda 7 · Telas gerais e infra** (9 arquivos, ~16 botões) — `Ranking.tsx` (6 — migram "Redefinir filtros" e "Filtros" só se encaixar no critério; os 2 X de chip, o "Limpar" link e o toggle de filtros 40px ficam crus), `Perfil.tsx` (3), `Login.tsx` (3), `Layout.tsx` (2), `Jogos.tsx` (1), `EstatisticasRacha.tsx` (1), `BotaoInstalar.tsx` (2), `BotaoVoltar.tsx` (1), `StepperBox.tsx` (2), `Snackbar.tsx` (1 — só se encaixar; o X de fechar é fora-variante), `ErrorBoundary.tsx` (1). CTAs-Link (ex.: `Jogos.tsx:121-127`, `PartidaDetalhe.tsx:272-277`) **não migram** — `<Botao>` renderiza `<button>`; o alvo de 44px deles é escopo do plano 19 · C1.
13. **Auditoria de encerramento** — rodar `grep -rc '<button' src --include='*.tsx'` e conferir que **todo sobrevivente** se enquadra em: (a) `DialogoEvento.tsx` (plano 08); (b) fora-variante catalogado no §6, agora com arquivo:linha preenchidos; (c) botão com justificativa nova escrita no registro de execução. Sobrevivente sem categoria = migração esquecida, corrigir antes de fechar o plano. Registar a contagem final (esperado: ~30–35 `<button>` crus restantes).

## 5. Validação manual

Após cada passo (e obrigatoriamente após os passos 2–5 e ondas, que mudam botões visíveis):

- [ ] `npm run build` passa (sem erro de TypeScript/lint).
- [ ] **Passo 2** — `ConfirmDialog`: abrir um diálogo com confirmação normal e um com `tomConfirmar="perigo"`; verificar contraste, sombra, foco por teclado (outline âmbar) e botão desabilitado (opacidade legível).
- [ ] **Passo 3** — Modal de filtros do Ranking: Limpar desabilitado até alterar filtro; Aplicar aplica e fecha.
- [ ] **Passo 4** — Formulário financeiro: submeter como receita (âmbar) e despesa (vermelho perigo); estado "Salvando…" desabilitado.
- [ ] **Passo 5** — Os 4 modais (Opção, Goleiro, Escalação, Agendamento): rodapé fecha o modal; botões têm 44px de altura no toque; Escalação valida o novo `rounded-[4px]`/sombra (única mudança visual intencional).
- [ ] **Ondas 1–7** — Navegar em 1–2 telas de cada onda no aparelho: toque em botão primário, estado desabilitado, foco, e ausência de mudança visual além do alinhamento à canônica (`font-black`→`font-bold`, `opacity-40`→`-50`, `rounded-[3px]`→`[4px]`, `shadow-carimbo-destaque`→`shadow-carimbo`).
- [ ] **Onda 4** — adicionalmente: reproduzir o fluxo de partida ao vivo em partida de teste antes do deploy (restrição de janela do §3).
- [ ] **Passo 13** — conferir o relatório de sobreviventes e bater com o §6.

## 6. Fora de escopo

- **`DialogoEvento.tsx`**: fica para o plano 08 · A5 (migração para `ModalBase`); seus botões migram lá, não aqui.
- **CTAs-Link** (`<Link>` com cara de botão): não viram `<Botao>` (elemento diferente); 44px deles é o plano 19 · C1. O mesmo vale para as abas de `NavLink` do Ranking.
- **Botões fora das 3 variantes** (ficam `<button>` cru, com debate de componentização em aberto — decisão do dono, não do executor):
  - **Botão-ícone quadrado** (44×44, só ícone + `aria-label`): `DueloCard.tsx:24-32`, `LinhaGoleiro.tsx` (4: Edit2, Power, Save, X), `CartaoJogadorEdicao.tsx`, `CampoBusca.tsx:104+` (X de limpar), `Snackbar.tsx` (fechar), `ModalBase.tsx:114+` (fechar), `Layout.tsx`, `Login.tsx` — ~11 usos em 8 arquivos.
  - **Item de seleção de lista** (48px, estado selecionado, sublabel, check): `ModalSelecionarOpcao.tsx:64+`, `ModalSelecionarGoleiro.tsx`, `ModalEscalarJogador.tsx`, `ModalSelecionarAgendamento.tsx` (dias), `SecaoNotificacaoConfirmacao.tsx` — 5 arquivos com a mesma estrutura.
  - **Células de hora/minuto** do `ModalSelecionarAgendamento.tsx` (44px mono, sem borda).
  - **X de chip** (remover filtro) e o "Limpar" botão-link do `Ranking.tsx`; toggle "Filtros" de 40px com estado ativo e badge. Os chips têm plano próprio (15 · `pilula-filtro.md`).
  - **"Copiar PIX"** compacto de `LinhaGoleiro.tsx:200-218` (texto+ícone, `rounded-[3px]`, papel híbrido).
- **Novas variantes** ("ghost", "link", tamanhos `sm`/`lg`) ou componentes novos (`BotaoIcone`, item de seleção): só após o debate em aberto e com demanda real (YAGNI). Nada disso é criado por este plano.
- **Unificar `Toggle`, `CampoBusca`, `Badge`** ou qualquer outra primitiva: fora deste plano.
- **Novas bibliotecas**: nada de `class-variance-authority`, `cva`, headless UI ou similar — tudo com o que já existe (Tailwind + spread nativo).
- **Testes automáticos**: não criar (AGENTS.md); validação é manual, §5.

## 7. Riscos e rollback

- **Risco: regressão visual em `ConfirmDialog`** (10 chamadores, diálogos destrutivos). Mitigação: commit isolado (passo 2), inspeção dos fluxos que confirmam descarte/votação. Rollback: `git revert` do passo — nenhum outro arquivo é tocado nele.
- **Risco: mudança visual silenciosa nos 4 rodapés** (Escalação ganha sombra/raio). Mitigação: é a única divergência intencional da canônica; validar os 4 modais no passo 5. Rollback: revert do passo 5 (4 arquivos, sem dependência cruzada).
- **Risco: escopo ampliado concentrar regressões** (ondas tocam telas críticas: confirmações, votação, ao-vivo, financeiro). Mitigação: 1 onda = 1 commit (fatiável, nunca fundido), critério de encaixe objetivo no §3 e checklist por onda no §5. Rollback: revert da onda isolada — nenhuma onda depende de outra em runtime (todas só trocam call sites do mesmo componente criado no passo 1).
- **Risco: onda 4 quebrar partida ao vivo**. Mitigação: restrição de janela (fora de rodada), validação em partida de teste, commit único revertível. `DialogoEvento` (o cerne do fluxo de eventos) nem é tocado aqui.
- **Risco: escape de `className` mal composto** (classe do call site perdendo para a canônica ou duplicando `rounded`). Mitigação: regra explícita no §3 — escape só para layout; override de cor/papel é proibido e indica botão fora do critério de encaixe.
- **Risco: migrar "tudo" virar big-bang disfarçado**. Mitigação: o fora de escopo (§6) é explícito e a auditoria do passo 13 obriga justificativa por sobrevivente — o inverso também vale: botão que não encaixa fica cru, sem escape criativo.
- **Todos os passos são revertíveis por `git revert` isolado**: nenhum passo depende do anterior em runtime (o passo 1 só adiciona arquivo novo; os demais só trocam call sites).
