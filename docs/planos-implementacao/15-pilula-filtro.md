# 15 · `PilulaFiltro` — Plano de Implementação

> Ref.: item **A7** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#15 (nota 2,5)**, Tier 3 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P3

## ⚠️ Status: débito arquivado — gatilho original revisto, não executar agora

> **Atualização 04/10/2026**: **executado** por decisão do dono (pedido explícito), sem aguardar o gatilho — caminho da seção 4 (componente próprio), alternativa `Botao` descartada. Ver [registro](registros/15-pilula-filtro.md). O texto abaixo fica como histórico do arquivamento.

O ranking (#15, nota 2,5) é explícito: é o único item "de extração" que o próprio plano de origem limita ("só se houver 4º uso ou evolução visual — teto em um componente"). **A verificação de 2026-10-03 alterou a premissa central do plano**: `GestaoJogadores.tsx` foi migrado para `<Botao variante={...}>` (commit `620f55f`, onda 5 do plano 02), eliminando o maior dos 3 call sites originais — e provando que o `Botao` com variante já produz o estado ativo de pílula em botões-encaixáveis (`ui/Botao.tsx:20` gera exatamente `bg-destaque text-destaque-tinta shadow-carimbo`, o estado que a `PilulaFiltro` replicaria).

Com isso, o critério original do "4º uso" **não é mais o gatilho correto**: restam 2 arquivos com o ternário de classes inline e o componente `Botao` cobre o papel "botão-toggle de filtro". O que restaria para uma `PilulaFiltro` dedicada é um recorte menor — pílulas que não são `<button>`-ação (NavLinks de navegação, fora do alcance do `Botao`) ou onde normalizar para `Botao` não for visualmente aceitável. Há ainda um caminho alternativo mais barato que o componente novo: migrar os 2 modais restantes para `<Botao variante>` com `className` de padding, zerando os ternários sem criar abstração (a decidir pelo dono).

**Critério de ativação revisado** (qualquer um, verificado por grep antes de decidir):

1. **Novo call site de pílula que não encaixe no `Botao`**: surgir uma pílula de filtro `<button>` onde o `Botao` não atende — por divergência visual relevante do par `primario`/`secundario` que o dono não aceite normalizar, ou por precisar de semântica toggle (`aria-pressed`) que o `Botao` não oferece. Um 3º uso nessa condição justifica a extração.
2. **Evolução visual das pílulas**: qualquer mudança de design intencional no padrão (ex.: unificar `shadow-carimbo` vs `shadow-xs`, cor de fundo inativo) que precise ser aplicada em todos os usos. Extrair antes da mudança, nunca depois.

**Avaliação revisada**: com 2 call sites restantes e o estado ativo já centralizado no `Botao` para botões-encaixáveis, o gatilho original não justifica mais execução imediata. O plano continua existindo como registro do débito e definição de gatilho; a decisão entre executar, migrar os modais para `Botao` ou aposentar este plano é do dono.

## 1. Objetivo

Quando o gatilho de ativação ocorrer, extrair a assinatura visual da "pílula de filtro" (botão ativo/inativo) para o componente único `PilulaFiltro`, eliminando o ternário de classes repetido nos call sites restantes e criando um único ponto de mudança para o elemento visual. **Neste momento, com 2 usos restantes e o `Botao` já cobrindo o estado ativo de botões-encaixáveis, a extração é prematura** — o estado atual é aceitável e este é um débito consciente.

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em **2026-10-03** (números e trechos corrigidos onde divergiam das medições anteriores):

- **`src/components/ui/Botao.tsx:16-23`** (novo desde a medição de 2026-09-30): componente de botão com variantes. `primario` (**linha 20**): `border-destaque bg-destaque text-destaque-tinta shadow-carimbo hover:brightness-105` — é exatamente o estado ativo de pílula dos usos originais. `secundario` (linha 21): `border-borda bg-superficie-2 text-giz shadow-xs hover:bg-superficie`. Base (linhas 16-17): `min-h-[44px] inline-flex items-center justify-center ... rounded-[4px] ... text-xs transition` com `type="button"` por padrão.
- **`src/routes/GestaoJogadores.tsx:328-359`** — **migrado para `Botao` no commit `620f55f`** (onda 5 do plano 02). Os 4 ternários de classes manuais que existiam aqui não existem mais; hoje são 4 `<Botao variante={filtro === X ? 'primario' : 'secundario'} className="shrink-0 px-3 cursor-pointer">` (Todos, Mensalistas, Avulsos, Admins), mantendo os contadores dinâmicos no `children` (ex.: linha 342, `Mensalistas ({totalMensalistas}/{MAX_MENSALISTAS})`). Resta apenas o ternário de **variante** (linhas 330, 338, 346, 354) — sem repetição de classes de estilo.
- **`src/components/ModalEscalarJogador.tsx:81-93`**: 5 pílulas via `.map` sobre array constante (linhas 72-80: `todos`, `goleiros`, `linha`, `mensalistas`, `avulsos`), ternário nas linhas **85-89**. Ativo (linha 87): `bg-destaque text-destaque-tinta shadow-carimbo` — idêntico à variante `primario` do `Botao` (exceto padding/`rounded`/hover). Inativo (linha 88): `bg-superficie-2 border border-borda text-giz-fraco hover:text-giz` (**sem** `hover:bg-*`). Base: `min-h-[44px] px-2.5 py-1 rounded-[3px] ... whitespace-nowrap`, com `type="button"` (linha 83).
- **`src/components/ModalFiltrosRanking.tsx:116-143`**: botão "Todas" (linhas 116-126) + `.map` sobre `POSICOES_FILTRO` (linhas 127-143), ternários nas linhas **119-123 e 134-138**. Ativo (linhas 121 e 136): `bg-destaque text-destaque-tinta shadow-xs border border-destaque font-black` — **diferente da variante `primario` do `Botao`**. Inativo (linhas 122 e 137): `border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:bg-superficie`. Base: `min-h-[44px] inline-flex items-center justify-center rounded-[3px] px-2 py-2 ...`, com `type="button"` (linhas 117 e 132).

**Conclusão da verificação: sobraram 2 arquivos com o ternário de classes inline (3 blocos de pílula).** Núcleo comum confirmado: `min-h-[44px]`, `rounded-[3px]`, `font-display font-bold uppercase tracking-wider text-xs transition cursor-pointer` e as cores `destaque`/`destaque-tinta` (ativo) e `giz-fraco`/`giz` (inativo). Divergências reais entre os 2 restantes:

| Aspecto | ModalEscalarJogador | ModalFiltrosRanking |
|---|---|---|
| Sombra do ativo | `shadow-carimbo` | `shadow-xs` + `border-destaque` + `font-black` |
| `hover:bg-*` no inativo | ausente | `hover:bg-superficie` |
| Padding | `px-2.5 py-1` | `px-2 py-2` |
| `whitespace-nowrap` | presente | ausente |

Observação adicional de 2026-10-03: os NavLinks de navegação (`AbasEstatisticas.tsx:34-39`, `AbasNotificacoes.tsx:29-33`, `AbasClipesAdmin.tsx:30-34`, `Ranking.tsx:184-228`) repetem a linguagem visual da pílula, mas são **navegação de rota, não `<button>` de filtro** — fora do alcance tanto do `Botao` quanto da `PilulaFiltro` proposta (que renderiza `<button>`). Não contam como call sites deste plano.

Ou seja: há drift, mas é drift **cosmético e sem queixa relatada**, agora restrito a 2 arquivos dentro de modais — ainda menos superfície do que na medição original. Continua sendo o limite abaixo do qual extrair componente é abstração sem demanda.

## 3. Pré-condições e dependências

- **Gatilho de ativação revisado** (seção Status): novo call site de pílula que não encaixe no `Botao`, ou evolução visual das pílulas decidida pelo dono. Sem gatilho, este plano permanece arquivado.
- **Alternativa mais barata a avaliar antes de executar**: migrar `ModalEscalarJogador.tsx:81-93` e `ModalFiltrosRanking.tsx:116-143` para `<Botao variante={ativo ? 'primario' : 'secundario'}>` com `className` de padding (o padrão já adotado em `GestaoJogadores.tsx:328-359`). Elimina os ternários de classes sem componente novo; custo: normalizar `rounded-[4px]`→base do `Botao` e aceitar `hover:bg-superficie`/`text-giz` do `secundario` onde hoje não há. Se o dono preferir esse caminho, este plano pode ser aposentado.
- **Plano 17 (A9 · pasta `ui/`)**: quando executado, `PilulaFiltro` nasce direto em `src/components/ui/PilulaFiltro.tsx` (convenção para primitivas novas), no mesmo commit da extração.
- **Decisão do dono exigida antes de executar** (se optar pelo componente): qual variante de ativo vira o padrão do componente — `shadow-carimbo` (`ModalEscalarJogador`, também a da variante `primario` do `Botao`) ou `shadow-xs border-destaque font-black` (Ranking). Recomendação: `shadow-carimbo`, alinhada ao `Botao` e ao design system.
- Restrição de janela: nenhuma — os 2 call sites restantes estão em modais de gestão (markups estáticos), não em partida ao vivo.

## 4. Plano de execução (1 passo = 1 commit)

Executável apenas quando o gatilho ocorrer (e após o dono descartar a alternativa "migrar para `Botao`" da seção 3).

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

   Contrato: prop **`ativo`** decide o ternário; **`children`** recebe o rótulo; **handlers** (`onClick` etc.) passam por spread de `ComponentProps<'button'>` — sem reinventar props. Acessibilidade de graça: `aria-pressed` centralizado (estado toggle que o `Botao` não oferece). Padding/`whitespace-nowrap` por call site via `className` (variação de layout, não de papel visual).
2. **Migrar `ModalEscalarJogador.tsx:81-93`** (site mais próximo do padrão proposto) para `<PilulaFiltro ativo={filtroModal === f.id} onClick={...}>`.
3. **Migrar `ModalFiltrosRanking.tsx:116-143`** (botão "Todas" + `.map` de `POSICOES_FILTRO`), aceitando a normalização do ativo para `shadow-carimbo` (validar visualmente a troca de `shadow-xs`/`font-black`).

Passos 2-3 são independentes e revertíveis isoladamente; a ordem vai do site mais parecido ao mais divergente, para calibrar o componente antes do caso com mais classes extras.

## 5. Validação manual

- [ ] `npm run build` passa e `tsc` não acusa erros nos 3 arquivos tocados.
- [ ] `ModalEscalarJogador`: as 5 pílulas de filtro alternam corretamente; a lista de candidatos reage a cada filtro; scroll horizontal da barra de filtros continua funcionando.
- [ ] `ModalFiltrosRanking`: posição "Todas" e as 3 posições alternam; o filtro aplicado reflete no Ranking ao confirmar.
- [ ] Alvo de toque ≥ 44px preservado em todos os botões migrados (inspeção visual/devtools).
- [ ] `aria-pressed` presente no DOM dos botões migrados (devtools).
- [ ] Diferença visual aceita pelo dono no 1 ponto normalizado (sombra/`font-black` no Ranking).

## 6. Fora de escopo

- **Executar agora** — sem o gatilho revisado, os 2 ternários inline permanecem como estão.
- Migrar os 2 modais para `<Botao variante>` sem componente novo — é a **alternativa** registrada na seção 3; só vira caminho escolhido por decisão do dono, e nesse caso este plano é aposentado.
- Estender `PilulaFiltro` (ou o `Botao`) aos NavLinks de navegação que repetem a linguagem visual (`AbasEstatisticas.tsx:34-39`, `AbasNotificacoes.tsx:29-33`, `AbasClipesAdmin.tsx:30-34`, `Ranking.tsx:184-228`) — são navegação, não botão-toggle; exigiria polimorfismo de elemento fora do teto deste plano.
- Botões de ação/rodapé dos modais — já são `Botao` (`ModalFiltrosRanking.tsx:93-105`, `ModalEscalarJogador.tsx:55-57`); papéis visuais distintos, nada a fazer.
- Unificar previamente os drifts de sombra/fundo in-place antes da extração (seria duplo churn; a normalização acontece na migração).
- Criar variantes/configs adicionais (tamanhos, formatos, `dense`) — YAGNI; o componente proposto tem o teto mínimo do plano de origem.
- Movimentação de arquivos além da criação em `ui/` (sem migrar os componentes existentes; isso é do plano 17).

## 7. Riscos e rollback

- **Risco de regressão visual no 1 ponto normalizado** (sombra/`font-black` no `ModalFiltrosRanking`): mitigado pela validação visual do Passo 3; cada migração é um commit isolado, revertível com `git revert` sem afetar o outro site.
- **Risco de abstração errada** (props insuficientes para um uso futuro): o spread de `ComponentProps<'button'>` + `className` cobre variações de layout sem novas props; se um uso futuro exigir mais que isso, é sinal de repensar o componente, não de acumular props opcionais.
- **Risco de o débito apodrecer** (novos usos copiando o ternário sem ninguém lembrar do plano): mitigado pelo padrão já estabelecido — novos botões de filtro devem nascer como `<Botao variante>` (padrão de `GestaoJogadores.tsx:328-359`), não com ternário de classes; o critério de ativação está no topo, não no fim.
- **Risco de o plano ficar obsoleto** (a alternativa "migrar para `Botao`" ser executada sem atualizar este doc): registrar no histórico do repositório a decisão do dono e marcar o plano como aposentado nesse caso.
- Rollback geral: todos os passos são commits independentes e mecânicos; `git revert` de qualquer passo restaura o estado anterior sem efeitos colaterais nos demais arquivos.
