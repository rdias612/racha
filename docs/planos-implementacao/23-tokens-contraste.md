# 23 · Tokens de contraste `--cor-ok-texto` e `--cor-perigo-texto` — Plano de Implementação

> Ref.: item **C2** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#23 (nota 1,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: M · Risco: baixo-médio · Prioridade global do plano: P1

## 1. Objetivo

Dar contraparte adaptativa ao verde `#58b368` e ao vermelho `#e4572e`, replicando o mecanismo consagrado do âmbar (`--cor-destaque` ↔ `--cor-destaque-texto` em `src/index.css`): criar os pares `--cor-ok-texto`/`--cor-perigo-texto` em `:root`/`.dark`, mapeá-los no `@theme` e migrar **somente os usos como texto pequeno** (16 pontos em 6 arquivos). No tema escuro (default) nada muda visualmente (os novos tokens recebem os valores atuais); no tema claro, onde o contraste atual é insuficiente (`text-ok` ≈ 2,4:1, `text-perigo` ≈ 3,4:1 — abaixo até do limiar de texto grande 3:1), os textos passam a usar versões mais profundas das cores. `bg-ok`/`bg-perigo` (e as variantes `/10`, `/15`, `/20`) **permanecem como estão** — continuam servindo fundos e bordas.

Observação honesta do ranking: este item é **neutro em anti-slop** (nota 1,0, Tier 4) — é uma correção de acessibilidade, e o valor do mecanismo replicado é preventivo (texto novo em verde/vermelho tem um token correto à mão, como já acontece com o âmbar).

## 2. Estado atual (evidências verificadas)

Evidências reconferidas no código em **2026-10-03** (revisão anterior: 2026-09-30; o código andou no meio — ondas A2/A6/A8 de `Botao`, `ChipTipoLancamento` e `Badge` mini). Os tokens `--cor-ok-texto`/`--cor-perigo-texto` **ainda não existem**; o plano segue sem execução. A contagem refeita por grep resultou em **16 pontos** — e corrige a inconsistência da revisão anterior, que dizia "14 pontos em 7 arquivos" mas listava 13 pontos em 6 arquivos na tabela. O critério de escopo (texto pequeno) não distingue cor: as variantes `perigo` do `Badge` e `erro` do `MensagemEstado` alimentam os mesmos textos pequenos que as verdes, e o valor `text-perigo` de `ListaReceitasAbertas.tsx:110` é o espelho do valor `text-ok` de `:160` — entram no escopo.

**Mecanismo do âmbar a replicar** (par adaptativo destaque-texto/destaque-tinta):
- `src/index.css:21` — mapeamento no `@theme` (`--color-destaque-texto: var(--cor-destaque-texto)`, no bloco destaque :20-22).
- `src/index.css:44-45` — `:root` (claro): `--cor-destaque-texto: #92400e` (versão profunda do âmbar) e `--cor-destaque-tinta: #1a1200`.
- `src/index.css:65-66` — `.dark`: `--cor-destaque-texto: #ffb300` (o próprio âmbar) e `--cor-destaque-tinta` inalterado. **É este padrão que o ok/perigo segue**: no escuro, o token `-texto` recebe o valor base atual.

**Valores base atuais, sem adaptatividade** (iguais nos dois temas):
- `src/index.css:48-49` (`:root`) e `src/index.css:69-70` (`.dark`): `--cor-perigo: #e4572e`, `--cor-ok: #58b368`.

**Usos como texto pequeno citados no plano (todos conferidos, escopo da migração):**

| Arquivo | Linhas | Uso |
|---|---|---|
| `src/components/Badge.tsx` | 69, 70 | variantes `ok` e `perigo` do Badge (`border-ok/40 bg-ok/10 text-ok` / idem perigo — só os `text-ok`/`text-perigo` migram; alimentam Badges `text-[9px]`/`text-[10px]` de todo o app) |
| `src/components/Estado.tsx` | 63, 64 | variantes `erro` e `sucesso` do `MensagemEstado` (idem: só os tokens de texto migram; corpo da mensagem é `text-xs`) |
| `src/components/LinhaJogadorGestao.tsx` | 117 | toggle mensalista com `text-ok` herdando `text-xs` do grid (`:100`). Os antigos chips `text-[9px]` citados na revisão anterior migraram para `Badge` mini (A8) — o ponto atual do arquivo é este. O checkbox interno usa `text-branco-time` sobre `bg-ok` sólido (`:126`) e não se toca |
| `src/components/ConfirmacoesPartida.tsx` | 77, 105, 129, 140, 384 | botão "Essa quinta não rola" `text-xs` (77), mini-botões admin ✓/✗ `text-xs` (105, 129), hover do mini-botão remover (140), rodapé de erro `text-xs` (384) |
| `src/components/ListaReceitasAbertas.tsx` | 58, 110, 160 | valores financeiros em mono (`text-base` em 58; `text-sm` em 110 — total devido `text-perigo` — e 160) |
| `src/components/ListaDespesasAbertas.tsx` | 30, 95, 104 | total e valores `text-perigo` em mono (30, 95) e hover do botão Quitar `text-xs` (104) |

