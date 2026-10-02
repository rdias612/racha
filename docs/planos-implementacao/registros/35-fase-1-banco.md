# 35 · Fase 1 — Banco: tabelas, bucket, grants e tipos — Registro de Execução e Validação

> Registro da execução da [fase-1-tasks.md](../35-fases/fase-1-tasks.md) do plano 35 em 2026-10-02, na branch `main`, no fluxo de três agentes: **executor**, **auditor** (read-only) e **corretor** (acionado pelos achados da auditoria). Veredito da auditoria: **APROVADO COM RESSALVAS** (zero Critical/Important, 3 Minor — corrigidas/documentadas).

## 1. Execução

- **3 commits** (1 por task; nada pushed pelos agentes):
  - `f4b7974` — migration `109_clipes_tabelas.sql`: tabelas `clipes` (FK `partidas` CASCADE, `data_jogo` denormalizada, `size_bytes` P12, `UNIQUE(partida_id, caminho)`, índices) e `clipes_importacoes` (ledger padrão `cron_execucoes`, CHECKs `origem`/`status` incluindo `'limpeza'`/`'sem_clipes'`), grants (escrita só `service_role`).
  - `1f60870` — migration `110_clipes_bucket.sql`: bucket `clipes` público (INSERT idempotente) + policy SELECT de leitura; nenhuma policy de escrita.
  - `0850e2a` — `src/lib/database.types.ts` regenerado com as tabelas novas.
- **Migrations aplicadas no remoto** via `npx supabase db push` (sem erro — inclusive o primeiro contato do repo com `storage.*`, risco da divergência 9.2 não se concretizou).
- **Validações de banco** (executor, via CLI/curl): `GET /rest/v1/clipes` com anon key → 200 `[]`; `POST /rest/v1/clipes` e `GET /rest/v1/clipes_importacoes` com anon key → negados (42501); objeto inexistente no bucket público → "Object not found" (bucket existe, público); upload com anon key → negado (403).
- **Numeração 109 confirmada livre** (regra da seção 9.1 da spec — plano escolha-times não implementado).
- **Auditoria** (review package em `.superpowers/sdd/35-clipes-filmaeu/fase-1-review-package.md`): spec S1–S5 toda ✅ (DDL fiel, nenhum grant de escrita ao client, types sem perdas, escopo limpo); build e lint reexecutados pelo auditor com exit 0.

## 2. Divergências plano × código real / decisões

1. **Regeneração de types não é reproduzível pela toolchain atual** (trap documentado): nenhum CLI testado (1.100→2.119) reproduz o arquivo versionado — args de RPC saem sem `| null`, quebrando `src/lib/dividas.ts:118-127` (5 erros TS2322). O executor restaurou verbatim a seção `registrar_divida` para manter o build (desvio da letra da Task 3, auditado e semanticamente correto). Trap anotado em `docs/MIGRATE.md` pelo corretor (commit `74d08f7`).
2. **Achados Minor da auditoria**: M1 patch manual no types (acima); M2 `PostgrestVersion` `'14.15'`→`'14.5'` (sem consumidor, sem ação); M3 trap documentado só em arquivo não versionado → corrigido pelo corretor no MIGRATE.md.
3. **`clipes` legível por `anon`** (não só `authenticated`): decisão deliberada da divergência 9.4 — confirmada limitada a SELECT.
4. Correção aplicada pela Fase 4 do plano (anticipada na spec): grant `DELETE` a `service_role` em `clipes` não estava na Fase 1 e entra na migration 112.

## 3. Desdobramento pós-fase — ajuste de tipos RPC (`docs/plano-ajuste-tipos-rpc.md`)

- O dono regenerou `database.types.ts` manualmente (commit `2248f12`), ativando o trap (build quebrado). Um subagente planejador criou o plano de ajuste (opção A: omitir args opcionais com `?? undefined` em vez de `null` — `092:14-23` confirma `DEFAULT NULL` em todos os parâmetros de `registrar_divida`).
- Execução no mesmo fluxo de 3 agentes: executor (`a35a0bb` — 5 linhas em `dividas.ts`; `82aa127` — nota do MIGRATE.md reescrita para o padrão correto), auditor: **APROVADO sem achados** (build/lint reexecutados com exit 0; semântica omitir==NULL conferida na migration; linha a linha contra o chamador real, sem comportamento novo). O trap deixa de existir: regenerações futuras são plug-and-play.
- Pendente de validação manual do dono: checklist da seção 5 do plano (lançamentos no financeiro comparando gravação com antes — `jogador_id` NULL, `NULLIF` de descrição/referência, data default).

## 4. Observações operacionais

- Os commits da Fase 1 chegaram a `origin/main` via push do próprio dono — nenhum agente fez push.
- Working tree deixado com: ruído de line-ending (autocrlf) em `database.types.ts` (diff de conteúdo vazio) — intocado de propósito.

## 5. Pendente de validação humana (dono)

- [ ] Dashboard → Storage: bucket `clipes` listado como **público**.
- [ ] Upload de arquivo de teste pelo dashboard → abre pela URL pública `/storage/v1/object/public/clipes/...` em browser anônimo; remover o arquivo depois.
- [ ] Upload com anon key via SDK falha (sem policy de escrita) — evidência CLI já coletada.
- [ ] Checklist da seção 5 de `docs/plano-ajuste-tipos-rpc.md` (lançamentos do financeiro no app).
- [ ] `git log` da fase com os 3 commits + 2 do desdobramento (revertíveis isoladamente).
