# 11 · Chip "mini" no `Badge` — Registro de Execução e Validação

> Registro da execução do plano [11-badge-mini.md](../11-badge-mini.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (3 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO COM RESSALVAS** — 1 correção de baixa severidade (tooltip `title` perdido), aplicada em commit próprio após a auditoria.

## 1. Execução

- **3 commits** (`60b5633` → `d23b53c`), 1 passo = 1 commit, build e lint verdes em cada. Diff total: 4 arquivos.
- **Passo 1** (`60b5633`, só `Badge.tsx`, nenhum call site): `BadgeVariante` ganha `'destaque-solido'`; `BadgeProps` ganha `densidade?: 'normal' | 'mini'` (default `'normal'`); composição troca SÓ o trio tipográfico no mini (`font-black tracking-widest text-[10px]` → `font-bold tracking-wider text-[9px]`); geometria (`rounded-[2px] border px-1.5 py-05`, `gap-1`, `leading-tight`, `select-none`) intocada; Badge "normal" funcionalmente idêntico.
- **Passo 2** (`feb7d5e`, só `LinhaJogadorGestao.tsx`): os 6 chips migrados com o mapeamento exato da tabela do plano — Pendente→`destaque`+Sparkles+`animate-pulse shrink-0`; Superadmin→`destaque-solido`+Crown; Admin→`destaque`+Shield; 🧤 Isento (Goleiro)→`ok`; Mensalista→`ok`+UserCheck2; Avulso→`neutro`. Ícones `size-3` preservados; **cores 100% via `variante`**, zero override por `className`.
- **Passo 3** (`d23b53c`): "Admin" do Perfil → `destaque-solido`; "mensalista" da ListaReceitasAbertas → `destaque`; spans manuais removidos.
- Fora de escopo confirmados intocados: os 2 chips `COR_TIPO` (ListaDespesasAbertas.tsx ausente do diff), os 4 `text-[9px]` não-chip (Logo, PainelPlacar, ResumoGestao, Resumo), nenhum call site de Badge "normal", nenhum componente `Chip` criado.
- Critério de encerramento: `grep "text-[9px]" src/` retorna só o Badge mini, os 2 `COR_TIPO` e os 4 fora de escopo.

## 2. Correção aplicada pós-auditoria

- **Tooltip `title="Superadmin permanente"` perdido** na migração (o `Badge` não aceitava props nativas e o plano não previa o atributo — perda acidental, não decisão). Corrigido em `07865ce`: prop `title?: string` no `BadgeProps` (renderizada no `<span>` de saída) + repasse no chip Superadmin. Build e lint verdes. Observação da auditoria: o padrão alternativo seria spread nativo (`extends Omit<HTMLAttributes...>`), como em `ui/CampoTexto` — a prop explícita foi escolhida por ser a mudança mínima.

## 3. Divergências plano × código real (avaliadas pela auditoria)

1. Números de linha derivados (~5-14 linhas): Perfil :150, ListaReceitasAbertas :111, LinhaJogadorGestao :50-83 — trechos confirmados por contexto.
2. **`shrink-0` perdido em 5 chips**: o plano o sancionava só no "Pendente"; auditoria verificou os 3 pais (flex-wrap em LinhaJogadorGestao; irmão com `truncate` que absorve o encolhimento em Perfil/ListaReceitas) — sem risco real; o `shrink-0` antigo era redundante nesses contextos. Revisitar se um chip for reutilizado em pai sem essas condições.
3. `bg-destaque/20` → `/15` no chip "Pendente" não constava da lista de unificações da §3 — inerente ao mapeamento `variante="destaque"` que o próprio plano manda usar (drift list incompleta, não erro de execução).
4. `destaque-solido` adiciona borda transparente de 1px que os sólidos antigos não tinham (≈2px a mais de largura) — consequência das classes exatas sancionadas pelo plano; imperceptível.

## 4. Unificações visuais sancionadas (§3 do plano) aplicadas e confirmadas

Borda de destaque `/40`–`/50` → `/60` (Pendente, mensalista); `bg-ok/15` → `/10` (Isento, Mensalista); "Admin" de `bg-superficie-2` → variante `destaque`; os 2 sólidos `font-black` → `font-bold` no mini.

## 5. Pendente de validação humana (visual, no aparelho)

- [ ] Gestão de Jogadores: "Pendente" pulsando com sparkles; "Superadmin" sólido âmbar com coroa; "Admin" com escudo; "Isento (Goleiro)"/"Mensalista" verdes; "Avulso" neutro; ícones alinhados em `size-3`.
- [ ] Perfil: chip "Admin" sólido ao lado do nome, legível em 9px.
- [ ] Administrador → Receitas em aberto: chip "mensalista" no cabeçalho do grupo; chips de tipo (`COR_TIPO`) **idênticos ao estado anterior**.
- [ ] Unificações da seção 4 aprovadas pelo dono na prática (bordas, pesos) — comparar com print anterior, se disponível.
- [ ] Badge "normal" inalterado: badges 10px em Jogos/Partida, pulso no "Ao Vivo".
- [ ] Tooltip do chip Superadmin restaurado (hover no desktop; invisível no mobile, como antes).
