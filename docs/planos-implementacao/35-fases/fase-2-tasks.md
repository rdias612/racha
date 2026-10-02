# Fase 2 · Segredos + Action: workflow base com partida alvo e ledger — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md`, seção 3 — Fase 2) · requisito fechado (`docs/requisito-clipes-filmaeu.md`)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicáveis a esta fase: **P3** (RPC SECURITY DEFINER dedicada de leitura do Vault, só `service_role`), **P8** (cron sexta 09:00 BRT = 12:00 UTC), **P10** (ledger da feature é `clipes_importacoes`).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). Interface do banco = **exatamente a definida na Fase 1** (`fase-1-tasks.md`).

## 1. Objetivo da fase

Criar o **primeiro workflow do repo** (`.github/` não existe — confirmado em 02/10/2026): cron semanal sexta 12:00 UTC + `workflow_dispatch` com inputs (`data`, `horario`, `partida_id`), executando um script Node que (a) lê as credenciais do Filma Eu do Vault via **RPC SECURITY DEFINER dedicada** (P3), (b) localiza a partida alvo (`partida_id` do input ou por `data_jogo` do dia), (c) grava/atualiza a linha em `clipes_importacoes` (status `iniciado` → `concluido`), com idempotência de reexecução. Inclui a migration da RPC do Vault e o passo **documental/cadência manual** dos secrets (Vault + GitHub Secrets). **Não baixa nada** (Playwright é Fase 3).

## 2. Estado atual (evidências verificadas em 02/10/2026)

- **`.github/` não existe no repo** (listagem da raiz confirmada) — será o primeiro workflow; sem CI atual, o workflow entra direto na branch padrão.
- **`scripts/` não existe** no repo — diretório novo.
- **`partidas` não tem coluna de quadra/local**: `supabase/migrations/004_create_partidas.sql:11-17` tem só `id, data_jogo, status, voting_closes_at, criado_por, created_at`. "Society Gragoatá" é implícito (o app inteiro é o racha; ver divergência 9.1). Filtro de alvo possível: `data_jogo` + `status` (`004:12-14`).
- **Padrão de leitura do Vault**: `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ...` dentro de RPC SECURITY DEFINER — `supabase/migrations/099_cron_http_response_logging.sql:242-245` (e `288`, `406`, `469`, `552`).
- **Padrão de RPC SECURITY DEFINER com `search_path` fixado**: `SET search_path = public, extensions` em `018_fix_rpc_search_path.sql:19,36,53` — o projeto corrige search_path explicitamente em RPCs DEFINER.
- **Padrão de revogação para "só service_role"**: `077_configuracoes_notificacoes.sql:51-52` (`REVOKE ALL ... FROM anon, authenticated` + `GRANT ... TO service_role`); grants de EXECUTE explícitos em `099:582-587`.
- **Interface da Fase 1** (a consumir tal como escrita, `fase-1-tasks.md:65-95`): `clipes_importacoes` com `partida_id bigint NULL REFERENCES partidas ON DELETE SET NULL`, `data_referencia date NOT NULL`, `origem CHECK ('automatico','manual')`, `status CHECK ('iniciado','concluido','sem_clipes','falha','limpeza')`, `sucesso`, `quantidade_clipes`, `bytes_total`, `detalhe`, `erro`, `criado_em`, `atualizado_em`; grants: `REVOKE ALL ... FROM anon, authenticated` + `GRANT SELECT, INSERT, UPDATE ... TO service_role` + sequences.
- **supabase-js já é dependência do repo**: `package.json:16` (`@supabase/supabase-js": "^2.112.2"`); client padrão em `src/lib/supabase.ts:1-14` (`createClient`, `persistSession: false`).
- **BRT = UTC-3 fixo, sem horário de verão**: convenção registrada em `060_cron_agendar_partida_semanal.sql:7` ("BRT = UTC-3 fixo => 10:00 BRT == 13:00 UTC").
- **Fuso do cron é UTC**: o pg_cron do projeto agenda em UTC (`060:8`); o cron do GitHub Actions também roda em UTC.
- Migrations aplicadas via `npx supabase db push` (`docs/MIGRATE.md:13`); projeto linkado `jtavmrlllyctkuxefhpc` (`docs/MIGRATE.md:7`).
- `.gitignore` cobre `node_modules` (raiz e qualquer subdiretório) — o `package-lock.json` do diretório da Action DEVE ser commitado.
- Extensão Vault já em uso no projeto (`vault.decrypted_secrets` em `099`), então `vault.create_secret` está disponível no banco.

