# Fase 3 · Action: Playwright (login → download → upload idempotente) — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md`, seção 3 — Fase 3, linhas 94–103) · requisito fechado (`docs/requisito-clipes-filmaeu.md`, reconhecimento técnico §1 linhas 13–18)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicáveis a esta fase: **P3** (credenciais via RPC `obter_segredo_vault`), **P4** (bucket público de leitura → URL pública determinística), **P12** (`size_bytes` capturado no upload), **RNF04** (seletores resilientes e centralizados — o site é frágil por natureza).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). Interface do banco e do script = **exatamente a definida nas Fases 1 e 2** (`fase-1-tasks.md`, `fase-2-tasks.md`).

## 1. Objetivo da fase

Implementar a automação de browser que efetivamente baixa os clipes do slot 19:00 da Society Gragoatá na data da partida e os sobe para `clipes/{partida_id}/` no Storage com idempotência completa (reexecução da mesma data não rebaixa nem duplica), gravando `size_bytes` real por clipe (P12) e fechando o ledger (`clipes_importacoes`) com status/sucesso/contagem. Tudo isolado em `scripts/clipes/` — **nenhum arquivo do PWA é tocado** (RNF01). Limpeza é Fase 4; notificações são Fase 5.

## 2. Estado atual e interfaces vinculantes (evidências verificadas em 02/10/2026)

**O que as fases anteriores já entregam (a consumir tal como escritas):**

