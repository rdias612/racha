# 28 · Manifest `shortcuts` — Plano de Implementação

> Ref.: item **B5** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#28 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P3 (Fase 5 — Higiene P2/P3)

## 1. Objetivo

Adicionar 2 atalhos estáticos ("Jogos" → `/jogos`, "Ranking" → `/ranking/pontos`) ao `public/manifest.webmanifest`, reaproveitando `icon.svg` já publicado. São ~12 linhas de JSON em 1 commit, sem código novo, sem dependência nova. O item é puramente funcional (toque longo no ícone oferece navegação direta às duas telas mais usadas) — por isso a nota baixa no ranking anti-slop, que não diminui o valor de PWA pelo critério original do plano.

## 2. Estado atual (evidências verificadas)

Verificado no código em **03/10/2026**; todas as linhas do doc de origem conferidas e corretas:

- `public/manifest.webmanifest:1-46` — **sem a chave `shortcuts`** (grep confirmado; o doc de origem diz "grep vazio" — confere). Estrutura atual: `name`, `short_name`, `id`, `start_url`, `scope`, `display`, `categories` (`:13`) e `icons` (`:14-45`).
- `public/manifest.webmanifest:14-20` — `icons` já declara `/icon.svg` (512x512, `image/svg+xml`, `purpose: any`) e `/icon-maskable.svg` — os atalhos reutilizam o SVG existente, sem arquivo novo.
- `public/icon.svg` existe em `public/` (confirmado por listagem: `icon.svg`, `icon-maskable.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`).
- Rotas de destino existem de fato no router:
  - `src/App.tsx:49` — `<Route path="/jogos" element={<Jogos />} />`.
  - `src/App.tsx:50` — `/ranking` redireciona para `/ranking/pontos`; `src/App.tsx:51` — `<Route path="/ranking/:metrica" element={<Ranking />} />`. `/ranking/pontos` é a rota efetiva canônica (também usada em `src/routes/Layout.tsx:76,309` e `src/routes/Ranking.tsx:82,182`).
- `public/sw.js:35-44` — `ASSETS_PRECACHE` inclui `/manifest.webmanifest` (`:37`), precacheado em `racha-static-v3` (`:7`). `public/sw.js:220-242` — o handler same-origin do `fetch` é **NetworkFirst** com `cache.put` (`:224-227`): o manifest atualizado é baixado na 1ª visita online após o deploy, mesmo sem alterar o `sw.js`.
- `src/lib/pwa.ts:70` — registro do `/sw.js` após o `load`, sem alterações necessárias.

## 3. Pré-condições e dependências

- **Planos pré-requisitos**: nenhum. O plano 20 (B3, aviso de nova versão) e o 22 (B4, poda de cache) tocam `src/lib/pwa.ts`/`Layout.tsx` e `sw.js` respectivamente; este plano toca só `public/manifest.webmanifest` — nenhum conflito de arquivo.
- **Decisão do dono exigida antes de executar**: nenhuma — a proposta do plano de origem está fechada (2 atalhos estáticos, ícone reutilizado, sem `short_maskable_icon` nem atalhos dinâmicos).
- **Restrição de janela**: nenhuma (não toca telas nem fluxo de partida ao vivo).

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Chave `shortcuts` no manifest · 1 commit

**Arquivo tocado**: `public/manifest.webmanifest` (único). Nenhum arquivo novo, nenhuma biblioteca nova.

**Mudança**: inserir a chave `shortcuts` entre `"categories"` (linha 13) e `"icons"` (linha 14), mantendo a indentação de 2 espaços do arquivo. Esboço (~12 linhas):

```json
"shortcuts": [
  {
    "name": "Jogos",
    "url": "/jogos",
    "icons": [{ "src": "/icon.svg", "sizes": "512x512", "type": "image/svg+xml" }]
  },
  {
    "name": "Ranking",
    "url": "/ranking/pontos",
    "icons": [{ "src": "/icon.svg", "sizes": "512x512", "type": "image/svg+xml" }]
  }
]
```

**Decisões embutidas**:

