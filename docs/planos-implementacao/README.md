# Planos de Implementação — Plano de Melhorias Frontend PWA

> Um plano por item do ranking em `docs/rank-melhorias-reuso-codigo.md` (critério: redução de code slop / duplicação / reuso). Estrutura padrão em `TEMPLATE.md`.
> Registros de execução/validação de planos executados ficam em [`registros/`](registros/).
> Plano de origem: `docs/plano-melhorias-frontend-pwa.md`. Filosofia: `AGENTS.md` — passos pequenos, 1 commit por passo, sem novas bibliotecas, validação manual.

## Processo padrão de execução (válido para todo plano deste diretório)

Ao executar qualquer plano, este fluxo é **parte da execução esperada** — não precisa ser solicitado a cada vez:

1. **Implementar**: disparar subagente executor, que segue o plano passo a passo (1 passo = 1 commit), valida com `npm run build` a cada passo e reporta divergências plano × código real.
2. **Validar**: disparar subagente auditor read-only em seguida, que audita commits, superfície de diff, fora de escopo e critérios de encerramento, emitindo veredito (aprovado / aprovado com ressalvas / reprovado).
3. **Registrar**: criar o registro da execução em `registros/<NN>-<slug>.md` (mesmo formato dos existentes), contendo: commits, divergências plano × código real, normalizações aplicadas, confirmações técnicas da auditoria, observações e o checklist de validação manual pendente para o dono.
4. **Marcar como feito**: atualizar a linha do item na tabela de índice abaixo com `✅ **executado**` + link para o registro.
5. **Corrigir o plano na fonte**: se a auditoria detectar imprecisões no doc do plano (linhas deslocadas, critérios de encerramento falsos por construção), corrigi-las no próprio doc do plano no mesmo commit do registro.
6. **Commitar** tudo em commit próprio (`docs: registro de execução/validação do plano NN`).

As validações visuais/funcionais no aparelho listadas na seção 5 de cada plano e nos registros permanecem **pendentes para o dono** — agentes não as executam.

## Índice (ordem do ranking anti-slop)

