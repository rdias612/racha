# 18 · Revalidar dados ao voltar online — Plano de Implementação

> Ref.: item **B1** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#18 (nota 1,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P0

## 1. Objetivo

Fazer o `handleOnline` do `Layout` chamar `invalidarCache()` **sem argumento** ao voltar a conexão, para que todas as telas montadas revalidem seus dados em background automaticamente — em vez de exibir dado do cache de memória até um PullToRefresh, troca de rota ou remount. São ~2 linhas (1 import + 1 chamada), **zero abstração nova** e zero slop removido: o ganho é 100% de produto.

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#18, nota 1,5) — o critério daquele ranking mede deduplicação, não valor de UX, e itens puramente funcionais tendem à nota baixa **sem deixarem de ser valiosos** (explicitado na seção 1 do ranking). No plano original o B1 é **P0, Fase 1**: é o item mais barato da fase crítica, ataca o cenário real de uso em campo (usuário sai de área sem sinal e volta a ver dado velho **sem perceber**) e a ordem de fases do plano original continua correta (o `README.md` deste diretório manda seguir as fases do plano para o Tier 4).

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

- `src/routes/Layout.tsx:90-92` — o `handleOnline` apenas faz `setIsOffline(false)` (desliga o banner global offline); **nenhuma invalidação é disparada**. O ouvinte já existe e está corretamente registrado/removido (`Layout.tsx:96-101`).
- `invalidarCache(chave?: string): void` (`src/hooks/useCache.ts:39-58`) — sem argumento, percorre **todas** as chaves do cache, incrementa a geração de cada uma, limpa `cache` e `emVoo` e notifica todos os conjuntos de ouvintes inscritos (ramo `else` em `useCache.ts:48-57`). É API pública existente, usada hoje só com chave específica.
- **Ouvintes de invalidação montados**: todo componente consumindo `useCache` se inscreve na sua chave (`src/hooks/useCache.ts:152-156`, via `inscrever` → `revalidar(true)` forçado, com guard `ativo` e checagem de geração). Consumidores confirmados por grep: `src/routes/Resumo.tsx:18`, `src/routes/Jogos.tsx:6`, `src/routes/Ranking.tsx:8`, `src/routes/Comparador.tsx:14`, `src/routes/PartidaDetalhe.tsx`, `src/routes/PartidaAoVivo.tsx`, `src/routes/PartidaEditar.tsx`, `src/routes/PartidaTimes.tsx`.
- **Sem skeleton na revalidação**: `carregando` só é `true` quando não há dados nem erro (`src/hooks/useCache.ts:184`, comentário "Skeleton apenas na primeira visita") — a revalidação pós-`invalidarCache()` atualiza a tela em background com o dado velho visível, sem flash.
- O doc de origem (`plano-melhorias-frontend-pwa.md` §B1) cita `Layout.tsx:90-92` e `useCache.ts:39-58` — **ambos conferem**.
- `Layout.tsx` hoje não importa nada de `../hooks/useCache` (o import será adicionado no Passo 1). Nenhum risco de ciclo: `hooks/useCache.ts` importa apenas `react` e `../lib/erros`.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** O item 03 (helper `invalidarCachesDependentesDePartida`) não interfere: aqui usa-se a forma **global** `invalidarCache()` sem argumento, que cobre todas as chaves montadas (resumo, jogos, ranking, partida) — exatamente o que se quer ao voltar online. Nem 03 depende de 18, nem 18 de 03.
- **Decisão do dono exigida antes de executar**: nenhuma — a proposta do plano de origem está fechada (chamar `invalidarCache()` dentro do `handleOnline` existente).
- **Restrição de janela**: nenhuma. A mudança não toca fluxos de mutação nem telas de partida ao vivo (elas se beneficiam como qualquer tela montada, sem alteração de código).
- **Restrição de validação**: o checklist da seção 5 depende do DevTools (aba Network / `navigator.onLine`), então validar em desktop com emulação offline é suficiente para o comportamento do `handleOnline`; se houver aparelho Android à mão, repetir em modo avião para cobrir o cenário real de campo.

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Chamar `invalidarCache()` no `handleOnline` · 1 commit

