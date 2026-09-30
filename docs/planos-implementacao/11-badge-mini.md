# 11 · Chip "mini" no `Badge` — Plano de Implementação

> Ref.: item **A8** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#11 (nota 4,0)**, Tier 3 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P2

## 1. Objetivo

Consolidar no `Badge` a assinatura visual de "chip" que ele já encapsula em 10px, hoje recriada manualmente em 9px por ~10 `<span>`s espalhados (Gestão de jogadores, Perfil, lista de receitas). A mudança é uma única prop nova (`densidade?: 'normal' | 'mini'`), que elimina as cópias da geometria `rounded-[2px] px-1.5 py-0.5 uppercase tracking-*` e o drift já visível entre elas (peso de fonte, opacidades de borda). **Não** se cria um componente `Chip` separado — duas abstrações para o mesmo papel, como o doc de origem deixa explícito.

## 2. Estado atual (evidências verificadas)

Conferidas no código em 2026-09-30.

- **A assinatura que o `Badge` já encapsula**: `src/components/Badge.tsx:86-87` — `baseClasses = 'inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-display font-black uppercase tracking-widest text-[10px] leading-tight select-none'`; variantes de cor em `VARIANTE_CLASSES` (`Badge.tsx:56-63`: `posicao`, `destaque`, `ok`, `perigo`, `neutro`, `status`).
- **Infra de ícone e pulso já existe**: prop `icone` (`Badge.tsx:24`, renderizada em `:98`) e ponto de pulso para status "ao vivo" (`:92-97`).
- **Os 10 chips de 9px recriando a assinatura** (todos `rounded-[2px] … px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider`):
  - `src/components/LinhaJogadorGestao.tsx:50` — "Pendente" (`animate-pulse` no próprio span, ícone `Sparkles`);
  - `:59` — "Superadmin" (sólido `bg-destaque text-destaque-tinta shadow-xs`, **font-black**, sem borda, ícone `Crown`);
  - `:66` — "Admin" (ícone `Shield`);
  - `:72` — "🧤 Isento (Goleiro)";
  - `:76` — "Mensalista" (ícone `UserCheck2`);
  - `:81` — "Avulso";
  - `src/routes/Perfil.tsx:164` — "Admin" (sólido, **font-black**, sem borda);
  - `src/components/ListaReceitasAbertas.tsx:107` — "mensalista" (cores de destaque fixas);
  - `src/components/ListaReceitasAbertas.tsx:151` e `src/components/ListaDespesasAbertas.tsx:51` — chip de tipo colorido via `COR_TIPO[d.tipo]`.
- **Drift real entre as cópias** (correção futura hoje precisa ser feita 10×):
  - peso da fonte: `font-bold` em 8 chips vs `font-black` em 2 (`LinhaJogadorGestao.tsx:59`, `Perfil.tsx:164`) vs `font-black` no `Badge` normal;
  - `tracking-wider` nos chips vs `tracking-widest` no `Badge`;
  - destaque com **três opacidades de borda** diferentes: `border-destaque/40` (`ListaReceitasAbertas.tsx:107`, `COR_TIPO.mensalidade`), `border-destaque/50` (`LinhaJogadorGestao.tsx:50`) vs `border-destaque/60` do `Badge` (`Badge.tsx:58`);
  - `bg-ok/15` nos chips ok vs `bg-ok/10` do `Badge` (`Badge.tsx:59`).
- **Nem todo `text-[9px]` é chip**: `Logo.tsx:55`, `PainelPlacar.tsx:143`, `ResumoGestao.tsx:75` e `Resumo.tsx:176` são rótulos soltos, sem a assinatura de chip — fora do escopo (§6).
- **Os 2 chips `COR_TIPO` têm cores de domínio sem variante equivalente**: `COR_TIPO` (`ListaReceitasAbertas.tsx:15-22`) define 6 combinações (`goleiro` usa `bg-campo/20`, `eventos` usa `bg-destaque/10 border-destaque/30`), que não mapeiam para as 6 variantes do `Badge`.
- **Consumidores**: `LinhaJogadorGestao` só é usado por `src/routes/GestaoJogadores.tsx`; as listas financeiras só por `src/routes/Administrador.tsx:227-241`.

## 3. Pré-condições e dependências

