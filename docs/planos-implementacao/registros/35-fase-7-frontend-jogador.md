# 35 · Fase 7 — Frontend jogador: `lib/clipes.ts`, bloco no detalhe e link na home — Registro de Execução e Validação

> Registro da execução da [fase-7-tasks.md](../35-fases/fase-7-tasks.md) do plano 35 em 02/10/2026, na branch `main`, no fluxo de dois agentes: **executor** e **auditor** (read-only) — **sem corretor** (auditoria APROVADA, zero achados de código).

## 1. Execução

- **4 commits** (1 por task; `798d0c7` → `3e82a6f`):
  - `798d0c7` — `src/lib/clipes.ts`: tipos via `Pick` dos types gerados; `urlPublicaDoClipe` via `getPublicUrl` do SDK (resultado idêntico ao padrão da Fase 3 — P4); `carregarClipesDaPartida` (ordem `ordem` asc nullsLast + `id`); `obterUltimaPartidaComClipes` (join `partidas!inner(status)` + P7 `['published','closed']` + head-count do `totalClipes`).
  - `0056f7a` — `src/components/GradeClipesPartida.tsx`: card no visual do repo, `<video controls playsInline preload="metadata">` (sem autoplay — egress/bateria), Baixar = âncora `target="_blank" rel="noopener noreferrer" download`, Compartilhar = Web Share API com fallback clipboard e feedback "Copiado!" 2s. Zero libs novas.
  - `089d7f1` — `src/routes/PartidaDetalhe.tsx`: `buscarClipes` tolerante a falha (try/catch → `[]`, padrão do count de votos) como 6º membro do `Promise.all`; render `{clipes.length > 0 && <GradeClipesPartida/>}` imediatamente após `GridTimesPartida`. Nenhum outro bloco alterado.
  - `3e82a6f` — `src/lib/chavesCache.ts` (1 chave nova, `clipes:ultima-partida`) + `src/routes/Resumo.tsx` (segundo `useCache` independente do `DadosResumo`; `CardClipesDisponiveis` com `return null`; render ENTRE `CardProximaPartida` e o ternário `semPartidas` — **P9 literal**: card visível no empty state).
- **Task 5 (verificação pura, sem commit)**: Storage (`/storage/v1/object/public/clipes/...`) não casa com nenhum dos 3 ramos do handler de fetch de `sw.js` (`:166,175-177,199,220`) nem com o rewrite do `vercel.json:2` — streaming direto à rede, Range headers intactos (seek funciona). Nenhuma mudança nos dois arquivos.
- **Validações do executor**: build/lint exit 0 após cada task; nenhum seletor/segredo/desvio de escopo; working tree limpa.

## 2. Único desvio de código (ajuste obrigatório de compilação)

`'share' in navigator` do esboço não compila: o `lib.dom` tipa `share` como obrigatório em `Navigator`, então o ramo `else` do `in` estreita para `never` (TS2339). Trocado por `typeof navigator.share === 'function'` — semanticamente equivalente para detecção de capability, documentado com comentário no código (`GradeClipesPartida.tsx:27-28`). A auditoria validou a equivalência: **não é achado**.

## 3. Auditoria (aprovado)

- S1–S6 ✅ com evidência linha a linha (inclusive as linhas reais conferidas contra o `database.types.ts` gerado e a FK `clipes_partida_id_fkey`).
- Q1 (query P7) traçada: join/filtro válidos em 1 round-trip; empate de `data_jogo` inócuo; retenção não deixa órfãos de linha; head-count coerente.
- Q2 (regressão nas telas mais visitadas — risco principal): `buscarClipes` captura tudo que a lib lança (`getPublicUrl` é síncrono); demais membros do `Promise.all` intactos; no Resumo, fetcher estável (referência de módulo) e `null` cacheado distingue de `undefined` — card some sem bloquear a home.
- Q5: gates reexecutados pelo auditor (build 1.09s, lint exit 0).
- **Achados**: zero Critical/Important. Dois Minor **herdados do esboço da própria spec**, ambos "nenhuma ação necessária" (estacionados): `setTimeout` do "Copiado!" sem cleanup no unmount (inofensivo no React 18+, escopo 2s); `formatarTamanho` chamado 2× por item (cosmético).
- Anotação: `origin/main` em `3e82a6f` durante a auditoria — push paralelo do dono novamente (nada pushed por agentes).

## 4. Observações operacionais

- Quarta fase consecutiva com push paralelo do dono durante a execução/auditoria — o relatório do executor declara "nada pushed" e é verdade para os agentes.
- A pré-condição "types com `clipes`" já estava satisfeita pelas regenerações das Fases 1/6 — nenhuma regeneração nesta fase (conforme desenho).

## 5. Pendente de validação humana (dono — no aparelho, via `iniciar_local.ps1`)

- [ ] **Semear dados de teste** (seção 3 da spec): partida real `published`/`closed` + 2–3 mp4 curtos no bucket `clipes/{partida_id}/` pelo dashboard + `INSERT INTO clipes (...)` no SQL Editor (com `size_bytes` real e `ordem` 1,2...). Manter também uma partida recente SEM clipes (caso "não mostra nada").
- [ ] **RF04 — playback**: grade abaixo dos times, reprodução com som, seek funcionando.
- [ ] **RF04 — baixar/compartilhar**: Baixar abre o vídeo para salvar; Android/iOS abre o share sheet; desktop mostra "Copiado!".
- [ ] **Partida sem clipes**: nenhum bloco, layout idêntico ao de hoje; com devtools bloqueando `/rest/v1/clipes*`, a página carrega normal.
- [ ] **RF05 — card na home**: entre "PRÓXIMA QUINTA" e os destaques, com contagem certa; tocar abre o detalhe certo; sem linhas em `clipes` → card some ao reabrir a rota.
- [ ] **P9 — empty state**: com o ano zerado de destaques e clipes existentes → card aparece acima da mensagem.
- [ ] **Prova SW**: playback com SW ativo → Network sem "from ServiceWorker", resposta `206 Partial Content`.
- [ ] Nenhuma lib nova no `package.json`; 4 commits revertíveis; limpar as sementes se não virarem dado real.
