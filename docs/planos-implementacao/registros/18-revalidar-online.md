# 18 · Revalidar dados ao voltar online (`B1`) — Registro de Execução e Validação

> Registro da execução do plano [18-revalidar-online.md](../18-revalidar-online.md) em 2026-10-02, na branch `main`, por dois agentes independentes: **implementador** (1 passo) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO COM RESSALVAS** — ressalvas apenas documentais (imprecisão na lista de consumidores do plano, corrigida no próprio doc); o código foi aprovado sem ressalvas.

## 1. Execução

- **1 commit** (`873b657`, `revalida caches ao voltar online (B1)`), apenas local (`main` à frente de `origin/main`). Diff: `src/routes/Layout.tsx` +2/−0 — exatamente o previsto (~2 linhas líquidas).
- Import adicionado: `import { invalidarCache } from '../hooks/useCache';` (`Layout.tsx:37`).
- `handleOnline` (`Layout.tsx:91-94`) ficou conforme o plano — `setIsOffline(false)` permanece a 1ª instrução (sem risco de regressão no banner), seguido de `invalidarCache();`:
  ```ts
  function handleOnline() {
    setIsOffline(false);
    invalidarCache();
  }
  ```
- Nenhum outro arquivo tocado: sem novo estado/efeito, `useCache.ts`, `sw.js`, banner offline e `handleOffline` intocados; nenhuma abstração nova (sem `useOnline` — YAGNI da seção 6 respeitado).

## 2. Confirmações técnicas da auditoria

- **Semântica da invalidação global**: `invalidarCache()` sem argumento (`useCache.ts:39-58`, ramo `else`) percorre todas as chaves, incrementa a geração, limpa `cache`/`emVoo` e notifica todos os ouvintes inscritos — cada tela montada com `useCache` dispara `revalidar(true)` forçado.
- **Revalidação sem skeleton**: `carregando` só é `true` na 1ª visita (`useCache.ts:184`) — o dado antigo permanece visível até a resposta chegar, sem flash.
- **Guard de geração mitigação o risco de resposta obsoleta**: `executar` só grava no cache se a geração não mudou (`useCache.ts:70-77`) e `revalidar` só aplica estado se o voo não foi invalidado (`useCache.ts:131-148`). O burst ao reconectar equivale a um PullToRefresh por tela, com falha silenciosa se a rede ainda estiver instável.
- **Build e lint reexecutados pelo validador**: `npm run build` (exit 0) e `npm run lint` (exit 0, sem diagnósticos).
- **Commit único e coerente**: 1 passo = 1 commit, mensagem idêntica à prevista, apenas local.

## 3. Divergências plano × código real / Decisões tomadas

1. **Lista de consumidores do `useCache` imprecisa no plano (seção 2)** — corrigida no próprio doc do plano (passo 5 do processo padrão): o plano citava `PartidaDetalhe.tsx` e `PartidaAoVivo.tsx` como consumidores, mas **nenhum dos dois importa `useCache`** (usam `invalidarCachesDependentesDePartida` de `lib/chavesCache.ts`). Lista real, revalidada por grep na execução: `Resumo`, `Jogos`, `Ranking`, `Comparador`, `Estatisticas`, `EstatisticasRacha`, `Administrador`, `Login`, `Perfil`, `PartidaNova`, `PartidaEditar`, `PartidaTimes` (rotas) + `src/components/ConfirmacoesPartida.tsx`. Quem não está inscrito simplesmente não revalida — o ganho do plano se mantém integralmente, e o burst cobre mais telas do que o doc sugeria.
2. Nenhuma divergência de código: a execução seguiu o plano linha a linha (linhas de `Layout.tsx` conferiam sem deslocamento).

## 4. Pendente de validação humana (fluxo online → offline → online, no DevTools)

- [ ] DevTools → Network → **Offline**: banner vermelho "Modo offline — exibindo dados locais salvos" aparece no topo; ao voltar **Online**, o banner some imediatamente.
- [ ] No mesmo instante do retorno, com a aba Network aberta (filtro Fetch/XHR): novas requisições das telas montadas disparam sozinhas, **sem skeleton e sem flash** (dado antigo visível até a resposta chegar).
- [ ] Alterar um dado no Supabase/dashboard enquanto offline e conferir que Resumo/Jogos o exibem ao voltar online — sem PullToRefresh e sem trocar de rota.
- [ ] Repetir o ciclo com a aba **Ranking** montada (segunda validação de consumidor `useCache`).
- [ ] Em aparelho Android (se disponível): modo avião → desligar modo avião, mesmos comportamentos (banner + revalidação silenciosa).
