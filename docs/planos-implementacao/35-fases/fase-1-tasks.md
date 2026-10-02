# Fase 1 · Banco: tabelas, bucket, grants e tipos — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md`, seção 3 — Fase 1) · requisito fechado (`docs/requisito-clipes-filmaeu.md`)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicáveis a esta fase: **P4** (bucket público de leitura), **P5** (bucket por migration), **P12** (`size_bytes` denormalizado em `clipes`).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). Sem RLS no schema public — proteção por grants (`016:3`).

## 1. Objetivo da fase

Criar a fundação de dados da feature Clipes: tabelas `clipes` e `clipes_importacoes` (ledger no padrão `cron_execucoes`), bucket `clipes` no Storage com leitura pública e escrita só service key, grants no padrão canônico do projeto e `src/lib/database.types.ts` regenerado. Nada de Vault, Action, Edge Function ou frontend (Fases 2–8).

## 2. Estado atual (evidências verificadas em 02/10/2026)

- Última migration do repo é `108_username_regra_unica.sql` (108 arquivos em `supabase/migrations/`, git status limpo) → **próxima numeração livre: 109**.
- **Nenhuma migration toca Storage**: grep de `storage.buckets`/`storage.objects` em todas as migrations retorna zero ocorrências (os "buckets" de `043_voting_reminders_buckets_fixos.sql`, `045_voting_reminders_15min.sql` são janelas de horário de push). Bucket é território novo.
- `partidas`: `id bigserial PK`, `data_jogo timestamptz NOT NULL`, `status CHECK IN ('draft','published','closed')` — `supabase/migrations/004_create_partidas.sql:10-18`; índice `idx_partidas_data_jogo` (`004:21`).
- Padrão de grants: schema-wide em `016_grants_baseline.sql:7` (`GRANT USAGE ON SCHEMA public`), SELECT por tabela em `016:10`, sequences em `016:26`; sem RLS nem policies (`016:1-4`).
- Padrão "client não escreve": `077_configuracoes_notificacoes.sql:51-52` (`REVOKE ALL ... FROM anon, authenticated` + `GRANT SELECT ... TO service_role`) e `036_create_push_notifications.sql:34` (REVOKE do ledger de push).
- Padrão de ledger: `cron_execucoes` em `099_cron_http_response_logging.sql:18-29` (bigserial PK, colunas de resultado, índices por job/sucesso) e grants em `099:582-587` (`GRANT SELECT ON TABLE cron_execucoes TO anon, authenticated` — tabela legível pelo client, escrita só pelo backend).
- `partidas` é referenciável por FK com `ON DELETE CASCADE` (precedente `push_reminder_deliveries`, `036:17-25`).
- `src/lib/database.types.ts` é gerado (1330 linhas; `cron_execucoes` em `database.types.ts:11`) e alimenta o client tipado (`src/lib/supabase.ts:1-2,11`).
- Comando de regeneração de types já documentado no repo: `docs/plano-escolha-times-realtime.md:561`.
- Migrations aplicadas via `npx supabase db push` (`docs/MIGRATE.md:13`), projeto linkado (`docs/MIGRATE.md:5-7`).

## 3. Pré-condições

- Nenhuma fase anterior (fase inicial). Depende apenas de: Supabase CLI logado e projeto linkado (`npx supabase login` + `npx supabase link --project-ref jtavmrlllyctkuxefhpc`, `docs/MIGRATE.md:5-7`).
- **O executor NÃO faz deploy manual no dashboard** — aplica tudo com `npx supabase db push` (`docs/MIGRATE.md:13`).
- **Conferir a numeração 109 antes de começar** (ver divergência na seção 9 — o plano `docs/plano-escolha-times-realtime.md:560` também reserva `109`).
- Decisões já fechadas: P4 (público), P5 (migration), P12 (`size_bytes`).

## 4. Tasks (1 passo = 1 commit)

### Task 1 — Migration 109: tabelas `clipes` e `clipes_importacoes` + índices + grants