## 3. Pré-condições

- **Fase 1 aplicada**: migrations de `clipes`/`clipes_importacoes` + bucket aplicadas (`npx supabase db push`), `database.types.ts` regenerado. Sem o ledger, esta fase não tem onde gravar.
- Supabase CLI logado/projeto linkado (`docs/MIGRATE.md:5-7`).
- **Numeração de migrations conferida**: esta fase usa **111** (Fase 1 usa 109/110). Se a divergência da Fase 1 (colisão da 109 com `docs/plano-escolha-times-realtime.md:560`) se confirmar e deslocar as migrations da Fase 1, deslocar esta para a próxima livre — renomear só o arquivo, nada de conteúdo.
- Decisões fechadas aplicáveis: P3, P8, P10.
- **Acesso de admin ao GitHub do repo** (para cadastrar Secrets) e **acesso SQL ao Supabase** (SQL Editor, para criar o secret no Vault) — cadência manual, ver Task 4.

## 4. Tasks (1 passo = 1 commit)

### Task 1 — Migration 111: RPC `obter_segredo_vault` (SECURITY DEFINER, só `service_role`)

**Arquivos a criar**: `supabase/migrations/111_rpc_obter_segredo_vault.sql`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (SQL completo)**:

```sql
-- 111_rpc_obter_segredo_vault.sql
-- P3 (breakdown §5): a Action consome segredos do Vault via PostgREST, porque
-- vault.decrypted_secrets não é exposto ao PostgREST. Uma única RPC dedicada
-- (SECURITY DEFINER, padrão de leitura do Vault de 099:242-245) atende o Filma Eu
-- (Fase 3) e o PAT do GitHub (Fase 6) sem expor o schema vault.
-- Executável EXCLUSIVAMENTE pela service_role (padrão de revogação de 077:51-52;
-- a Action roda com a service key — 037_push_function_permissions.sql já concede
-- os acessos de tabela que ela precisa; o EXECUTE dela é concedido aqui).

CREATE OR REPLACE FUNCTION obter_segredo_vault(p_nome text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault   -- padrão 018 (search_path fixado em RPC DEFINER)
AS $$
DECLARE
  v_valor text;
BEGIN
  SELECT decrypted_secret INTO v_valor
    FROM vault.decrypted_secrets
    WHERE name = p_nome
    LIMIT 1;

  -- Nulo se o secret não existir: o chamador valida e registra no ledger
  -- (a Action NUNCA loga o valor retornado — RNF02).
  RETURN v_valor;
END;
$$;

-- Execução restrita à service_role (nenhum client chama):
REVOKE ALL ON FUNCTION obter_segredo_vault(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION obter_segredo_vault(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION obter_segredo_vault(text) TO service_role;
```

**Decisões embutidas**:
- **Genérica por nome (`p_nome`), não uma RPC por segredo**: uma função só serve `filmaeu_credenciais` (Fase 3) e `github_pat_clipes` (Fase 6) sem nova migration. Quem tem a service key já lê todas as tabelas do `public` — o limite de confiança do projeto é a service role; a RPC apenas dá acesso ao `vault` pelo mesmo canal, e o `REVOKE ... FROM PUBLIC/anon/authenticated` impede qualquer outro caminho.
- `STABLE` + `SET search_path` seguem o padrão das RPCs do repo (`018:19,36,53`).
- O segredo em si entra **por cadência manual** (Task 4), nunca em migration (RNF02 — nada de credencial versionada; precedentes: `push_cron_secret` citado como "não versionado" em `037:3`).

**Validação da task**:
1. `npx supabase db push` — aplica sem erro (`docs/MIGRATE.md:13`).
2. Com a **anon key** (valores de `.env.example`/`.env`):
   `curl -s "$VITE_SUPABASE_URL/rest/v1/rpc/obter_segredo_vault" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"p_nome":"teste"}'`
   → **erro de permissão** (EXECUTE negado), nunca um valor.
