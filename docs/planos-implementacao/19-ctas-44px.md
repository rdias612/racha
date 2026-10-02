# 19 · Alvos de toque 44px nos CTAs-Link — Plano de Implementação

> Ref.: item **C1** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#19 (nota 1,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: mínimo · Prioridade global do plano: P1

## 1. Objetivo

Elevar os 2 CTAs implementados como `<Link>` (que renderiza `<a>`) à altura mínima de toque de 44px exigida pelo design do app (`DESIGN.md` / regra global de `index.css`): **"Nova partida"** no mural de Jogos (hoje ≈32px, apertado demais para o polegar) e **"Editar votos"** no detalhe da partida (no limite ≈42-44px, oscila conforme line-height). A correção é **pontual nos 2 elementos** (`min-h-[44px]` + centralização flex), sem tocar no seletor global e sem criar abstração nenhuma.

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#19, nota 1,0) — não remove duplicação; é "preencher lacuna" da regra que já existe, não unificar. No plano original o C1 é **P1 de esforço mínimo**, indicado para a Fase 1 do roadmap. O ganho é de UX/acessibilidade (alvo de toque), integralmente preservado pelo critério original do plano.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; divergências de linha do doc de origem corrigidas abaixo:

- `src/index.css:146-152` — regra global de alvo de toque cobre **apenas** `button, [role='button']` (`:146-148`) e `input[type='range']` (`:151-152`); **não cobre `<a>`**. (Linhas revalidadas em 02/10/2026, na execução do plano.)
- `src/routes/Jogos.tsx:83-89` — CTA-Link **"Nova partida"** (`Link` do react-router, className em `:85`): `inline-flex items-center gap-1 ... px-3 py-1.5` — `text-xs` + `py-1.5` resultam em **≈32px** de altura, abaixo do alvo.
- `src/routes/PartidaDetalhe.tsx:269-274` — CTA-Link **"Editar votos"** (`Link`, className em `:271`): `block text-center ... px-4 py-3` — **≈42-44px**, no limiar; fica dentro da grade `grid grid-cols-2 gap-2` (`:268`) ao lado de um `<button>` irmão (`:275-281`) que **já recebe os 44px da regra global** — os dois elementos do par têm alturas potencialmente diferentes hoje.
- TabBar e menu admin: OK, fora do escopo (conforme doc de origem).
- **Divergência do exemplo citado no doc de origem**: `EscalacaoTimesEditor.tsx:335` citado como "o e-mail" é, no código real, o className do botão inline **"+ Novo"** (`text-xs font-mono hover:underline`, `:332-338`) — um `<button>`, **já coberto** pela regra global (inclusive com `min-h-[44px]` explícito). O exemplo correto de link inline de texto que a extensão global inflaria é `src/components/ListaReceitasAbertas.tsx:166-172` (`Link` → `<a>` com `inline-block text-[11px] ... hover:underline`). A tese do doc de origem continua válida; apenas a evidência citada diverge.
- Não há nenhum `<a>` literal em `src/**.tsx` (grep confirmado): os âncoras do app vêm todos do `<Link>` do react-router.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** O item é autônomo (2 classes utilitárias Tailwind em 2 arquivos).
- **Coordenação com o plano 02 (A2 · `Botao`)**: se o plano 02 for executado **antes** deste e o dono escolher a **Opção B (constantes de classe**, ex. `ASSINATURA_BOTAO` / `Record<VarianteBotao, string>`, seguindo o padrão do `Badge`**)**, os 2 CTAs-Link podem consumir as constantes no `className` em vez de colar `min-h-[44px]` manualmente — o 44px viraria invariante da constante. Nesse caso, os passos abaixo mudam só na forma (constante + ajuste local) e não no conteúdo. Se o plano 02 optar pelo componente `Botao` (Opção A) ou não tiver sido executado, seguir os passos como escritos (classes utilitárias diretas). **Decisão do dono exigida antes de executar**: apenas esta — classes diretas (default) ou consumir constantes do 02, se ele já existir.
- **Restrição de janela**: nenhuma fora do comum. O CTA de votação só aparece com votação aberta e usuário participante (`PartidaDetalhe.tsx:265`) — validar com uma partida nessas condições (ver seção 5).

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Correção pontual dos 2 CTAs-Link · 1 commit

- **`src/routes/Jogos.tsx`** (className do `Link` "Nova partida", `:85`) — acrescentar `min-h-[44px]` à lista de classes. O elemento já é `inline-flex items-center`, então a centralização vertical vem de graça com a altura mínima:

  ```tsx
  className="inline-flex min-h-[44px] items-center gap-1 text-xs font-display font-bold uppercase tracking-wider rounded-[3px] border border-destaque bg-destaque text-destaque-tinta px-3 py-1.5 shadow-carimbo hover:brightness-105 transition active:translate-y-px"
  ```