**Arquivos a criar**: `supabase/migrations/109_clipes_tabelas.sql` (nome conferido livre; ajustar se a divergência da seção 9 se confirmar).
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (DDL completo)**:

```sql
-- 109_clipes_tabelas.sql
-- Fundação da feature Clipes do Filma Eu (docs/requisito-clipes-filmaeu.md §6):
-- 1. Tabela `clipes` (grade de vídeos por partida; denormalizações p/ limpeza RF09 — P12).
-- 2. Tabela `clipes_importacoes` (ledger de execuções — padrão cron_execucoes, 099:18-29).
-- 3. Grants no padrão canônico (016 / 036:34 / 077:51-52 / 099:582-587). SEM RLS.

-- 1. Tabela clipes -------------------------------------------------------
CREATE TABLE IF NOT EXISTS clipes (
  id          bigserial   PRIMARY KEY,
  partida_id  bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  caminho     text        NOT NULL CHECK (char_length(caminho) <= 512),
  data_jogo   timestamptz NOT NULL,           -- denormalizada de partidas.data_jogo (ordenação da limpeza RF09)
  size_bytes  bigint      CHECK (size_bytes IS NULL OR size_bytes >= 0),  -- P12: capturado no upload
  ordem       integer,                        -- ordem/horário do clipe dentro do slot
  criado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clipes_partida_caminho_unicos UNIQUE (partida_id, caminho)
);

CREATE INDEX IF NOT EXISTS idx_clipes_partida
  ON clipes (partida_id, ordem);
CREATE INDEX IF NOT EXISTS idx_clipes_data_jogo
  ON clipes (data_jogo);

-- 2. Ledger de importações ----------------------------------------------
CREATE TABLE IF NOT EXISTS clipes_importacoes (
  id                bigserial   PRIMARY KEY,
  partida_id        bigint      REFERENCES partidas(id) ON DELETE SET NULL,  -- nulo se a partida não for achada
  data_referencia   date        NOT NULL,     -- dia alvo da importação (slot 19:00 Society Gragoatá)
  origem            text        NOT NULL CHECK (origem IN ('automatico','manual')),
  status            text        NOT NULL CHECK (status IN ('iniciado','concluido','sem_clipes','falha','limpeza')),
  sucesso           boolean     NOT NULL DEFAULT false,
  quantidade_clipes integer,
  bytes_total       bigint      CHECK (bytes_total IS NULL OR bytes_total >= 0),
  detalhe           text,
  erro              text,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clipes_importacoes_data
  ON clipes_importacoes (data_referencia DESC, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_clipes_importacoes_status
  ON clipes_importacoes (status, criado_em DESC);

-- 3. Grants (SEM RLS; escrita só service_role) ---------------------------
-- clipes: leitura para o app (jogadores logados/anon); escrita NUNCA pelo client
-- (a Action usa service key; o que existir aqui é inserido só por ela).
GRANT SELECT ON clipes TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE clipes_id_seq TO service_role;

-- clipes_importacoes: painel admin lê via RPC (Fase 6, padrão obter_execucoes_cron 099:172-211);
-- client não lê nem escreve (padrão 077:51-52); Action (service key) insere/atualiza.
REVOKE ALL ON clipes_importacoes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON clipes_importacoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE clipes_importacoes_id_seq TO service_role;
```

**Decisões de DDL embutidas (para revisão)**:
- `caminho` = caminho do objeto dentro do bucket, sem o nome do bucket (ex.: `123/clipe-001.mp4`), o que torna `UNIQUE(partida_id, caminho)` naturalmente idempotente para o `ON CONFLICT ... DO NOTHING` da Fase 3.
- `data_jogo` denormalizada (breakdown Fase 1 + `004:12`) e `size_bytes` (P12) evitam join com `partidas` e listagem do Storage na limpeza da Fase 4.
- `status` já inclui `'limpeza'` (Fase 4 registra entrada de limpeza no ledger — RF09) e `'sem_clipes'` (RF07). Relaxar CHECK no futuro segue o precedente `077:55-63`.
- `partida_id` nulo no ledger com `ON DELETE SET NULL`: preserva histórico de importações órfãs; em `clipes` é `CASCADE` (precedente `036:18`).
- `clipes_importacoes` segue `cron_execucoes` (`099:18-29`) mas legível só por `service_role` (o painel usará RPC com gate `is_admin` na Fase 6), diferença deliberada de `099:582`.
- RPCs de leitura do ledger ficam para a **Fase 6** (escopo explícito do breakdown), não aqui.