- **Fase 2 — script orquestrador**: `scripts/clipes/importar-clipes.mjs` (esboço em `fase-2-tasks.md:138-243`) já faz: `resolverConfig` (env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INPUT_DATA`, `INPUT_HORARIO` default `'19:00'`, `INPUT_PARTIDA_ID`, `GITHUB_EVENT_NAME` — `fase-2-tasks.md:148-155`), `criarClienteSupabase` (supabase-js, `persistSession: false`, **sem** `database.types.ts` — `fase-2-tasks.md:156-160`), `resolverDataAlvo`/`calcularFaixaDataBRT` (BRT = UTC-3 fixo), `buscarPartidaAlvo` (retorna `{ id, data_jogo }` ou null), `abrirRegistroImportacao` (idempotência do ledger: reusa linha ativa por `(data_referencia, partida_id)`, status `iniciado`) e `fecharRegistroImportacao(client, registroId, { status, sucesso, quantidadeClipes, detalhe, erro })` (`fase-2-tasks.md:215-219`). Os **pontos de extensão da Fase 3 estão marcados** no `main()` entre `validarSegredoFilmaEu` e `fecharRegistroImportacao` (`fase-2-tasks.md:232-236`).
- **Fase 2 — RPC do Vault**: `obter_segredo_vault(p_nome)` SECURITY DEFINER, executável só por `service_role` (migration 111, `fase-2-tasks.md:44-78`). O segredo `filmaeu_credenciais` contém JSON `{"usuario":"...","senha":"..."}` (`fase-2-tasks.md:275`).
- **Fase 2 — workflow**: `.github/workflows/clipes-filmaeu.yml` com cron `0 12 * * 5` (P8), `workflow_dispatch` com inputs `data`/`horario`/`partida_id`, `timeout-minutes: 10`, node 22, `npm ci --prefix scripts/clipes` (`fase-2-tasks.md:308-370`); a nota da Task 5 já antecipa: *"adicionar `actions/setup-node` com `cache: npm` quando a Fase 3 trouxer Playwright"* (`fase-2-tasks.md:374`).
- **Fase 1 — tabela `clipes`** (`fase-1-tasks.md:48-62`): `partida_id` FK, `caminho text` (`UNIQUE(partida_id, caminho)`), `data_jogo` denormalizada, **`size_bytes bigint`** (P12), `ordem integer` (semântica a fixar — divergência 3 da Fase 1 promete fixar aqui: **`ordem` = posição do clipe na listagem do slot, 1-based**), `criado_em`.
- **Fase 1 — ledger** (`fase-1-tasks.md:65-83`): `status CHECK IN ('iniciado','concluido','sem_clipes','falha','limpeza')`, `sucesso boolean`, `quantidade_clipes integer`, `bytes_total bigint`, `detalhe`, `erro`. Grants: INSERT/UPDATE só `service_role`.
- **Fase 1 — decisão de `caminho`** (`fase-1-tasks.md:99`): caminho do objeto **dentro do bucket, sem o nome do bucket** (ex.: `123/clipe-001.mp4`) → caminho no Storage = `clipes/{partida_id}/{arquivo}` e `caminho` = `{partida_id}/{arquivo}`.

**O que sabemos do Filma Eu (única base permitida para seletores — `docs/requisito-clipes-filmaeu.md:13-18`):**

- Área de vídeos exige login; fluxo `/login` → busca da quadra → data da partida → horário (19:00) → grade com botão **Baixar**.
- Site server-rendered clássico (jQuery/Bootstrap), **sem API pública detectável**; mídia em bucket S3 (`filmaeustorage`).
- **Nenhum seletor concreto (id/classe/atributo) é sustentado pelos docs** → todos os valores de seletor desta fase entram como **`A CONFIRMAR NO MAPEAMENTO DO DONO`** (Task 1) e vivem isolados num único arquivo (RNF04).
- Playwright estável em 02/10/2026: **1.63.0** (`registry.npmjs.org/playwright/latest`).

**Estado do repo**: `scripts/clipes/package.json` tem só `@supabase/supabase-js ^2.112.2` em `dependencies` (`fase-2-tasks.md:106-115`); `package.json` raiz não tem Playwright nem deve ter (`package.json:15-38`).

## 3. Pré-condições

- **Fase 1 aplicada**: migrations 109/110 (tabelas + bucket público) e `database.types.ts` regenerados.
- **Fase 2 aplicada**: migration 111 (RPC `obter_segredo_vault`), `scripts/clipes/` com lockfile commitado, `importar-clipes.mjs` rodando verde via `workflow_dispatch`, workflow YAML na branch padrão.
- **Secrets criados** (cadência manual da Fase 2): `filmaeu_credenciais` no Vault (conta D7) + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no GitHub (`docs/configuracao-clipes-action.md`).
- **Mapeamento DOM feito pelo dono** (Task 1 desta fase — pré-requisito explícito do breakdown, `breakdown.md:101`): as Tasks 4–6 podem ser codadas antes com placeholders, mas **nenhuma run de validação da fase acontece sem o mapeamento preenchido**.
- Decisões fechadas aplicáveis: P3, P4, P12, RNF04. Numeração de migrations: **esta fase não cria migration** (nenhuma mudança de banco é necessária — `caminho`, `size_bytes`, `ordem`, status `sem_clipes` já existem na interface da Fase 1).

## 4. Tasks (1 passo = 1 commit)

### Task 1 — Documento de mapeamento DOM do Filma Eu (pré-requisito documental do dono)

**Arquivos a criar**: `docs/filmaeu-mapeamento-dom.md`.
**Arquivos a tocar**: nenhum código.

**Conteúdo esboçado** (template que o dono preenche logado no filmaeu.com.br, uma vez):

```markdown
# Mapeamento DOM do Filma Eu — Clipes (preenchido pelo dono, uma vez)

> Consumidor: `scripts/clipes/filmaeu/seletores.mjs` (RNF04 — única fonte de seletores).
> Preencher com valores REAIS do site. Nada de credenciais neste arquivo.

## 1. Rotas e fluxo
- URL de login: ______ (sabe-se que é atrás de /login — requisito §1)
- Após o login, para chegar na grade de clipes: ______ passos (busca da quadra
  "Society Gragoatá" → seleção de data → slot 19:00). Descrever cada tela
  (URL e o que muda) e anexar screenshot.
- A URL da grade do slot carrega a data/horário na querystring? ______
  (se sim, navegação direta pode substituir cliques — mais resiliente)

## 2. Seletores (para cada passo, o seletor mais estável: id > data-* > name > classe > texto)
- Campo de usuário / senha / botão entrar: ______
- Campo de busca da quadra + como selecionar "Society Gragoatá": ______
- Controle de data (input? calendário?): ______
- Item do slot 19:00 (link? card?): ______
- Card de cada clipe na grade (título, ordem de exibição): ______
- Botão "Baixar" de cada clipe: ______

## 3. Comportamento do download (crítico)
- Clicar em "Baixar" dispara download direto, abre nova aba ou navega para
  URL do S3 (`filmaeustorage...`)? ______ (colar a URL de exemplo, sem token se houver)
- O arquivo baixado mantém nome estável entre acessos (ex.: `clipe-1234.mp4`)? ______
- Extensão/formato: ______ (esperado mp4 — A CONFIRMAR)

## 4. Resiliência
- O slot 19:00 aparece desabilitado/ausente quando não há clipes? ______
- Quantos clipes típicos por slot? ______ (sanidade: conta esperada na validação)
```

**Decisões embutidas**:
- A pergunta **3.2 (nome de arquivo estável?)** define a chave de idempotência da Task 6: plano principal = nome do arquivo do site; **plano B** (se o nome variar a cada acesso) = nome determinístico derivado da posição na grade (`clipe-{ordem:03d}.mp4`), decidido no preenchimento — não no código.
- A pergunta **1.3 (URL com querystring)** pode eliminar vários cliques frágeis — se a grade for endereçável por URL, `navegarParaSlot` usa `page.goto` direto em vez de 3 interações (RNF04: menos cliques, menos fragilidade).

**Validação da task**:
1. Doc preenchido pelo dono, sem credenciais no conteúdo (revisar diff).
2. Revisão cruzada: cada seletor do doc tem correspondência clara no checklist da seção 2 do doc.

**Divergências/observações**: o breakdown marca o mapeamento como "pré-requisito manual" sem definir artefato; doc em `docs/` segue o hábito do repo (`docs/MIGRATE.md`, `docs/configuracao-clipes-action.md` da Fase 2).

### Task 2 — Playwright como devDependency do diretório da Action + ajustes no workflow

**Arquivos a tocar**: `scripts/clipes/package.json` (devDependency nova), `scripts/clipes/package-lock.json` (regenerado), `.github/workflows/clipes-filmaeu.yml` (2 steps + timeout).
**Arquivos NÃO tocados**: `package.json` raiz, `src/`.

**Conteúdo esboçado**:

`scripts/clipes/package.json` (adicionar):
```json
"devDependencies": {
  "playwright": "^1.63.0"
}
```

Instalar: `npm install --prefix scripts/clipes` (lockfile commitado, igual à Task 2 da Fase 2).

`.github/workflows/clipes-filmaeu.yml` — três mudanças:
```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm                                  # NOVO (Fase 2 já antecipava, :374)
          cache-dependency-path: scripts/clipes/package-lock.json
      - name: Instalar dependências da Action
        run: npm ci --prefix scripts/clipes
      - name: Instalar Chromium (Playwright)          # NOVO
        run: npx --prefix scripts/clipes playwright install --with-deps chromium
```
E `timeout-minutes: 10` → `timeout-minutes: 25` (downloads de N vídeos de ~30s + uploads — 10 min pode ser apertado; 25 mantém folga sob o limite de 6 h do runner).

**Justificativa (2 linhas, pedida)**: o Playwright entra como **devDependency do `scripts/clipes/`** porque só é usado pela automação no runner (e em debug local do executor) — nunca importado pelo PWA, que segue sem nenhuma lib nova (RNF01/AGENTS); `devDependency` (e não `dependency`) expressa que não é runtime de aplicação, e como o diretório não tem build/publish, o efeito prático é semântico + keeps `npm ci --omit=dev` possível no futuro.

**Versão**: `^1.63.0` — latest estável do npm em 02/10/2026 (`registry.npmjs.org/playwright/latest`). Só Chromium é instalado (`install chromium`), não o pacote completo de browsers — instalação menor no runner.

**Validação da task**:
1. `npm ci --prefix scripts/clipes` instala a partir do lockfile sem erro.
2. `npm run build` e `npm run lint` (raiz) passam — PWA intocado.
3. `git status`: só `package.json`, `package-lock.json` de `scripts/clipes/` e o YAML mudaram.
4. Run de `workflow_dispatch` (sem data) → **verde**: o novo step `playwright install` executa e o script da Fase 2 continua funcionando (ainda não usa Playwright).

**Divergências/observações**: `npx --prefix` é a forma correta de resolver o binário do diretório aninhado no runner (o `npx playwright` simples resolveria da raiz, que não tem Playwright). Alternativa seria `npm exec --prefix scripts/clipes -- playwright install chromium`.

### Task 3 — `scripts/clipes/filmaeu/seletores.mjs` (única fonte de seletores, RNF04)

**Arquivos a criar**: `scripts/clipes/filmaeu/seletores.mjs`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (completo)**:

```js
// Única fonte de rotas e seletores do filmaeu.com.br (RNF04 — requisito §1 e §7:
// o site muda sem aviso; correção pontual AQUI, nunca espalhada pelo código).
// TODOS os valores marcados "A CONFIRMAR" vêm do mapeamento do dono
// (docs/filmaeu-mapeamento-dom.md). Estratégia de resiliência, em ordem:
// id > data-* > name > classe estável > texto visível (getByRole/getByText).
// Site server-rendered (jQuery/Bootstrap): navegação clássica, sem SPA —
// usar waitForSelector/waitForURL, não networkidle.

export const QUADRA = 'Society Gragoatá';   // D7 — quadra fixa (requisito §2)
export const URLS = {
  base: 'https://filmaeu.com.br',
  login: 'https://filmaeu.com.br/login',    // A CONFIRMAR (requisito §1: "atrás de /login")
  // grade: se o mapeamento 1.3 mostrar URL endereçável, montar aqui
  // (ex.: `${base}/quadra/...?data=${dataISO}&horario=${horario}`) — A CONFIRMAR
};

// A CONFIRMAR NO MAPEAMENTO DO DONO — valores iniciais plausíveis para
// jQuery/Bootstrap, substituídos pelos reais antes da primeira run de validação.
export const SELETORES = {
  campoUsuario: 'A CONFIRMAR',              // ex.: 'input[name="usuario"]'
  campoSenha: 'A CONFIRMAR',                // ex.: 'input[type="password"]'
  botaoEntrar: 'A CONFIRMAR',               // ex.: 'button[type="submit"]'
  sinalPostLogin: 'A CONFIRMAR',            // elemento só visível autenticado
  campoBuscaQuadra: 'A CONFIRMAR',
  itemQuadra: 'A CONFIRMAR',                // card/linha contendo QUADRA (texto)
  campoData: 'A CONFIRMAR',                 // input date? calendário? (mapeamento 2.3)
  itemSlot: 'A CONFIRMAR',                  // elemento do horário (ex.: link '19:00')
  gradeClipes: 'A CONFIRMAR',               // container da grade
  cardClipe: 'A CONFIRMAR',                 // card individual (para contar/ordenar)
  tituloClipe: 'A CONFIRMAR',
  botaoBaixar: 'A CONFIRMAR',               // ex.: 'a:has-text("Baixar")'
};

export const PAGINA = {
  timeoutNavegacaoMs: 30_000,   // page.goto / waitForURL
  timeoutElementoMs: 15_000,    // waitForSelector de cada passo
  timeoutDownloadMs: 120_000,   // por clipe (~30s de vídeo)
  tentativasDownload: 2,        // retry por clipe
};

// Erro de domínio: a automação distingue "o site não se comportou como esperado"
// (ErroFilmaeu → ledger 'falha' + screenshot) de erro de infra (throw comum).
export class ErroFilmaeu extends Error {
  constructor(passo, causa) {
    super(`Filma Eu: falha no passo "${passo}"${causa ? `: ${causa}` : ''}`);
    this.name = 'ErroFilmaeu';
    this.passo = passo;
  }
}
```

**Decisões embutidas**:
- **Timeouts centralizados aqui também** (não só seletores) — RNF04 pede seletores resilientes E execução logada; ajustar tempos vindo do mapeamento é edição de um arquivo.
- `ErroFilmaeu` carrega o `passo` — a Task 4 usa para tirar screenshot nomeado por passo e para o `detalhe`/`erro` do ledger.
- Nada de lógica de navegação neste arquivo: só constantes (SRP).

**Validação da task**:
1. `node --check scripts/clipes/filmaeu/seletores.mjs`.
2. Grep no diretório `scripts/clipes/`: nenhum seletor literal do Filma Eu fora deste arquivo (após Tasks 4–6, refazer — regra permanente).
3. Consistência: todo item "A CONFIRMAR" tem seção correspondente no `docs/filmaeu-mapeamento-dom.md`.

**Divergências/observações**: nenhum valor de seletor é inventado — os docs só sustentam o fluxo (`/login`, quadra, data, 19:00, botão "Baixar") e o caráter server-rendered/jQuery do site (`docs/requisito-clipes-filmaeu.md:15-16`).

### Task 4 — `scripts/clipes/filmaeu/automacao.mjs` (login → navegação → coleta → download)

**Arquivos a criar**: `scripts/clipes/filmaeu/automacao.mjs`.
**Arquivos a tocar**: nenhum outro (integração no `main` é a Task 6).

**Conteúdo esboçado (estrutura com assinaturas e comportamento)**:

```js
// Automação Playwright do Filma Eu (Fase 3 — breakdown SDD 35).
// Funções puras de browser: recebem context/page, retornam dados; a orquestração
// com Supabase/ledger fica em importar-clipes.mjs (Task 6). RNF02: credenciais
// são usadas só em page.fill — JAMAIS logadas. RNF04: log rico por passo.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { URLS, SELETORES, PAGINA, QUADRA, ErroFilmaeu } from './seletores.mjs';

export async function abrirBrowser() {
  // chromium.launch({ headless: true }) → newContext({ acceptDownloads: true })
  // (acceptDownloads é obrigatório para page.waitForEvent('download')).
  // Retorna { browser, context } — o caller fecha o browser no finally.
}

async function comRetry(passo, fn, tentativas = 1) {
  // Executa fn(); em ErroFilmaeu/timeout, loga tentativa e reexecuta até
  // `tentativas`; esgotou → screenshot(dirDebug, `falha-${passo}`) e rethrow.
  // Usado em login e download (RNF04: retry em fragilidade transitória).
}

async function screenshot(page, dirDebug, nome) {
  // page.screenshot({ path: join(dirDebug, `${nome}.png`), fullPage: true })
  // dirDebug = ${process.env.RUNNER_TEMP || os.tmpdir()}/clipes-debug (mkdir -p)
}

export async function logarFilmaeu(context, { usuario, senha }) {
  // 1. page.goto(URLS.login, { waitUntil: 'domcontentloaded', timeout: PAGINA.timeoutNavegacaoMs })
  // 2. fill usuario/senha + click botaoEntrar (comRetry, passo 'login')
  // 3. aguardar SELETORES.sinalPostLogin (prova de sessão autenticada)
  // 4. log: '[clipes] login ok' — SEM os valores. Falha → ErroFilmaeu('login').
  // Retorna page.
}

export async function navegarParaSlot(page, { dataISO, horario }) {
  // Se o mapeamento 1.3 confirmar URL endereçável:
  //   page.goto(URL da grade com data/horário) — caminho preferido (menos cliques).
  // Senão, sequência com waitForSelector entre passos (cada um com log):
  //   a. buscar quadra QUADRA e clicar no item (getByText(QUADRA) como fallback do seletor)
  //   b. preencher/selecionar dataISO (AAAA-MM-DD, formato do controle — mapeamento 2.3)
  //   c. clicar no slot `horario` (default '19:00', vindo de INPUT_HORARIO)
  // Cada passo lança ErroFilmaeu(passo) em timeout — nunca erro cru de seletor.
  // Retorna a page na grade do slot.
}

export async function coletarClipes(page) {
  // waitForSelector(SELETORES.gradeClipes); $$eval dos SELETORES.cardClipe.
  // Retorna lista [{ ordem, titulo, seletorBaixar }] — ordem = índice 1-based
  // na grade (vira clipes.ordem — fixa a semântica prometida na divergência 3
  // da Fase 1). Lista vazia NÃO é erro aqui (caller decide 'sem_clipes').
}

export async function baixarClipes(page, listaClipes, { dirTemp, caminhosPendentes }) {
  // Para cada clipe cujo caminho derivado está em caminhosPendentes (Task 6):
  //   (comRetry, PAGINA.tentativasDownload)
  //   a. derivar nome: Promise.all([page.waitForEvent('download'), clipe.seletorBaixar.click()])
  //      → download.suggestedFilename() — padrão A do mapeamento 3.1
  //   b. se o site navegar direto para URL S3 (padrão B do mapeamento 3.1),
  //      fallback: context.request.get(urlDaAncora) com os cookies da sessão,
  //      nome extraído da URL. Estratégia escolhida na Task 1, codificada aqui.
  //   c. download.saveAs(join(dirTemp, nomeArquivo)) — dirTemp = RUNNER_TEMP/clipes-baixa
  //   d. sizeBytes = tamanho do arquivo salvo (fs.stat) — P12
  //   e. log '[clipes] baixado i/N: <nome> (<size> bytes)'
  // Timeout PAGINA.timeoutDownloadMs por clipe. Retorna
  // [{ ordem, titulo, nomeArquivo, arquivoLocal, sizeBytes }].
}
```

**Decisões embutidas**:
- **`acceptDownloads: true` + `waitForEvent('download')`** é o caminho canônico do Playwright para download autenticado; o fallback via `context.request.get` cobre o padrão "âncora direta para o S3" (reconhecimento: mídia em `filmaeustorage`, requisito §1) reusando os cookies da sessão sem segundo login.
- **Screenshots por passo em falha** vão para `${RUNNER_TEMP}/clipes-debug/` — a Task 2/YAML (seção 5) os publica como artefato da run (RNF04: debug sem reproduzir manualmente).
- A função **não decide idempotência** — recebe `caminhosPendentes` e só baixa o que falta (decisão da Task 6, aplicada na chamada). SRP: automação vs política.

**Validação da task**:
1. `node --check scripts/clipes/filmaeu/automacao.mjs`.
2. Revisão do diff: nenhum `console.log` interpola `usuario`/`senha` (RNF02); nenhum seletor literal fora de `seletores.mjs`.
3. (Opcional, local, com credenciais do dono via env no terminal — nunca em arquivo) smoke manual do login até a grade, durante a validação da fase.

**Divergências/observações**: os dois padrões de download (evento vs navegação S3) estão previstos porque o mapeamento 3.1 é binário — a Task 1 decide qual codificar em definitivo; manter os dois até lá é custo baixo e evita retrabalho.

### Task 5 — `scripts/clipes/armazenamento.mjs` (upload no Storage + INSERT idempotente + consultas)

**Arquivos a criar**: `scripts/clipes/armazenamento.mjs`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (estrutura com assinaturas e comportamento)**:

```js
// Persistência dos clipes: Storage (service key) + tabela clipes.
// Interface EXATA da Fase 1 (fase-1-tasks.md:48-95): caminho = '{partida_id}/
// {arquivo}' dentro do bucket 'clipes'; UNIQUE(partida_id, caminho) →
// ON CONFLICT DO NOTHING; size_bytes real por clipe (P12).
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

export function montarCaminho(partidaId, nomeArquivo) {
  // `{partidaId}/{nomeArquivo}` — igual ao caminho do objeto no bucket
  // (fase-1-tasks.md:99). Public URL (P4, bucket público) é determinística:
  //   `${SUPABASE_URL}/storage/v1/object/public/clipes/${caminho}`
  // e NÃO é gravada: a Fase 1 não tem coluna de URL (divergência 2 desta fase) —
  // a Fase 7 monta a URL em src/lib/clipes.ts a partir de caminho.
}

export async function caminhosExistentes(client, partidaId) {
  // .from('clipes').select('caminho').eq('partida_id', partidaId) → Set<string>
  // É a base da idempotência RF02 (decisão na Task 6 — tabela antes de baixar).
}

export async function subirClipe(client, { partidaId, dataJogo, ordem, arquivoLocal, nomeArquivo }) {
  // 1. sizeBytes = (await stat(arquivoLocal)).size  — P12, tamanho real
  // 2. body = await readFile(arquivoLocal)
  // 3. await client.storage.from('clipes').upload(caminho, body, {
  //      contentType: 'video/mp4',        // A CONFIRMAR no mapeamento 3.3
  //      upsert: true,                    // idempotente no bucket: reexecução
  //    })                                 // após crash sobrescreve, não falha
  // 4. INSERT idempotente na tabela:
  //    await client.from('clipes')
  //      .insert({ partida_id: partidaId, caminho, data_jogo: dataJogo,
  //                size_bytes: sizeBytes, ordem },
  //                { onConflict: 'partida_id,caminho', ignoreDuplicates: true })
  //      → PostgREST 'Prefer: resolution=ignore-duplicates' = ON CONFLICT DO NOTHING
  // 5. log '[clipes] subido <caminho> (<sizeBytes> bytes)'
  // Retorna { caminho, sizeBytes }.
}

export async function resumoDaPartida(client, partidaId) {
  // .from('clipes').select('size_bytes').eq('partida_id', partidaId)
  // → { quantidade: n, bytesTotal: soma } — alimenta o ledger (Task 6):
  //   quantidade_clipes e bytes_total refletem o ESTADO DA PARTIDA ao final
  //   (inclui linhas de runs anteriores), coerente com o painel da Fase 8.
}
```

**Decisões embutidas**:
- **`size_bytes` vem do arquivo salvo em disco** (`fs.stat`), não de header HTTP — é o valor que vai ao Storage de fato (P12: "capturado no upload", determinístico para a limpeza da Fase 4, que soma por partida sem consultar o Storage).
- **Upload com `upsert: true`**: cobre o crash entre upload e INSERT (run seguinte sobrescreve o objeto órfão e insere a linha). A ausência de policies de escrita client (Fase 1, `fase-1-tasks.md:141-142`) garante que só a service key faz isto.
- **`ignoreDuplicates: true`** é o `ON CONFLICT (partida_id, caminho) DO NOTHING` do breakdown (`breakdown.md:97`) na sintaxe supabase-js v2 (`^2.112.2`, `package.json:16`) — sem SQL cru, sem lib nova.
- **`contentType` único**: sem detecção de MIME (YAGNI — o mapeamento 3.3 confirma o formato; se vier mais de um, vira constante por extensão aqui).

**Validação da task**:
1. `node --check scripts/clipes/armazenamento.mjs`.
2. Revisão: `caminho` montado sem nome do bucket; nenhum `console.log` de `body`/conteúdo.

**Divergências/observações**: nenhuma incompatibilidade com a interface da Fase 1 — `caminho`, `data_jogo`, `size_bytes` e `ordem` são colunas existentes; `UNIQUE(partida_id, caminho)` (`fase-1-tasks.md:56`) é exatamente o alvo do `onConflict`.

### Task 6 — Integração no `importar-clipes.mjs`: orquestração, idempotência completa e fechamento do ledger

**Arquivos a tocar**: `scripts/clipes/importar-clipes.mjs` (nos pontos de extensão marcados pela Fase 2, `fase-2-tasks.md:232-236`), `.github/workflows/clipes-filmaeu.yml` (1 step novo).
**Arquivos NÃO tocados**: seletores, automação, armazenamento (Tasks 3–5).

**Conteúdo esboçado**:

```js
// --- nova função em importar-clipes.mjs ---
async function importarClipesDaPartida(client, { partida, dataAlvo, horario, credenciais }) {
  // 1. existentes = caminhosExistentes(client, partida.id)
  //    >>> IDEMPOTÊNCIA (decisão fechada desta fase):
  //    Consultar a TABELA antes de tocar no site e derivar o caminho de forma
  //    determinística ({partida_id}/{nomeArquivo}) — baixar SOMENTE o que não
  //    tem linha. Justificativa: comparar hash exigiria baixar tudo (derrota o
  //    RF02 "não rebaixar"); nome do arquivo é a chave natural do slot (o
  //    mapeamento 3.2 do dono confirma a estabilidade; plano B: nome por ordem,
  //    já previsto na Task 1). Reexecução com tudo presente → 0 downloads.
  // 2. { browser, context } = abrirBrowser(); try {
  //    page = logarFilmaeu(context, credenciais)
  //    page = navegarParaSlot(page, { dataISO: dataAlvo, horario })
  //    lista = coletarClipes(page)
  //    if (lista.length === 0) → return { status: 'sem_clipes', ... } (sem browser aberto além do necessário)
  //    pendentes = lista.filter(c => !existentes.has(montarCaminho(partida.id, nome)))
  //    baixados = baixarClipes(page, pendentes, { dirTemp, caminhosPendentes })
  //    for (b of baixados) subirClipe(client, { partidaId, dataJogo: partida.data_jogo, ...b })
  //    } finally { await browser.close() }
  // 3. resumo = resumoDaPartida(client, partida.id)
  //    return { status: 'concluido', resumo, novos: baixados.length }
}

// --- ajustes no main() existente (Fase 2) ---
// 5. credenciais = JSON.parse(await client.rpc('obter_segredo_vault',
//        { p_nome: 'filmaeu_credenciais' }))
//    null/vazio → throw (run falha, ledger 'falha') — igual à Fase 2.
//    JSON inválido → throw com mensagem SEM o conteúdo (RNF02).
//    (O validarSegredoFilmaeu da Fase 2 é substituído por este parse real.)
// 5.5 (NOVO — ponto de extensão Fase 3):
//    resultado = await importarClipesDaPartida(...)
// 6. fecharRegistroImportacao(client, registroId, {
//      status: resultado.status,        // 'concluido' | 'sem_clipes'
//      sucesso: resultado.status === 'concluido',
//      quantidadeClipes: resultado.resumo.quantidade,
//      bytesTotal: resultado.resumo.bytesTotal,
//      detalhe: `${resultado.novos} novos, ${resultado.resumo.quantidade} totais`,
//    })
//    >> 'sem_clipes': sucesso FALSE (condição de alerta RF07 — Fase 5 usa para
//    avisar admins) e process.exit(0) (infra ok, run verde, igual à decisão
//    "partida não encontrada" da Fase 2).
// Erros (ErroFilmaeu, timeout, rede): fecharRegistroImportacao(status 'falha',
//    sucesso false, erro.message) + process.exit(1) — comportamento da Fase 2 mantido.
```

`.github/workflows/clipes-filmaeu.yml` — step novo, por último:
```yaml
      - name: Publicar debug do browser (falhas)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: clipes-debug
          path: ${{ runner.temp }}/clipes-debug
          if-no-files-found: ignore
```

**Decisões embutidas**:
- **Idempotência completa em 3 camadas**: (a) ledger — UPDATE da linha ativa (Fase 2); (b) download — só o que falta na tabela (nova); (c) gravação — upload `upsert` + INSERT `ignoreDuplicates` (Task 5). Segunda execução da mesma data: coleta a lista do site (barato — só DOM), baixa 0 arquivos, insere 0 linhas, fecha o ledger com contagem final correta.
- **Reexecução de data já concluída NÃO é pulada cedo**: navegar/coletar custa segundos e serve de verificação de sanidade (site ainda lista os mesmos clipes); pular antes do login esconderia mudança no site (RNF04). O que se evita é **rebaixar/reenviar** (custo real).
- **`quantidade_clipes`/`bytes_total` = estado final da partida** (não só da run) — o painel da Fase 8 mostra o que existe, não o delta da última tentativa; `detalhe` preserva o delta para auditoria.
- **`process.exit(0)` para `sem_clipes`**: condição esperada (slot vazio / clipes ainda não publicados), idêntica em espírito à "partida não encontrada" da Fase 2 (`fase-2-tasks.md:249`).
- Credenciais: o JSON do Vault é parseado e desestruturado em memória; o único uso é `page.fill` — nenhum caminho até log (RNF02).

**Validação da task (a validação real da fase)**:
1. `node --check scripts/clipes/importar-clipes.mjs` + `npm run build`/`npm run lint` (raiz) — PWA intocado.
2. **Run de teste com data real**: `workflow_dispatch` com `data` = última quinta com partida `published`/`closed` e `horario` vazio (19:00) → run **verde**.
3. Bucket: dashboard/`curl -I` em `$VITE_SUPABASE_URL/storage/v1/object/public/clipes/{partida_id}/...` → **200** por clipe (bucket público, P4).
4. Tabela: `select partida_id, caminho, size_bytes, ordem from clipes where partida_id = X` → linhas com `size_bytes > 0` e `caminho` no formato `{partida_id}/{arquivo}`.
5. Ledger: linha ativa da data com `status 'concluido'`, `sucesso true`, `quantidade_clipes` = contagem da tabela, `bytes_total` = soma dos `size_bytes`.
6. **2ª execução (idempotência)**: mesmo `data` de novo → run verde; log mostra `0 novos`; **nenhum download de arquivo no log**, nenhuma linha nova na tabela (mesmo `count`), ledger reusado (sem segunda linha ativa); `atualizado_em` da linha muda.
7. Log da run: sem credenciais (Filma Eu, service key) — grep no log como prova extra.
8. Debug: disparar uma run com `data` sem partida → ledger `falha` (caminho "partida não encontrada" da Fase 2 preservado); em falha de DOM (se ocorrer), artefato `clipes-debug` aparece na run.

## 5. Validação manual da fase (checklist para o dono)

- [ ] `docs/filmaeu-mapeamento-dom.md` preenchido e sem credenciais.
- [ ] `npm ci --prefix scripts/clipes` + step `playwright install chromium` verdes em run real.
- [ ] Run de teste com data de partida real → verde; clipes aparecem no bucket em `clipes/{partida_id}/`.
- [ ] URL pública de cada clipe abre no browser anônimo (`/storage/v1/object/public/clipes/...`).
- [ ] Tabela `clipes`: linhas com `size_bytes` real (> 0), `ordem` preenchida, `caminho` correto.
- [ ] Ledger: `concluido`, `sucesso true`, `quantidade_clipes` e `bytes_total` coerentes com a tabela.
- [ ] **2ª execução da mesma data**: run verde, `0 novos` no log, nenhum arquivo rebaixado/reenviado, nenhuma linha duplicada, ledger reusado.
- [ ] Run com data sem partida → run verde com ledger `falha` (comportamento Fase 2 mantido).
- [ ] Log da run sem Filma Eu/service key (RNF02).
- [ ] `npm run build`/`npm run lint` passam; `git log` da fase com 6 commits (Tasks 1–6), cada um revertível isoladamente; nenhum arquivo em `src/` alterado.

## 6. Fora de escopo da fase

- Limpeza por retenção e limite configurável (Fase 4, P11).
- Push "clipes prontos"/aviso de falha (Fase 5) — o `status 'sem_clipes'` e `sucesso false` já gravados aqui são o gatilho de lá.
- Disparo pelo app (Fase 6), frontend (Fases 7–8).
- Backfill de histórico (D9) e múltiplas quadras (§8 do requisito).
- Qualquer mudança em `src/`, migrations ou `database.types.ts` (a fase não cria objetos de banco novos).

## 7. Riscos e rollback

- **Cada task é 1 commit, revertível por `git revert` isolado** (AGENTS.md). Reverter a Task 6 devolve o comportamento da Fase 2 (workflow base, sem download); reverter a Task 2 remove o Playwright do runner.
- **Risco principal (breakdown `:102`): fragilidade do DOM (RNF04)**. Mitigado em camadas: seletores + timeouts num único arquivo (`seletores.mjs`), estratégias por texto/`getByRole` como fallback, retry em login/download, screenshots por passo publicados como artefato em `failure()`, log rico por passo. Correção futura = editar `seletores.mjs` (1 commit pequeno), sem tocar orquestração.
- **Nome de arquivo do site não estável** (idempotência baseada nele): plano B decidido no mapeamento 3.2 (nome determinístico `clipe-{ordem:03d}`); se descoberto só depois, a migração é reimportar a data com `partida_id` (linhas antigas de caminho diferente ficam órfãs → limpar por SQL com service_role; risco baixo, histórico curto no início).
- **Padrão de download diferente do previsto** (evento vs navegação S3): os dois padrões estão codificados na Task 4; o mapeamento 3.1 escolhe — sem retrabalho estrutural.
- **Run estoura 25 min** (muitos clipes/links lentos): timeout do runner mata a run → ledger fica `iniciado` (a próxima execução reusa a linha — Fase 2) e os objetos/linhas parciais são completados pela reexecução (upload `upsert` + `ignoreDuplicates` cobrem o crash no meio).
- **Clipes ainda não publicados no horário do cron** (P8 default): run da sexta fica `sem_clipes` (`sucesso false`, exit 0); reprocesso via `workflow_dispatch` (RF03) ou ajuste de 1 linha no cron — mesmo risco já registrado na Fase 2.
- **Ledger inconsistente** (status errado por bug): correção manual por SQL com service_role ou nova run com `partida_id` (UPDATE da linha ativa) — mesmo tratamento da Fase 2.

## 8. Divergências e observações (vs Fases 1–2 e código)

1. **`sucesso` para `sem_clipes` não estava mapeado**: a Fase 2 lista o status sem definir o boolean (`fase-2-tasks.md:215-219`). Fixado aqui: `sucesso false` + `exit 0` (é condição de alerta para RF07/Fase 5, não infra). Impacto: nenhum — coluna aceita ambos.
2. **URL pública não é gravada**: a pergunta "como o upload obtém a URL pública" se resolve por P4 + Fase 1 — bucket público ⇒ URL determinística `${SUPABASE_URL}/storage/v1/object/public/clipes/{caminho}`, e a tabela não tem coluna de URL (`fase-1-tasks.md:48-57`); a Action grava só `caminho`. **A Fase 7 monta a URL em `src/lib/clipes.ts`** — registrar lá; nenhuma mudança de schema.
3. **Semântica de `ordem` fixada** (promessa da divergência 3 da Fase 1): posição do clipe na listagem do slot, 1-based, vinda de `coletarClipes`. Ajuste futuro (timestamp do clipe, se o site expuser) é 1 linha na coleta.
4. **Playwright como `devDependency`** diverge do padrão atual do diretório (só `dependencies` até aqui) — deliberado e justificado na Task 2 (não é runtime de aplicação; sem efeito prático porque o diretório não faz publish/build).
5. **`validarSegredoFilmaeu` (Fase 2) é substituído** pelo parse real do JSON das credenciais na Task 6 — a Fase 2 já marcava o valor como "não usado nesta fase" (`fase-2-tasks.md:208-213`); o consumo real era o ponto de extensão previsto.
6. **Cache npm no workflow**: a Fase 2 adiava a decisão para "quando a Fase 3 trouxer Playwright" (`fase-2-tasks.md:374`) — feito na Task 2 (a instalação passa de segundos para dezenas com o download do Chromium em cache).
7. **`actions/upload-artifact@v4` é a primeira action de terceiros além de checkout/setup-node no repo** — action oficial do GitHub, mínima (`if: failure()`, `if-no-files-found: ignore`), justificada pelo RNF04 (debug de DOM sem reproduzir manualmente). Reversível junto com a Task 6.
8. **Nenhuma migration nesta fase**: tudo que o código usa (`clipes.caminho/size_bytes/ordem`, status `sem_clipes`, grants de service_role) já existe na interface da Fase 1 — confirmado contra `fase-1-tasks.md:48-95`. **Nenhuma incompatibilidade encontrada** com a interface da Fase 2 (pontos de extensão, assinatura de `fecharRegistroImportacao`, inputs do workflow).

## 9. Critérios de encerramento (do breakdown `:103`, refinados)

1. **Run de teste baixa e sobe os clipes de uma data real**: `workflow_dispatch` com data de partida real → clipes em `clipes/{partida_id}/` no bucket, abertos pela URL pública, com linhas em `clipes` (`size_bytes` real, `ordem` preenchida).
2. **Segunda execução da mesma data não rebaixa nem duplica**: log com `0 novos`, `count` da tabela inalterado, ledger reusado (uma linha ativa só).
3. **Ledger reflete sucesso com contagem**: `concluido`, `sucesso true`, `quantidade_clipes` e `bytes_total` coerentes com a tabela; falhas (`falha`, `sem_clipes`) também registradas corretamente.
4. Nenhum segredo no log da run (RNF02); PWA intocado (RNF01 — `build`/`lint` verdes); seletores isolados em `seletores.mjs` (RNF04).
5. 6 commits (Tasks 1–6), cada um revertível isoladamente; checklist da seção 5 completo.

## 10. NEEDS_CONTEXT

Nenhum. (P3, P4, P12 e RNF04 cobrem as escolhas estruturais. A pendência real — seletores reais do site — é pré-requisito documental do dono, tratado como Task 1 com plano B previsto no mapeamento; nenhuma decisão exige o orquestrador.)
