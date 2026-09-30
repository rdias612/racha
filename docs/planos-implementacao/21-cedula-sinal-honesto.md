# 21 · Cédula de votação: sinal honesto — Plano de Implementação

> Ref.: item **E1** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#21 (nota 1,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P1

## 1. Objetivo

Fazer a cédula de votação comunicar o sinal honesto do modelo de urna: as notas **nascem** com 6 de propósito (o jogador só ajusta quem se destacou), mas a UI atual esconde isso — a barra "Progresso da cédula" nasce em 100%, o contador "X/Y avaliados" nasce completo e o rótulo alternativo do botão ("Avalie todos (n restantes)") é **código morto** inatingível. A mudança troca a métrica de "progresso obrigatório" (sempre cheio, logo mentiroso) por um contador de **ajustes reais**: "Você ajustou X de Y — as demais ficam com 6", com o botão comunicando a economia ("Enviar votos — X ajustes") e `vibrateSuccess` ao enviar. Zero abstração nova, zero estado novo: o contador é **estado derivado** dos maps que já existem, sem tocar no `SeletorNota` acessível.

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#21, nota 1,0) — o critério daquele ranking mede deduplicação, não valor de UX; itens funcionais tendem à nota baixa sem deixarem de ser valiosos pelo critério do plano original (E1 é **P1, Fase 4**, primeiro item da fase de UX funcional). O `README.md` deste diretório manda seguir as fases do plano para o Tier 4.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; divergência de linha do doc de origem corrigida abaixo:

- `src/routes/PartidaVotar.tsx:150-180` — na carga, o mapa de notas é construído **pré-preenchido**: sem votos anteriores, cada alvo recebe `6` como padrão (`:174-179`; o doc de origem citava `~176-180`, a linha real do `: 6` é `178`, dentro do bloco `175-179`). O mesmo mapa pode ser restaurado de rascunho do `localStorage` (`:159-172`), também pré-preenchido.
- `src/routes/PartidaVotar.tsx:184-185` — `setNotas(mapaNotas)` e `setNotasIniciais(mapaNotas)`: o snapshot do load vira a baseline de comparação usada por `temModificacoes` (`:53-62`, padrão existente de comparação nota-atual vs. baseline por alvo).
- `src/routes/PartidaVotar.tsx:222-223` — `avaliadosCount` conta alvos com nota definida e `todosAvaliados = alvos.length > 0 && avaliadosCount === alvos.length`. Como **toda** nota nasce definida, ambos nascem (e permanecem) no valor máximo: `todosAvaliados` é constante `true` e `avaliadosCount === alvos.length` desde o mount (doc citava `:222-223` — confere).
- `src/routes/PartidaVotar.tsx:302-318` — a barra "Progresso da cédula" renderiza `avaliadosCount/alvos.length` com `width: ...%` (`:315`): nasce em **100%** e nunca muda — progresso obrigatório que não informa nada.
- `src/routes/PartidaVotar.tsx:368-382` — botão da `BarraAcaoInferior` com `disabled={!todosAvaliados || salvando}` (o primeiro termo é morto) e rótulo ternário cujo ramo alternativo **"Avalie todos (n restantes)"** (`:378-380`) é **código morto**: `todosAvaliados` é sempre `true`, o ramo nunca renderiza (doc citava `:378-380` — confere).
- `src/routes/PartidaVotar.tsx:207-220` — `setNota` é a **única via de mutação** das notas (chamada pelo `onChange` do `SeletorNota` em `:351-355`); persiste rascunho no `localStorage`.
- `src/routes/PartidaVotar.tsx:233-274` — `enviar()`: em caso de aceito, grava `feedback` e navega após 800ms; **nenhum haptic** é disparado (o arquivo não importa nada de `../lib/haptics`).
- `src/lib/haptics.ts:26-28` — `vibrateSuccess()` existe e é padrão do repo para confirmação (usos: `src/components/ConfirmacoesPartida.tsx:184`, `src/components/Snackbar.tsx:26`, `src/routes/Perfil.tsx:96`).
- `src/components/SeletorNota.tsx:72-74` — o gatilho `compact` (w-24, combobox acessível com `useListbox`) não precisa de nenhuma alteração para a proposta mínima.
- **Referência visual (não fonte de verdade)**: Draft 2 "Cédula de Votação · Sinal Honesto" do canvas Superdesign — https://p.superdesign.dev/draft/6a14a50a-3612-4cf1-ba61-0ac5cd5ea21a (listado no Apêndice do plano de origem). Serve só para visualizar a ideia do contador "ajustou x de y"; os textos, o layout e o escopo seguem este plano (o draft inclui botões −/+, que aqui ficam **fora do escopo mínimo**, seção 6).

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** O item 16 (E3 — retry/PTR/haptics nas telas de partida) também prevê `vibrateSuccess` ao enviar votos, mas os dois são aditivos e independentes: se o 16 for executado antes, este plano apenas **não duplica** a chamada (conferir o `enviar()` antes do Passo 2); se este for antes, o 16 pula o item correspondente no seu checklist.
- **Decisão do dono exigida antes de executar**: apenas para o **opcional (M)** — botões −/+ junto ao gatilho do `SeletorNota` compacto (marcado como fora do escopo mínimo na seção 6; exige mexer na vizinhança do combobox acessível e validar alvo de toque/teclado). A proposta mínima **não** depende dessa decisão e pode ser executada sem ela.
- **Restrição de janela**: a validação manual (seção 5) exige uma partida com **votação aberta** (guard `votacaoAberta`, prazo de 24h — `PartidaVotar.tsx:102-108`). Executar fora de partida ao vivo; validar na janela pós-partida real ou com dados de teste que deixem a votação aberta.

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Contador de ajustes derivado + rótulos honestos + remoção do código morto · 1 commit

