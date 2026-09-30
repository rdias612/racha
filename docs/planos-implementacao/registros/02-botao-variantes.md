# 02 · Extrair `Botao` com variantes e adotar em todo o app — Registro de Execução e Validação

> Registro da execução do plano [02-botao-variantes.md](../02-botao-variantes.md) em 2026-09-30/10-01, na branch `main`. Execução **fatiada em 1 subagente por etapa** (13 etapas, para conter janela de contexto), seguida de **1 validador único** read-only. Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção.

## 1. Execução (14 commits, `414ad3a` → `a19d98e`)

| Etapa | Commit | Conteúdo | Migrados |
|---|---|---|---|
| 1 | `414ad3a` | cria `src/components/ui/Botao.tsx` (3 variantes, canônica §3) | — |
| — | `787eac0` | `ref?: Ref<HTMLButtonElement>` na API (desbloqueio do ConfirmDialog — ver §2) | — |
| 2 | `a50e579` | ConfirmDialog (par cancelar/confirmar, refs, tom perigo) | 2 |
| 3 | `a01cff1` | rodapé de ModalFiltrosRanking | 2 |
| 4 | `8d3738b` | submit de FormLancamentoFinanceiro (perigo/primario) | 1 |
| 5 | `98e5edd` | rodapés de 4 modais (Opção, Goleiro, Escalação, Agendamento) | 5 |
| 6 | `7d4888f` | onda 1 · confirmações/notificações | 4 |
| 7 | `8bf1fa4` | onda 2 · votação e súmula | 2 |
| 8 | `f732663` | onda 3 · partida e escalação | 6 |
| 9 | `cff28ba` | onda 4 · partida ao vivo (fora de rodada) | 2 |
| 10 | `620f55f` | onda 5 · gestão de jogadores/goleiros | 10 |
| 11 | `a7517b7` | onda 6 · financeiro | 5 |
| 12 | `75a3065` | onda 7 · telas gerais e infra | 7 |
| 13 | `a19d98e` | auditoria: 1 esquecido corrigido (ModalSelecionarGoleiro:166) | 1 |

**Total: 47 botões migrados** · **61 usos de `<Botao`** em 32 arquivos · **84 `<button>` sobreviventes** catalogados (ver §3).

## 2. Divergências e decisões da execução (avaliadas pela auditoria)

1. **Classe base `border`** adicionada à canônica na criação (o §3 listava só as cores de borda; sem a largura, nada renderizaria). Única classe fora da lista literal.
2. **`ref` na API** (`787eac0`): o ConfirmDialog usa `initialFocusRef` do `useModalA11y`; a primeira tentativa da etapa 2 abortou corretamente (TS2322) em vez de quebrar o comportamento de foco. Completude da API, não escape de escopo. React 19 já encaminhava `ref` via spread em runtime — faltava só a tipagem.
3. **Migrações seletivas**: o plano estimava ~96 botões nas ondas; o critério de encaixe do §3 aprovou 45 (os demais eram translúcidos/tinted, displays de campo, acordeões, comboboxes, ícones — catalogados, sem escape criativo). A contagem final de sobreviventes (84 vs ~30–35 esperados) decorre disso; a auditoria verificou que **nenhum sobrevivente é botão de ação claro** com a canônica.
4. **`cursor-pointer`** preservado via `className` onde o original tinha (layout, sancionado); o `disabled:cursor-not-allowed` da base prevalece por especificidade.
5. Números de linha derivados ao longo do plano (outros planos já tocaram os arquivos) — trechos sempre localizados por contexto.

## 3. Sobreviventes (84, com arquivo:linha na auditoria do passo 13)

- **(a) DialogoEvento** (6) — escopo do plano 08, intocado (diff vazio confirmado).
- **(b) Fora-variante do §6** (66): botão-ícone quadrado 44×44 (18), item de seleção de lista (7), célula hora/minuto (2), X de chip (2), botão-link (5), toggle pequeno com estado (18), papel híbrido/tinted/campo-disparador (14).
- **(d) Justificativa nova** (12): cabeçalhos de coluna ordenável (2), cabeçalhos de acordeão `aria-expanded` (2), triggers de combobox `role="combobox"` (2), ações destrutivas/secundárias em forma ghost que exigiriam escape de cor (6 — ex.: "Descartar votos", "Encerrar sessão", "Quitar").

## 4. Validações técnicas confirmadas pela auditoria

- **Regra crítica do §3 com zero violações**: varredura dos 61 call sites (inclusive `className={` template literals) — nenhuma cor (`border-`/`bg-`/`text-`/`shadow-`), `font-black` ou `opacity-` via className; condicionais de cor 100% via prop `variante`.
- Amostragem de regressão (ConfirmDialog, FormLancamento, GestaoJogadores, esquecido): props preservadas (`type`/`onClick`/`disabled`/`ref`/condicionais/ícones), sem mudança de comportamento.
- `npm run build` e `npm run lint` verdes; working tree limpa; nenhum commit fundiu etapas.

## 5. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] **ConfirmDialog** (10 chamadores): 1 diálogo normal + 1 `tomConfirmar="perigo"`; contraste, sombra, foco por teclado (outline âmbar — o foco inicial continua indo ao Confirmar), disabled legível.
- [ ] Modal de filtros do Ranking: Limpar desabilitado até alterar; Aplicar aplica e fecha (novo estilo disabled canônico).
- [ ] Formulário financeiro: receita = âmbar, despesa = vermelho; "Salvando…" desabilitado.
- [ ] Os 4 modais de rodapé fecham; 44px no toque; Escalação valida o ganho de `rounded-[4px]`/sombra (única mudança visual intencional do passo 5).
- [ ] Ondas 1–7: navegar 1–2 telas por onda (confirmações, votação, nova/edição de partida, gestão, financeiro, Ranking/Perfil/Login/BotaoInstalar) — alinhamento à canônica (`font-black`→`font-bold`, `opacity-40`→`-50`, `rounded-[3px]`→`[4px]`).
- [ ] **Onda 4 — obrigatória antes do próximo racha**: fluxo ao vivo completo em partida de teste, FORA de dia/horário de rodada.
- [ ] Badge "normal" e os fora-variante (§6) idênticos ao antes.
- [ ] Rollback de qualquer etapa: `git revert <commit>` isolado.