**Validação da task**:
1. `npx supabase db push` — aplica sem erro (migrations locais → remoto, `docs/MIGRATE.md:13`).
2. `curl "$VITE_SUPABASE_URL/rest/v1/clipes?select=*&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"` → **200** com `[]`.
3. `curl -X POST .../rest/v1/clipes ... -H "Prefer: return=minimal" -d '{}'` com anon key → **erro de permissão** (42501), sem inserir.
4. `curl .../rest/v1/clipes_importacoes?select=*` com anon key → **erro de permissão** (tabela invisível ao client).

**Divergências/observações**: nenhuma — DDL segue precedentes citados acima.

### Task 2 — Migration 110: bucket `clipes` + policy de leitura pública

**Arquivos a criar**: `supabase/migrations/110_clipes_bucket.sql`.

**Conteúdo esboçado (DDL completo)**:

```sql
-- 110_clipes_bucket.sql
-- Bucket `clipes` no Storage (P5: por migration, versionável; P4: leitura pública — RNF03).
-- Escrita: nenhuma policy de INSERT/UPDATE/DELETE é criada → nenhum role client escreve;
-- a Action usa service key (service_role bypassa RLS em storage.objects).

-- 1. Bucket (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('clipes', 'clipes', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Leitura pública via API do Storage (a URL pública /object/public/ nem depende disto,
--    mas a policy cobre list/download pela API autenticada)
DROP POLICY IF EXISTS "Leitura publica dos clipes" ON storage.objects;
CREATE POLICY "Leitura publica dos clipes"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'clipes');
```

**Decisões embutidas**:
- Sem `file_size_limit` nem `allowed_mime_types` no bucket por ora (NULL) — o teto que importa é o total de 1 GB, controlado pela limpeza da Fase 4 (RF09); restringir MIME agora é especulação sobre o formato que o Filma Eu entrega (YAGNI).
- Escrita só `service_role` é garantida pela **ausência** de policies de escrita (RLS de `storage.objects` é enabled por padrão no Supabase; `service_role` tem `BYPASSRLS`), não por REVOKE.

**Validação da task**:
1. `npx supabase db push` — aplica sem erro.
2. No dashboard do Supabase (validação manual do dono): bucket `clipes` listado como **público**.
3. Upload de um arquivo de teste pelo dashboard e `curl -I "$VITE_SUPABASE_URL/storage/v1/object/public/clipes/<arquivo-teste>"` → **200** (leitura pública funciona); apagar o arquivo de teste depois.
4. Tentativa de upload via SDK com a **anon key** (`supabase.storage.from('clipes').upload(...)`) → **falha com permissão negada** (nenhuma policy de INSERT).

**Divergências/observações**:
- É a primeira migration do repo a escrever em `storage.*`. `npx supabase db push` executa como role `postgres`, que no Supabase tem permissão de criar policies em `storage.objects` (padrão da plataforma). Se o push falhar por permissão (não esperado), **parar e escalar** — fallback seria dashboard (contra P5) e é decisão do dono.
- Risco aceito pelo dono em P4: bucket público significa que as URLs dos vídeos são tecnicamente abertas para quem as tiver (requisito §8 tira o compartilhamento público do escopo do **app**, não da URL — decisão registrada no breakdown §5/P4).

### Task 3 — Regeneração de `src/lib/database.types.ts`

**Arquivos a tocar**: `src/lib/database.types.ts` (só regeneração, sem edição manual).
**Comando exato** (precedente já documentado no repo, `docs/plano-escolha-times-realtime.md:561`; projeto já linkado conforme `docs/MIGRATE.md:7`):

