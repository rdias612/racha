# Fase 4 · Action: limpeza por retenção (RF09) — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md:105-114`, Fase 4) · requisito fechado (`docs/requisito-clipes-filmaeu.md:71`, RF09) · esqueleto (`docs/planos-implementacao/35-clipes-filmaeu.md:34`, passo 6; `:51`, teste de retenção do §5)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicáveis a esta fase: **P11** (limite como var do workflow, default 800 MB, override por input do `workflow_dispatch` — `breakdown.md:193`), **P12** (tamanho por partida via `size_bytes` denormalizado na tabela `clipes`, NÃO por metadados do Storage — `breakdown.md:194`).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). Interfaces do banco, do script e do workflow = **exatamente as definidas nas Fases 1–3** (`fase-1-tasks.md`, `fase-2-tasks.md`, `fase-3-tasks.md`).

## 1. Objetivo da fase

Implementar a rotina pós-importação de limpeza por retenção (RF09): ao final de cada importação **bem-sucedida** (status `concluido` da Fase 3), somar o tamanho por partida a partir de `clipes.size_bytes` (P12 — zero consultas de tamanho ao Storage), e enquanto o total do bucket exceder o limite (P11: var do workflow com default 800 MB, override por input do dispatch — input adicionado ao YAML nesta fase), deletar **a partida mais antiga inteira por `data_jogo`** — objetos do bucket no prefixo `clipes/{partida_id}/`, linhas da tabela `clipes` e entrada de ledger `clipes_importacoes` com status `limpeza` — **nunca** deletando a partida recém-importada. A ordem é pela **data do jogo**, nunca pela data de upload (exemplo do dono em `docs/requisito-clipes-filmaeu.md:71`: clipes de partida de 02/02 importados hoje são deletados antes dos de 02/09 importados ontem). Deleção manual no frontend permanece fora de escopo.

## 2. Estado atual e interfaces vinculantes (evidências verificadas em 02/10/2026)

**O que as fases anteriores já entregam (a consumir tal como escrito):**

- **Fase 1 — tabela `clipes`** (`fase-1-tasks.md:48-62`): `partida_id` FK, `caminho` (= `{partida_id}/{arquivo}`, sem nome do bucket — decisão `fase-1-tasks.md:99`), **`data_jogo` denormalizada** (`:52`, base da ordenação da limpeza), **`size_bytes bigint` anulável** (`:53`, P12), `ordem`. Índice `idx_clipes_data_jogo` (`:61-62`). `UNIQUE(partida_id, caminho)` (`:56`).
- **Fase 1 — grants de `clipes`** (`fase-1-tasks.md:88-89`): `GRANT SELECT ON clipes TO anon, authenticated` + sequence para `service_role`. **Nenhum `DELETE` explícito para `service_role`** — tratado na Task 1 (divergência 8.1).
- **Fase 1 — ledger `clipes_importacoes`** (`fase-1-tasks.md:65-83`): `status CHECK IN ('iniciado','concluido','sem_clipes','falha','limpeza')` (`:70` — **`'limpeza'` já existe no CHECK**, antecipado pela divergência 5 da Fase 1), `origem CHECK IN ('automatico','manual')` (`:69`), `partida_id` nulável com `ON DELETE SET NULL`, `quantidade_clipes`, `bytes_total`, `detalhe`, `erro`. Grants: INSERT/UPDATE/SELECT só `service_role` (`:93-95`).
- **Fase 2 — script orquestrador** `scripts/clipes/importar-clipes.mjs`: `main()` com passos numerados, incluindo os pontos de extensão das fases seguintes marcados entre `validarSegredoFilmaEu`/importação e `fecharRegistroImportacao` (`fase-2-tasks.md:227-240`; marcados de novo em `fase-3-tasks.md:15`); `fecharRegistroImportacao(client, registroId, { status, sucesso, quantidadeClipes, detalhe, erro })` (`fase-2-tasks.md:215-219`); helpers BRT (UTC-3 fixo) já no arquivo (`fase-2-tasks.md:162-175`).
- **Fase 2 — workflow** `.github/workflows/clipes-filmaeu.yml`: cron `0 12 * * 5`, `workflow_dispatch` com inputs `data`/`horario`/`partida_id`, env injetado via `${{ inputs.* }}`/`${{ secrets.* }}` (`fase-2-tasks.md:308-370`). A divergência 8 da Fase 2 já reserva a var de retenção para esta fase (`fase-2-tasks.md:431`: "o segundo entra na Fase 4 como var do workflow — não cadastrada agora para não criar var órfã").
- **Fase 2 — doc de cadência** `docs/configuracao-clipes-action.md` (criado na Task 4 da Fase 2, `fase-2-tasks.md:257-306`) — recebe a seção da variável nesta fase.
- **Fase 3 — módulos**: `scripts/clipes/filmaeu/seletores.mjs`, `scripts/clipes/filmaeu/automacao.mjs` e **`scripts/clipes/armazenamento.mjs`** com `subirClipe` (upload + INSERT `ignoreDuplicates`, P12: `size_bytes` do arquivo em disco — `fase-3-tasks.md:320-335`) e `resumoDaPartida` (`fase-3-tasks.md:337-343`). A integração da Fase 3 no `main()` ocupa o passo 5.5 (`fase-3-tasks.md:394-407`); **o passo 6 (`fecharRegistroImportacao`) ainda está livre — é onde a limpeza entra antes**.
- **Fase 3 — idempotência em 3 camadas** (`fase-3-tasks.md:422`): (a) ledger reusado por UPDATE; (b) download só do que falta; (c) upload `upsert` + INSERT `ignoreDuplicates`. A limpeza **depende** de (c) ser seguro: reexecução após falha da limpeza não rebaixa nada.
- **Padrão de migrations do repo**: numeração sequencial; última real = `108_username_regra_unica.sql` (107 arquivos em `supabase/migrations/`, contagem conferida em 02/10/2026); Fase 1 usa 109/110 e Fase 2 usa 111 → **esta fase usa 112** (com a mesma ressalva de colisão da Fase 1, divergência 8.6).
- **supabase-js v2** (`package.json:16`, `^2.112.2`): `client.storage.from('clipes').list(prefix, { limit })` e `.remove(paths)` disponíveis; DELETE de tabela via `.from('clipes').delete().eq(...)`. Sem lib nova.
- **`.github/` e `scripts/` não existem ainda no repo** (confirmado em 02/10/2026) — as Fases 1–3 são planos pendentes de execução; esta fase parte do estado pós-Fase 3 descrito acima.