3. Com a **service_role key** (pegar do dashboard na hora; **não colar em arquivo nem no histórico compartilhado**):
   `curl -s "$SUPABASE_URL/rest/v1/rpc/obter_segredo_vault" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{"p_nome":"teste_inexistente"}'`
   → **200 com `null`** (função executável; segredo inexistente retorna nulo).
4. Opcional (prova de leitura, sem imprimir o valor): criar secret de teste no SQL Editor (`SELECT vault.create_secret('prova', 'teste_rpc_109');`), chamar a RPC com service_role e conferir **apenas o comprimento** (`| length > 0` via `jq`), depois `SELECT vault.delete_secret('teste_rpc_109', true);`.

**Divergências/observações**: nenhum conflito com a Fase 1 — a RPC é nova (nenhum precedente de leitura de Vault via RPC existe; até hoje o Vault só era lido dentro de outras RPCs, `099:242-245`).

### Task 2 — Diretório da Action: `scripts/clipes/` com `package.json` próprio (reusa supabase-js)

**Arquivos a criar**: `scripts/clipes/package.json`, `scripts/clipes/package-lock.json` (gerado), `scripts/clipes/.gitignore` (só `node_modules/`, por clareza local).
**Arquivos a tocar**: nenhum no `package.json` raiz.

**Conteúdo esboçado**:

`scripts/clipes/package.json`:
```json
{
  "name": "clipes-action",
  "private": true,
  "type": "module",
  "dependencies": {
    "@supabase/supabase-js": "^2.112.2"
  }
}
```

Instalar e commitar o lockfile:
```
npm install --prefix scripts/clipes
```

**Decisão: onde o script vive e qual linguagem (pedida pela fase)**:
1. **Diretório próprio `scripts/clipes/` com `package.json` isolado** (opção "diretório próprio da Action" do breakdown), não `scripts/` da raiz reaproveitando o `node_modules` raiz. Justificativa: isola as dependências da Action do `package.json` do PWA (RNF01/AGENTS — nenhuma lib nova no frontend) e já prepara o terreno para o Playwright da Fase 3, que entra como dependência deste diretório sem tocar o app.
2. **Node 20+ (ESM `.mjs`), sem TypeScript e sem build na Action** — o runner do GitHub (`ubuntu-latest`) executa direto; supabase-js é **reusado como dependência do diretório** na mesma versão do repo (`package.json:16`, `^2.112.2`) — sem lib nova, sem duplicar versão. O `npm ci --prefix scripts/clipes` do workflow garante instalação reprodutível pelo lockfile commitado.

**Validação da task**:
1. `npm ci --prefix scripts/clipes` — instala sem erro a partir do lockfile.
2. `npm run build` (raiz) e `npm run lint` — passam, provando que o PWA não foi tocado.
3. `git status` — `scripts/clipes/package.json`, `package-lock.json` e `.gitignore` stageados; `node_modules` **não** (coberto pelo `.gitignore` raiz, seção `node_modules`).

**Divergências/observações**: primeira vez que o repo tem um `package.json` aninhado; nenhuma ferramenta do repo (Vite/tsc/eslint, escopos de `package.json:5-14`) enxerga o diretório, então não há impacto no build.

### Task 3 — Script `scripts/clipes/importar-clipes.mjs` (workflow base: alvo + ledger, sem download)

**Arquivos a criar**: `scripts/clipes/importar-clipes.mjs`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (estrutura com assinaturas e lógica crítica)**:

```js
// Workflow base da Action Clipes do Filma Eu (Fase 2 do breakdown SDD 35).
// Lê env, resolve a partida alvo, valida o segredo do Filma Eu no Vault e
// grava a execução no ledger clipes_importacoes. O download (Playwright) é a
// Fase 3; limpeza é a Fase 4; push é a Fase 5 — pontos de extensão marcados.
// RNF02: valores de segredo NUNCA vão para console/log — só existência.

// ---------- configuração ----------
function resolverConfig() {
  // Lê e valida: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (obrigatórios),
  // INPUT_DATA, INPUT_HORARIO (default '19:00'), INPUT_PARTIDA_ID,
  // GITHUB_EVENT_NAME ('schedule' | 'workflow_dispatch').
  // Falta de SUPABASE_URL/KEY => throw (run falha — má configuração de infra).
}

// ---------- client ----------
function criarClienteSupabase() {
  // createClient(url, serviceKey, { auth: { persistSession: false } })
  // Sem generic <Database>: o script é isolado do PWA e não importa
  // src/lib/database.types.ts (padrão de opções de src/lib/supabase.ts:11-14).
}

// ---------- datas (BRT = UTC-3 fixo, padrão 060:7) ----------
function resolverDataAlvo(dataInput) {
  // dataInput ('AAAA-MM-DD') se veio do input; senão a última quinta-feira
  // ANTERIOR ao dia corrente em America/Sao_Paulo (no cron de sexta = ontem).
  // Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }) pega a
  // data local; caminhar dia a dia até getDay() === 4 (quinta), estritamente
  // antes de hoje. Retorna 'AAAA-MM-DD'.
}

function calcularFaixaDataBRT(dataISO) {
  // [início, fim) do dia em timestamptz, montado com offset fixo -03:00
  // (sem DST): `${dataISO}T00:00:00-03:00` até dia seguinte. Parâmetro do
  // filtro gte/lt em partidas.data_jogo.
}

// ---------- partida alvo ----------
async function buscarPartidaAlvo(client, { partidaId, dataAlvo }) {
  // partidaId (input, tem precedência — caminho de reimportação/histórico):
  //   .from('partidas').select('id, data_jogo, status').eq('id', partidaId).maybeSingle()
  //   => null = partida inexistente (erro registrado, run "verde com falha lógica").
  // dataAlvo (caminho do cron e do input 'data'):
  //   .from('partidas').select('id, data_jogo, status')
  //     .gte('data_jogo', inicio).lt('data_jogo', fim)
  //     .in('status', ['published', 'closed'])   // P7, coerente com o requisito
  //     .order('data_jogo').limit(1).maybeSingle()
  // ("Society Gragoatá" é implícito — o app não tem coluna de quadra, 004:11-17.)
  // Retorna { partida: {id, data_jogo} | null }.
}

// ---------- ledger (interface exata da Fase 1) ----------
async function abrirRegistroImportacao(client, { partidaId, dataReferencia, origem }) {
  // Idempotência do critério de conclusão "reexecução não duplica registro
  // ativo": procurar registro com a mesma (data_referencia, partida_id) e
  // status IN ('iniciado','concluido','sem_clipes') — "ativo".
  //   .from('clipes_importacoes')
  //     .select('id').eq('data_referencia', dataReferencia)
  //     .eq('partida_id', partidaId)            // ou .is('partida_id', null)
  //     .in('status', ['iniciado','concluido','sem_clipes'])
  //     .maybeSingle()
  // Achou => UPDATE: status 'iniciado', atualizado_em now(), detalhe da run.
  // Não achou => INSERT (partida_id pode ser null; 'falha' anteriores NÃO
  // bloqueiam — histórico de tentativas é preservado).
  // origem: 'automatico' (schedule) | 'manual' (workflow_dispatch), via
  // GITHUB_EVENT_NAME. Retorna o id do registro.
}

async function validarSegredoFilmaEu(client) {
  // await client.rpc('obter_segredo_vault', { p_nome: 'filmaeu_credenciais' })
  // Válido só para provar o caminho P3 nesta fase: valor null/vazio =>
  // throw 'Secret filmaeu_credenciais não configurado no vault' (run falha).
  // O VALOR não é usado nem logado aqui (download é Fase 3 — ponto de extensão).
}

async function fecharRegistroImportacao(client, registroId, { status, sucesso, quantidadeClipes, detalhe, erro }) {
  // UPDATE em clipes_importacoes: status ('concluido' | 'sem_clipes' | 'falha'),
  // sucesso, quantidade_clipes (0 nesta fase), detalhe
  // ('Workflow base — download implementado na Fase 3'), erro, atualizado_em.
}

async function registrarFalhaSemPartida(client, { dataReferencia, origem, erro }) {
  // Partida não encontrada: INSERT com partida_id null, status 'falha',
  // sucesso false, erro. Exit 0 depois (condição esperada, não infra).
}

// ---------- orquestração ----------
async function main() {
  // 1. config + client
  // 2. dataAlvo = resolverDataAlvo(INPUT_DATA); origem = por GITHUB_EVENT_NAME
  // 3. alvo = buscarPartidaAlvo(...)  — INPUT_PARTIDA_ID tem precedência
  // 4. registroId = abrirRegistroImportacao(...)  // status 'iniciado'
  // 5. validarSegredoFilmaEu(client)              // caminho P3 provado aqui
  //    --- Fase 3: login Filma Eu + download + upload + INSERT em `clipes`
  //    --- Fase 4: limpeza por retenção | Fase 5: push de resultado
  // 6. fecharRegistroImportacao(status 'concluido', sucesso true, qtd 0,
  //    detalhe 'Workflow base — download implementado na Fase 3')
  // Erros: fecharRegistroImportacao(status 'falha', erro.message) e
  // process.exit(1). Partida não encontrada: registrarFalhaSemPartida +
  // process.exit(0) (run verde com linha 'falha' no ledger).
}

main();
```

