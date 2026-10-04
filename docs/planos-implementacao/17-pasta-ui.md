# 17 · Pasta `ui/` para novas primitivas (adoção por toque) — Plano de Implementação

> Ref.: item **A9** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#17 (nota 2,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: XS · Risco: mínimo · Prioridade global do plano: P3 · Última verificação: **2026-10-03**

## 1. Objetivo

Estabelecer a convenção de que **toda primitiva de UI nova nasce em `src/components/ui/`**, impedindo que a raiz de `src/components/` (hoje com 68 arquivos planos misturando primitivas, navegação e seções de tela) inche com novas extrações. Este plano é **de convenção/adoção, não de código**: ele não extrai componente algum, não move arquivo existente e praticamente não adiciona código próprio — o único artefato permanente é a regra registrada em documentação.

**Situação atual da adoção**: a pasta `ui/` **já existe** e a convenção **já está em adoção de fato** — os planos 01, 02, 04 e 09 criaram suas primitivas diretamente em `ui/`, correndo à frente da parte documental deste plano. O resíduo acionável restante é registrar a regra em documentação e validar a conformidade do que já foi criado.

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em **2026-10-03**:

- **`src/components/ui/` já existe** com 7 componentes, criados pelos planos de extração (a adoção correu à frente deste plano):
  - `src/components/ui/Botao.tsx` (plano 02);
  - `src/components/ui/CabecalhoSumula.tsx` (plano 01);
  - `src/components/ui/CampoTexto.tsx` e `src/components/ui/CampoTextoLongo.tsx` (plano 04);
  - `src/components/ui/ChipTipoLancamento.tsx` e `src/components/ui/LinhaMetaLancamento.tsx` (plano 09);
  - `src/components/ui/PilulaFiltro.tsx` (plano 15, executado em 04/10/2026).
- **68 arquivos planos** na raiz de `src/components/` (contagem confirmada por `find -maxdepth 1 -type f`; eram 63 na medição de 2026-09-30). A lista mistura primitivas (`Badge.tsx`, `ModalBase.tsx`, `Estado.tsx`, `Snackbar.tsx`, `Toggle.tsx`, `Skeletons.tsx`), navegação (`BotaoVoltar.tsx`, `BarraAcaoInferior.tsx`) e seções de tela (`ResumoGestao.tsx`, `PainelPlacar.tsx`, `Secao*.tsx`).
- **A regra NÃO está registrada em documentação** (único resíduo acionável deste plano):
  - `DESIGN.md` §3 ("Estrutura de Diretórios e Responsabilidades") não menciona `src/components/ui/`;
  - `docs/planos-implementacao/README.md` cita o plano 17 na tabela e na filosofia de junção, mas não registra a convenção como regra permanente.
- **Adoção pendente (regra contínua, sem prazo)**: plano 11 → `Badge` (hoje em `src/components/Badge.tsx`) é caso de **migração por toque** — quando o plano tocar o arquivo funcionalmente (prop `densidade`), avaliar mover no mesmo commit. (A adoção pelo plano 15 foi satisfeita em 04/10/2026: `PilulaFiltro` nasceu direto em `ui/`.)
- Os planos dependentes já citam este plano como executor da convenção: `01:26,149`, `02:54,59`, `04:29,151`, `15:43,95`.

## 3. Pré-condições e dependências

