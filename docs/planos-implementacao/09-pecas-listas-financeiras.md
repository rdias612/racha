# 09 · Peças das listas financeiras — Plano de Implementação

> Ref.: item **A6** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#9 (nota 5,5)**, Tier 2 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P2

## 1. Objetivo

Desacoplar as peças compartilhadas das duas listas da tela Administrador (financeiro): hoje `COR_TIPO` — um mapa de classes de apresentação sobre `TipoDivida` — é **exportada de um componente de UI e importada por outro** (acoplamento invertido entre irmãos), e a **linha de metadados do lançamento** (badge de natureza + chip de tipo + referência + data) está copiada entre Receitas e Despesas. A extração devolve a constante de estilo a um ponto único e elimina o JSX duplicado, sem alterar comportamento nem visual.

## 2. Estado atual (evidências verificadas)

Conferidas no código em 2026-09-30. Nenhum número divergiu do doc de origem.

- **`COR_TIPO` mora em componente de UI**: `src/components/ListaReceitasAbertas.tsx:15-22` — `export const COR_TIPO: Record<TipoDivida, string>` (classes Tailwind por tipo de lançamento), com comentário na própria linha 14 admitindo que é "compartilhado com ListaDespesasAbertas".
- **Acoplamento invertido**: `src/components/ListaDespesasAbertas.tsx:4` — `import { COR_TIPO } from './ListaReceitasAbertas'`; um componente irmão importa constante de outro para renderizar.
- **Uso nos dois arquivos**: mesmo JSX do chip de tipo copiado — `ListaReceitasAbertas.tsx:150-154` e `ListaDespesasAbertas.tsx:50-54` (`<span className={...${COR_TIPO[d.tipo]}}>` + `labelTipoDivida(d.tipo)`).
- **Linha de metadados duplicada**: `ListaReceitasAbertas.tsx:148-163` vs `ListaDespesasAbertas.tsx:48-63` — mesmo bloco `<div className="flex flex-wrap items-center gap-1.5">` com Badge de natureza + chip de tipo + `ref. {d.referencia}` + `formatarDataLista(d.data_divida)`. Única divergência entre as cópias: o Badge (`variante="ok"`/label "Receita" vs `variante="perigo"`/label "Despesa").
- **`ChipTipoLancamento` e `LinhaMetaLancamento` não existem ainda** (nomes propostos; confirmado por grep em `src/`).
- **`src/lib/dividas.ts` existe e já concentra o domínio**: `TipoDivida` (`:9`), `TIPOS_DIVIDA` (`:16-23`), `labelTipoDivida` (`:140-142`), `NATUREZAS_LANCAMENTO` (`:11-14`) — `COR_TIPO` é o par natural de `labelTipoDivida` (o rótulo e a cor do mesmo tipo).
- **Call sites das duas listas**: apenas `src/routes/Administrador.tsx:227-241` (uma tela consome cada lista; nenhum outro arquivo importa `COR_TIPO` — recontado por grep).
- **Rodapé "Fechar"**: a duplicação de rodapés/botões de modal (incluindo o submit do `FormLancamentoFinanceiro.tsx:221-236`) **já é escopo do plano 02 · A2** (passos 4–5) — não é tratada aqui.

## 3. Pré-condições e dependências

- **Nenhum plano é pré-requisito**. O plano 02 (Botao) reduz o custo total da onda anti-slop, mas não bloqueia este item: os artefatos aqui (constante de cor + chip + linha de metadados) são independentes de como os botões serão extraídos.
- **Nota de dependência (não escopo)**: o rodapé "Fechar" dos modais e o submit do formulário financeiro caem naturalmente no plano 02 (passos 4–5). Este plano **não** toca neles — ver §6.
- **Decisão do dono (leve)**: este plano adota a variante **"componente único"** da proposta A6 — `COR_TIPO` vira constante **privada** dentro de `ChipTipoLancamento.tsx`, em vez de migrar para `lib/dividas.ts`. Justificativa: `COR_TIPO` contém classes Tailwind (apresentação); movê-la para a `lib` de domínio colocaria CSS dentro do módulo que hoje guarda tipos, queries e regras — inversão de camadas. Se o dono preferir a `lib` (leitura do ranking: "devolve a responsabilidade ao lugar certo"), o passo 1 muda só o destino do artefato; os passos 2+ não mudam.
- **Localização dos novos componentes**: raiz de `src/components/`, como os 63 existentes. Se a pasta `ui/` (plano 17 · A9) já existir na hora da execução, nascer lá; caso contrário, raiz — sem mover nada retroativamente.
- **Restrições de janela**: nenhuma — a tela Administrador não participa de partida ao vivo.

## 4. Plano de execução (1 passo = 1 commit)

Cada passo é pequeno, reversível por `git revert` isolado e deixa o build funcionando. Migração completa em 2 commits (apenas 2 arquivos consumidores).