**Decisões embutidas**:
- **Sem `database.types.ts` no script**: o diretório é isolado do PWA; queries tipadas ficam para as libs das Fases 7–8. Os campos usados aqui (`partidas.id/data_jogo/status` e as colunas do ledger) já são fixos na interface da Fase 1.
- **Sem playwright/supabase storage upload nesta fase**: nenhum passo toca o bucket — Fase 2 só prova alvo + segredo + ledger (escopo fechado do breakdown).
- **`horario` do input é validado (`HH:MM`) e carregado, mas não usado**: o slot só entra na navegação do Filma Eu (Fase 3). O input já existe agora para o contrato do workflow não mudar.
- **`exit 0` em "partida não encontrada"**: condição esperada (ex.: quinta sem jogo / data histórica sem partida), registrada como `falha` no ledger — infraestrutura ok. Falha de configuração (env ausente, secret ausente, erro de rede/PostgREST) → `exit 1`.

**Validação da task**:
1. `node --check scripts/clipes/importar-clipes.mjs` — sintaxe ok (validação local real acontece via `workflow_dispatch` na Task 5 / validação da fase).
2. Revisão do diff: **nenhum `console.log` recebe valor de segredo** (grep por `obter_segredo` no arquivo — o valor só é testado com `if (!valor)`).

**Divergências/observações**: o breakdown pede "busca a partida por `data_jogo` + Society Gragoatá" — como `partidas` não tem coluna de quadra (divergência 9.1), o filtro real é `data_jogo` + `status` (P7); a quadra é parâmetro fixo só no site do Filma Eu (Fase 3).

### Task 4 — Cadência manual de secrets (Vault + GitHub Secrets) documentada

**Arquivos a criar**: `docs/configuracao-clipes-action.md`.
**Arquivos a tocar**: nenhum código.

**Conteúdo esboçado do documento**:

```markdown
# Configuração de secrets — Action Clipes do Filma Eu

> Cadência manual (RNF02): nenhum segredo vive no repo, em migration ou em log.
> Este documento lista O QUE cada segredo contém, ONDE é criado e a regra de
> log. Consumo: `scripts/clipes/importar-clipes.mjs` + `.github/workflows/clipes-filmaeu.yml`.

## 1. Supabase Vault (SQL Editor, como postgres)

| Nome | Conteúdo | Criado com | Consumidor |
| --- | --- | --- | --- |
| `filmaeu_credenciais` | JSON `{"usuario":"<login do dono no filmaeu.com.br>","senha":"<senha>"}` (D7: conta única) | `SELECT vault.create_secret('<json>', 'filmaeu_credenciais');` | Action Fase 3 via RPC `obter_segredo_vault` (migration 111) |
| `github_pat_clipes` | Fine-grained PAT do GitHub: só este repo, permissão mínima `actions:write` | Mesmo `vault.create_secret` | RPC `disparar_importacao_clipes` da Fase 6 (registrar já; não é lida nesta fase) |

- Rotação: recriar/atualizar com `vault.update_secret` (ou novo `create_secret`
  com o mesmo name); nada muda no repo.
- A RPC de leitura é executável só pela `service_role` (migration 111).

## 2. GitHub Secrets (repo → Settings → Secrets and variables → Actions)

| Nome | Conteúdo |
| --- | --- |
| `SUPABASE_URL` | `https://jtavmrlllyctkuxefhpc.supabase.co` (Project URL, dashboard Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (dashboard Supabase → Settings → API). **Chave de admin total do banco** — nunca em código, `.env` commitado ou log |

## 3. Regra de log (RNF02 — crítica)