Total: **16 pontos em 6 arquivos** (12 usos diretos + 4 definições de variante que alimentam todos os Badges/MensagensEstado pequenos do app, verdes e vermelhos).

**Usos de `text-ok`/`text-perigo` existentes FORA do escopo** (conferidos por grep): migram depois, "ao tocar o arquivo" (ver §6 — alguns deles também são texto pequeno, mas ficam fora por decisão de escopo mínimo).

## 3. Pré-condições e dependências

- **Nenhuma dependência de outros planos.** Os planos 12 (scrim) e 13 (tokens mortos) mexem no mesmo bloco de tokens de `index.css`, mas em linhas distintas — sem conflito de merge relevante; se executados próximos, manter a ordem de commits isolada de cada um.
- **Validação visual do dono é parte do plano**: os hexes propostos para o tema claro (verde ~`#2e7d32`, vermelho ~`#b3401e`) são estimativas de contraste e **precisam ser validados lado a lado** com a paleta atual antes do merge do passo 1. O tom percebido muda um pouco no claro — é o risco declarado no plano de origem.
- Janela de execução: **fora de partida ao vivo**, por cautela — `ConfirmacoesPartida.tsx` é tela de partida (embora os pontos tocados sejam de confirmação pré-jogo).

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Criar os tokens adaptativos em `src/index.css` (commit 1)

Somente `src/index.css`, replicando exatamente a estrutura do âmbar:

1. **`@theme`** (ao lado de `--color-perigo`/`--color-ok`, linhas 26-27):
   ```css
   --color-ok-texto: var(--cor-ok-texto);
   --color-perigo-texto: var(--cor-perigo-texto);
   ```
2. **`:root`** (tema claro — valores novos, a validar visualmente):
   ```css
   --cor-ok-texto: #2e7d32;     /* ~verde profundo; contraste alvo ≥ 4,5:1 sobre #faf7ee */
   --cor-perigo-texto: #b3401e; /* ~vermelho profundo; idem */
   ```
3. **`.dark`** (tema escuro — valores atuais, **zero mudança visual**):
   ```css
   --cor-ok-texto: #58b368;
   --cor-perigo-texto: #e4572e;
   ```
4. Rodar `npm run build` (ou `tsc -b` + build do Vite) para confirmar que o Tailwind gera as utilities `text-ok-texto`/`text-perigo-texto` a partir do `@theme`.

**Commit neste passo ainda sem nenhum consumidor** — reversível e visualmente inerte. Se a validação lado a lado rejeitar os hexes do claro, ajustar aqui antes de seguir (o ajuste de hex pós-validação, se vier depois do passo 2, é tolerado como 3º commit isolado).

### Passo 2 — Migrar só os usos como texto pequeno (commit 2)

Troca mecânica `text-ok` → `text-ok-texto` e `text-perigo` → `text-perigo-texto` **apenas nos 16 pontos** da tabela da seção 2. Regras da migração:

- Em classes compostas, trocar **só o token de texto**; `border-ok/40`, `bg-ok/10`, `bg-perigo/20`, `hover:bg-perigo/10` etc. permanecem (fundos e bordas continuam na cor base, que é vibrante de propósito).
- Em `ConfirmacoesPartida.tsx:140` (hover: `hover:text-perigo`) → `hover:text-perigo-texto`; em `:77` o `text-perigo` do botão → `text-perigo-texto`.
- Em `LinhaJogadorGestao.tsx:117`, trocar só o `text-ok` da classe condicional do toggle (o `hover:bg-ok/20` fica; o checkbox interno em `:126` não se toca).
- Ordem de migração: primeiro `Badge.tsx` e `Estado.tsx` (as quatro variantes propagam para todos os consumidores), depois os arquivos de pontos diretos.
- Conferir no build que nenhuma utility `text-ok-texto`/`text-perigo-texto` ficou sem definição (passo 1 garante) e que **nenhum `bg-ok-texto` foi criado por engano** (o token é para texto).

## 5. Validação manual

Sem testes automáticos, conforme AGENTS.md. Checklist no aparelho/build:

- [ ] **Tema escuro (default)**: comparar as telas tocadas antes/depois — nenhuma diferença perceptível de cor (os tokens valem o mesmo que hoje).
- [ ] **Tema claro**: alternar o tema e percorrer os 6 arquivos: toggle do `LinhaJogadorGestao`, Badges verdes e vermelhos ("Confirmado"/"Encerrada"/"Não vai"/"Recusada"), `MensagemEstado` de sucesso e de erro, valores de `ListaReceitasAbertas`/`ListaDespesasAbertas`, botões e rodapé de `ConfirmacoesPartida`. O verde/vermelho do **texto** deve estar visivelmente mais profundo e legível; os **fundos** (chips, faixas, botões) devem continuar com o verde/vermelho vibrante de sempre.
- [ ] Validação lado a lado dos hexes do claro (print das duas propostas, atual vs. nova, sobre `#faf7ee`/`#f3efe4`): confirmar que o verde não "esverdeia demais" para oliva e que o vermelho não puxa para marrom. Se rejeitado, ajustar hex no passo 1 e revalidar só o claro.
- [ ] Confirmar que nenhum lugar ficou com texto verde/vermelho sobre fundo verde/vermelho cheio (`bg-perigo` sólido) usando o token novo (os sólidos continuam com `hover:text-branco-time` etc., já presentes no código).
- [ ] `npm run build` limpo; smoke test rápido de navegação nas telas tocadas.

## 6. Fora de escopo

- **Não migrar** os demais usos de `text-ok`/`text-perigo` (re-grep de 2026-10-03; refs atualizadas — antes citadas com linhas deslocadas): ícones soltos (`ResumoGestao.tsx:56`, `LinhaGoleiro.tsx:209`, `GridTimesPartida.tsx:55`), hovers de destruição (`routes/Jogos.tsx:132`, `routes/Perfil.tsx:260`, `ModalSelecionarGoleiro.tsx:97`, `EventosAutomaticosFinanceiro.tsx:178`, `routes/PartidaNova.tsx:325`), botões grandes e botões de seleção (`routes/PartidaDetalhe.tsx:296`, `routes/PartidaAoVivo.tsx:357`, `CartaoJogadorEdicao.tsx:78`, `DialogoEvento.tsx:136`, `FormLancamentoFinanceiro.tsx:110-111`), textos grandes/números de placar (`routes/PartidaAoVivo.tsx:340`, `StepperBox.tsx:28,36`, `SecaoNotificacaoSaude.tsx:169`, `routes/PartidaVotar.tsx:315`, `routes/PartidaDetalhe.tsx:283`, `routes/PartidaNova.tsx:226`, `EscalacaoTimesEditor.tsx:345`, `LinhaGoleiro.tsx:61-62,100-101,210`).
- **Usos pequenos deliberadamente fora por escopo mínimo** (também são texto pequeno, mas não entram neste plano para mantê-lo revisável; migram na mesma onda oportunista): `ErrorBoundary.tsx:32` (chip `text-[10px]`), `SecaoNotificacaoTestes.tsx:48` (`text-xs`), `SecaoHistoricoImportacoes.tsx:77` (`text-xs`), `SecaoFalhasRecentesClipes.tsx:19` (título `text-sm`), `CartaoJogadorEdicao.tsx:54` (`text-[11px]`), chips de `LinhaGoleiro.tsx:61-62` (`text-[10px]`) e o map `COR_TIPO` hoje em `ui/ChipTipoLancamento.tsx:5` (extraído de `ListaReceitasAbertas` no A6; chip `text-[9px]`). Ficam como migração oportunista **ao tocar o arquivo** — evitando a mudança cosmética ampla que o AGENTS.md manda evitar.
- **Não tocar** em `bg-ok`/`bg-perigo` (nem nas opacidades `/10`, `/15`, `/20`, `/25`) — continuam a cor base.
- **Não criar** tokens adicionais (`-tinta`, `-borda`) para ok/perigo: o âmbar tem três tokens porque tem os três usos; ok/perigo hoje só exigem o par de texto. YAGNI.
- **Não alterar** os hexes de `--cor-ok`/`--cor-perigo` em nenhum dos dois temas.
- **Não** documentar os novos tokens no `DESIGN.md` neste plano (fica para o C5, plano do `DESIGN.md`).

## 7. Riscos e rollback

| Risco | Mitigação / rollback |
|---|---|
| Cor percebida muda no tema claro (verde/vermelho mais "apagados" nos textos) | É o efeito desejado (mais contraste), mas validado lado a lado antes do merge; se rejeitado, ajustar hex no commit 1 (ou 3º commit de ajuste) — nenhum consumidor precisa ser retocado. |
| Verde claro `#2e7d32` destoa da paleta (puxa para oliva `#54552e`) | Alternativas na validação: ajustar matiz/luminosidade do hex; rollback = `git revert` do commit 1 derruba os tokens e o commit 2 passa a referenciar tokens inexistentes — **reverter sempre o commit 2 primeiro** (ordem: revert 2, depois 1). |
| Tema escuro mudar sem querer | Os valores do `.dark` são literalmente os atuais; conferência visual no checklist §5. Qualquer divergência = erro de digitação, pego no build/review. |
| Utility não gerada (token mal mapeado no `@theme`) | Build do passo 1 já valida (utility presente no CSS gerado). |
| Regressão em tela de partida | Executar fora de ao-vivo; rollback por `git revert` isolado de cada commit (ambos tocam poucos arquivos). |
