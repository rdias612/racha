# 04 · CampoTexto e CampoTextoLongo — Registro de Execução e Validação

> Registro da execução do plano [04-campo-texto.md](../04-campo-texto.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (6 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção.

## 1. Execução

- **6 commits** (`153a41a` → `23fca42`), 1 passo = 1 commit, `tsc -b && vite build` verde em todos.
- Passo 1: `src/components/ui/CampoTexto.tsx` e `CampoTextoLongo.tsx` criados (adoção da convenção do plano 17 — o diretório `ui/` já existia do plano 01). Assinaturas com `Omit<..., 'value' | 'onChange' | 'className'>` + spread de props nativas, conforme o plano. Nenhum chamador alterado neste passo.
- Passos 2–6: os **16 pares migráveis** migrados (13 inputs + 3 textareas) em 5 arquivos:
  - `FormEventoAutomatico.tsx` — 4 pares; a constante `INPUT_CLASS` (:19-20) **morreu** neste commit (`5ffd93f`).
  - `FormLancamentoFinanceiro.tsx` — 4 pares (`aa56695`).
  - `SecaoNotificacaoConfirmacao.tsx` — 2 `CampoTexto` + 2 `CampoTextoLongo` (`c232fc4`).
  - `SecaoNotificacaoVotacao.tsx` — 1+1 renderizados ×5 pelo `map` de `TEMPLATES_VOTACAO` (`40e390b`).
  - `SecaoExportacaoFinanceira.tsx` — 2 (`23fca42`).
- Diff total: 245 inserções / 208 remoções em 7 arquivos (2 componentes + 5 migrados).
- As linhas/contagens do plano bateram 1:1 com o código — nenhuma divergência de evidência nesta execução.

## 2. Normalizações deliberadas aplicadas (sancionadas pelo plano)

1. **Anti-zoom completo `text-base sm:text-sm`**: nasce na receita canônica dos componentes; efetivou-se em FEA, FLF e SEF, cujas cópias tinham só `text-base`.
2. **Foco com `focus-visible:outline-offset-2`**: efetivou-se nos 4 campos de SNC e nos 2×5 de SNV, que não tinham offset.
3. **SNV**: fundo `bg-superficie` → `bg-superficie-2` e rótulo `text-[11px]` → `text-xs` (via receita canônica). **Prop `variante` NÃO foi criada** — decisão do plano ("não criar sem demanda").

## 3. Fora de escopo preservado (confirmado pela auditoria)

- Dentro dos arquivos migrados: os 5 `SelectSumula` do FEA e 2 do FLF mantêm label manual; fieldset "Natureza" intacto; checkbox "Ativo" (FEA) e checkboxes de buckets (SNV) intactos; blocos `span + button` do disparo/antecedência intactos.
- Outros arquivos com diff vazio: `Login.tsx`, `Perfil.tsx`, `Estatisticas.tsx`, `ModalNovoGoleiro.tsx`, `LinhaGoleiro.tsx`, `CampoBusca.tsx`.
- `grep -n "INPUT_CLASS" src/` → vazio; `grep -rn "focus-visible:outline-destaque-texto" src/components/` restrito aos componentes novos, `CampoBusca` e casos pré-existentes fora de escopo.

## 4. Validações técnicas confirmadas pela auditoria

- 6 commits atômicos, cada um tocando só os arquivos do seu passo; superfície de diff = exatamente os 7 arquivos esperados (nenhum CSS, rota, sw.js ou componente extra).
- Receita de classes dos componentes **idêntica caractere a caractere** ao plano; tabela dos 16 pares conferida com todas as props preservadas (required, maxLength 120/500, min/step/inputMode, type="date", fonteMono, placeholders condicionais como expressões, col-span-2 via className).
- `npm run build` e `npm run lint` passam.

## 5. Observações da auditoria (nenhuma exige ação)

1. Campos sem `tipo` ficam sem atributo `type` explícito (`type={undefined}` — React omite; default HTML é `text`). Comportamento idêntico aos `type="text"` originais.
2. `placeholder`/`maxLength` redeclarados nas interfaces embora existam nos tipos nativos — redundância inofensiva, prevista textualmente no plano (fidelidade, não desvio).
3. Débito pré-existente (não introduzido, fora de escopo): `SeletorAtletasComparador.tsx:34,56` carrega a fórmula inline com `text-base` sem `sm:text-sm` — entra "ao tocar o arquivo", conforme seção 6 do plano.

## 6. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] Comparação visual lado a lado dos 5 formulários migrados (campos idênticos, exceto as normalizações da seção 2).
- [ ] **Anti-zoom** em aparelho (largura <sm): teclado não amplia a página em cada campo; em ≥sm, recuo para 14px em FEA/FLF/SEF.
- [ ] Foco via `Tab`: contorno âmbar visível, com offset nos campos de SNC/SNV.
- [ ] Validação HTML: `required` (Nome/Valor/Descrição do FEA, Valor do FLF) bloqueia submit vazio; `maxLength` 120/500; `min/step` no Valor; `type="date"` abre seletor nativo.
- [ ] Grids: pares de 2 colunas lado a lado; `col-span-2` com largura total.
- [ ] Notificações: editar título/mensagem, salvar e conferir persistência (SNC); abrir os 5 buckets do acordeão e conferir os 10 campos (SNV).
- [ ] Exportação: gerar Excel de período válido e conferir a validação "data inicial > final".
