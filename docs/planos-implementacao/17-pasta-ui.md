# 17 · Pasta `ui/` para novas primitivas (adoção por toque) — Plano de Implementação

> Ref.: item **A9** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#17 (nota 2,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: mínimo · Prioridade global do plano: P3

## 1. Objetivo

Estabelecer a convenção de que **toda primitiva de UI nova nasce em `src/components/ui/`**, impedindo que a raiz de `src/components/` (hoje com 63 arquivos planos misturando primitivas, navegação e seções de tela) inche com as extrações dos planos 01–15. Este plano é **de convenção/adoção, não de código**: ele não extrai componente algum, não move arquivo existente e praticamente não adiciona código próprio — o único artefato permanente é a regra registrada em documentação.

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em 2026-09-30:

- **63 arquivos planos** em `src/components/` (contagem confirmada por `find -maxdepth 1 -type f`; bate com o doc de origem A9). A lista mistura primitivas (`Badge.tsx`, `ModalBase.tsx`, `Estado.tsx`, `Snackbar.tsx`, `Toggle.tsx`, `Skeletons.tsx`), navegação (`BotaoVoltar.tsx`, `BarraAcaoInferior.tsx`) e seções de tela (`ResumoGestao.tsx`, `PainelPlacar.tsx`, `Secao*.tsx`).
- **`src/components/ui/` ainda não existe** (confirmado: nenhum subdiretório em `src/components/`).
- As extrações previstas que adotam esta convenção:
  - **Plano 01** → `src/components/ui/CabecalhoSumula.tsx` (`01-cabecalho-sumula.md:37,26`).
  - **Plano 02** → `src/components/ui/Botao.tsx` (ou `ui/botoes.ts` na Opção B de constantes) (`02-botao-variantes.md:87,71,59`).
  - **Plano 04** → `src/components/ui/CampoTexto.tsx` e `src/components/ui/CampoTextoLongo.tsx` (`04-campo-texto.md:40`).
  - **Plano 15** → `src/components/ui/PilulaFiltro.tsx` (débito com gatilho; quando ativar, nasce direto em `ui/`) (`15-pilula-filtro.md:43,51`).
  - **Plano 11** → `Badge` **já existe** em `src/components/Badge.tsx` (assinatura em `Badge.tsx:86-87`); caso de **migração por toque**, não de criação — quando o plano 11 tocar o arquivo funcionalmente (prop `densidade`), avaliar mover no mesmo commit.
- Os planos dependentes já citam este plano como executor da convenção: `01:26,149`, `02:54,59`, `04:29,151`, `15:43,95`.

## 3. Pré-condições e dependências