## 3. Pré-condições

- **Fases 1–3 aplicadas**: migrations 109–111, `database.types.ts` regenerado, `scripts/clipes/` com Playwright, `importar-clipes.mjs` rodando verde com download/upload real e idempotência (critérios da Fase 3 atendidos — em particular, ao menos **uma partida real com clipes importados**, que servirá de "recém-importada" na validação).
- **Secrets da Fase 2** criados (Vault `filmaeu_credenciais` + GitHub Secrets) e `docs/configuracao-clipes-action.md` existente.
- **Numeração de migrations conferida**: esta fase usa **112** (Fases 1–2 usam 109–111). Se a colisão da 109 (`docs/plano-escolha-times-realtime.md:560`) deslocar as anteriores, deslocar para a próxima livre — renomear só o arquivo, nada de conteúdo.
- Decisões fechadas aplicáveis: P11, P12.
- **Acesso de admin ao GitHub** (para cadastrar a *Variable* `LIMITE_STORAGE_MB`, opcional — Task 4) e ao SQL Editor do Supabase (para semear dados de teste da validação da fase).

## 4. Tasks (1 passo = 1 commit)

### Task 1 — Migration 112: `GRANT DELETE ON clipes TO service_role`

**Arquivos a criar**: `supabase/migrations/112_grant_delete_clipes.sql`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (SQL completo)**:

```sql
-- 112_grant_delete_clipes.sql
-- RF09 (Fase 4): a limpeza deleta linhas de `clipes` com a service key da Action
-- (DELETE via PostgREST, filtro por partida_id). A Fase 1 concedeu só SELECT a
-- anon/authenticated e nada explícito de DML a service_role (fase-1-tasks.md:88-95).
-- Os default privileges da plataforma Supabase normalmente concedem ALL a
-- service_role em tabelas novas, mas o padrão do repo é de grants EXPLÍCITOS
-- (016:7-26; 099:582-587; 077:51-52) — o grant fica escrito aqui para não
-- depender de comportamento de plataforma. GRANT é idempotente.
GRANT DELETE ON clipes TO service_role;
```

**Decisões embutidas**:
- **DELETE direto pelo PostgREST com service key, sem RPC**: a escrita em `clipes` já é exclusiva da service_role (nenhum grant de escrita a clients, Fase 1); a única lacuna era o grant de DELETE, resolvido aqui. Uma RPC SECURITY DEFINER para deletar seria camada sem necessidade (AGENTS: KISS — nada de abstração sem justificativa objetiva). O `service_role` tem `BYPASSRLS` e o schema `public` não usa RLS (`016:1-4`) — grants são a única barreira, e ficam explícitos.
- **Nenhuma migration para o ledger**: o status `'limpeza'` já está no CHECK da Fase 1 (`fase-1-tasks.md:70`), `origem` aceita os valores da run, e `partida_id`/`data_referencia`/`quantidade_clipes`/`bytes_total`/`detalhe` cobrem a entrada de limpeza (verificação pedida pelo orchestrator: **o schema da `clipes_importacoes` comporta a entrada sem ajuste**). Entradas de limpeza são INSERT novos, sem conflito com a idempotência do ledger da Fase 2 (que só reusa linhas `iniciado/concluido/sem_clipes` — `fase-2-tasks.md:199`).
- Rollback (se um dia necessário): `REVOKE DELETE ON clipes FROM service_role;` — mas `git revert` do commit basta como registro; o grant remanescente no banco é inócuo (só amplia para quem já é admin total do banco).

