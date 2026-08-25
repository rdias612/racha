# Dívida Técnica — Contraste do Âmbar (`destaque`) no Tema Claro

**Status:** ✅ CONCLUÍDO (resolvido em 23/08/2026 via Opção A — token `--cor-destaque-texto` / remapeamento de `text-destaque` e `outline-destaque`)
**Data do registro:** 23/08/2026
**Data de conclusão:** 23/08/2026
**Origem:** Auditoria de conformidade do AGENTS.md sobre a badge de vencedor do Comparador (`src/routes/Comparador.tsx`) — achado classificado como 🟡-3 e deliberadamente adiado por ser uma decisão de **design system**, não um ajuste pontual de tela.
**Tipo:** Acessibilidade (WCAG 2.1 AA) / Evolução de tokens do `design-system.md`

---

## 1. Problema

O âmbar de destaque (`--cor-destaque: #ffb300`) usado como **cor de texto** (`text-destaque`) sobre as superfícies claras do tema claro (`--cor-fundo: #f3efe4`, `--cor-superficie: #faf7ee`, `--cor-superficie-2: #ece7d8`) tinha contraste de **≈ 1,6:1** — muito abaixo do mínimo **4,5:1** do WCAG AA para texto normal (e até do 3:1 para texto grande/UI). No tema escuro o mesmo par rende **≈ 10,6:1** e estava correto; o problema manifestava-se apenas no tema claro.

| Combinação                                                        | Contraste Anterior | Contraste Atual (`#92400e`) | Exigência WCAG                        | Situação                             |
| ----------------------------------------------------------------- | ------------------ | --------------------------- | ------------------------------------- | ------------------------------------ |
| `text-destaque` sobre `bg-fundo` claro (`#f3efe4`)                | ≈ 1,6:1 ❌         | **6,25:1**                  | 4,5:1 (texto normal)                  | ✅ Aprovado (WCAG AA)                |
| `text-destaque` sobre `bg-superficie` clara (`#faf7ee`)           | ≈ 1,5:1 ❌         | **6,73:1**                  | 4,5:1 (texto normal)                  | ✅ Aprovado (WCAG AA)                |
| `text-destaque` sobre `bg-superficie-2` clara (`#ece7d8`)         | ≈ 1,7:1 ❌         | **5,79:1**                  | 4,5:1 (texto normal)                  | ✅ Aprovado (WCAG AA)                |
| `text-destaque` sobre `bg-fundo` escuro (`#12100d`)               | ≈ 10,6:1           | **10,6:1**                  | 4,5:1 (texto normal)                  | ✅ Aprovado                          |
| `outline-destaque` / `:focus-visible` sobre superfícies claras    | ≈ 1,6:1 ❌         | **> 5,5:1**                 | 3:1 (não-texto, WCAG 1.4.11 / 2.4.11) | ✅ Aprovado (WCAG AA)                |
| `text-destaque-tinta` (`#1a1200`) sobre `bg-destaque` (`#ffb300`) | alto (10,2:1)      | **10,2:1**                  | 4,5:1 (texto normal)                  | ✅ Aprovado (badges/botões mantidos) |

## 2. Por que foi resolvido via arquitetura de tokens (e não fix pontual)

O padrão era **canonizado pelo próprio `design-system.md`**: o exemplo oficial de lista contínua da seção 3.1 usa `text-destaque` nos números, e o padrão foi replicado por todo o app. Corrigir tela por tela violaria a regra de tokens semânticos (AGENTS.md 4.2 — proibido hex ad hoc no JSX); corrigir no token errado mudaria a identidade visual das badges âmbar (`bg-destaque` + tinta escura) e do placar LED, que estão aprovados. Foi adotada a **Opção A** (token semântico de texto `--cor-destaque-texto` remapeado para `text-destaque` e `outline-destaque`), permitindo que todas as 112 ocorrências ganhassem contraste acessível de forma atômica e consistente.

## 3. Escopo afetado

- **112 ocorrências** de `text-destaque` em **30 arquivos** (`src/routes/` e `src/components/`).
- **9 ocorrências** de `outline-destaque` (anéis de foco visível — AGENTS.md 4.2.5) sobre superfícies claras.
- Exemplos emblemáticos: números dos mini-placares do mural (`Jogos.tsx`), valores do pódio/tabela (`Ranking.tsx`), valores dominantes da `LinhaComparativa` e placar do vencedor do histórico (`Comparador.tsx`), destaques do `Resumo.tsx`.
- **Fora do escopo (mantidos intactos):** `bg-destaque` com `text-destaque-tinta` (badges, abas ativas, botões primários) e âmbar sobre fundos pretos (placar LED, `bg-preto-time`).

## 4. Direção de solução adotada

- **Opção A (Token de texto dedicado e remapeamento semântico):**
  - `--color-destaque-texto: var(--cor-destaque-texto);` configurado no `@theme` de `src/index.css`.
  - `--cor-destaque-texto: #92400e;` definido no tema claro (`:root`), garantindo contraste entre 5,79:1 e 6,73:1 em todas as superfícies claras.
  - `--cor-destaque-texto: #ffb300;` definido no tema escuro (`.dark`), mantendo o contraste de 10,6:1 inalterado.
  - Utilities `@utility text-destaque` e `@utility outline-destaque` associadas a `var(--cor-destaque-texto)`.
  - `:focus-visible` global atualizado para `var(--cor-destaque-texto)`.

## 5. Critérios de aceite

- [x] Todo `text-destaque` sobre `fundo`/`superficie`/`superficie-2` no tema claro atinge **≥ 4,5:1** (atinge 5,79:1 – 6,73:1).
- [x] Anéis de foco `outline-destaque` e `:focus-visible` no claro atingem **≥ 3:1** (atinge > 5,5:1).
- [x] Tema escuro permanece inalterado (já aprovado com 10,6:1) — dif de regressão visual vazio.
- [x] Badges `bg-destaque`/`text-destaque-tinta` e placar LED sem mudança visual perceptível (`#ffb300` e `#1a1200`).
- [x] Zero hex hardcoded no JSX (manutenção estrita da regra de tokens semânticos).
- [x] Exemplo oficial e paleta da seção 2.1 e 4.2 do `design-system.md` e seção 4.2 do `AGENTS.md` atualizados com o novo token.
- [x] Validação por suite de testes/linter/build (`npm run lint`, `npm run build`) sem erros.

## 6. Registro de Conclusão

Resolvido e integrado ao design system canônico em 23/08/2026. Documentação, `src/index.css`, `design-system.md` e `AGENTS.md` perfeitamente alinhados e sincronizados.