- **Nenhum plano é pré-requisito**. O item é Tier 3 ("higiene pontual") — o ranking recomenda executá-lo "ao tocar o arquivo"; este plano pode rodar a qualquer momento ou ser puxado junto da próxima mudança em `GestaoJogadores`/`Perfil`.
- **Interação com o plano 09 (A6)**: o plano 09 extrai os 2 chips `COR_TIPO` (`ListaReceitasAbertas.tsx:151`, `ListaDespesasAbertas.tsx:51`) para `ChipTipoLancamento` e adia expressamente a padronização "mini" para este plano. Aqui esses 2 chips **não são migrados** (justificativa na §6); a ordem entre os planos 09 e 11 é livre.
- **Decisões do dono exigidas antes de executar** (todas de unificação visual, nenhuma de arquitetura):
  1. Criar **1 variante nova** `destaque-solido` em `VARIANTE_CLASSES` (`border-transparent bg-destaque text-destaque-tinta shadow-xs`) para os 2 chips sólidos de "Superadmin"/"Admin" — é a única cor sem equivalente. Justificativa: 2 usos concretos hoje, não especulação (YAGNI respeitado); sem ela, esses chips ficam como cópias manuais.
  2. Aceitar **unificações sutis de cor** onde o chip divergia do `Badge` (borda de destaque `/40`–`/50` → `/60`; `bg-ok/15` → `/10`; "Admin" de fundo `superficie-2` → variante `destaque`). Diferenças de 1 dígito em opacidade, invisíveis na prática; é justamente o drift que o item elimina.
  3. Aceitar que o chip "mini" usa `font-bold tracking-wider` (a assinatura de fato dos 10 chips) — os 2 chips `font-black` ficam marginalmente mais leves.
- **Restrições de janela**: nenhuma — as três telas afetadas (Gestão de Jogadores, Perfil, Administrador) não participam de partida ao vivo.

## 4. Plano de execução (1 passo = 1 commit)

Três passos: 1 commit de infraestrutura no `Badge` + 2 commits de migração. Cada passo deixa o build verde e é reversível isoladamente.

1. **Adicionar a prop `densidade` ao `Badge`** — em `src/components/Badge.tsx`:
   - `BadgeProps` ganha `densidade?: 'normal' | 'mini'` (default `'normal'`, comportamento atual intocado);
   - a composição das classes passa a trocar apenas o trio tipográfico quando `mini`: `text-[10px] font-black tracking-widest` → `text-[9px] font-bold tracking-wider` (geometria `rounded-[2px] border px-1.5 py-0.5`, `gap-1`, `leading-tight`, `select-none` permanecem);
   - adicionar `destaque-solido: 'border-transparent bg-destaque text-destaque-tinta shadow-xs'` em `VARIANTE_CLASSES` e ao tipo `BadgeVariante` (`Badge.tsx:5`);
   - nenhum call site muda neste commit (prop opcional). Atualizar o uso do `Badge` nos arquivos só nos passos seguintes.
2. **Migrar `LinhaJogadorGestao.tsx`** (maior densidade: 6 chips, 1 arquivo) — substituir os `<span>`s por `<Badge densidade="mini">` com o mapeamento:

   | Chip atual | Migração |
   |---|---|
   | `:50` "Pendente" | `variante="destaque"` + `icone={<Sparkles …/>}` + `className="animate-pulse shrink-0"` |
   | `:59` "Superadmin" | `variante="destaque-solido"` + `icone={<Crown …/>}` |
   | `:66` "Admin" | `variante="destaque"` + `icone={<Shield …/>}` |
   | `:72` "Isento (Goleiro)" | `variante="ok"` |
   | `:76` "Mensalista" | `variante="ok"` + `icone={<UserCheck2 …/>}` |
   | `:81` "Avulso" | `variante="neutro"` (casamento exato com `Badge.tsx:61`) |

   Regra da migração: cores **sempre via `variante`**, nunca sobrepostas por `className` (com Tailwind, duas classes da mesma propriedade no mesmo elemento resolvem por ordem do stylesheet, não pela ordem no `className` — override via `className` é não determinístico). `className` fica restrito a utilitários sem conflito (`shrink-0`, `animate-pulse`).