- **`src/routes/Layout.tsx`** — duas alterações pontuais:
  1. Adicionar ao imports: `import { invalidarCache } from '../hooks/useCache';`
  2. Dentro de `handleOnline` (linhas 90-92), acrescentar a chamada após `setIsOffline(false)`:

  ```ts
  function handleOnline() {
    setIsOffline(false);
    invalidarCache();
  }
  ```

- Nenhum outro arquivo é tocado. Sem novo estado, sem novo efeito, sem componente novo — reuso direto da API de invalidação existente e dos ouvintes que `useCache` já monta.
- Conferir com `tsc -b` (ou o build do projeto) que não há erro de import.
- Commit: "revalida caches ao voltar online (B1)".

Total: 1 commit, ~2 linhas líquidas.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no build de dev (`npm run dev`) com o app logado, exercitando o fluxo **online → offline → online**:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] Abrir a aba **Resumo** (`/`) e o **mural Jogos** (`/jogos`) normalmente (dados carregados, sem banner).
- [ ] DevTools → aba **Network** → seletor de throttling → **Offline** (ou `navigator.onLine === false` via console): o **banner vermelho "Modo offline — exibindo dados locais salvos"** aparece no topo.
- [ ] Com o app offline, navegar entre Resumo e Jogos: telas seguem exibindo o dado do cache (comportamento atual preservado — nada quebra).
- [ ] Devolver a rede (**Online** no throttling): o **banner some imediatamente**.
- [ ] No mesmo instante, com a aba **Network** aberta (filtro Fetch/XHR): novas requisições às queries das telas montadas disparam sozinhas (revalidação), **sem skeleton e sem flash de carregamento** — o dado antigo permanece visível até a resposta chegar.
- [ ] Conferir que Resumo e Jogos exibem dado atualizado após a revalidação (ex.: alterar um dado no Supabase/dashboard enquanto offline e ver a mudança aparecer ao voltar online, sem pull-to-refresh e sem trocar de rota).
- [ ] Repetir o ciclo offline→online com a aba **Ranking** montada (segunda validação de consumidor `useCache`).
- [ ] Em aparelho Android (se disponível): modo avião → desligar modo avião, mesmos comportamentos (banner + revalidação silenciosa).

## 6. Fora de escopo

- **Não** tocar em `src/hooks/useCache.ts` — a API atual já atende; nenhuma mudança de semântica de `invalidarCache`.
- **Não** criar invalidação seletiva por tela/chave montada (ex.: "só as chaves visíveis") — YAGNI: o custo de revalidar tudo montado é baixo e a simplicidade é o ponto do item.
- **Não** implementar o B3 (aviso de nova versão) nem nenhum outro ouvinte novo — só o `handleOnline` existente é alterado.
- **Não** mexer no service worker (`sw.js`), no comportamento do banner offline (texto, cor, ARIA) nem no `handleOffline`.
- **Não** extrair componente/hook de "conectividade" (ex.: `useOnline`) para 1 consumidor — abstração sem demanda (AGENTS.md).

## 7. Riscos e rollback

- **Risco funcional: baixo.** A chamada reusa o caminho já exercitado por todas as mutações (`invalidarCache` + ouvintes + guard de geração em `useCache.ts:70-77,131-148`), que impede resposta obsoleta de repovoar o cache. O pior caso é um burst de revalidações das telas montadas ao reconectar — mesmo efeito de um PullToRefresh em cada tela, sem skeleton e com falha silenciosa se a rede ainda estiver instável (dado antigo permanece em tela, comportamento documentado do `useCache`).
- **Risco de regressão no banner offline**: nulo — `setIsOffline(false)` permanece a primeira instrução; a chamada nova é aditiva.
- **Rollback**: `git revert` do commit único restaura o `handleOnline` original (o import órfão cai junto no mesmo commit). Reversão total e isolada.
