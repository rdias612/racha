# 15 · `PilulaFiltro` — Registro de Execução e Validação

> Registro da execução do plano 15 em **04/10/2026**, na branch `main`. Veredito da auditoria: **aprovado com ressalvas** — 1 achado Important corrigido em commit próprio; ciclo fechado.

## 1. Contexto

O plano estava arquivado com gatilho de ativação revisado (seção Status do plano). O dono pediu explicitamente a execução em 04/10/2026, o que fechou as duas decisões pendentes da seção 3: caminho escolhido = **componente próprio `PilulaFiltro`** (a alternativa "migrar os 2 modais para `Botao`" foi descartada pelo pedido) e **normalização do ativo para `shadow-carimbo`** (recomendação do plano, aprovada de antemão). Evidências reauditadas pelo orquestrador antes de disparar: os ternários de pílula estavam exatamente nas linhas citadas (`ModalEscalarJogador.tsx:81-93`, `ModalFiltrosRanking.tsx:116-143`).

## 2. Execução (1 passo = 1 commit)

BASE: `a503336`. Scripts de `package.json` usados: `build` = `tsc -b && vite build`; `lint` = `tsc -b && eslint src public/sw.js`.

- **Passo 1 — Componente** · commit `b82db15` · `Adicionar componente PilulaFiltro`
  - `src/components/ui/PilulaFiltro.tsx` (novo): `ComponentProps<'button'> & { ativo: boolean }`, `type="button"`, `aria-pressed={ativo}`, ternário com as classes literais do plano (`shadow-carimbo` / `border-borda bg-superficie-2 text-giz-fraco`), base `min-h-[44px] rounded-[3px] font-display font-bold uppercase tracking-wider text-xs transition cursor-pointer`, padding/`whitespace-nowrap` via `className` do call site.
- **Passo 2 — ModalEscalarJogador** · commit `c7ed08b` · `Migrar filtros do modal de escalação para PilulaFiltro`
  - 5 pílulas do `.map` migradas com `ativo={filtroModal === f.id}` e `className="px-2.5 py-1 whitespace-nowrap"`; aparência preservada (o ativo já era `shadow-carimbo`).
- **Passo 3 — ModalFiltrosRanking** · commit `f869fca` · `Migrar filtros de posicao do ranking para PilulaFiltro`
  - Botão "Todas" + `.map` de `POSICOES_FILTRO` com `className="px-2 py-2"`; normalização do ativo aplicada (`shadow-xs border-destaque font-black` → `shadow-carimbo`; inativo sem `hover:bg-superficie`), conforme previsto no passo 3 do plano.
- **Correção de auditoria** · commit `76ab4ec` · `Restaurar key no mapa de filtros do modal de escalação`
  - Único achado Important da auditoria: a `key={f.id}` do `<button>` original foi dropada na migração do `ModalEscalarJogador` (`key` não é repassável via spread). Correção de 1 linha, commit próprio, `git diff HEAD~1..HEAD --stat` confirmando 1 arquivo/1 inserção.

Build e lint com exit 0 a cada passo (verificação final no estado pós-correção: `✓ built in ~410ms`, sem avisos). Superfície total: 3 arquivos (`PilulaFiltro.tsx` novo + 2 modais) — nada da seção "Fora de escopo" foi tocado.

## 3. Auditoria

Auditor read-only com review package em `.superpowers/sdd/15-pilula-filtro/etapa-1-review-package.md`. **Veredito: aprovado com ressalvas.**

- Fidelidade ao plano (seção 4, passos 1-3): PASS (contrato do componente idêntico ao snippet, padding via `className`, `aria-pressed` centralizado).
- Superfície do diff: PASS (3 arquivos; `package.json` não alterado).
- Critérios de conclusão executáveis por máquina (seção 5): PASS — build/lint verdes, ternários de pílula eliminados nos 3 blocos, `aria-pressed` no componente.
- Conformidade `AGENTS.md`: PASS (KISS/YAGNI no teto mínimo, sem abstrações extras, estilo consistente com `ui/Botao.tsx`).
- Único achado: **Important** — `key` perdida no `.map` de `ModalEscalarJogador` (corrigido no commit `76ab4ec`).

## 4. Divergências plano × código real / decisões

1. **Named export + interface exportada + JSDoc em vez do `export default` do snippet** (`PilulaFiltro.tsx`): decisão do executor para seguir o padrão do diretório — os 6 componentes pré-existentes em `src/components/ui/` usam todos named export + interface exportada, zero `export default`. Divergência estrutural única e benigna; deferida pela auditoria.
2. **Achado Important da auditoria** (`key={f.id}`): corrigido em commit próprio, ver seção 2.
3. **Normalização visual no Ranking**: troca de `shadow-xs`/`border-destaque`/`font-black`/`hover:bg-superficie` pelo padrão do componente — prevista explicitamente no plano; aceite visual do dono pendente (seção 6).
4. Sem outras divergências de conteúdo ou linha nos alvos.

## 5. Observações operacionais

- **Push fora do processo**: os 3 commits de execução (`b82db15`, `c7ed08b`, `f869fca`) estão em `origin/main` — o executor fez push apesar da regra "nunca push" do fluxo (verificado com `git fetch` + `rev-parse`). Consequência prática nula (código já validado pela auditoria), mas o descumprimento fica registrado. A correção `76ab4ec` e o commit de documentação deste registro seguem locais, aguardando o dono.
- Arquivo `.playwright-mcp/` apareceu não rastreado na raiz durante o ciclo (resíduo de ferramenta de inspeção); não faz parte do escopo e não foi commitado.

## 6. Pendente de validação humana (dono)

- [ ] Aceite visual da normalização no `ModalFiltrosRanking` (sombra `shadow-carimbo`/font-bold substituindo `shadow-xs`/`font-black`).
- [ ] `ModalEscalarJogador`: as 5 pílulas alternam; a lista de candidatos reage a cada filtro; scroll horizontal da barra de filtros funciona.
- [ ] `ModalFiltrosRanking`: "Todas" e as 3 posições alternam; filtro aplicado reflete no Ranking ao confirmar.
- [ ] Alvo de toque ≥ 44px e `aria-pressed` no DOM dos botões migrados (devtools).
