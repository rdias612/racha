# 20 · Aviso de nova versão disponível — Plano de Implementação

> Ref.: item **B3** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#20 (nota 1,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P1 (Fase 1)

## 1. Objetivo

Fechar a janela residual em que o SPA quente em memória roda contra um backend já migrado: quando o SW novo assume o controle (`skipWaiting` + `clients.claim`), o `Layout` exibe o banner "Nova versão disponível — Recarregar", que faz `window.location.reload()`. São ~15 linhas novas seguindo o padrão de ouvintes reativos já existente em `pwa.ts` — código novo, sem slop removido (o ganho é 100% de produto).

> **Nota de prioridade**: no ranking anti-slop este item é Tier 4 (#20, nota 1,0) — o critério daquele ranking mede deduplicação, não valor de UX. No plano original o B3 é **P1, Fase 1** (item 5 da fase), ataca cenário real de campo (telas podem falhar até o próximo cold start) e a ordem do plano original continua correta.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; linhas do doc de origem conferidas:

- `public/sw.js:55` — `self.skipWaiting()` **incondicional** no handler `install`; `public/sw.js:66` — `self.clients.claim()` no `activate`. Resultado: o SW novo assume o controle imediatamente, mas a página antiga continua em memória sem ser avisada.
- `src/lib/pwa.ts:67-74` — `registrarServiceWorker()` registra `/sw.js` de forma silenciosa (`.catch(() => {})`); **zero `controllerchange`** no arquivo (grep confirma).
- **Padrão de estado reativo a replicar**: `src/lib/pwa.ts:44-55` — `ouvintes: Set<() => void>` + `notificar()` + `inscrever(cb)`; consumido por `useInstalacaoPWA` (`pwa.ts:135-141`) via `setTick`. É exatamente o mecanismo a reutilizar, não um novo.
- **Onde o `Layout` exibe banners**: `src/routes/Layout.tsx:117-127` — banner global offline (`isOffline`, estado em `Layout.tsx:85-102` com ouvintes `online`/`offline`). O banner de nova versão entra no mesmo ponto, logo abaixo.
- O doc de origem cita `sw.js:55`, `sw.js:66` e `pwa.ts:66-74` — **todos conferem** (o registro está em `pwa.ts:67-74`, com o JSDoc a partir de 61).

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** Nenhum outro item do ranking toca `pwa.ts` (registro) ou o bloco de banners do `Layout`.
- **Decisão do dono exigida antes de executar**: nenhuma — a proposta do plano de origem está fechada (guard de primeiro controller + banner com reload; **sem** `postMessage`, **sem** Workbox/vite-plugin-pwa — descartados no plano original).
- **Restrição de janela**: nenhuma. Sem mudança no `sw.js` (o `skipWaiting` incondicional permanece — a alternativa "esperar consentimento" é escopo novo e não solicitado).

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Detecção em `initPWA` + estado reativo · 1 commit

- **`src/lib/pwa.ts`** — ~10 linhas:
  1. Estado de módulo junto dos existentes (`pwa.ts:41-44`): `let novaVersaoDisponivel = false;`
  2. Em `initPWA` (após `registrarServiceWorker()`), capturar **sincronamente, antes de qualquer ativação**: `const tinhaController = !!navigator.serviceWorker.controller;` e registrar o ouvinte com o **guard**:

  ```ts
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaController) return; // primeiro claim pós-instalação não é update
    novaVersaoDisponivel = true;
    notificar();
  });
  ```

  3. Exportar `useNovaVersaoPWA()` no mesmo molde de `useInstalacaoPWA` (`pwa.ts:135-141`): `inscrever` + `setTick`, retornando `{ novaVersaoDisponivel }`.

### Passo 2 — Banner no `Layout` · 1 commit

- **`src/routes/Layout.tsx`** — ~5 linhas, logo abaixo do banner offline (`Layout.tsx:118-127`), mesmo estilo (`role="status"`, faixa fina no topo):

  ```tsx
  {novaVersao && (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 bg-aviso px-3 py-1.5 text-xs ...">
      <span>Nova versão disponível</span>
      <button onClick={() => window.location.reload()}>Recarregar</button>
    </div>
  )}
  ```

  `const { novaVersaoDisponivel: novaVersao } = useNovaVersaoPWA();` junto dos hooks existentes (`Layout.tsx:80-87`). Cor de fundo: reutilizar token existente (validar `bg-aviso` vs `bg-perigo` ao tocar o arquivo; sem tokens novos).

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist **obrigatório cobrindo os dois cenários** — o guard do primeiro controller é o ponto de atenção:

1. **Instalação limpa** (DevTools → Application → Service Workers → Unregister + Clear storage; recarregar): o primeiro `claim` dispara `controllerchange`, mas `tinhaController` era `false` → o banner **NÃO** deve aparecer.
2. **Update real**: com o app aberto, alterar algo visível no bundle (ou `CACHE_STATIC` em `sw.js`), deploy/build, recarregar **uma vez** (dispara o install do SW novo; o `skipWaiting` o ativa) → banner "Nova versão disponível" **deve** aparecer; clicar em "Recarregar" deve recarregar com o bundle novo visível e o banner some.
3. **Coexistência com banner offline**: emular offline → banner offline aparece; voltar online → some; banner de versão não é afetado.
4. Repetir 1 e 2 em aparelho Android instalado (standalone), se disponível — é o cenário real de campo (SPA quente por dias).

## 6. Fora de escopo

- **Não** trocar `skipWaiting()` incondicional por espera de consentimento (mudaria o fluxo de ativação do SW).
- **Não** usar `postMessage` entre SW e página (desnecessário: `controllerchange` já chega na página).
- **Não** introduzir Workbox, `vite-plugin-pwa` ou novas dependências (descartados no plano de origem).
- **Não** tocar em `sw.js`, B4 (poda de `/assets/*`) ou qualquer outro item do ranking.

## 7. Riscos e rollback

- **Falso positivo do banner em instalação limpa** (guard incorreto): o banner apareceria na primeira visita — cenário pior é inofensivo (reload numa primeira carga), mas o checklist 5.1 deve ser validado **antes** do deploy. Correção é ajustar o guard no Passo 1.
- **Banner não aparece em update real** (ex.: navegador com página dormente que recarrega sozinha): degrada para o comportamento atual (versão nova no próximo cold start), sem regressão.
- **Rollback**: cada passo é revertível por `git revert` isolado — o Passo 2 sozinho remove a UI; o Passo 1 sozinho remove o ouvinte e o hook (sem referências restantes).