**Validação da task**:
1. `npx supabase db push` — aplica sem erro (`docs/MIGRATE.md:13`).
2. Com a **service_role key** (do dashboard, na hora; nunca em arquivo): semear uma linha de teste no SQL Editor (`INSERT INTO clipes (partida_id, caminho, data_jogo) VALUES (<id_real>, 'teste-grant/nao-existe.mp4', now());`) e deletá-la via PostgREST:
   `curl -s -X DELETE "$SUPABASE_URL/rest/v1/clipes?caminho=eq.teste-grant%2Fnao-existe.mp4" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"` → **204** e linha sumida (SELECT de conferência vazio).
3. Mesmo DELETE com a **anon key** → **erro de permissão** (escrita bloqueada ao client — comportamento da Fase 1 intacto).
4. `npm run build`/`npm run lint` (raiz) — intocados, verde.

**Divergências/observações**: ver 8.1 — o grant faltante é lacuna real da interface da Fase 1 para esta fase, corrigida com 1 linha idempotente (sem alterar comportamento da Fase 1).

### Task 2 — `scripts/clipes/retencao.mjs`: `limparPorRetencao` (soma por partida, loop de deleção, proteção e guarda)

**Arquivos a criar**: `scripts/clipes/retencao.mjs`.
**Arquivos a tocar**: nenhum outro (integração no `main()` é a Task 3).

**Conteúdo esboçado (estrutura com assinaturas e lógica crítica)**:

```js
// Limpeza por retenção (RF09 — Fase 4 do breakdown SDD 35).
// P12: o tamanho por partida vem da TABELA clipes (size_bytes denormalizado) —
// NENHUMA leitura de metadados/tamanho do Storage alimenta a decisão de deletar.
// O Storage é consultado só para LISTAR caminhos na hora de deletar a partida.
// P11: o limite chega pronto em bytes (resolvido no importar-clipes.mjs via
// input > var > default, Task 4); aqui é parâmetro puro — testável sem env.
// Ordem de deleção: data_jogo ASC (a data do JOGO, nunca a do upload — requisito :71).

const MB = 1024 * 1024;

export function resolverLimiteBytes(env = process.env) {
  // env.LIMITE_STORAGE_MB: string vinda do YAML (input > var > '800', Task 4).
  // Vazio/ausente → 800 * MB (P11). Valor não numérico ou <= 0 → throw
  // (má configuração = run falha; o número vem do YAML/var, não é livre).
  // Retorna limiteBytes (number).
}

async function carregarGruposPorPartida(client) {
  // .from('clipes').select('partida_id, data_jogo, caminho, size_bytes')
  //   (sem paginação: a tabela é pequena — dezenas de linhas por partida semanal)
  // Agrega em memória: Map<partida_id, { partidaId, dataJogo, bytes, quantidade, caminhos[] }>
  //   bytes: soma dos size_bytes; size_bytes NULL conta como 0 (coluna é anulável
  //   na Fase 1, :53; a Fase 3 sempre preenche — null só de dado semeado antigo)
  //   com log de aviso por linha nula; caminhos: lista de `caminho` da tabela.
  // PostgREST não faz GROUP BY: agregar no Node é a opção simples — a alternativa
  // (RPC SECURITY DEFINER de agregação) é camada nova sem necessidade (AGENTS/KISS).
}

async function registrarLimpezaNoLedger(client, grupo, { quantidadeLinhas, origem }) {
  // INSERT em clipes_importacoes (interface exata da Fase 1, fase-1-tasks.md:65-83):
  //   partida_id: grupo.partidaId
  //   data_referencia: dia BRT do data_jogo da partida DELETADA
  //     (Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }) — helper
  //     de data no padrão da Fase 2, fase-2-tasks.md:162-175)
  //   origem: a origem da RUN que disparou a limpeza ('automatico'|'manual' —
  //     o CHECK da Fase 1 não tem 'limpeza' em origem; limpeza é STATUS, :70)
  //   status: 'limpeza', sucesso: true
  //   quantidade_clipes: quantidadeLinhas, bytes_total: grupo.bytes (liberados)
  //   detalhe: 'Limpeza por retenção: prefixo clipes/{id}/ removido;
  //             total do bucket após: {X} MB'
}

async function deletarPartida(client, grupo, { origem }) {
  // ORDEM IMPORTA: Storage primeiro, linhas depois, ledger por último.
  // (Se o Storage falha e as linhas fossem primeiro, a partida sairia do radar
  //  da limpeza para sempre e os objetos virariam órfãos permanentes.)
  // 1. Storage por prefixo: client.storage.from('clipes')
  //      .list(String(grupo.partidaId), { limit: 1000, sortBy: null })
  //    paths = união dos nomes listados com grupo.caminhos (a tabela pode ser
  //    menor que o prefixo: objetos órfãos de crash pós-upload, cobertos pela
  //    Fase 3; a listagem os alcança também) — montar '{partidaId}/{nome}'.
  // 2. if (paths.length): remove = await client.storage.from('clipes').remove(paths)
  //    Inspecionar a resposta: item com erro diferente de 'Not Found' → THROW
  //    ANTES de tocar a tabela (partida continua candidata na próxima run);
  //    'Not Found' é tolerado (idempotência de reexecução). Log: '[clipes]
  //    retenção: {n} objetos removidos de clipes/{id}/'.
  // 3. Linhas: .from('clipes').delete().eq('partida_id', grupo.partidaId)
  //    → erro => throw (o Storage já foi; linhas permanecem => próxima run
  //      tenta de novo: list vazio, remove pulado, DELETE reexecutado — seguro).
  // 4. registrarLimpezaNoLedger(...)
  // Retorna { liberadosBytes: grupo.bytes, quantidadeLinhas }.
}

export async function limparPorRetencao(client, { limiteBytes, partidaAtualId, origem }) {
  // 1. if (!Number.isFinite(limiteBytes) || limiteBytes <= 0) throw — guarda.
  // 2. grupos = await carregarGruposPorPartida(client)
  //    total = soma dos bytes de TODOS os grupos (estado do bucket segundo P12)
  //    if (total <= limiteBytes) → return { deletadas: [], totalRestante: total }
  //    (caso mais comum: nada a fazer, zero escritas no ledger)
  // 3. deletadas = []
  //    while (total > limiteBytes):
  //      candidatos = grupos exceto partidaAtualId (PROTEÇÃO RF09: a recém-
  //        importada NUNCA é candidata, mesmo sendo a mais antiga) e ainda
  //        presentes em grupos
  //      GUARDA ANTI-LOOP: if (candidatos.length === 0):
  //        log '[clipes] retenção: total acima do limite ({total} MB) mas
  //             nenhuma outra partida além da atual para deletar' e break
  //        (uma única partida pode exceder o limite — ela é preservada)
  //      alvo = candidato com menor data_jogo; empate: menor partida_id
  //        (determinístico — possível em importação histórica de mesmo dia)
  //      liberado = await deletarPartida(client, alvo, { origem })
  //      grupos.delete(alvo.partidaId)          // progresso garantido a cada
  //      total -= alvo.bytes                    // iteração: ou reduz o total,
  //                                             // ou esgota candidatos => while
  //      deletadas.push({ partidaId, dataJogo, ...liberado })  // termina (loop
  //                                             // finito por construção)
  // 4. log resumo: '[clipes] retenção: {n} partida(s) deletada(s),
  //    {X} MB liberados, total restante {Y} MB'
  //    return { deletadas, totalRestante: total }
}
```

**Decisões embutidas**:
- **Soma via SELECT de todas as linhas + agregação em Node** (não `GROUP BY`): PostgREST não expõe agregação; o volume é pequeno (racha semanal, dezenas de clipes por partida) e evita criar uma RPC só para `SUM` (YAGNI). P12 íntegro: o único uso do Storage é `list` para **deletar**, nunca para medir.
- **Deleta por partida inteira**: objetos do prefixo (tabela + órfãos listados), linhas por `partida_id`, 1 entrada de ledger por partida deletada — exatamente o RF09 (`requisito:71`).
- **`data_referencia` = data do jogo da partida deletada**: a entrada de limpeza fica alinhada ao painel da Fase 8 (histórico por data) e ao exemplo do dono.
- **Loop termina por construção** (cada iteração remove um candidato do conjunto finito ou o total cai); a guarda do `break` cobre o caso "uma só partida acima do limite" e o caso "só existe a recém-importada" — nos dois, nada é deletado e a run continua normal (o excesso é logado).
- **Nenhuma nova dependência**: só supabase-js e `Intl` (padrão do diretório `scripts/clipes/`).

**Validação da task**:
1. `node --check scripts/clipes/retencao.mjs` — sintaxe ok.
2. `node -e` local (sem banco): `resolverLimiteBytes` com `{ LIMITE_STORAGE_MB: '50' }` → `52428800`; com `''`/ausente → 800 MB; com `'abc'`/`'-1'` → throw.
3. Grep no arquivo: nenhuma leitura de `metadata.size` do Storage (P12 — a lista do `list` só gera caminhos).
4. Revisão do diff: nenhum `console.log` de valores sensíveis (aqui não há segredos; regra do diretório vale por padrão).