- **`url` absoluto a partir da raiz** (`/jogos`, `/ranking/pontos`), no padrão do restante do manifest (`start_url: "/"`, `scope: "/"`). Aponta direto para `/ranking/pontos` (rota efetiva) em vez de `/ranking` (que é só redirect — `App.tsx:50`).
- **Sem `description`/`short_name` por atalho**: campos opcionais que não agregam neste caso (nomes de 1 palavra já são curtos).
- **Sem bump de `CACHE_STATIC`**: o manifest não é imutável e o handler same-origin já é NetworkFirst (`sw.js:222-228`) — o conteúdo novo chega ao cache na 1ª visita online, como hoje. Bump forçaria re-precache completo sem ganho (mesma justificativa do plano 22).
- **Ícone reutilizado**: o Chrome recomenda ícone ≥96px por atalho; `/icon.svg` já atende e evita criar PNG novo.

**Reversibilidade**: passo único; `git revert` restaura o manifest original. Sem migração de dados nem estado residual.

## 5. Validação manual

Sem testes automáticos, conforme AGENTS.md. Checklist objetivo (Android/Chrome real; atalho **pode exigir reinstalação do PWA**, pois o Chrome avalia o manifest na instalação):

- [ ] **Sanidade do JSON**: após o build, abrir o manifest servido e confirmar JSON válido; no Chrome DevTools → Application → Manifest, conferir que `shortcuts` aparece com as 2 entradas e sem erro de parse.
- [ ] **Reinstalação do PWA (passo essencial)**: no Android/Chrome, desinstalar o app instalado (ou usar um perfil limpo / `chrome://webapks` → desinstalar), abrir o site online e reinstalar ("Adicionar à tela inicial"). O Chrome lê os `shortcuts` **no momento da instalação** — instalação existente não os recebe só com reload.
- [ ] **Toque longo**: pressionar e segurar o ícone do app na tela inicial → devem aparecer "Jogos" e "Ranking" com o ícone do racha.
- [ ] **Navegação dos atalhos**: tocar "Jogos" → abre `/jogos` direto; tocar "Ranking" → abre `/ranking/pontos` (aba de pontos), sem passar pela home nem pelo redirect de `/ranking`.
- [ ] **Autenticação**: atalho tocado com sessão expirada deve cair no fluxo normal de login (as rotas estão dentro do `Layout` protegido — nenhum comportamento novo esperado).
- [ ] **Offline**: app offline aberto via atalho deve degradar como hoje (cache/`offline.html`) — os atalhos são estáticos e não afetam o SW.
- [ ] **Desktop (bônus)**: no Chrome desktop instalado, toque direito no ícone da barra de tarefas/janela mostra os mesmos 2 atalhos.

## 6. Fora de escopo

- **Não** implementar atalhos dinâmicos (`shortcuts` via `registration.setShortcuts`/SW — API ainda não amplamente suportada e sem demanda).
- **Não** criar `short_maskable_icon` por atalho nem PNG dedicado a atalhos (reuso do `icon.svg`, conforme o plano de origem).
- **Não** adicionar mais atalhos (Estatísticas, Perfil etc.) — 2 é o escopo fechado do item B5; mais atalhos são YAGNI até demanda real.
- **Não** tocar `sw.js`, `vercel.json` ou `pwa.ts` (ver decisão de sem bump na seção 4).
- **Não** criar testes automáticos para o manifest (AGENTS.md: validação manual apenas).

## 7. Riscos e rollback

- **Risco principal — manifest inválido**: um erro de sintaxe no JSON invalidaria o manifest inteiro (instalação/ícone/start_url degradam). Mitigação: validação do checklist (DevTools → Manifest mostra erro de parse imediatamente); o diff de ~12 linhas é revisável a olho. Detectado antes do deploy por inspeção local do build.
- **Risco secundário — atalho desatualizado em instalações existentes**: usuários que já têm o PWA instalado não veem os atalhos até reinstalar (comportamento do Chrome, não bug). Sem ação possível no código; o manifest atualizado já está disponível para novas instalações. Impacto aceitável em ~25 usuários.
- **Rollback**: `git revert` do commit único restaura o manifest anterior; na próxima visita online o handler NetworkFirst (`sw.js:222-228`) volta a servir o manifest antigo, e novas instalações voltam ao estado anterior. Sem estado residual (atalhos somem nas próximas reinstalações).
