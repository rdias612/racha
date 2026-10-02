# 19 · Alvos de toque 44px nos CTAs-Link (`C1`) — Registro de Execução e Validação

> Registro da execução do plano [19-ctas-44px.md](../19-ctas-44px.md) em 2026-10-02, na branch `main`, por dois agentes independentes: **implementador** (1 passo) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção.

## 1. Execução

- **1 commit** (`f6b4fe4`, `garante alvo de toque 44px nos CTAs-Link (C1)`). Diff: 2 arquivos, +2/−2 (uma linha de className por arquivo).
- **`src/routes/Jogos.tsx:85`** — Link **"Nova partida"**: `min-h-[44px]` inserido após `inline-flex`, preservando `items-center` (centralização vertical de graça) e todas as demais classes. ClassName final idêntico caractere por caractere ao exemplo do plano.
- **`src/routes/PartidaDetalhe.tsx:271`** — Link **"Editar votos"**: `block text-center` → `flex min-h-[44px] items-center justify-center`, preservando as demais classes. Como célula de `grid grid-cols-2`, o preenchimento da célula é preservado; com o `<button>` irmão "Descartar votos" já coberto pela regra global (`min-height: 44px`), o par fica uniforme em 44px.
- **Coordenação com o plano 02 não aplicada**: embora o `Botao` (plano 02) já exista, o fora de escopo (seção 6) manda não migrar neste item — classes utilitárias diretas, conforme o default do plano. Nenhum componente/constante nova criada.
- **Fora de escopo respeitado**: `src/index.css` intocado (seletor global **não** estendido para `a`); botão irmão intocado; nenhum outro `<Link>` alterado.

## 2. Confirmações técnicas da auditoria

- **Diff exato**: `git show f6b4fe4 --stat` → 2 arquivos +2/−2, 1 hunk por arquivo; nenhum classe a mais ou removida além do especificado.
- **Regra global intacta**: `src/index.css:146-152` continua restrita a `button, [role='button']` e `input[type='range']`; links inline de texto (ex.: `ListaReceitasAbertas`) não são afetados — risco de regressão em links inline: zero.
- **Build e lint reexecutados pelo validador**: `npm run build` (exit 0) e `npm run lint` (exit 0).
- **Grep de sanidade**: `min-h-[44px]` presente nos 2 className novos; nenhuma outra ocorrência introduzida pelo commit.

## 3. Divergências plano × código real / Decisões tomadas

1. **Linhas deslocadas no doc do plano** — corrigidas no próprio doc (passo 5 do processo padrão): Jogos.tsx Link `:83-89` (className `:85`, plano citava `:120-126`/`:122`); PartidaDetalhe.tsx Link `:269-274` (className `:271`, plano citava `:273-278`/`:275`); botão irmão `:275-281`; grade `:268`; regra global do `index.css` `:146-152` (plano citava `:149-156`). Conteúdo sem divergência — os className reais coincidiam com os exemplos do plano.
2. Nenhuma decisão de conteúdo: o plano estava fechado (2 classes utilitárias, sem abstração).

## 4. Observações operacionais

- O commit `f6b4fe4` chegou a `origin/main` junto com o push da própria sessão do dono (commit `7d3e38c`, plano 35 de clipes) — não houve push pelos agentes desta execução.
- O working tree tem edição do dono não commitada no índice (remoção das linhas dos planos 10 e 15) — preservada fora dos commits desta execução. **Atenção**: a linha do plano 10 (executado, com registro) sumiu da tabela; conferir se foi intencional.

## 5. Pendente de validação humana (visual/toque, no aparelho)

- [ ] **Mural Jogos** (`/jogos`, logado como admin): CTA "Nova partida" com `min-height: 44px` no DevTools e rótulo centralizado verticalmente; cabeçalho do mural sem quebra (conferir em viewport estreito, ex. 360px — o CTA segue alinhado à direita, na linha do bloco "Temporada Oficial").
- [ ] **Toque real**: tocar "Nova partida" próximo às bordas superior/inferior e confirmar navegação para `/partida/nova`.
- [ ] **Detalhe da partida com votação aberta** (participante, não-random, já votou): par "Editar votos"/"Descartar votos" com os dois elementos na mesma altura (44px), alinhados na grade 2 colunas; navegação para `/partida/:id/votar` funcionando.
- [ ] **Cenários não tocados**: "ainda não votou" e votação fechada sem mudança visual; `hover:brightness-105`, `active:translate-y-px` e `focus-visible` âmbar funcionando nos dois links.
