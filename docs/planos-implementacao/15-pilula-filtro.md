# 15 · `PilulaFiltro` — Plano de Implementação

> Ref.: item **A7** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#15 (nota 2,5)**, Tier 3 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P3

## ⚠️ Status: débito documentado — não executar agora

O ranking (#15, nota 2,5) é explícito: é o único item "de extração" que o próprio plano de origem limita ("só se houver 4º uso ou evolução visual — teto em um componente"). Com 3 usos e sem drift que exija correção centralizada, extrair hoje seria criar abstração sem demanda — exatamente o que o `AGENTS.md` manda evitar (DRY com critério, YAGNI). **Este plano existe para registrar o débito e definir o gatilho de execução**, não para ser executado na onda anti-slop atual.

**Critério de ativação** (qualquer um dos dois, verificado por grep antes de decidir):

1. **4º uso**: surgir um novo call site com o mesmo ternário de pílula ativa/inativa (`bg-destaque text-destaque-tinta` no ativo, `text-giz-fraco` no inativo, geometria `min-h-[44px] rounded-[3px] font-display uppercase`). Ao confirmar, executar este plano e migrar os 4 sites.
2. **Evolução visual das pílulas**: qualquer mudança de design intencional no padrão (ex.: unificar `shadow-carimbo` vs `shadow-xs`, cor de fundo inativo) que precise ser aplicada em todos os usos. Extrair antes da mudança, nunca depois.

Enquanto nenhum gatilho ocorrer, manter os ternários inline nos 3 arquivos atuais. Revisitar este documento sempre que uma tela nova incluir filtros em pílula.

## 1. Objetivo

Quando o gatilho de ativação ocorrer, extrair a assinatura visual da "pílula de filtro" (botão ativo/inativo) para o componente único `PilulaFiltro`, eliminando o ternário de classes repetido nos call sites e criando um único ponto de mudança para o elemento visual. **Neste momento, com 3 usos e variações reais entre eles, a extração é prematura** — o estado atual é aceitável e este é um débito consciente.

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em 2026-09-30 (números e trechos corrigidos onde divergiam dos docs de origem):

- **`src/routes/GestaoJogadores.tsx:322-359`** (o doc de origem citava `322-360`): 4 botões escritos à mão (Todos, Mensalistas, Avulsos, Admins), ternários nas linhas **325, 335, 345, 355**. Ativo: `bg-destaque text-destaque-tinta shadow-carimbo`. Inativo: `bg-superficie border border-borda text-giz-fraco hover:text-giz hover:bg-superficie-2`. Base: `min-h-[44px] px-3 py-1.5 rounded-[3px] font-display font-bold uppercase tracking-wider transition shrink-0 cursor-pointer`. Sem `type="button"` (não está em `<form>`) e com contador dinâmico no `children` (ex.: `Mensalistas ({totalMensalistas}/{MAX_MENSALISTAS})`).
- **`src/components/ModalEscalarJogador.tsx:74-93`** (o doc de origem citava `74-97`): 5 botões via `.map` sobre array constante (`todos`, `goleiros`, `linha`, `mensalistas`, `avulsos`), ternário nas linhas **88-92**. Ativo: `bg-destaque text-destaque-tinta shadow-carimbo`. Inativo: `bg-superficie-2 border border-borda text-giz-fraco hover:text-giz` (**sem** `hover:bg-*`). Base: `min-h-[44px] px-2.5 py-1 rounded-[3px] ... whitespace-nowrap`, com `type="button"`.
- **`src/components/ModalFiltrosRanking.tsx:121-145`** (o doc de origem citava `121-149`): botão "Todas" (linhas 121-131) + `.map` sobre `POSICOES_FILTRO` (linhas 132-145), ternários nas linhas **125-129 e 140-144**. Ativo: `bg-destaque text-destaque-tinta shadow-xs border border-destaque font-black` — **diferente dos outros dois**. Inativo: `border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:bg-superficie`. Base: `min-h-[44px] inline-flex items-center justify-center px-2 py-2 rounded-[3px]`, com `type="button"`.

**Conclusão da verificação: o ternário NÃO é idêntico nos 3 lugares.** Núcleo comum confirmado: `min-h-[44px]`, `rounded-[3px]`, `font-display font-bold uppercase tracking-wider text-xs transition cursor-pointer` e as cores `destaque`/`destaque-tinta` (ativo) e `giz-fraco`/`giz` (inativo). Divergências reais:

| Aspecto | GestaoJogadores | ModalEscalarJogador | ModalFiltrosRanking |
|---|---|---|---|
| Sombra do ativo | `shadow-carimbo` | `shadow-carimbo` | `shadow-xs` + `border-destaque` + `font-black` |
| Fundo do inativo | `bg-superficie` | `bg-superficie-2` | `bg-superficie-2` |
| `hover:bg-*` no inativo | `hover:bg-superficie-2` | ausente | `hover:bg-superficie` |
| Padding | `px-3 py-1.5` | `px-2.5 py-1` | `px-2 py-2` |

Ou seja: há drift, mas é drift **cosmético e sem queixa relatada** — nenhuma correção de comportamento ou a11y fica presa em cópias (o argumento que justificou extrações dos Tiers 1-2). Este é precisamente o limite abaixo do qual extrair componente é abstração sem demanda.

## 3. Pré-condições e dependências

- **Gatilho de ativação** (seção Status): 4º uso confirmado por grep, ou evolução visual das pílulas decidida pelo dono. Sem gatilho, este plano permanece arquivado.
- **Plano 17 (A9 · pasta `ui/`)**: quando executado, `PilulaFiltro` nasce direto em `src/components/ui/PilulaFiltro.tsx` (convenção para primitivas novas), no mesmo commit da extração.
- **Decisão do dono exigida antes de executar**: qual variante de ativo vira o padrão do componente — `shadow-carimbo` (2 de 3 usos) ou `shadow-xs border-destaque font-black` (Ranking). Recomendação: `shadow-carimbo`, majoritária.
- Restrição de janela: nenhuma para `ModalEscalarJogador`/`ModalFiltrosRanking` (markups estáticos). A migração de `GestaoJogadores.tsx` é tela de gestão, não de partida ao vivo — sem janela crítica.

## 4. Plano de execução (1 passo = 1 commit)

Executável apenas quando o gatilho ocorrer.

1. **Criar `src/components/ui/PilulaFiltro.tsx`** — componente único, sem config além do essencial:

   ```tsx
   type PilulaFiltroProps = ComponentProps<'button'> & { ativo: boolean };

   export default function PilulaFiltro({ ativo, className, ...props }: PilulaFiltroProps) {
     return (
       <button
         type="button"
         aria-pressed={ativo}
         className={`min-h-[44px] rounded-[3px] font-display font-bold uppercase tracking-wider text-xs transition cursor-pointer ${
           ativo
             ? 'bg-destaque text-destaque-tinta shadow-carimbo'
             : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz'
         } ${className ?? ''}`}
         {...props}
       />
     );
   }
   ```

   Contrato: prop **`ativo`** decide o ternário; **`children`** recebe o rótulo (incluindo contadores dinâmicos, como em `GestaoJogadores`); **handlers** (`onClick` etc.) passam por spread de `ComponentProps<'button'>` — sem reinventar props. Acessibilidade de graça: `aria-pressed` centralizado. Padding/`whitespace-nowrap`/`shrink-0` por call site via `className` (variação de layout, não de papel visual).
2. **Migrar `ModalEscalarJogador.tsx:74-93`** (site mais próximo do padrão proposto) para `<PilulaFiltro ativo={filtroModal === f.id} onClick={...}>`.
3. **Migrar `ModalFiltrosRanking.tsx:121-145`**, aceitando a normalização do ativo para `shadow-carimbo` (validar visualmente a troca de `shadow-xs`/`font-black`).
4. **Migrar `src/routes/GestaoJogadores.tsx:322-359`** (4 botões), aceitando a normalização do fundo inativo para `bg-superficie-2` e perdendo o `hover:bg-*` do inativo (validar visualmente).

Passos 2-4 são independentes e revertíveis isoladamente; a ordem vai do site mais parecido ao mais divergente, para calibrar o componente antes do caso com mais classes extras.

## 5. Validação manual

- [ ] `npm run build` passa e `tsc` não acusa erros nos 4 arquivos tocados.
- [ ] `GestaoJogadores`: as 4 abas alternam visual ativo/inativo ao toque; contadores dinâmicos renderizam dentro da pílula; scroll horizontal continua funcionando.
- [ ] `ModalEscalarJogador`: as 5 pílulas de filtro alternam corretamente; a lista de candidatos reage a cada filtro.
- [ ] `ModalFiltrosRanking`: posição "Todas" e as 3 posições alternam; o filtro aplicado reflete no Ranking ao confirmar.
- [ ] Alvo de toque ≥ 44px preservado em todos os botões migrados (inspeção visual/devtools).
- [ ] `aria-pressed` presente no DOM dos botões migrados (devtools).
- [ ] Diferenças visuais aceitas pelo dono nos 2 pontos normalizados (sombra no Ranking, fundo/hover inativo na Gestão).

## 6. Fora de escopo

- **Executar agora** — sem o gatilho, os 3 ternários inline permanecem como estão.
- Estender `PilulaFiltro` a outros padrões de botão toggle que não sejam pílula de filtro (ex.: `ModalFiltrosRanking.tsx:96` — botões de ação do rodapé — e `ModalEscalarJogador.tsx:57` — botão "Limpar", papéis visuais distintos).
- Unificar previamente os drifts de sombra/fundo in-place antes da extração (seria duplo churn; a normalização acontece na migração).
- Criar variantes/configs adicionais (tamanhos, formatos, `dense`) — YAGNI; o componente proposto tem o teto mínimo do plano de origem.
- Movimentação de arquivos além da criação em `ui/` (sem migrar os 63 componentes existentes; isso é do plano 17).

## 7. Riscos e rollback

- **Risco de regressão visual nos 2 pontos normalizados** (sombra no `ModalFiltrosRanking`, fundo/hover inativo na `GestaoJogadores`): mitigado pela validação visual do Passo correspondente; cada migração é um commit isolado, revertível com `git revert` sem afetar os outros sites.
- **Risco de abstração errada** (props insuficientes para um uso futuro): o spread de `ComponentProps<'button'>` + `className` cobre variações de layout sem novas props; se um uso futuro exigir mais que isso, é sinal de repensar o componente, não de acumular props opcionais.
- **Risco de o débito apodrecer** (novos usos copiando o ternário sem ninguém lembrar do plano): mitigação barata — ao tocar qualquer arquivo com filtros em pílula, o autor deve consultar este documento; o critério de ativação está no topo, não no fim.
- Rollback geral: todos os passos são commits independentes e mecânicos; `git revert` de qualquer passo restaura o estado anterior sem efeitos colaterais nos demais arquivos.