**Divergências/observações**: ver 8.2 (assinatura) e 8.3 (arquivo próprio).

### Task 3 — Integração no `importar-clipes.mjs`: chamada ao final do fluxo bem-sucedido

**Arquivos a tocar**: `scripts/clipes/importar-clipes.mjs` (ponto de extensão entre o passo 5.5 da Fase 3 e o passo 6 — `fase-2-tasks.md:232-236`, ocupado em `fase-3-tasks.md:394-407`).
**Arquivos NÃO tocados**: `retencao.mjs` (Task 2), YAML (Task 4), armazenamento/automação (Fase 3).

**Conteúdo esboçado**:

```js
// --- ajustes no main() existente (Fases 2–3) ---
// (topo do arquivo) import { limparPorRetencao, resolverLimiteBytes } from './retencao.mjs'
//
// 5.5 (Fase 3) resultado = await importarClipesDaPartida(...)
// 5.6 (NOVO — Fase 4): if (resultado.status === 'concluido') {
//        // RF09: limpeza só após importação BEM-SUCEDIDA. 'sem_clipes' não
//        // dispara (nada novo entrou no bucket — requisito :71).
//        const limiteBytes = resolverLimiteBytes();
//        log `[clipes] retenção: limite ${limiteBytes / MB} MB, partida atual ${partida.id}`
//        const { deletadas, totalRestante } = await limparPorRetencao(client, {
//          limiteBytes, partidaAtualId: partida.id, origem });
//        resultado.limpeza = { deletadas: deletadas.length, totalRestante };
//      }
// 6. fecharRegistroImportacao(client, registroId, {
//      status: resultado.status, sucesso: ...,
//      quantidadeClipes / bytesTotal: como na Fase 3 (estado da partida),
//      detalhe: detalheDaFase3 + (resultado.limpeza?.deletadas
//        ? `; retenção: ${resultado.limpeza.deletadas} partida(s) deletada(s),
//           total restante ${MB(resultado.limpeza.totalRestante)} MB`
//        : ''),
//    })
// Erros: o catch existente da Fase 2 mantém — throw na limpeza fecha o ledger
// como 'falha' (sucesso false, erro.message) e process.exit(1) (decisão abaixo).
```

**Decisões embutidas**:
- **Ordem: importação → limpeza → fechamento único do ledger.** A limpeza roda ANTES de `fecharRegistroImportacao`, dentro do mesmo `try`: uma falha na limpeza marca a run como `falha` (exit 1) — falha alta e visível (RNF04 em espírito), porque limpeza quebrada é o caminho para estourar o free tier de 1 GB e travar os uploads das próximas runs. As linhas/objetos já importados permanecem; a reexecução do mesmo dia (idempotência da Fase 3) reentra em `concluido` e re-tenta a limpeza. A alternativa (try/catch próprio que só loga e segue) esconderia a quebra até o cap — rejeitada.
- **Disparo condicionado a `concluido`**: `sem_clipes` e `falha` não limpam (o requisito manda "após cada importação bem-sucedida", `requisito:71`).
- **`resultado.limpeza` vai no `detalhe` do registro da importação** — o delta da run fica auditável numa linha só; as deleções têm suas próprias entradas `limpeza` no ledger (uma por partida, Task 2).
- **`partidaAtualId = partida.id` da run**: se o admin reimportar uma partida histórica via `partida_id` (RF03), é ELA a protegida — correto: "recém-importada" é a partida da run, não a de `data_jogo` mais recente.

**Validação da task**:
1. `node --check scripts/clipes/importar-clipes.mjs` + `npm run build`/`npm run lint` (raiz) — PWA intocado.
2. Revisão do diff: chamada da limpeza **somente** dentro do ramo `concluido`; `detalhe` não cresce indefinidamente (1 linha de resumo).
3. Grep: `limparPorRetencao` importada de `./retencao.mjs` (nada duplicado no arquivo).

**Divergências/observações**: nenhuma — o ponto de extensão foi reservado pela Fase 2 (`fase-2-tasks.md:234`) e preservado pela Fase 3.

### Task 4 — Workflow YAML: input `limite_storage_mb` + env `LIMITE_STORAGE_MB` + var documentada

**Arquivos a tocar**: `.github/workflows/clipes-filmaeu.yml` (input novo + 1 linha de env), `docs/configuracao-clipes-action.md` (seção nova).
**Arquivos NÃO tocados**: scripts, migrations, `src/`.

**Conteúdo esboçado**:

`.github/workflows/clipes-filmaeu.yml` — no `workflow_dispatch.inputs` (após `partida_id`, `fase-2-tasks.md:335-338`):
```yaml
      limite_storage_mb:
        description: 'Limite de retenção do bucket em MB (vazio = var LIMITE_STORAGE_MB ou 800)'
        required: false
        default: ''