```
npx supabase gen types typescript --project-id jtavmrlllyctkuxefhpc > src/lib/database.types.ts
```

**Momento certo**: DEPOIS das migrations 109 e 110 aplicadas (`db push` das Tasks 1–2), para que o schema remoto já contenha as tabelas novas. Commit próprio (arquivo grande, diff isolado e revisável).

**Validação da task**:
1. `grep -c "clipes" src/lib/database.types.ts` ≥ 1 e presença de `clipes_importacoes` nas `Tables` (as policies de Storage não aparecem no types — normal).
2. Cabeçalho do arquivo intacto (`export type Json = ...`, formato atual em `database.types.ts:1-8`) e sem `cron_execucoes`/objetos antigos sumidos.
3. `npm run build` (tsc -b + vite, `package.json:8`) e `npm run lint` passam — `src/lib/supabase.ts:2,11` consome o `Database` gerado.

**Divergências/observações**:
- Executar o redirecionamento no **Git Bash**, não no PowerShell: o `>` do PowerShell escreve UTF-16 por padrão e pode corromper o diff/arquivo. Se o CLI disponível suportar, preferir flag de output direto a redirecionamento.
- Não adotar o caminho alternativo de tipos hand-written (padrão `ResumoAno`, `src/lib/partidas.ts:585-616`) para as tabelas novas — elas serão consumidas pelas libs das Fases 7–8 via types gerados; hand-written só se algum campo gerado se mostrar impreciso (documentar lá se ocorrer).

## 5. Regeneração de `src/lib/database.types.ts` (lacuna 1 do breakdown)

- **Descoberta**: o comando exato já está documentado no repo em `docs/plano-escolha-times-realtime.md:561` — `npx supabase gen types typescript --project-id jtavmrlllyctkuxefhpc > src/lib/database.types.ts` (não há script em `package.json` nem menção em `docs/MIGRATE.md`; `package.json:6-14` só tem dev/build/lint/format).
- **Passo certo**: Task 3 desta fase, após `db push` das Tasks 1–2, em commit isolado, com `npm run build` como gate.
- **Cuidado de encoding**: rodar no Git Bash (ver observação da Task 3).

## 6. Validação manual da fase (checklist para o dono)

- [ ] `npx supabase db push` aplicou 109 e 110 sem erro.
- [ ] PostgREST: `GET /rest/v1/clipes` com anon key → 200 `[]`.
- [ ] PostgREST: `POST /rest/v1/clipes` com anon key → erro de permissão (escrita bloqueada).
- [ ] PostgREST: `GET /rest/v1/clipes_importacoes` com anon key → erro de permissão (ledger invisível).
- [ ] Dashboard → Storage: bucket `clipes` existe e está marcado como público.
- [ ] Upload de arquivo de teste pelo dashboard → abre pela URL pública (`/storage/v1/object/public/clipes/...`) no browser anônimo; depois remover o arquivo de teste.
- [ ] Upload com anon key via SDK falha (sem policy de escrita).
- [ ] `src/lib/database.types.ts` contém `clipes` e `clipes_importacoes`.
- [ ] `npm run build` e `npm run lint` passam.
- [ ] Nada além das migrations 109/110 + `database.types.ts` foi alterado (`git log` da fase com 3 commits).

## 7. Fora de escopo da fase

- RPC de disparo manual e de leitura do ledger com gate `is_admin` (Fase 6 — breakdown §3/Fase 6).
- Edge Function de push, segredos no Vault, GitHub Secrets (Fases 2 e 5).
- Qualquer arquivo em `src/` além da regeneração de `database.types.ts`.
- Limite de retenção e rotina de limpeza (Fase 4 — vive como var do workflow, P11).
- Backfill/dados de teste persistentes (a Action da Fase 3 populará as tabelas).

## 8. Riscos e rollback