- Os dois secrets do GitHub são mascarados automaticamente nos logs das runs;
  isso NÃO dispensa a regra: **nunca** `echo`/`print`/interpolar segredo em
  `run:`, nunca logar o retorno de `obter_segredo_vault` — o script só testa
  existência (`if (!valor)`).
- No terminal local, os mesmos cuidados: sem colar a service key em arquivos,
  issues ou conversas.
```

**Execução da cadência (pelo executor/dono, parte da task)**: criar `filmaeu_credenciais` no Vault (valores com o dono — conta D7), `github_pat_clipes` (PAT fine-grained só `actions:write`), e os 2 secrets no GitHub. **Sem commit de valores.**

**Validação da task**:
1. `docs/configuracao-clipes-action.md` existe e não contém **nenhum valor real** de credencial (revisar diff).
2. SQL Editor: `SELECT name FROM vault.decrypted_secrets;` lista `filmaeu_credenciais` (e o PAT, se já registrado).
3. Repo → Settings → Secrets: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` listados.

**Divergências/observações**: o breakdown manda documentar a cadência "no passo" (não especifica arquivo); doc próprio em `docs/` segue o hábito do repo (`docs/MIGRATE.md`) e é o lugar que a Fase 6 vai referenciar para o PAT.

### Task 5 — Workflow `.github/workflows/clipes-filmaeu.yml` (cron P8 + dispatch com inputs)

**Arquivos a criar**: `.github/workflows/clipes-filmaeu.yml`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (YAML completo)**:

```yaml
# Clipes do Filma Eu — workflow base (Fase 2 do breakdown SDD 35).
# Cron: sexta 09:00 BRT = 12:00 UTC (P8; BRT = UTC-3 fixo, padrão 060:7).
# OBSERVAÇÃO P8: default escolhido sem resposta do dono — revisar a hora quando
# os clipes de quinta aparecem no site do Filma Eu (ajuste de 1 linha aqui).
name: Clipes Filma Eu

on:
  schedule:
    - cron: '0 12 * * 5'   # sexta 12:00 UTC = 09:00 BRT (RF01, P8)
  workflow_dispatch:
    inputs:
      data:
        description: 'Data da partida (AAAA-MM-DD, fuso BRT). Vazio = última quinta-feira.'
        required: false
        default: ''
      horario:
        description: 'Horário do slot no Filma Eu (usado na Fase 3)'
        required: false
        default: '19:00'
      partida_id:
        description: 'ID da partida no Supabase (opcional; tem precedência sobre data)'
        required: false
        default: ''

permissions:
  contents: read   # mínimo; o workflow não escreve no repo

concurrency:
  group: clipes-filmaeu
  cancel-in-progress: false   # duas runs não disputam o ledger

jobs:
  importar:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Instalar dependências da Action
        run: npm ci --prefix scripts/clipes

      - name: Importar clipes (workflow base)
        run: node scripts/clipes/importar-clipes.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          # Secrets passam SOMENTE via env (RNF02) — nunca interpolados em run:
          INPUT_DATA: ${{ inputs.data }}
          INPUT_HORARIO: ${{ inputs.horario }}
          INPUT_PARTIDA_ID: ${{ inputs.partida_id }}
```

**Decisões embutidas**:
- `permissions: contents: read` + `concurrency` são o mínimo de higiene para o primeiro workflow do repo (sem GITHUB_TOKEN escrito, sem runs paralelas).
- Sem cache de `node_modules` no primeiro momento (instalação do único dep é segundos); adicionar `actions/setup-node` com `cache: npm` quando a Fase 3 trouxer Playwright, se valer a pena (YAGNI).
- O step de execução imprime só o output do script (status do ledger) — nenhum valor de segredo passa por `run:`.

**Validação da task (a validação real da fase)**:
1. Push na branch padrão → aba Actions lista o workflow "Clipes Filma Eu".
2. **Execução manual**: "Run workflow" com `data` = data de uma partida real recente publicada/fechada (ex.: a última quinta com jogo), `horario` vazio (default 19:00), `partida_id` vazio → run **verde**.
3. Ledger: com a service_role key,
   `curl -s "$SUPABASE_URL/rest/v1/clipes_importacoes?select=id,partida_id,data_referencia,origem,status,sucesso,quantidade_clipes,detalhe&order=id.desc&limit=3" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`
   → linha com `data_referencia` do input, `origem: manual`, `status: concluido`, `sucesso: true`, `quantidade_clipes: 0`, `detalhe` coerente.