```

No step de execução, `env:` (após os `INPUT_*`, `fase-2-tasks.md:363-369`):
```yaml
          # P11: override por input do dispatch > var do repositório > default 800.
          LIMITE_STORAGE_MB: ${{ inputs.limite_storage_mb || vars.LIMITE_STORAGE_MB || '800' }}
```

`docs/configuracao-clipes-action.md` — seção nova (após as de secrets):
```markdown
## 4. Limite de retenção (RF09, P11) — opcional

- Default: **800 MB** (compilado no YAML; folga sob o free tier de 1 GB).
- **Var do repositório** (Settings → Secrets and variables → Actions → aba
  **Variables**, não Secrets): `LIMITE_STORAGE_MB` = número inteiro de MB.
  Define o limite de TODAS as runs (cron e dispatch) enquanto existir.
- **Override pontual**: input `limite_storage_mb` no `workflow_dispatch`
  (ex.: 50 para o teste de retenção do esqueleto §5) — vale só para aquela run.
- Precedência: input > var > default. Valor inválido (<= 0 ou não numérico)
  faz a run falhar (config errada, não silêncio).
```

**Decisões embutidas**:
- **Input opcional com default `''`**: dispatches antigos/agendados não mudam de contrato; input vazio degrada para a var, e a var ausente para o 800 MB (P11 exatamente: "var do workflow com default 800 MB, override por input").
- **`vars.*` (Variables) e não outro secret**: limite não é segredo — é configuração legível, no lugar certo do GitHub (`vars` context funciona em `env:` do job).
- **Validação do número vive no script** (`resolverLimiteBytes`, Task 2), não no YAML — o YAML só encadeia strings.
- O cron semanal não recebe input: `inputs.limite_storage_mb` é vazio por definição em `schedule` → var/default, como manda o P11.

**Validação da task**:
1. Push na branch padrão → workflow atualizado sem erro de YAML (a aba Actions passa a mostrar o input `limite_storage_mb` no "Run workflow").
2. Run de dispatch **sem** o input (vazio) com var ausente → log mostra limite 800 MB; com `limite_storage_mb: 50` → log mostra 50 MB (o log do passo 5.6 da Task 3 imprime o limite).
3. Revisão do diff do doc: nenhum valor de segredo; precedência documentada.

**Divergências/observações**: o `|| '800'` do YAML depende de input vazio virar string vazia (comportamento do GitHub para input não preenchido — confirmável na validação 2).

## 5. Validação manual da fase (checklist para o dono)

O coração é o **teste com limite baixo de 50 MB** do esqueleto §5 (`docs/planos-implementacao/35-clipes-filmaeu.md:51`), reproduzindo o exemplo do dono (ordem por `data_jogo`, não por upload). Semear por Supabase (SQL Editor roda como `postgres`, sem restrição de grants; uploads de arquivo pelo dashboard Storage):

- [ ] **Semente A (partida antiga, upload de hoje)**: SQL Editor → `INSERT INTO partidas (data_jogo, status, voting_closes_at, criado_por) VALUES ('2026-02-02T19:00:00-03:00', 'closed', now(), <admin>);` (data antiga — use a data real de uma partida de fevereiro se quiser fidelidade ao exemplo); criar 2 arquivos dummy de ~15 MB localmente (`dd if=/dev/urandom of=clipe-a1.mp4 bs=1M count=15` etc.), subir os dois pelo dashboard em `clipes/{id_a}/`; `INSERT INTO clipes (partida_id, caminho, data_jogo, size_bytes, ordem) VALUES (<id_a>, '<id_a>/clipe-a1.mp4', '2026-02-02T19:00:00-03:00', <bytes reais do stat>, 1), (... clipe-a2 ...);` — total semeado ~30 MB, com `data_jogo` de **fevereiro** e upload de **hoje**.
- [ ] **Semente B (opcional, para provar a ordem)**: mesma receita com `data_jogo` de `2026-02-09` e ~40 MB — upload também de hoje, mais recente que A em `data_jogo`.
- [ ] **Pré-requisito**: a partida real importada na validação da Fase 3 existe com clipes (é a "recém-importada"); a soma dela + sementes > 50 MB.
- [ ] **Run de teste**: `workflow_dispatch` reimportando a MESMA data da Fase 3 (0 downloads por idempotência, status `concluido`) com `limite_storage_mb: 50` → run **verde**.
- [ ] **Ordem por `data_jogo`** (critério do breakdown `:114`): com A e B semeadas, o ledger mostra **duas** entradas `status='limpeza'` e `SELECT partida_id, data_referencia, criado_em FROM clipes_importacoes WHERE status='limpeza' ORDER BY id` → a de `data_referencia` = fevereiro (A) vem **antes** da de 09/02 (B), embora ambas tenham sido criadas hoje — a ordem seguiu o jogo, não o upload.
- [ ] **Arquivos + linhas removidos**: dashboard Storage → `clipes/{id_a}/` e `clipes/{id_b}/` vazios; `SELECT count(*) FROM clipes WHERE partida_id IN (id_a, id_b)` → 0; entradas `limpeza` com `quantidade_clipes` e `bytes_total` coerentes.
- [ ] **Recém-importada preservada**: arquivos em `clipes/{id_atual}/` intactos, linhas da partida da run intactas, **nenhuma** entrada `limpeza` apontando para `id_atual`.
- [ ] **Guarda anti-loop**: disparar com `limite_storage_mb: 50` num cenário em que só a recém-importada existe (após limpar as sementes) e ela sozinha passa de 50 MB → run verde, log da guarda ("nenhuma outra partida além da atual"), zero entradas `limpeza`.
- [ ] **Loop de múltiplas deleções**: se só a semente A existir (30 MB) e a partida atual tiver ~30 MB, com limite 50 → **uma** entrada `limpeza` (A) e o total restante abaixo do limite (sem segunda iteração); com limite 20 → A deletada **e** o loop para na guarda (a atual nunca é deletada).
- [ ] **Sem input e sem var**: dispatch normal (vazio) → log mostra 800 MB e (se total < 800 MB) zero limpeza.
- [ ] Log da run sem segredos (RNF02); `npm run build`/`npm run lint` verdes; `git log` da fase com 4 commits (Tasks 1–4), cada um revertível isoladamente; nenhum arquivo em `src/` alterado.
- [ ] **Limpeza da semente**: `DELETE FROM partidas WHERE id IN (id_a, id_b);` (CASCADE em `clipes`; `SET NULL` no ledger — histórico preservado) e conferir que não sobrou objeto nos prefixos.

## 6. Fora de escopo da fase

- Deleção manual de partidas/clipes no frontend (fora de escopo do requisito — `breakdown.md:109`); o painel admin (Fase 8) só **exibe** as entradas `limpeza`.
- Push/aviso de falha (Fase 5) — o `status 'falha'` da limpeza quebrada, registrado nesta fase, é insumo de lá.
- Disparo pelo app (Fase 6), frontend (Fases 7–8), backfill (D9), múltiplas quadras (§8).
- Coluna configurável de limite no banco (rejeitada no P11).
- Otimizações de espaço (transcodificação, HLS — §8 do requisito).

## 7. Riscos e rollback

- **Cada task é 1 commit, revertível por `git revert` isolado** (AGENTS.md). Reverter a Task 3 remove a chamada da limpeza do fluxo (comportamento da Fase 3); reverter a Task 2 remove o módulo; a Task 1 não precisa de down (grant inócuo); a Task 4 volta o YAML ao estado da Fase 3.
- **Risco principal (breakdown `:113`): deletar partida que o grupo quer rever.** Mitigado em camadas: ordem estrita por `data_jogo` (com desempate por `id`), proteção absoluta da `partidaAtualId`, folga do default de 800 MB, uma entrada de ledger `limpeza` por partida deletada (auditável no painel da Fase 8), e deleção **por partida inteira** (nunca clipe avulso). Recuperação: reimportar a data via `workflow_dispatch`/RF03 enquanto o Filma Eu mantiver os clipes (esqueleto §7, `:62`).
- **Falso total por órfãos/linhas nulas** (P12 aceita divergência tabela × bucket): órfãos da partida atual não contam no total (só são varridos quando a própria partida é alvo); `size_bytes` NULL conta como 0 com log de aviso. O teto real de 1 GB tem 200 MB de folga no default — margem para essas imprecisões.
- **Falha parcial do `remove` no Storage**: a Task 2 aborta ANTES de deletar linhas (partida continua candidata na próxima run); `Not Found` é tolerado (reexecução idempotente).
- **Loop infinito**: impossível por construção (cada iteração consome um candidato finito); a guarda do `break` cobre "limite menor que uma única partida" — cenário de teste dedicado na seção 5.
- **Run vermelha por falha de limpeza**: deliberado (Task 3 — falha alta); o reprocesso é reexecutar a mesma data (Fase 3 reimporta 0 arquivos e re-tenta a limpeza).
- **Ledger inconsistente**: correção manual por SQL com service_role (mesmo tratamento das Fases 2–3); entradas `limpeza` são append-only.

## 8. Divergências e observações (vs Fases 1–3 e código)

1. **`GRANT DELETE` a `service_role` não existe na interface da Fase 1** (`fase-1-tasks.md:88-95` concede só SELECT a clients e sequence a service_role). Os default privileges da plataforma provavelmente já dariam o DELETE, mas o padrão do repo é de grants explícitos — Task 1 acrescenta a 1 linha idempotente (migration 112) em vez de confiar em comportamento de plataforma. **Não é mudança de comportamento da Fase 1** (clients continuam sem escrita).
2. **Assinatura da `limparPorRetencao`**: o breakdown/orquestrador menciona `limparPorRetencao(limiteBytes, partidaAtualId)`; implementada como `limparPorRetencao(client, { limiteBytes, partidaAtualId, origem })` — o `client` injetado explicitamente segue o padrão de todas as funções das Fases 2–3 (`fecharRegistroImportacao(client, ...)`, `subirClipe(client, ...)`) e a `origem` é necessária para o CHECK da coluna `origem` do ledger (`fase-1-tasks.md:69`, que não aceita 'limpeza' — limpeza é `status`, não `origem`). Sem impacto estrutural.
3. **Arquivo próprio `scripts/clipes/retencao.mjs`** (não função dentro de `importar-clipes.mjs`): segue o padrão de módulos que a Fase 3 consolidou (`armazenamento.mjs`, `filmaeu/automacao.mjs`) — SRP; a integração é de 6 linhas no `main()`.
4. **PostgREST não faz `GROUP BY`**: a soma por partida agrega em Node a partir de `SELECT partida_id, data_jogo, caminho, size_bytes FROM clipes` (tabela pequena). A alternativa (RPC de agregação SECURITY DEFINER) foi rejeitada como camada sem necessidade (AGENTS/KISS). Se o volume um dia crescer (multi-quadra, §8), a RPC é a evolução natural — anotado, não construído (YAGNI).
5. **`size_bytes` é anulável na Fase 1** (`fase-1-tasks.md:53`) — o algoritmo trata NULL como 0 com log de aviso (a Fase 3 sempre preenche; NULL só de dados semeados à mão).
6. **Numeração 112**: acompanha 109–111 das fases anteriores e a mesma ressalva de colisão com `docs/plano-escolha-times-realtime.md:560` (Fase 1, divergência 9.1; Fase 2, divergência 2). Ação do executor: confirmar numeração antes de criar o arquivo; se deslocar, renomear só o arquivo.
7. **`sem_clipes` não dispara limpeza**: leitura estrita do RF09 ("após cada importação **bem-sucedida**" — `requisito:71`); `sem_clipes` tem `sucesso false` (Fase 3, `fase-3-tasks.md:471`). Nenhuma entrada nova no bucket justifica a checagem.
8. **Empate de `data_jogo`** (improvável no racha semanal, possível em importação histórica): desempate determinístico por `partida_id` ASC — decisão local desta fase, sem precedente nas anteriores.
9. **Interfaces das Fases 1–3 consumidas sem incompatibilidade além do grant da 8.1**: status `'limpeza'` já no CHECK da Fase 1 (`fase-1-tasks.md:70`, antecipado pela divergência 5 de lá), `caminho` no formato `{partida_id}/{arquivo}` (`fase-1-tasks.md:99`) alimenta direto o prefixo do Storage, `resumoDaPartida`/idempotência da Fase 3 permanecem intocados, e o ponto de extensão do `main()` reservado pela Fase 2 (`fase-2-tasks.md:234`) encaixa sem remanejamento.

## 9. Critérios de encerramento (do breakdown `:114`, refinados)

1. **Teste com limite de 50 MB deleta primeiro a partida de `data_jogo` mais antiga, independente da data de upload** (sementes A/B da seção 5 reproduzem o exemplo do dono do RF09: fevereiro semeada hoje deletada antes da de setembro/da atual).
2. **Remove arquivos + linhas**: prefixo `clipes/{partida_id}/` vazio no bucket e zero linhas em `clipes` para cada partida deletada (com órfãos do prefixo varridos junto).
3. **Registra no ledger**: uma entrada `status='limpeza'`, `sucesso true`, por partida deletada, com `quantidade_clipes`, `bytes_total`, `data_referencia` do jogo deletado e `detalhe` com o total restante; o `detalhe` da linha da importação menciona o resumo da limpeza.
4. **Preserva a recém-importada**: `partidaAtualId` nunca deletado, inclusive quando ela sozinha excede o limite (guarda com log; run verde).
5. Limite configurável funcionando: input `limite_storage_mb` do dispatch > var `LIMITE_STORAGE_MB` > default 800 MB (P11), validado no log de execução; valor inválido falha a run.
6. PWA intocado (`npm run build`/`npm run lint` verdes; nada em `src/`); 4 commits revertíveis (Tasks 1–4); checklist da seção 5 completo, incluindo a limpeza das sementes de teste.

## 10. NEEDS_CONTEXT

Nenhum. (P11 e P12 — as únicas decisões abertas da fase no breakdown `:112` — foram fechadas pelo orquestrador em `breakdown.md:193-194` e dirigem exatamente o desenho acima: var do workflow com override por input, soma por `size_bytes` da tabela. O grant de DELETE da 8.1 é correção de 1 linha resolvida dentro da fase, sem decisão estrutural.)