3. **Migrar `Perfil.tsx:164` e `ListaReceitasAbertas.tsx:107`** — "Admin" → `<Badge densidade="mini" variante="destaque-solido">`; "mensalista" → `<Badge densidade="mini" variante="destaque">`. Remover os `<span>` manuais correspondentes. Os 2 chips `COR_TIPO` (`ListaReceitasAbertas.tsx:151`, `ListaDespesasAbertas.tsx:51`) **não** são tocados (§6).

## 5. Validação manual

Sem testes automáticos (AGENTS.md); após cada passo:

- [ ] `npm run build` passa (TypeScript/lint sem erros).
- [ ] Gestão de Jogadores (`GestaoJogadores.tsx`): cada linha de jogador mostra os chips corretos — "Pendente" pulsando com o ícone de sparkles, "Superadmin" sólido âmbar com coroa, "Admin" com escudo, "Isento (Goleiro)"/"Mensalista" verdes, "Avulso" neutro; ícones alinhados e do mesmo tamanho (`size-3`) que antes.
- [ ] Perfil: chip "Admin" sólido ao lado do nome, legível em 9px.
- [ ] Administrador → "Receitas em aberto": chip "mensalista" no cabeçalho do grupo; chips de tipo (via `COR_TIPO`) **idênticos ao estado anterior** — este plano não os toca.
- [ ] Divergências visuais aceitadas na §3 conferidas na prática (borda de destaque, peso `font-bold` nos 2 ex-sólidos) e aprovadas pelo dono; comparar com print anterior, se disponível.
- [ ] `Badge` "normal" inalterado: badges de status na tela de Jogos/Partida continuam em 10px, com pulso no "Ao Vivo".

## 6. Fora de escopo

- **Criar componente `Chip` separado** — expressamente proibido pelo doc de origem (A8): duas abstrações para o mesmo papel. A prop `densidade` no `Badge` é a solução inteira.
- **Migrar os 2 chips `COR_TIPO`** (`ListaReceitasAbertas.tsx:151`, `ListaDespesasAbertas.tsx:51`): suas 6 cores são de domínio (`goleiro`, `campo`, `eventos`…), sem variante equivalente no `Badge`; mapeá-las exigiria 6 variantes novas ou a perda das distinções. Permanecem em `ChipTipoLancamento` (plano 09) com geometria própria — débito consciente e registrado.
- **Tocar os 4 `text-[9px]` que não são chips** (`Logo.tsx:55`, `PainelPlacar.tsx:143`, `ResumoGestao.tsx:75`, `Resumo.tsx:176`): rótulos soltos, sem a assinatura de chip; migrá-los seria migração cosmética ampla.
- **Alterar o `Badge` "normal"** (10px) ou qualquer call site existente dele: a prop é opcional e o default preserva o comportamento atual.
- **Criar variantes além de `destaque-solido`** ou mecanismo genérico de variantes (`cva`, maps tipados sofisticados): `Record` simples, como o `Badge` já faz.
- **Novas bibliotecas e testes automáticos**: nenhum dos dois (AGENTS.md).

## 7. Riscos e rollback

- **Risco: regressão visual nos chips migrados** — baixo: as diferenças estão confinadas às unificações declaradas na §3 (opacidades, peso de fonte), todas de baixa perceptibilidade e aprovadas antes da execução. Rollback: `git revert` do passo afetado; cada migração devolve os `<span>`s originais sem dependência dos outros passos.
- **Risco: override de cor via `className` não determinístico** — mitigado por regra explícita no passo 2 (cores só via `variante`); se descumprida, o sintoma é cor errada visível na §5, não bug silencioso.
- **Risco: variante `destaque-solido` sem uso futuro** — aceito e justificado por 2 usos concretos no próprio plano (`LinhaJogadorGestao.tsx:59`, `Perfil.tsx:164`); não é especulação.
- **Todos os passos são revertíveis por `git revert` isolado**: o passo 1 é aditivo (prop opcional + 1 entrada em `Record`); os passos 2–3 editam arquivos disjuntos (`LinhaJogadorGestao.tsx` vs `Perfil.tsx` + `ListaReceitasAbertas.tsx`) e não se dependem em runtime. Nenhuma query, estado ou fluxo de dados é alterado.