- **`src/routes/PartidaVotar.tsx`** — alterações contidas, sem novo `useState`/`useEffect`:
  1. Substituir `avaliadosCount`/`todosAvaliados` (`:222-223`) por um contador derivado de **ajustes reais**, reusando a mesma forma de comparação de `temModificacoes` (`:53-62`):
     - modo edição (`editando`, `votosOriginais` populado): ajuste = nota atual diferente do voto já registrado (`notas[a.jogador_id] !== votosOriginais.get(a.jogador_id)`);
     - voto novo: ajuste = nota atual diferente do padrão da urna (`notas[a.jogador_id] !== 6` — literal `6` como já usado em `:178`, **sem** extrair constante para `lib`; o plano de origem rejeitou fundir esse 6 com `NOTA_PADRAO`, domínios distintos).
     - Sugestão de nome: `ajustadosCount` (`const ajustadosCount = editando ? ... : ...`).
  2. Substituir o bloco "Progresso da cédula" (`:302-318`) por uma linha de texto no mesmo lugar: **"Você ajustou X de Y — as demais ficam com 6"** (voto novo) / **"Você ajustou X de Y — as demais mantêm os votos anteriores"** (edição), usando os tokens tipográficos já presentes no bloco (`text-xs font-mono`, destaque em `text-destaque-texto`). A barra de progresso some junto com a métrica que a alimentava.
  3. Simplificar o botão (`:368-382`): `disabled={salvando}` (o termo `!todosAvaliados` é morto) e rótulo ternário de 2 ramos — voto novo: **"Enviar votos — X ajustes"** (tratar singular: `X === 1 ? '1 ajuste' : 'X ajustes'`); edição: "Atualizar votos" (mantém-se). Remover o ramo morto "Avalie todos (n restantes)" (`:378-380`) e o estado `salvando` continua regendo o "Depositando votos na urna…".
  4. `enviar()` (`:234`): remover o guard `!todosAvaliados` (constante `false` no negativo — morto); o guard de `salvando`/ausência de `jogador`/`partida` permanece.
- Nenhum outro arquivo é tocado. Nenhum comportamento de dados muda: payload, rascunho, `temModificacoes`/`beforeunload` e guards de carga permanecem intocados.
- Conferir com `tsc -b` (ou o build) que não sobrou referência a `avaliadosCount`/`todosAvaliados`.
- Commit: "cédula de votação: contador de ajustes honesto no lugar do progresso fake (E1)".

### Passo 2 — `vibrateSuccess` ao enviar · 1 commit

- **`src/routes/PartidaVotar.tsx`** — importar `vibrateSuccess` de `../lib/haptics` e chamá-lo no caminho de sucesso de `enviar()`, logo após o `setFeedback(...)` (`:261`), espelhando o padrão de `ConfirmacoesPartida.tsx:184` (haptic junto da confirmação). Não vibrar nos ramos de erro/não-aceito (`:247-250`, `:269-271`).
- Commit: "cédula de votação: vibrateSuccess ao enviar votos (E1)".