4. **Idempotência**: disparar de novo com o MESMO `data` → run verde; consulta do passo 3 mostra **uma** linha ativa (`iniciado`/`concluido`) para a data, atualizada (`atualizado_em`), não duas.
5. Segunda execução com `partida_id` preenchido (mesma partida) → mesma linha reusada, sem duplicata.
6. Log da run: sem nenhum valor de segredo (buscar no log por trechos da service key, se quiser prova extra — o mascaramento do GitHub + ausência de echo cobrem).

**Divergências/observações**:
- `schedule` do GitHub roda só na branch padrão e pode atrasar alguns minutos (limitação da plataforma) — irrelevante para uma janela semanal de sexta de manhã; registrado em riscos.
- Se `data` apontar para um dia sem partida, a run fica **verde** com linha `falha` no ledger (decisão da Task 3) — o dono confere pelo painel (Fase 6/8), não pelo status da run.

## 5. Validação manual da fase (checklist para o dono)

- [ ] Migration 111 aplicada (`npx supabase db push` sem erro).
- [ ] RPC `obter_segredo_vault` com anon key → permissão negada; com service_role → 200 (nulo para nome inexistente).
- [ ] Run manual (`workflow_dispatch`) com data de partida real → **verde**.
- [ ] `clipes_importacoes` tem a linha: `origem: manual`, `status: concluido`, `sucesso: true`, `quantidade_clipes: 0`, `data_referencia` = data do input.
- [ ] Run do cron simulada: disparo sem `data` nem `partida_id` → alvo = última quinta; `origem` vira `automatico` quando disparado por schedule (o `origem: automatico` real só é observável na primeira sexta após o merge — conferir então).
- [ ] Reexecução com a mesma data → **uma** linha ativa só (sem duplicata).
- [ ] Log da run **sem nenhum segredo** (Filma Eu, service key, PAT).
- [ ] `npm run build` e `npm run lint` passam (PWA intocado).
- [ ] `git log` da fase com 5 commits (Tasks 1–5), cada um revertível isoladamente.

## 6. Fora de escopo da fase

- Playwright/login/download/upload no Storage/INSERT em `clipes` (Fase 3).
- Limpeza por retenção e var de limite (Fase 4, P11).
- Push de resultado/aviso de falha (Fase 5).
- RPC de disparo manual pelo app e RPCs de consulta do ledger com `is_admin` (Fase 6 — o PAT até se registra aqui, mas não é lido).
- Qualquer arquivo em `src/` (não há mudança de `database.types.ts`: a RPC nova só é chamada pela Action, nunca pelo frontend; se a Fase 6 quiser consumi-la pelo app, regenera lá).
- Deploy de Edge Functions (nenhuma tocada).

## 7. Riscos e rollback

- **Cada task é 1 commit, revertível por `git revert` isolado** (AGENTS.md).
- **Risco principal (breakdown): segredo em log do runner**. Mitigado em três camadas: (a) secrets só via `env:` no YAML, nunca interpolados em `run:`; (b) script nunca imprime o retorno da RPC (só teste de existência); (c) mascaramento nativo do GitHub para os secrets cadastrados. Validação: item específico no checklist da fase.
- **Cron da plataforma**: `schedule` do GitHub pode atrasar ou ser suprimido em picos de carga — para importação semanal de sexta de manhã, tolerável; o reprocesso é o `workflow_dispatch` (RF03, na Fase 6 pelo app; hoje, manual na aba Actions).
- **Hora do cron (P8)**: default escolhido sem resposta do dono; se os clipes de quinta só aparecerem mais tarde no site, ajuste de 1 linha no YAML (revertível).
- **Rollback da migration 111**: `DROP FUNCTION IF EXISTS obter_segredo_vault(text);` em migration corretiva (o repo não usa down migrations — mesmo padrão da seção 8 da Fase 1). Nenhum dado novo é criado por ela.
- **Rollback do workflow**: `git revert` do commit da Task 5 remove o workflow; runs em curso concluem, ledger mantém histórico (append-only — não se apaga linha de ledger em rollback).
- **Erro no ledger pela Action** (ex.: status errado): correção manual por SQL com service_role ou nova run com `partida_id` (o UPDATE de reexecução corrige a linha ativa).

