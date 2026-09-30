# 03 · Helper de invalidação pós-mutação de partida — Plano de Implementação

> Ref.: item **D1** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#3 (nota 8,5)**, Tier 1 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: mínimo · Prioridade global do plano: P0

## 1. Objetivo

Substituir, por **uma única função**, o par `invalidarCache(CHAVE_JOGOS); invalidarCache(chaveResumo(new Date().getFullYear()))` hoje copiado literalmente em **7 call sites de 6 rotas**. Elimina o slop mais perigoso do repo: duplicação **comportamental**, não visual — qualquer chave nova que dependa de partidas exigiria tocar 7 arquivos, e esquecer um gera tela obsoleta em silêncio. A função cria o ponto único de manutenção onde chaves futuras (elenco do plano 05, realtime do `docs/plano-escolha-times-realtime.md`) entram sem multiplicar o par.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

- O par idêntico e contíguo aparece em **7 sites / 6 rotas**:
  - `src/routes/Jogos.tsx:86-87` (exclusão de partida da súmula)
  - `src/routes/PartidaDetalhe.tsx:151-152` (início da partida)
  - `src/routes/PartidaAoVivo.tsx:136-137` (início da partida) **e** `src/routes/PartidaAoVivo.tsx:223-224` (publicação/fim)
  - `src/routes/PartidaEditar.tsx:204-205` (salvar edição)
  - `src/routes/PartidaTimes.tsx:210-211` (salvar times e goleiros)
  - `src/routes/PartidaNova.tsx:173-174` (criar partida)
- `invalidarCache(chave?: string): void` é exportada de `src/hooks/useCache.ts:39-58` (função de módulo, não hook: incrementa geração, limpa `cache`/`emVoo` e notifica ouvintes inscritos).
- `src/lib/chavesCache.ts` (29 linhas) é a **fonte única das chaves** por design — o comentário de cabeçalho manda importar chaves daqui "tanto no `useCache` quanto no `invalidarCache`". Exporta `CHAVE_JOGOS` e `chaveResumo(ano)`, cujo docstring registra que o ano entra na chave por causa da "virada do ano numa sessão aberta".
- Os 6 arquivos de rota importam `import { CHAVE_JOGOS, chaveResumo } from '../lib/chavesCache'`; `Jogos.tsx:6` importa também `useCache` de `../hooks/useCache` (mantém uso); os outros 5 importam **apenas** `invalidarCache` de `../hooks/useCache` (import some após a migração).
- Nenhum outro call site de `invalidarCache` existe em `src/` (grep confirmado — os 7 sites são o universo).
- `src/hooks/useCache.ts` importa somente de `react` e `../lib/erros` — não há risco de ciclo se `lib/chavesCache.ts` passar a importar `invalidarCache`.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** É o item recomendado como primeiro passo da Fase 1 do plano de origem e o primeiro da onda anti-slop (`README.md` deste diretório: ordem 03 → 01 → 02 → 04).
- **Quem se beneficia**: o plano **05 (elenco/derivados via `useCache`)** depende diretamente deste ponto único — as chaves novas (`CHAVE_ELENCO_ATIVO` etc.) passarão a ser invalidadas dentro de `invalidarCachesDependentesDePartida()` (partida mutada muda escalação/confirmações exibidas) com **1 linha editada em 1 arquivo**, em vez de 7.
- **Chaves futuras**: o realtime do `docs/plano-escolha-times-realtime.md` (draft ao vivo) e qualquer outra leitura derivada de partida entram pelo mesmo ponto.
- **Restrição de janela**: a migração toca telas de mutação de partida, inclusive `PartidaAoVivo`. Executar **fora de janela de rachas ao vivo** para validar com calma (a mudança é byte-equivalente em comportamento, mas a validação manual envolve iniciar/publicar partida).
- **Decisão do dono exigida antes de executar**: nenhuma — a recomendação de assinatura está fechada na seção 4.

## 4. Plano de execução (1 passo = 1 commit)

**Abordagem recomendada: função `invalidarCachesDependentesDePartida(): void` exportada de `src/lib/chavesCache.ts`.**

Por que função e não a alternativa `CHAVES_PARTIDA_MUTADA` + loop nos call sites:

1. A constante seria avaliada **no load do módulo**, congelando `new Date().getFullYear()` e contrariando o próprio docstring de `chaveResumo` ("virada do ano numa sessão aberta"). Exigiria array-factory ou recomputo — mais mágico que a função direta.
2. Deixar o `forEach(invalidarCache)` nos 7 sites manteria 7 cópias do loop: mata a chave mas não o call site.
3. O header de `chavesCache.ts` já declara ser a fonte única; a função de invalidação derivada das chaves pertence a esse módulo (coesão por responsabilidade).

Custo de camada consciente e aceitável: `lib/chavesCache.ts` passa a importar `invalidarCache` de `../hooks/useCache` (sem ciclo — verificado na seção 2; `invalidarCache` é função pura de módulo, não hook). Mover `invalidarCache` para `lib/` ficaria como opção, mas é refactor maior que o problema — fora de escopo.

### Passo 1 — Criar o helper e migrar o piloto (`Jogos.tsx`) · 1 commit