- **Cada task é 1 commit e revertível por `git revert` isolado** (AGENTS.md).
- **Migrations aplicadas no remoto não são desfeitas pelo `git revert`** (`npx supabase db push` não roda down migrations). Para desfazer o banco após um push errado, criar uma migration `NNN_revert_*.sql` (padrão do projeto de migrations "corretivas" em par, ex. `077` → ajustes em `099`):
  ```sql
  DROP POLICY IF EXISTS "Leitura publica dos clipes" ON storage.objects;
  DELETE FROM storage.buckets WHERE id = 'clipes';   -- remove objetos junto
  DROP TABLE IF EXISTS clipes_importacoes;
  DROP TABLE IF EXISTS clipes;
  ```
  (ordem importa: policy e bucket antes das tabelas não é obrigatório — schemas diferentes — mas os DROPs de tabela vêm por último por clareza).
- **Risco principal da fase** (breakdown): erro de grants expondo escrita ao client. Mitigado por: nenhum `GRANT INSERT/UPDATE/DELETE` a `anon/authenticated` nas duas tabelas, nenhuma policy de escrita no bucket, e validação 3/4 da Task 1 + 4 da Task 2. O projeto não usa RLS no `public` (`016:1-4`), então grants são a única barreira — revisar o diff com atenção.
- **Risco secundário**: colisão de numeração 109 (seção 9) — baixo, puramente burocrático.
- **Risco baixo**: bucket público (P4) — decisão fechada do dono, sem revert previsto no requisito.

## 9. Divergências e observações para o executor

1. **Colisão de numeração 109**: `docs/plano-escolha-times-realtime.md:560` reserva a migration `109_draft_times_ao_vivo.sql`, e o próprio doc diz "nada implementado ainda" (`:3`). A última migration real é a `108`. **Ação**: antes de criar a primeira migration desta fase, confirmar qual plano executa primeiro; se o de draft rodar antes, esta fase passa a usar `110`/`111` (renomear arquivos e referências desta tasks-list). Nenhuma mudança de conteúdo.
2. **Primeiro contato do repo com Storage**: não há precedente de bucket/policy em migrations (verificado por grep em todas as 108). O DDL da Task 2 segue a documentação padrão da plataforma, mas se o `db push` falhar em `storage.objects` por permissão do role de migração, escalar ao dono (não contornar via dashboard sem decisão).
3. **`ordem` em `clipes`**: o requisito (§6) pede "horário/ordem" do clipe; a semântica exata (índice no slot vs timestamp do clipe) será fixada na Fase 3, quando o formato do Filma Eu for conhecido. A coluna `integer` anulável não bloqueia.
4. **`clipes` legível por `anon`** (não só `authenticated`): segue o grant de tabela de `016:10` e o fato de o app não usar Supabase Auth para sessão (`src/lib/supabase.ts:12-13`, `persistSession: false`); o gate "jogador logado" é de UI, igual ao resto do app. Se o dono quiser restringir a `authenticated` depois, é 1 linha de grant (reversível).
5. **`'limpeza'` no CHECK de status do ledger** antecipa a Fase 4 (breakdown: "entrada de limpeza no ledger"); relaxar CHECK depois tem precedente direto (`077:55-63`), mas incluí-lo agora evita uma migration só para isso.

## 10. Critérios de encerramento (refinados do breakdown)

1. `npx supabase db push` aplica as migrations da fase sem erro.
2. Tabelas consultáveis via PostgREST com anon key: `clipes` só leitura (SELECT 200; INSERT falha), `clipes_importacoes` inacessível ao client.
3. Bucket `clipes` criado por migration, público para leitura, sem nenhum caminho de escrita pelo client (upload anônimo falha).
4. `src/lib/database.types.ts` regenerado com as tabelas novas; `npm run build` e `npm run lint` passam.
5. Checklist da seção 6 completo; 3 commits (Tasks 1–3), cada um revertível isoladamente.

## 11. NEEDS_CONTEXT

Nenhum. (A colisão da numeração 109 é resolvível pelo executor com a regra da seção 9.1 e não exige decisão nova do orquestrador — P4, P5 e P12 já fechadas cobrem todas as escolhas estruturais desta fase.)