- **`src/routes/PartidaDetalhe.tsx`** (className do `Link` "Editar votos", `:271`) — trocar `block text-center` por `flex items-center justify-center` e acrescentar `min-h-[44px]` (centralização horizontal e vertical explícitas, sem depender de line-height):

  ```tsx
  className="flex min-h-[44px] items-center justify-center rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo transition active:translate-y-px"
  ```

  Como o elemento é célula da grade `grid grid-cols-2`, `flex` preenche a célula normalmente (o `block` atual também preenche — comportamento preservado). O `<button>` irmão ("Descartar votos", `:279-283`) não é tocado: já recebe 44px da regra global; com o `Link` também em 44px, o par fica uniforme.

- Nenhum outro arquivo é tocado. Nenhuma alteração em `src/index.css`, nenhum componente novo, nenhuma dependência nova.
- Conferir com `tsc -b` (ou o build do projeto) que não há erro (mudança é só de className, mas o hábito vale).
- Commit: "garante alvo de toque 44px nos CTAs-Link (C1)".

Total: 1 commit, 2 arquivos, ~2 linhas líquidas.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no build de dev (`npm run dev`) + DevTools; ideal em aparelho real (o item é de toque):

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Mural Jogos** (`/jogos`), logado como admin: o CTA "Nova partida" tem altura de 44px (inspecionar no DevTools: `min-height: 44px`, caixa do elemento ≥ 44px) e o rótulo fica centralizado verticalmente (não "grudado" em cima com o padding antigo).
- [ ] Layout do cabeçalho do mural não quebra: o CTA segue alinhado à direita, na mesma linha do bloco "Temporada Oficial", sem empurrar conteúdo (o aumento é de ~12px de altura — conferir em viewport estreito, ex. 360px).
- [ ] **Toque real**: em aparelho (ou emulação de toque), tocar "Nova partida" na borda superior/inferior da área do elemento e confirmar que a navegação para `/partida/nova` dispara mesmo em toque próximo à borda.
- [ ] **Detalhe da partida com votação aberta** (usuário participante, não-random, tendo **já votado**): o par "Editar votos" / "Descartar votos" fica com os **dois botões na mesma altura** (44px), alinhados na grade 2 colunas.
- [ ] Tocar "Editar votos" e confirmar navegação para `/partida/:id/votar`.
- [ ] Cenário "ainda não votou" (o CTA de votação principal) e votação fechada: sem mudança visual (esses elementos não foram tocados).
- [ ] Passar o mouse no desktop: `hover:brightness-105` (Jogos) e `active:translate-y-px` seguem funcionando; `focus-visible` âmbar global (`index.css:158-159`) intacto nos dois links.

## 6. Fora de escopo

- **Não** estender o seletor global de `src/index.css` para `a` — inflaria links inline de texto corrido, como o `Link` "ver partida →" em `ListaReceitasAbertas.tsx:166-172` (`text-[11px] hover:underline`). A regra global permanece restrita a `button`, `[role='button']` e `input[type='range']`.
- **Não** migrar os CTAs para um componente `Botao` ou para as constantes do plano 02 neste item — a coordenação com o 02 é opcional (seção 3) e, se ocorrer, é o plano 02 que entrega o artefato.
- **Não** auditar nem ajustar outros `<Link>` do app além dos 2 citados (TabBar e menu admin já estão OK, conforme doc de origem); novos CTAs-Link que surgirem devem nascer com `min-h-[44px]`, mas não são escopo deste plano.
- **Não** criar teste automatizado de acessibilidade/alvo de toque, nem alterar tokens, breakpoints ou o `DESIGN.md`.

## 7. Riscos e rollback

- **Risco funcional: mínimo.** As mudanças são só de classes utilitárias em 2 elementos; nenhum estado, rota ou dado é tocado.
- **Risco visual: baixo e localizado.** O CTA de Jogos cresce ~12px de altura — o único layout sensível é o cabeçalho do mural em telas estreitas, coberto pelo checklist da seção 5. O de PartidaDetalhe já era ≈42-44px; a mudança perceptível é a uniformidade com o botão irmão.
- **Risco de regressão em links inline: zero** — o seletor global não é alterado (é justamente o ponto do fora de escopo).
- **Rollback**: `git revert` do commit único restaura os 2 className originais. Reversão total e isolada, sem dependência de outros planos.