- **`src/lib/chavesCache.ts`** — adicionar ao fim:

  ```ts
  import { invalidarCache } from '../hooks/useCache';

  /**
   * Invalida todas as chaves de telas que exibem dados derivados de partidas.
   * Chamar após QUALQUER mutação de partida (criar, editar, iniciar, publicar,
   * escalar, excluir). Ponto único de manutenção: chave nova dependente de
   * partida entra aqui, sem tocar os call sites. O ano é calculado na chamada
   * (a chave do resumo precisa refletir a virada do ano em sessão aberta).
   */
  export function invalidarCachesDependentesDePartida(): void {
    invalidarCache(CHAVE_JOGOS);
    invalidarCache(chaveResumo(new Date().getFullYear()));
  }
  ```

- **`src/routes/Jogos.tsx`** (piloto) — substituir as linhas 86-87 por `invalidarCachesDependentesDePartida();`; ajustar imports: `useCache` segue de `../hooks/useCache`, e `CHAVE_JOGOS`/`chaveResumo` saem do import de `../lib/chavesCache` (entram na função).
- Commit: "extrai helper único de invalidação pós-mutação de partida (D1)".

### Passo 2 — Migrar os 6 call sites restantes · 1 commit

Substituição literal do par por `invalidarCachesDependentesDePartida();` em:

1. `src/routes/PartidaDetalhe.tsx:151-152`
2. `src/routes/PartidaAoVivo.tsx:136-137`
3. `src/routes/PartidaAoVivo.tsx:223-224`
4. `src/routes/PartidaEditar.tsx:204-205`
5. `src/routes/PartidaTimes.tsx:210-211`
6. `src/routes/PartidaNova.tsx:173-174`

Em cada arquivo, remover o import de `invalidarCache` de `../hooks/useCache` (nos 5 arquivos ele é o único símbolo importado — a linha some) e trocar `import { CHAVE_JOGOS, chaveResumo } from '../lib/chavesCache'` por `import { invalidarCachesDependentesDePartida } from '../lib/chavesCache'`.

- Validar com `tsc -b` (zero referências restantes: `grep -rn "CHAVE_JOGOS\|chaveResumo" src/routes/` deve retornar vazio).
- Commit: "migra as rotas de partida para o helper de invalidação (D1)".

Total: 2 commits, ~30 linhas líquidas removidas, comportamento byte-equivalente.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no aparelho/build, exercitando cada call site migrado e conferindo que o **mural (Jogos)** e o **Boletim do ano (Resumo)** revalidam após cada mutação:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Criar partida** (`PartidaNova`): voltar ao mural — a partida nova aparece; Resumo reflete o acréscimo.
- [ ] **Editar partida** (`PartidaEditar`): salvar e conferir mural/atualizado.
- [ ] **Escalar times** (`PartidaTimes`): salvar e conferir que o Detalhe mostra os times salvos ao reabrir.
- [ ] **Iniciar partida** por `PartidaDetalhe` e por `PartidaAoVivo` (os dois sites): mural passa a exibir "ao vivo".
- [ ] **Publicar/encerrar** em `PartidaAoVivo`: mural e Resumo atualizam; súmula visível no Detalhe.
- [ ] **Excluir partida** pelo mural (`Jogos`): ela some do mural e do Resumo.
- [ ] Revalidação em background do `useCache` segue funcionando (tela aberta em background atualiza ao voltar sem pull-to-refresh).

## 6. Fora de escopo

- **Não** criar as chaves de elenco/derivados (`CHAVE_ELENCO_ATIVO` etc.) — é o plano 05; este plano só abre o ponto de entrada.
- **Não** migrar o item B1 (revalidar ao voltar online) nem tocar o `sw.js`.
- **Não** alterar a semântica de `invalidarCache` em `src/hooks/useCache.ts` (nenhuma mudança nesse arquivo) nem movê-lo de lugar.
- **Não** renomear `CHAVE_JOGOS`/`chaveResumo` nem mexer no formato das chaves (leitores existentes dependem delas).
- **Não** refatorar os fluxos de mutação ao redor (push, snackbar, navegação) — só trocar o par de invalidação.
- **Não** criar abstração genérica de invalidação por "grupo de chaves" (YAGNI: um grupo existe hoje; grupos futuros viram funções irmãs quando surgirem).

## 7. Riscos e rollback

- **Risco funcional: mínimo** — cada call site executa exatamente as mesmas duas chamadas, na mesma ordem, no mesmo ponto do fluxo. O único risco real é erro mecânico de migração (par trocado por referência errada), coberto pelo `tsc -b` + checklist da seção 5.
- **Risco de import cíclico**: descartado por verificação — `hooks/useCache.ts` importa apenas `react` e `lib/erros`; nada importa `lib/chavesCache` de dentro de `hooks/`.
- **Rollback do Passo 1**: `git revert` isolado — remove o helper e devolve `Jogos.tsx` ao par literal; os demais sites nem foram tocados.
- **Rollback do Passo 2**: `git revert` isolado — restaura os 6 pares e os imports originais; o helper criado no Passo 1 permanece (sem call sites, inofensivo) ou cai junto num revert de faixa dos dois commits.
- **Débito a registrar (não corrigir aqui)**: `invalidarCache` mora num módulo de hooks enquanto é função de módulo; se um dia `lib/` não puder depender de `hooks/`, movê-la para `lib/` é transposição mecânica — registrar no A10 (débitos), sem executar neste plano.