- **Nenhum plano é pré-requisito** — ao contrário: este plano deve ser adotado **junto** do primeiro que criar primitiva (01, 02 ou 04, o que vier primeiro). O ranking é explícito: executar **junto** do A1/A2/A3, nunca isolado (`rank-melhorias-reuso-codigo.md`, item #17 e §3.5: "A9 custa ~zero se executado no mesmo commit de criação de A1/A2/A3").
- **Decisão do dono exigida antes de executar** (registro, não código):
  1. Aprovar a regra de convenção em si (novas primitivas em `ui/`; raiz congelada para novos arquivos).
  2. Escolher **onde registrar**: `DESIGN.md` §3 ("Estrutura de Diretórios e Responsabilidades", linha 62) e/ou `docs/planos-implementacao/README.md`. Sem registro, a convenção não sobrevive a outras sessões.
- **Restrições de janela**: nenhuma — não há mudança funcional; pode ser aplicado em qualquer momento, inclusive em partida ao vivo (o commit que cria a pasta é o mesmo do componente novo, sem risco adicional).

## 4. Plano de execução (1 passo = 1 commit)

Como este plano é de convenção, o "passo 1" não cria pasta vazia: **a pasta nasce no commit do primeiro componente que a adotar** (nunca um commit só com diretório vazio).

1. **Passo 1 — Registrar a convenção na documentação** (único artefato próprio deste plano; pode ser o commit que cria a primeira primitiva em `ui/`, junto do plano 01/02/04):
   - Em `DESIGN.md`, seção §3 "Estrutura de Diretórios e Responsabilidades": adicionar que **primitivas de UI reutilizáveis e sem domínio de negócio nascem em `src/components/ui/`**; componentes existentes permanecem na raiz.
   - Em `docs/planos-implementacao/README.md`: acrescentar uma linha à filosofia apontando para o plano 17 como origem da regra.
   - Não executar nenhuma mudança em `src/` neste passo se ele vier sozinho.
2. **Passo 2 — Adoção no commit de criação de cada primitiva nova** (executado pelos planos dependentes, não por este):
   - Plano 01: `src/components/ui/CabecalhoSumula.tsx`.
   - Plano 02: `src/components/ui/Botao.tsx` (ou `ui/botoes.ts`).
   - Plano 04: `src/components/ui/CampoTexto.tsx` + `ui/CampoTextoLongo.tsx`.
   - Plano 15: `src/components/ui/PilulaFiltro.tsx`, quando o gatilho de ativação ocorrer.
3. **Passo 3 — Migração por toque (regra contínua, sem commit próprio)**:
   - Um arquivo existente de `src/components/` só se move para `ui/` quando for **tocado por mudança funcional** (não cosmética) **e** for de fato uma primitiva (sem regra de negócio, sem acoplamento a rota).
   - **Um arquivo por commit**, junto da mudança funcional que o tocou; nunca lote de mudanças.
   - Primeiro candidato natural: `Badge.tsx`, quando o plano 11 (prop `densidade`) o tocar — avaliar mover no mesmo commit.

Regra de bolso para decidir se um componente novo vai para `ui/`: primitiva visual reutilizável, sem conhecimento de rotas nem de domínio (racha/jogador/financeiro) → `ui/`. Seção de tela, formulário de domínio ou peça acoplada a dado → raiz de `src/components/` ou pacote da feature.

## 5. Validação manual

- [ ] Após o commit que criar a pasta + primeira primitiva: `npm run build` (ou o build do projeto) passa sem erro de resolução de import.
- [ ] A tela que consome a primitiva renderiza idêntica à anterior (a mudança é só de caminho/nome de import).
- [ ] `grep -rn "components/ui" src/` mostra apenas os imports dos componentes efetivamente criados — nada de paths aspirados.
- [ ] Em cada migração por toque: a tela afetada é exercitada manualmente (abrir, interagir, verificar visual) antes do commit.

## 6. Fora de escopo

- **Não mover os 63 arquivos existentes** de `src/components/` para `ui/` — migração em massa é exatamente o que este plano proíbe.
- Não renomear nem reorganizar componentes existentes além do movimento para `ui/` (higiene de nomes é do plano 14).
- Não criar subpastas adicionais (`ui/forms/`, `ui/layout/` etc.) — uma única camada `ui/` enquanto não houver demanda real (YAGNI).
- Não extrair componente algum (isso é dos planos 01, 02, 04, 11, 15); este plano não gera primitiva própria.
- Não mover `Badge.tsx` agora: só na ocasião do toque funcional do plano 11.

## 7. Riscos e rollback

- **Risco: conflito de merge em imports** quando uma migração por toque acontecer em paralelo a outra branch tocando o mesmo arquivo. Mitigação: um arquivo por commit, nunca lote. Rollback: `git revert` do commit move/reverte isoladamente (imports voltam ao estado anterior).
- **Risco: convenção ignorada por sessões futuras** (pasta nasce, mas próximos componentes voltam à raiz). Mitigação: o Passo 1 registra a regra em `DESIGN.md` + README do diretório de planos; os planos 01/02/04/15 já apontam para cá.
- **Risco: pasta vazia órfã** se o plano registrador for commitado antes de qualquer primitiva. Mitigação: este plano manda a pasta nascer **no mesmo commit** do primeiro componente — diretório vazio nem chega ao repositório (git não versiona pasta vazia).
- **Risco de regressão funcional: mínimo** — nenhum passo altera comportamento; movimentações de arquivo são mecânicas e reversíveis por `git revert` isolado.