## 8. Divergências e observações (vs Fase 1 e código)

1. **`partidas` não tem coluna de quadra** (`004:11-17`): o "Society Gragoatá" do breakdown é implícito — o app inteiro é o racha do Gragoatá. O filtro real da partida alvo é `data_jogo` (faixa do dia BRT) + `status IN ('published','closed')` (P7). A quadra só vira parâmetro de navegação no Filma Eu (Fase 3). Nenhuma mudança na Fase 1 é necessária.
2. **Numeração 111**: Fase 1 usa 109/110 com ressalva de colisão (`docs/plano-escolha-times-realtime.md:560` reserva a 109). Esta fase acompanha o deslocamento se houver (ver pré-condições). Fase 1 fala em "108 arquivos" em migrations; na verdade são **107 arquivos** (não existe `017`) — a próxima numeração livre (109) continua correta; sem impacto.
3. **Interface da Fase 1 consumida sem alterações**: `clipes_importacoes` (DDL `fase-1-tasks.md:65-83`, grants `:86-95`) já tem tudo que o script precisa (`origem` com `manual/automatico`, `status` com `iniciado/concluido/falha`, `partida_id` nulável com `ON DELETE SET NULL`, grants de INSERT/UPDATE para `service_role` + sequences). **Nenhuma incompatibilidade encontrada.**
4. **Reuso do supabase-js no workflow: sim, mas via `package.json` próprio do diretório da Action** (`scripts/clipes/`, mesma versão `^2.112.2` do repo, `package.json:16`), não via `node_modules` raiz — isola a Action do PWA (RNF01) e acomoda o Playwright da Fase 3 sem retrabalho (decisão justificada na Task 2).
5. **RPC de Vault é genérica por nome** (`obter_segredo_vault(p_nome)`), não uma função por segredo — P3 pede "RPC dedicada executável só pela service_role"; uma função parametrizada com REVOKE explícito cumpre isso e evita segunda migration na Fase 6 para o PAT. O acesso continua inacessível a `anon`/`authenticated` (validação da Task 1).
6. **`exit 0` para "partida não encontrada"** (ledger `falha`, run verde) é decisão desta fase — o breakdown não define o comportamento; alternativa (run vermelha) poluiria o GitHub Actions de vermelho para condição esperada.
7. **Sem regeneração de `database.types.ts` nesta fase**: a RPC nova não é consumida pelo frontend em nenhum ponto do plano (Fase 6 chama as RPCs de disparo/consulta próprias dela); regenerar aqui seria diff grande sem consumidor. Se a revisão da Fase 6 decidir consumir `obter_segredo_vault` pelo app (não recomendado — é caminho de Action), regenera lá.
8. **`horario` (input, default 19:00) e a var de limite de retenção (P11) ainda não têm consumidor** — o primeiro é contrato do dispatch já fechado nesta fase (Fase 3 usa), o segundo entra na Fase 4 como var do workflow (não cadastrada agora para não criar var órfã).

## 9. Critérios de encerramento (do breakdown, refinados)

1. **Run manual verde**: `workflow_dispatch` com data real conclui sem erro.
2. **Linha no ledger com origem coerente**: `clipes_importacoes` registra `origem` (`manual` no dispatch / `automatico` no cron) e `status` coerente (`concluido` com `quantidade_clipes: 0`, ou `falha` documentada).
3. **Reexecução não duplica registro ativo**: mesma `data`/`partida_id` reusada via UPDATE (`iniciado`/`concluido`/`sem_clipes`); só `falha` acumula histórico.
4. **Nenhum segredo no log**: nem Filma Eu, nem service key, nem PAT aparecem no log da run nem no diff do repo.
5. Migration 111 aplicada; RPC inacessível a `anon`/`authenticated`; `npm run build`/`npm run lint` passam; 5 commits revertíveis; checklist da seção 5 completo.

## 10. NEEDS_CONTEXT

Nenhum. (P3, P8 e P10 cobrem todas as escolhas estruturais; a única pendência de dono — confirmar o horário dos clipes no site para o cron P8 — está registrada como observação no YAML e em riscos, com ajuste de 1 linha.)