1. **Extrair `ChipTipoLancamento`** — criar `src/components/ui/ChipTipoLancamento.tsx` (conforme §3, pois a pasta `ui/` já existe) com `COR_TIPO` como constante **privada** do módulo (sem `export`) e a assinatura:

   ```tsx
   interface ChipTipoLancamentoProps {
     tipo: TipoDivida;
   }
   export function ChipTipoLancamento({ tipo }: ChipTipoLancamentoProps)
   ```

   O componente renderiza exatamente o `<span>` atual (classes de `COR_TIPO[tipo]` + `labelTipoDivida(tipo)`), importando `labelTipoDivida`/`TipoDivida` de `../../lib/dividas`. Migrar os 2 call sites no mesmo commit: `ListaReceitasAbertas.tsx` e `ListaDespesasAbertas.tsx`. Remover a exportação de `COR_TIPO` de `ListaReceitasAbertas.tsx` e o import de `ListaDespesasAbertas.tsx` — o acoplamento invertido morre neste commit. Zero mudança visual.
2. **Extrair `LinhaMetaLancamento`** — criar `src/components/ui/LinhaMetaLancamento.tsx` encapsulando a linha de metadados (usa `ChipTipoLancamento` internamente):

   ```tsx
   interface LinhaMetaLancamentoProps {
     natureza: NaturezaLancamento;   // define o Badge: receita → variante "ok"/"Receita", despesa → "perigo"/"Despesa"
     tipo: TipoDivida;
     referencia: string | null;      // renderiza "ref. …" só se preenchida
     data: string;                   // formatarDataLista(data)
   }
   ```

   Migrar os 2 call sites: `ListaReceitasAbertas.tsx:148-163` e `ListaDespesasAbertas.tsx:48-63` passam a renderizar `<LinhaMetaLancamento … />`; tudo que vem **depois** da linha (descrição, link da partida, PIX, botões) permanece em cada lista — as cópias divergem justamente aí. Zero mudança visual esperada (as classes são movidas, não reescritas).

## 5. Validação manual

Sem testes automáticos (AGENTS.md); após cada passo:

- [ ] `npm run build` passa (sem erro de TypeScript/lint).
- [ ] Tela Administrador → "Receitas em aberto": expandir um grupo; cada lançamento mostra badge verde "Receita", chip do tipo com a cor correta (mensalidade âmbar, avulso verde, goleiro/campo/outro neutros), `ref.` quando houver e a data.
- [ ] Tela Administrador → "Despesas em aberto": mesmo chip de tipo nas despesas, badge vermelho "Despesa", `ref.`/data corretos, chave PIX e botão "Copiar PIX" intactos.
- [ ] Chip de tipo e linha de metadados **idênticos visualmente ao estado anterior** (comparar com print anterior à mudança, se disponível) — o plano não altera estilo.
- [ ] Quitar um lançamento de cada lista continua funcionando (botões "Pagar" não foram tocados).
- [ ] Lembrete WhatsApp (botão de mensagem no grupo de receitas) segue copiando normalmente.

## 6. Fora de escopo

- **Unificar as duas listas inteiras** (`ListaReceitasAbertas` vs `ListaDespesasAbertas`): expressamente proibido — elas divergem de propósito (agrupamento por jogador com expansão vs lista plana; lembrete WhatsApp, "Quitar todas", link de partida vs bloco PIX). Só as **peças compartilhadas** saem deste plano.
- **Rodapé "Fechar" e submit do formulário financeiro**: escopo do plano 02 · A2 (passos 4–5). Nenhuma migração de botão aqui, mesmo que o `Botao` já exista.
- **Chip "mini" (9px) em geral**: padronização via prop `densidade` no `Badge` é o plano 11 · A8 — o chip extraído aqui mantém as classes atuais, sem adiantar aquela mudança.
- **Mover as listas ou os novos componentes para `ui/` retroativamente**: adoção só por toque (plano 17 · A9).
- **Novas bibliotecas ou abstrações** (variant maps tipados genéricos, `cva`, etc.): tudo com Tailwind + `Record` simples, como o `Badge` já faz.
- **Testes automáticos**: não criar (AGENTS.md); validação manual conforme §5.

## 7. Riscos e rollback

- **Risco: regressão visual no chip/linha** — baixo, pois as classes são movidas literalmente, não reescritas; a única montagem nova é o mapeamento `natureza` → variante do Badge (2 casos, ambos cobertos na §5). Rollback: `git revert` do passo afetado; os passos não dependem entre si em runtime (o passo 1 deixa o chip standalone; o passo 2 apenas o consome).
- **Risco: `COR_TIPO` privada quebrar import futuro** — se algum código novo importar `COR_TIPO` de `ListaReceitasAbertas` após o passo 1, o build quebra em compile-time (falha visível, não silenciosa); o caminho correto passa a ser `ChipTipoLancamento` ou a constante internalizada.
- **Risco: escolha de localização (componente vs `lib`)** — decidido antes do passo 1 (§3); reverter a decisão depois custa só mover a constante num commit único, sem tocar call sites além dos imports.
- **Todos os passos são revertíveis por `git revert` isolado**: o passo 1 cria 1 arquivo e edita 2; o passo 2 cria 1 arquivo e edita os mesmos 2. Nenhum passo altera queries, estado ou fluxo de dados.