| # | Plano | Item (plano) | Tier |
|---|---|---|---|
| 01 | [cabecalho-sumula.md](01-cabecalho-sumula.md) | A1 · Extrair `CabecalhoSumula` — ✅ **executado** ([registro](registros/01-cabecalho-sumula.md)) | 1 |
| 02 | [botao-variantes.md](02-botao-variantes.md) | A2 · Extrair `Botao` com variantes — ✅ **executado** ([registro](registros/02-botao-variantes.md)) | 1 |
| 03 | [helper-invalidacao-partida.md](03-helper-invalidacao-partida.md) | D1 · Helper de invalidação pós-mutação — ✅ **executado** ([registro](registros/03-helper-invalidacao-partida.md)) | 1 |
| 04 | [campo-texto.md](04-campo-texto.md) | A3 · `CampoTexto`/`CampoTextoLongo` — ✅ **executado** ([registro](registros/04-campo-texto.md)) | 1 |
| 05 | [elenco-usecache.md](05-elenco-usecache.md) | D2 · Elenco/derivados via `useCache` — ✅ **executado** ([registro](registros/05-elenco-usecache.md)) | 2 |
| 06 | [aposentar-geracao-ref.md](06-aposentar-geracao-ref.md) | D3 · Aposentar `geracaoRef` manual — ✅ **executado** ([registro](registros/06-aposentar-geracao-ref.md)) | 2 |
| 07 | [queries-fora-da-lib.md](07-queries-fora-da-lib.md) | D5 · Queries fora da `lib` → `lib` — ✅ **executado** ([registro](registros/07-queries-fora-da-lib.md)) | 2 |
| 08 | [dialogo-evento-modal-base.md](08-dialogo-evento-modal-base.md) | A5 · `DialogoEvento` → `ModalBase` — ✅ **executado** ([registro](registros/08-dialogo-evento-modal-base.md)) | 2 |
| 09 | [pecas-listas-financeiras.md](09-pecas-listas-financeiras.md) | A6 · Peças das listas financeiras — ✅ **executado** ([registro](registros/09-pecas-listas-financeiras.md)) | 2 |
| 11 | [badge-mini.md](11-badge-mini.md) | A8 · Chip "mini" no `Badge` — ✅ **executado** ([registro](registros/11-badge-mini.md)) | 3 |
| 12 | [token-scrim.md](12-token-scrim.md) | C3 · Token `--cor-scrim` — ✅ **executado** ([registro](registros/12-token-scrim.md)) | 3 |
| 13 | [remocao-tokens-mortos.md](13-remocao-tokens-mortos.md) | C4 · Remoção de tokens/dados mortos — ✅ **executado** ([registro](registros/13-remocao-tokens-mortos.md)) | 3 |
| 14 | [higiene-nomenclatura.md](14-higiene-nomenclatura.md) | A4 · Higiene de nomenclatura — ✅ **executado** ([registro](registros/14-higiene-nomenclatura.md)) | 3 |
| 16 | [retry-ptr-partida.md](16-retry-ptr-partida.md) | E3 · Retry/PTR/haptics nas telas de partida | 4 |
| 17 | [pasta-ui.md](17-pasta-ui.md) | A9 · Pasta `ui/` para novas primitivas | 4 |
| 18 | [revalidar-online.md](18-revalidar-online.md) | B1 · Revalidar dados ao voltar online — ✅ **executado** ([registro](registros/18-revalidar-online.md)) | 4 |
| 19 | [ctas-44px.md](19-ctas-44px.md) | C1 · Alvos de 44px nos CTAs-Link — ✅ **executado** ([registro](registros/19-ctas-44px.md)) | 4 |
| 20 | [aviso-nova-versao.md](20-aviso-nova-versao.md) | B3 · Aviso "nova versão disponível" | 4 |
| 21 | [cedula-sinal-honesto.md](21-cedula-sinal-honesto.md) | E1 · Cédula de votação: sinal honesto | 4 |
| 22 | [poda-assets-cache.md](22-poda-assets-cache.md) | B4 · Poda de `/assets/*` no `CACHE_STATIC` | 4 |
| 23 | [tokens-contraste.md](23-tokens-contraste.md) | C2 · Tokens `--cor-ok-texto`/`--cor-perigo-texto` | 4 |
| 24 | [painel-da-semana.md](24-painel-da-semana.md) | E2 · Painel da Semana na home | 4 |
| 25 | [ranking-sua-posicao.md](25-ranking-sua-posicao.md) | E4 · Ranking "sua posição" com jump | 4 |
| 26 | [perfil-minhas-dividas.md](26-perfil-minhas-dividas.md) | E5 · Perfil reordenado + Minhas Dívidas | 4 |
| 27 | [filtro-status-mural.md](27-filtro-status-mural.md) | E6 · Jogos: filtro por status | 4 |
| 28 | [manifest-shortcuts.md](28-manifest-shortcuts.md) | B5 · Manifest `shortcuts` | 4 |
| 29 | [design-md-tokens.md](29-design-md-tokens.md) | C5 · DESIGN.md canônico em ordem | 4 |
| 30 | [micro-ajustes-feedback.md](30-micro-ajustes-feedback.md) | E7 · Micro-ajustes de feedback | 4 |
| 31 | [detalhes-finos.md](31-detalhes-finos.md) | C6 · Detalhes finos de design | 4 |
| 32 | [fontes-self-host.md](32-fontes-self-host.md) | B6 · Fontes self-host (condicional) | 4 |
| 33 | [bundle-inicial.md](33-bundle-inicial.md) | B7 · Bundle inicial (decisão: não mexer) | 4 |
| 34 | [debitos-registrados.md](34-debitos-registrados.md) | A10 · Débitos registrados | 4 |

### Planos de feature nova (fora do ranking anti-slop)

| # | Plano | Item | Status |
|---|---|---|---|
| 35 | [35-clipes-filmaeu.md](35-clipes-filmaeu.md) | Clipes do Filma Eu no app (requisito: [`docs/requisito-clipes-filmaeu.md`](../requisito-clipes-filmaeu.md)) | 🔨 **implementado** — 8 fases executadas/auditadas ([registros](registros/35-fase-1-banco.md) a [35-fase-8](registros/35-fase-8-frontend-admin.md)); pendente validação E2E do dono ([roteiro](35-fases/fase-8-tasks.md), Task 5) |

## Ordem de execução recomendada

- **Onda anti-slop**: 03 → 01 → 02 → 04 (Tier 1), depois a cadeia 07 → 05 → 06 (D5 → D2 → D3 — dependência real entre eles).
- **Junto de qualquer extração**: 17 (pasta `ui/`) custa ~zero se aplicado no commit de criação dos componentes novos.
- **Tier 3**: executar "ao tocar o arquivo" conforme oportunidade.
- **Tier 4**: seguir a ordem de fases do plano original (`docs/plano-melhorias-frontend-pwa.md` §4) — este diretório não altera a prioridade de produto.
- **Decisões do dono antes de executar**: 02 (componente vs constantes), 24 (aprovar escopo do Painel da Semana), 26 (sincronizar com roadmap "Minhas Dívidas"), 08 (janela fora de ao-vivo).
