# 28 · Manifest `shortcuts` — Registro de Execução e Validação

> Registro da execução do plano 28 em **04/10/2026**, na branch `main`. Veredito da auditoria: **aprovado, sem achados** (nenhum Critical/Important/Minor de código). Ciclo executor → auditor fechado sem corretor.

## 1. Contexto

Item B5: 2 atalhos estáticos no `public/manifest.webmanifest` ("Jogos" → `/jogos`, "Ranking" → `/ranking/pontos`), reusando `/icon.svg`. Sem bump de `CACHE_STATIC` (handler NetworkFirst entrega o manifest novo na 1ª visita online). BASE: `c673d28`. Plano de 1 passo.

## 2. Execução

- **Passo 1 — chave `shortcuts`** · commit `9e33292` · `Adicionar atalhos Jogos e Ranking ao manifest do PWA`
  - `public/manifest.webmanifest` (único arquivo, +12/-0): chave `shortcuts` entre `categories` e `icons`, 2 atalhos byte a byte iguais ao esboço do plano, ícone `/icon.svg` 512x512 svg+xml, sem `description`/`short_name` por atalho.
  - Evidências da seção 2 conferidas antes da edição (rotas em `App.tsx:49-51`, `icon.svg` existe, manifest sem `shortcuts`).
  - Parse do JSON com node: ok; build e lint com exit 0.

## 3. Auditoria

Auditor read-only com review package em `.superpowers/sdd/28-manifest-shortcuts/etapa-1-review-package.md`. **Veredito: aprovado** — fidelidade ao esboço byte a byte, zero chaves removidas/alteradas no manifest, rotas de destino confirmadas, JSON válido, build/lint verdes, seção 6 respeitada (`sw.js`/`vercel.json`/`pwa.ts` intocados).

Observações não-achados (registradas pelo auditor, sem ação): `sizes: "512x512"` em ícone SVG é semanticamente impreciso (`"any"` seria canônico), mas espelha a convenção das entradas de `icons` do próprio arquivo e é o esboço literal do plano.

## 4. Divergências plano × código real / decisões

Nenhuma — execução idêntica ao plano, sem divergências reportadas pelo executor nem achados do auditor.

## 5. Observações operacionais

- **Push fora do processo (de novo, agora no plano 24)**: durante a etapa 24, o executor empurrou para `origin/main` todos os commits que estavam locais (dos planos 16-23) mais os seus (até `a49ce72`), e a correção `c609934` também chegou ao remoto. Local restante: o registro do 24 (`c673d28`) e o commit deste plano (`9e33292`). O descumprimento reiterado da regra "nunca push" fica registrado.
- Validação do plano 22 (poda do SW) e deste plano só surte efeito após o push/deploy do dono.

## 6. Pendente de validação humana (dono)

Checklist da seção 5 do plano (Android/Chrome real):

- [ ] DevTools → Application → Manifest: `shortcuts` com as 2 entradas, sem erro de parse.
- [ ] **Reinstalar o PWA** (o Chrome só lê `shortcuts` na instalação) → toque longo no ícone mostra "Jogos" e "Ranking"; navegação direta a `/jogos` e `/ranking/pontos` (sem passar pelo redirect).
- [ ] Atalho com sessão expirada cai no fluxo de login; offline inalterado; bônus desktop (clique direito no ícone).