Total: 2 commits, ambos reversíveis isoladamente. (Se preferir, Passos 1 e 2 cabem num commit único — mas separados o review e o rollback são mais limpos.)

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no build de dev (`npm run dev`), com aparelho/emulação mobile e **uma partida com votação aberta** (janela de 24h), exercendo o fluxo de votação completo:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Voto novo, sem tocar em nada**: a cédula abre com todas as notas em 6 e a linha diz "Você ajustou 0 de Y — as demais ficam com 6"; **não existe mais barra de progresso**; o botão já está habilitado com "Enviar votos — 0 ajustes" (singular/plural conferidos com 0, 1 e 3+).
- [ ] Ajustar 3 notas quaisquer: a linha passa a "Você ajustou 3 de Y — as demais ficam com 6" e o botão "Enviar votos — 3 ajustes"; voltar uma delas para 6 derruba o contador para 2 (contagem = notas diferentes de 6).
- [ ] **Editar votos já enviados**: reabrir a cédula da mesma partida — baseline passa a ser os votos registrados; a linha diz "as demais mantêm os votos anteriores" e o botão continua "Atualizar votos", com o contador refletindo só as mudanças novas.
- [ ] Enviar votos (voto novo e edição): mensagem de sucesso aparece e **o aparelho vibra** (padrão duplo-curto do `vibrateSuccess`); navegação automática para a partida após ~800ms preservada.
- [ ] Forçar erro no envio (ex.: DevTools → Network offline no momento do clique): **sem vibração**, mensagem de erro exibida, cédula preserva as notas e o rascunho do `localStorage`.
- [ ] Sair sem enviar com notas modificadas: o `ConfirmDialog` "Sair da votação?" continua aparecendo (`temModificacoes` intacto); sair sem modificar não pergunta.
- [ ] `SeletorNota` intacto: abrir o dropdown por toque e por teclado (Tab/Enter/setas), foco visível âmbar, nota 6 continua pré-selecionada no destaque inicial — nenhum comportamento do combobox mudou.
- [ ] Cédula em tela estreita: a linha do contador não quebra o cabeçalho da súmula nem colide com o cronômetro "Fecha em Xh Ymin".

## 6. Fora de escopo

- **Botões −/+ junto ao gatilho do `SeletorNota` compacto** (o "opcional (M)" do plano de origem): **decisão do dono, fora do escopo mínimo**. Exige mexer na vizinhança de um combobox acessível (`useListbox`), com validação de alvo de toque, teclado e `aria` — não fazer sem aprovação explícita.
- **Não alterar o `SeletorNota`** (componente ou variantes): a proposta mínima vive toda em `PartidaVotar.tsx`.
- **Não extrair constante/`lib` para o 6 da urna** nem fundi-lo com `NOTA_PADRAO` de escala de times — rejeitado no plano de origem (§5, "domínios distintos, acoplamento perigoso").
- **Não reproduzir o layout do Draft 2 do Superdesign** (https://p.superdesign.dev/draft/6a14a50a-3612-4cf1-ba61-0ac5cd5ea21a): referência visual apenas; nenhum redesenho de cartão de jogador, nenhum componente novo.
- **Não tocar** na persistência de rascunho (`localStorage`), no payload de `registrarVotos`, nos guards de elegibilidade da carga nem no `temModificacoes`/`beforeunload`.
- **Não** implementar demais itens do E3 (retry, PullToRefresh, padronização de sucesso em `Snackbar`) — plano 16 cuida disso.
- **Não** criar testes automáticos (diretriz atual do AGENTS.md).

## 7. Riscos e rollback

- **Risco funcional: baixo.** Nenhuma mudança de dados, de payload ou de persistência; tudo é camada de apresentação sobre maps que já existem (`notas`, `notasIniciais`, `votosOriginais`). Os dois riscos pontuais:
  - **Contagem "≠ 6" no voto novo**: uma nota deliberadamente ajustada **para** 6 não é contada como ajuste — aceitável e até coerente com o texto ("as demais ficam com 6": quem está em 6, fica em 6). Documentar na review, não contornar com estado extra (seria recriar o estado que o escopo mínimo evita).
  - **Rascunho restaurado**: um rascunho com notas ≠ 6 conta corretamente como ajustes (derivação é sobre o valor, não sobre o toque na sessão). Nenhuma divergência conhecida.
- **Risco de regressão no botão**: o `disabled={salvando}` mantém o único bloqueio real; o botão já nasce habilitado hoje (`todosAvaliados` constante `true`), então nenhum fluxo que funcionava deixa de funcionar.
- **Rollback**: cada passo é um commit isolado e reversível por `git revert` sem efeitos colaterais — o Passo 2 é aditivo (1 import + 1 chamada); o Passo 1 restaura com o revert da troca de rótulos/bloco de progresso. Nenhuma migração, nenhum dado persistido novo.