- **Nenhum plano é pré-requisito para o que resta** — a criação de primitivas já ocorreu (01, 02, 04, 09) e o registro documental é independente. O ranking segue válido para o futuro: novas extrações (15, 11) devem nascer em `ui/` ou migrar no toque (`rank-melhorias-reuso-codigo.md`, item #17 e §3.5).
- **Decisão do dono exigida antes de executar** (registro, não código):
  1. Aprovar a regra de convenção em si (novas primitivas em `ui/`; raiz congelada para novos arquivos). Na prática ela já é seguida; o registro formaliza o que já acontece.
  2. Confirmar **onde registrar**: `DESIGN.md` §3 ("Estrutura de Diretórios e Responsabilidades") e `docs/planos-implementacao/README.md` — os dois destinos já previstos por este plano. Sem registro, a convenção não sobrevive a outras sessões.
- **Restrições de janela**: nenhuma — não há mudança funcional; o passo documental pode ser aplicado em qualquer momento, inclusive em partida ao vivo.

## 4. Plano de execução (1 passo = 1 commit)

### Já satisfeito (contexto histórico — não executar de novo)

- **Criação da pasta junto do 1º componente novo**: satisfeita. A regra original mandava a pasta nascer no commit do primeiro componente que a adotasse (nunca um commit só com diretório vazio) — os planos 01/02/04/09 seguiram exatamente isso, e `ui/` chegou ao repositório já populada com 6 componentes.
- **Adoção por criação (Passo 2 da versão anterior)**: satisfeita para os planos 01, 02, 04 e 09. Segue valendo para os pendentes: plano 15 (`ui/PilulaFiltro.tsx`, quando o gatilho ocorrer).

### O que resta executar

1. **Passo 1 — Registrar a convenção na documentação** (único artefato permanente restante; commit próprio, sem nenhuma mudança em `src/`):
   - Em `DESIGN.md`, seção §3 "Estrutura de Diretórios e Responsabilidades": adicionar que **primitivas de UI reutilizáveis e sem domínio de negócio nascem em `src/components/ui/`**; componentes existentes permanecem na raiz (migração só por toque).
   - Em `docs/planos-implementacao/README.md`: registrar a regra de forma permanente (não apenas a referência ao plano 17 na tabela), apontando este plano como origem.
   - Origem dos componentes já criados: mencionar que `ui/` foi adotada pelos planos 01, 02, 04 e 09.
2. **Passo 2 — Validar conformidade dos 6 componentes existentes** (sem commit; preencher o checklist da seção 5):
   - Conferir que `Botao`, `CabecalhoSumula`, `CampoTexto`, `CampoTextoLongo`, `ChipTipoLancamento`, `LinhaMetaLancamento` e `PilulaFiltro` são de fato **primitivas sem domínio de tela**: sem conhecimento de rotas, sem acoplamento a dados de domínio (racha/jogador/financeiro), reutilizáveis entre telas.
   - Se algum componente violar a regra, **não mover neste plano**: registrar o desvio como débito no plano correspondente (ou em `34-debitos-registrados.md`) e tratá-lo na migração por toque.

### Regra contínua — migração por toque (sem commit próprio deste plano)

- Um arquivo existente de `src/components/` só se move para `ui/` quando for **tocado por mudança funcional** (não cosmética) **e** for de fato uma primitiva (sem regra de negócio, sem acoplamento a rota).
- **Um arquivo por commit**, junto da mudança funcional que o tocou; nunca lote de mudanças.
- Primeiro candidato natural: `Badge.tsx`, quando o plano 11 (prop `densidade`) o tocar — avaliar mover no mesmo commit.

Regra de bolso para decidir se um componente novo vai para `ui/`: primitiva visual reutilizável, sem conhecimento de rotas nem de domínio (racha/jogador/financeiro) → `ui/`. Seção de tela, formulário de domínio ou peça acoplada a dado → raiz de `src/components/` ou pacote da feature.

## 5. Validação manual

- [ ] **Passo 1**: `DESIGN.md` §3 e `README.md` de `docs/planos-implementacao/` exibem a regra após o commit (revisar o diff antes do push).
- [ ] **Passo 2**: `grep -rn "from '.*ui/" src/` mostra apenas imports dos 7 componentes existentes (o padrão cobre os imports relativos `./ui/…` da raiz de `src/components/`, que o `grep "components/ui"` não captura) — nada de paths aspirados ou componentes fantasma.
- [ ] **Passo 2**: revisão dos imports dos 6 componentes de `ui/` confirma ausência de dependência de rota, feature ou dado de domínio (conformidade à regra de bolso da seção 4).
- [ ] `npm run build` (ou o build do projeto) passa sem erro — os componentes já são consumidos pelas telas.
- [ ] Em cada migração por toque (futura): a tela afetada é exercitada manualmente (abrir, interagir, verificar visual) antes do commit.

## 6. Fora de escopo

- **Não mover os arquivos existentes na raiz de `src/components/`** (68 hoje) para `ui/` — migração em massa é exatamente o que este plano proíbe.
- Não renomear nem reorganizar componentes existentes além do movimento para `ui/` (higiene de nomes é do plano 14).
- Não criar subpastas adicionais (`ui/forms/`, `ui/layout/` etc.) — uma única camada `ui/` enquanto não houver demanda real (YAGNI).
- Não extrair componente algum (isso é dos planos 01, 02, 04, 11, 15); este plano não gera primitiva própria.
- Não alterar os 6 componentes já criados em `ui/` — este plano apenas **verifica** sua conformidade (Passo 2); correções são dos planos de origem.
- Não mover `Badge.tsx` agora: só na ocasião do toque funcional do plano 11.

## 7. Riscos e rollback

- **Risco: conflito de merge em imports** quando uma migração por toque acontecer em paralelo a outra branch tocando o mesmo arquivo. Mitigação: um arquivo por commit, nunca lote. Rollback: `git revert` do commit move/reverte isoladamente (imports voltam ao estado anterior).
- **Risco: convenção ignorada por sessões futuras** (pasta existe, mas próximos componentes voltam à raiz — hoje é o risco central, já que a regra vive só nos planos, não na documentação canônica). Mitigação: o Passo 1 registra a regra em `DESIGN.md` + README do diretório de planos; os planos 01/02/04/15 já apontam para cá.
- **Risco: pasta vazia órfã** — **extinto**. A pasta nasceu já com 6 componentes (planos 01/02/04/09 seguiram a regra de nascer no commit do primeiro componente); diretório vazio nunca chegou ao repositório.
- **Risco de regressão funcional: mínimo** — nenhum passo restante altera comportamento; o Passo 1 é documental e o Passo 2 é somente leitura. Movimentações por toque futuras são mecânicas e reversíveis por `git revert` isolado.
