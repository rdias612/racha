# 35 · Fase 3 — Action: Playwright (login → download → upload idempotente) — Registro de Execução e Validação

> Registro da execução da [fase-3-tasks.md](../35-fases/fase-3-tasks.md) do plano 35 em 02/10/2026, na branch `main`, no fluxo de três agentes: **executor**, **auditor** (read-only) e **corretor** (acionado por 2 achados Minor). Veredito da auditoria: **APROVADO COM RESSALVAS** (código fiel à spec; ressalvas corrigidas/anotadas).

## 1. Execução

- **6 commits** (1 por task):
  - `ebd3a8b` — `docs/filmaeu-mapeamento-dom.md`: TEMPLATE para o dono preencher (4 seções: rotas/fluxo, seletores, comportamento do download, resiliência). **Nenhum seletor inventado.**
  - `5d3a790` — Playwright `^1.63.0` como devDependency de `scripts/clipes/` (deps do PWA intocadas — RNF01); YAML: `cache: npm` + `cache-dependency-path`, step `playwright install --with-deps chromium`, `timeout-minutes` 10→25.
  - `d16a632` — `scripts/clipes/filmaeu/seletores.mjs`: única fonte de rotas/seletores/timeouts (RNF04) — 12 seletores **'A CONFIRMAR'** + `ErroFilmaeu(passo)`.
  - `5ea3ea7` — `scripts/clipes/filmaeu/automacao.mjs`: `abrirBrowser` (headless, `acceptDownloads`), `comRetry`, `screenshot`, `logarFilmaeu`, `navegarParaSlot` (URL endereçável preferida + fallback por cliques), `coletarClipes` (ordem 1-based), `baixarClipes` (dois padrões codificados: evento de download + fallback âncora S3 com cookies da sessão).
  - `49abc15` — `scripts/clipes/armazenamento.mjs`: `montarCaminho` (`{partida_id}/{arquivo}`), `caminhosExistentes` (Set), `subirClipe` (`size_bytes` via `stat`, upload `upsert`, INSERT `ignoreDuplicates` = ON CONFLICT DO NOTHING), `resumoDaPartida`.
  - `fd74c98` — integração em `importar-clipes.mjs`: `importarClipesDaPartida` (idempotência "tabela antes de baixar"), parse real do JSON de credenciais (substitui `validarSegredoFilmaeu`), ledger com `concluido`/`sem_clipes` (sucesso false + exit 0) / `falha` (exit 1), quantidade/bytes = estado da partida; YAML: artefato `clipes-debug` em `if: failure()`.
- **Validações do executor**: `node --check` nos 4 .mjs; `npm ci` exit 0; `npm run build`/`lint` da raiz exit 0; `racha-gragoata-cbo` no lockfile = 0 (a dependência espúria da Fase 2 foi reintroduzida pelo `npm install` e removida antes do commit — mesma causa raiz, a investigar como débito); nenhum seletor fora de `seletores.mjs`; nenhum log de credencial.

## 2. Auditoria (aprovado com ressalvas)

- S1–S7 ✅ com fidelidade semântica plena (incluindo as 3 divergências do executor: Locator em vez de string de seletor, skip de pendentes dentro de `baixarClipes` — nome só se conhece pós-clique, com `download.cancel()` — e `bytes_total` no fecharRegistro, previsto pela spec da fase).
- Idempotência em 3 camadas verificada por trace: reexecução completa → 0 downloads → 0 inserts → ledger reusado com contagem total; crash entre upload e INSERT → re-download → `upsert` sobrescreve órfão + `ignoreDuplicates` evita duplicata. **Todos** os 11 retornos supabase-js checam `error`.
- **A1 (importante, processo — não é código)**: a fase inteira foi empurrada a `origin/main` durante a janela da auditoria por push paralelo do dono (reflog com 4 pushes). Relatório do executor dizia "sem push" — retificado aqui. Consequência prática: o workflow está público com cron ativo; **as runs de sexta vão falhar (vermelho) enquanto os secrets não existirem e o mapeamento DOM não for preenchido** — desabilitar o workflow na aba Actions ou cadastrar os secrets antes de sexta.
- **A2/A3 (Minor, corrigidos pelo corretor)** — commit `9f7995c`: screenshot de debug agora nas falhas de navegação/coleta também (`comScreenshotDeFalha`, `falha-<passo>`), e `new URL(url, URLS.base)` resolve href relativo no padrão B (absoluta S3, relativa `/media/clipe.mp4` e vazia testadas mentalmente pelo corretor). Build/lint/ci exit 0 revalidados.
- **A4 (Minor, débito deferido — herdado da Fase 2)**: se `fecharRegistroImportacao` lançar dentro do `catch` de `main()`, o erro escapa como unhandled rejection (node sai 1 mesmo assim). Sem ação nesta fase.
- **A5 (info)**: na reexecução com padrão A, o clique acontece antes do skip (nome pós-clique) — não rebaixa para disco nem reenvia; RF02 preservado.

## 3. Observações operacionais

- Arquivo estranho `0.30.0` visto na raiz do repo antes da fase sumiu do disco durante a execução — nunca foi stageado/commitado (origem desconhecida, provável artefato de npm/npx; manter olho).
- Flakiness de escrita em `scripts/clipes/` relatada na Fase 2 se repetiu de forma branda; executor/corretor confirmaram conteúdo via `cat`/`node -p` antes de cada commit.

## 4. Pendente de validação humana (dono — bloqueia as runs reais)

- [ ] **Preencher `docs/filmaeu-mapeamento-dom.md`** (logado no filmaeu.com.br) e substituir os 12 seletores 'A CONFIRMAR' em `scripts/clipes/filmaeu/seletores.mjs` — decidir também 3.1 (padrão de download) e 3.2 (nome estável vs plano B `clipe-{ordem:03d}.mp4`).
- [ ] Secrets: `filmaeu_credenciais` no Vault + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no GitHub (Fase 2) + push do commit `9f7995c`.
- [ ] Run de teste com data de partida real → verde; clipes em `clipes/{partida_id}/` no bucket; URL pública 200.
- [ ] 2ª execução da mesma data → `0 novos`, tabela inalterada, ledger reusado.
- [ ] Run com data sem partida → ledger `falha`, run verde (Fase 2 preservada).
- [ ] Log da run sem credenciais; artefato `clipes-debug` em falha de DOM.
- [ ] Enquanto o mapeamento/secrets não estiverem prontos: desabilitar o workflow ou esperar runs vermelhas de sexta (ver A1).
