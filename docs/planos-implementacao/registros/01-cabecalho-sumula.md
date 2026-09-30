# 01 · CabecalhoSumula — Registro de Execução e Validação

> Registro da execução do plano [01-cabecalho-sumula.md](../01-cabecalho-sumula.md) em 2026-09-30, na branch `docs/rank-melhorias-code-slop`, por dois agentes independentes: **implementador** (22 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes.

## 1. Execução

- **22 commits** (`3908e5b` → `5c3fc77`), 1 passo = 1 commit, `tsc -b && vite build` verde em todos os passos.
- Componente criado em `src/components/ui/CabecalhoSumula.tsx` (adoção da convenção do plano 17 no mesmo commit).
- 21 arquivos migrados (18 rotas + 3 seções), começando pelas 4 cópias byte-idênticas de notificações.
- Critério de encerramento batido: `grep -rn "sumula-header" src/` retorna só o componente, `Skeletons.tsx` (fora de escopo por definição) e a definição do `@utility` em `index.css:232`.
- Fora de escopo respeitado: Skeletons, BotaoVoltar, Botao, campos, movimentação dos 63 componentes de `src/components/` — nada tocado. Normalizações sancionadas aplicadas isoladamente: `font-black → font-bold` em GestaoGoleiros (`a8325f8`) e kicker do Resumo movido para abaixo do título (`302d2d2`, `h1`/`text-2xl` preservados).

## 2. Adaptações legítimas do implementador (plano vs código real)

1. **Container canônico**: o plano rascunhava `flex items-end justify-between gap-3 pb-2`; o padrão dominante real das telas é `flex items-baseline justify-between` (sem gap/pb fixos). O componente usa a base real; casos divergentes (`items-center`/`items-end`/`items-start`/`gap-3`/`mt-0.5`) preservados via escape `className` ou ReactNode (9 rotas).
2. **`kicker` e `acao` aceitam ReactNode**; string pura é envolvida no estilo mono canônico (`text-[10px] font-mono uppercase tracking-widest text-giz-fraco`). Necessário para que `acao="Oficial CBO"` do próprio plano não perdesse estilo.
3. **`tamanho` ganhou `'sm'`**: as seções usam `h3 text-sm`, não coberto por `md`/`lg`. Extensão mínima do prop.
4. **PartidaVotar**: countdown, "Urna Anônima", subtítulo e barra de progresso preservados byte-a-byte como ReactNode dentro do prop `kicker` (separá-los em `acao` deslocaria o layout — dividem a mesma linha abaixo do título).

## 3. Observações da auditoria (nenhuma bloqueante, nenhuma exige refação)

1. **`flex-1` na coluna esquerda é desvio não registrado** (`CabecalhoSumula.tsx:38`). O original tinha largura por conteúdo + `justify-between`; com `flex-1` (`flex-basis: 0%`), em viewports muito estreitos o título encolhe/quebra linha antes e o slot `acao` passa a preservar sempre a largura de conteúdo — distribuição de overflow diferente da original. Risco prático baixo (títulos curtos, container `max-w-2xl`, `shrink-0` nos botões), mas foge do "sem mudança visual" estrito e não consta como normalização sancionada. **Ação sugerida: validação visual rápida no aparelho em `Estatisticas` (sufixo de username longo) e `Ranking`.**
2. **O doc do plano ficou desatualizado**: o markup canônico implementado (baseline, sem `gap-3`/`mt-0.5`) diverge do rascunho da seção 4 do plano. O implementador casou com o código real (decisão correta — o código real vence), mas o plano não foi atualizado. **Ação sugerida: atualizar a seção 4 do plano 01 para refletir o canônico implementado**, para não confundir execuções futuras.
3. **`PartidaVotar` usa o prop `kicker` para um bloco grande** (countdown + subtítulo + barra de progresso) — funciona e preserva o visual, mas semanticamente o conteúdo não é um "kicker". Alternativas exigiriam nova prop (pior custo/benefício agora). **Registrado como débito estético; revisar se o cabeçalho do PartidaVotar for tocado por mudança funcional.**
4. **`pb-1.5!` (Tailwind v4 important) nas seções** (`ListaReceitasAbertas.tsx:72`, `ListaDespesasAbertas.tsx:35`) — auditoria confirmou que é o único `!` introduzido e que é necessário (o `pb-2` do container viria antes na folha e seria sobrescrito de qualquer forma). Aceito, mas é o primeiro uso de important do app; preferir não replicar o padrão em outros escapes.

## 4. Validações técnicas confirmadas pela auditoria

- Ordem de cascata do Tailwind garante os escapes: `.items-baseline` (15993) < `.items-center` (16030) < `.items-end` (16063) < `.items-start` (16095) no CSS gerado — os escapes via `className` vencem a base de forma confiável.
- Tabela rota → heading/peso antes vs depois: 19/21 idênticos; os 2 desvios são as normalizações sancionadas (GestaoGoleiros e Resumo).
- Superfície do diff exatamente a esperada: componente novo + 21 telas; `Skeletons.tsx`, `index.css`, `App.tsx`, `public/sw.js` e `BotaoVoltar.tsx` com 0 linhas alteradas.
- `npm run build` e `npm run lint` passam.

## 5. Pendente de validação humana (visual, no aparelho)

Os agentes não conseguem validar visualmente. Checklist do plano (seção 5), com ênfases da auditoria:

- [ ] Módulo notificações: cabeçalho idêntico nas 4 telas.
- [ ] Skeletons sem desalinhamento (detector de geometria do componente).
- [ ] **`Estatisticas` e `Ranking` em viewport estreito** (observação 1 — `flex-1`).
- [ ] PartidaAoVivo (tela crítica) e PartidaDetalhe: alinhamento do slot de Badges/countdown.
- [ ] GestaoGoleiros: aceitar o peso `font-bold` e conferir a linha inferior `border-b`.
- [ ] Resumo: aceitar o kicker abaixo do título; contador à direita.
- [ ] PartidaVotar: countdown/subtítulo/barra de progresso como antes.
- [ ] Seções financeiras dentro das telas que as hospedam; EscalacaoTimesEditor na tela de escalação.
- [ ] Jogos como não-admin (sem `acao`).
- [ ] Heading no DOM: `h1` só no Resumo.
