# 38 · Janela de horários reais na importação de clipes do Filma Eu — Plano de Implementação

> Plano de feature nova (fora do ranking anti-slop), no padrão do plano 37.
> Esforço estimado: M · Risco: médio (automação de site externo) · Prioridade: P1
> Aprovado pelo dono em 10/10/2026 (sessão de planejamento).

## 1. Objetivo

O racha não começa 19h em ponto nem termina 20h em ponto. Este plano permite que o
admin registre na **partida** o horário real de início e término do jogo (card admin no
detalhe da partida), e faz a importação de clipes — automática (cron de sexta 09h BRT) e
manual (painel Clipes) — considerar essa janela: navegar **todos os slots de hora
cobertos** (ex.: 19h **e** 20h) e baixar apenas os grupos de clipes cujo timestamp caia
dentro da janela. Sem horários definidos, mantém o comportamento atual (slot da partida
inteiro).

## 2. Estado atual (evidências verificadas em 10/10/2026)

- `partidas` só tem `data_jogo` (previsto, 19:00 BRT) — não existe horário real
  (`supabase/migrations/004_create_partidas.sql`; `src/lib/partidas.ts:22-29`).
- O 19:00 está fixo em 4 pontos: workflow (`.github/workflows/clipes-filmaeu.yml:19`),
  script (`scripts/clipes/importar-clipes.mjs:43`), RPC de disparo
  (`supabase/migrations/117_fix_timeout_disparar_importacao_clipes.sql:79`) e textos da
  UI (`src/components/SecaoDisparoClipes.tsx:4,30`, `src/routes/ClipesAdmin.tsx:112`,
  `src/lib/clipes.ts:115`).
- Partida resolvida por dia, ignorando a hora (`importar-clipes.mjs:103-129`); navegação
  de um único slot (`scripts/clipes/filmaeu/automacao.mjs:117-198`); coleta de TODOS os
  grupos do slot (`coletarClipes`, `automacao.mjs:200-235`); título do grupo =
  "horário da gravação" (`seletores.mjs:34`, `docs/filmaeu-mapeamento-dom.md` §2 —
  ex.: `19m39s`).
- Nome do arquivo `v_{titulo}_cam{n}.mp4` (`automacao.mjs:245-252`) — colidiria entre
  slots diferentes com títulos iguais (o título é offset dentro da hora).
- `PartidaDetalhe.tsx` já é admin-aware (`useAdmin`) e renderiza a grade de clipes
  (linha 246); `clipes` ordenam por `ordem` e `id` (`src/lib/clipes.ts:54-55`).

## 3. Pré-condições e dependências

- Nenhuma dependência de outros planos. Projeto Supabase: `jtavmrlllyctkuxefhpc`
  (MCP `supabase`, região sa-east-1).
- Decisões do dono já tomadas: horários reais inputados **no detalhe da partida**
  (card admin); parser do título aceita os dois formatos possíveis com log de calibração.
- A automação só é validável de verdade com credenciais do Filma Eu — a validação
  real fica para o dono (seção 5).

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Migration 120 + tipos gerados

Criar `supabase/migrations/120_horarios_reais_partida.sql`:

```sql
-- 120_horarios_reais_partida.sql
-- Plano 38: janela de horários reais do racha para a importação de clipes.
--inicio_real/fim_real são o horário REAL de início/término do jogo (BRT, mesmo dia
-- do data_jogo por construção na RPC); NULL = não informado (fallback: slot inteiro).

ALTER TABLE partidas
  ADD COLUMN inicio_real timestamptz,
  ADD COLUMN fim_real timestamptz;

-- Grava/limpa os horários reais. Recebe TIME (HH:MM) e combina com a data BRT do
-- data_jogo — mesmo dia garantido por construção. Padrão das RPCs admin (099):
-- SECURITY DEFINER + gate is_admin + EXECUTE amplo.
CREATE OR REPLACE FUNCTION salvar_horarios_reais_partida(
  p_admin_id   bigint,
  p_partida_id bigint,
  p_inicio     time,
  p_fim        time
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_data_brt date;
BEGIN
  -- 1) Gate is_admin (padrão 099:232-235)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- 2) Ambos preenchidos (salvar) ou ambos NULL (limpar)
  IF (p_inicio IS NULL) <> (p_fim IS NULL) THEN
    RAISE EXCEPTION 'Informe início e término juntos, ou limpe os dois.';
  END IF;

  -- 3) Partida existe? (mesmo SELECT resolve a data BRT do jogo)
  SELECT (data_jogo AT TIME ZONE 'America/Sao_Paulo')::date
    INTO v_data_brt
    FROM partidas
   WHERE id = p_partida_id;
  IF v_data_brt IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  -- 4) Grava ou limpa. date + time = timestamp sem fuso; o AT TIME ZONE interpreta
  --    como BRT e produz o timestamptz correto (Brasil sem DST, offset fixo -03).
  IF p_inicio IS NOT NULL THEN
    IF p_fim <= p_inicio THEN
      RAISE EXCEPTION 'O término precisa ser depois do início.';
    END IF;
    UPDATE partidas
       SET inicio_real = (v_data_brt + p_inicio) AT TIME ZONE 'America/Sao_Paulo',
           fim_real    = (v_data_brt + p_fim)    AT TIME ZONE 'America/Sao_Paulo'
     WHERE id = p_partida_id;
  ELSE
    UPDATE partidas
       SET inicio_real = NULL,
           fim_real    = NULL
     WHERE id = p_partida_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_horarios_reais_partida(bigint, bigint, time, time)
  TO anon, authenticated;

-- disparar_importacao_clipes: remove o input fixo horario='19:00' do dispatch.
-- A janela/slot passa a ser derivada da partida pela própria Action (Passo 5).
-- Cópia da 117 (timeout de coleta 2000 ms) com o payload sem 'horario'.
CREATE OR REPLACE FUNCTION disparar_importacao_clipes(
  p_admin_id bigint,
  p_data     date
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_pat      text;
  v_headers  jsonb;
BEGIN
  -- 1) Gate is_admin (padrão 099:232-235)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- 2) Validação leve do dia alvo (RF03: recuperar atraso/histórico — data passada)
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Data obrigatória (AAAA-MM-DD).';
  END IF;
  IF p_data > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Data não pode ser futura.';
  END IF;

  -- 3) PAT do Vault — leitura direta, padrão 099:242-245
  SELECT decrypted_secret INTO v_pat
    FROM vault.decrypted_secrets
   WHERE name = 'github_pat_clipes'
   LIMIT 1;

  IF v_pat IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_importacao_clipes', false, 'Secret github_pat_clipes não encontrado no vault.');
    RAISE EXCEPTION 'Secret github_pat_clipes não configurado no vault.';
  END IF;

  -- 4) Chamada à GitHub API workflow_dispatch. Sem input 'horario': a Action deriva
  --    o slot da partida (horários reais > hora do data_jogo). Fix 117 mantido.
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Accept', 'application/vnd.github+json',
    'Authorization', 'Bearer ' || v_pat,
    'X-GitHub-Api-Version', '2022-11-28'
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_importacao_clipes',
    'https://api.github.com/repos/rdias612/racha/actions/workflows/clipes-filmaeu.yml/dispatches',
    v_headers,
    jsonb_build_object(
      'ref', 'main',
      'inputs', jsonb_build_object('data', to_char(p_data, 'YYYY-MM-DD'))
    ),
    2000  -- cabe no statement_timeout de 3s do anon (padrão 104:16-20; fix 117)
  );

  RETURN true;
END;
$$;

-- Padrão das RPCs admin (099:585): EXECUTE amplo + gate is_admin interno.
GRANT EXECUTE ON FUNCTION disparar_importacao_clipes(bigint, date) TO anon, authenticated;
```

Aplicar via MCP Supabase (`apply_migration`, projeto `jtavmrlllyctkuxefhpc`) e
regenerar `src/lib/database.types.ts` (`generate_typescript_types`), sobrescrevendo o
arquivo. Se a saída do MCP vier truncada/ilegível, alternativa cirúrgica: acrescentar
na mão `inicio_real`/`fim_real` (`string | null`) no Row de `partidas` e a assinatura de
`salvar_horarios_reais_partida` em `Functions` — registrando a decisão no reporte.

Commit: `Adicionar horários reais da partida e dispatch sem slot fixo (migration 120)`.

### Passo 2 — Lib frontend

- `src/lib/partidas.ts`: interface `Partida` e o select de `carregarPartida` (linha 73)
  ganham `inicio_real: string | null` e `fim_real: string | null`.
- Nova função na mesma lib (padrão das wrappers de RPC existentes):

```ts
// Admin grava/limpa os horários reais do jogo (HH:MM BRT); null em ambos limpa.
export async function salvarHorariosReaisPartida(
  partidaId: number,
  adminId: number,
  inicio: string | null,
  fim: string | null
) {
  const { data, error } = await supabase.rpc('salvar_horarios_reais_partida', {
    p_admin_id: adminId,
    p_partida_id: partidaId,
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw error;
  return data as boolean;
}
```

- Atualizar o comentário de `src/lib/clipes.ts:115` (a RPC não fixa mais 19:00 — o
  slot vem da partida).

Commit: `Expor horários reais da partida na lib do frontend`.

### Passo 3 — Card admin no detalhe da partida

- `src/lib/formatacao.ts`: novo helper `horarioBRTDeIso(iso: string): string` →
  `'HH:MM'` em BRT (deslocar +3h e ler campos UTC — Brasil sem DST, padrão fixo -03).
- Novo `src/components/SecaoHorariosReaisPartida.tsx`, padrão visual da
  `SecaoDisparoClipes` (section + h3 `font-display uppercase` + inputs `font-mono`):
  - Props: `{ partida: Partida; onAtualizar: () => void }`; usa `useJogadorLogado()`
    para o `admin_id`.
  - Dois `<input type="time">` pré-preenchidos com `horarioBRTDeIso` dos valores atuais.
  - Botões `Botao` "Salvar" e "Limpar" (Limpar só quando há valores gravados).
  - Validação client: ambos preenchidos e `fim > início` (mesma regra da RPC);
    erro inline no card.
  - Ao salvar/limpar com sucesso: chama `onAtualizar()` (recarrega a partida).
- `src/routes/PartidaDetalhe.tsx`: renderizar o card quando `isAdmin`, para qualquer
  status, imediatamente ANTES de `{clipes.length > 0 && <GradeClipesPartida .../>}`
  (linha 246). `onAtualizar={() => carregar()}`.

Commit: `Card admin de horários reais no detalhe da partida`.

### Passo 4 — Refactor da automação (sem mudança de comportamento)

- `scripts/clipes/filmaeu/automacao.mjs`: extrair de `navegarParaSlot` a parte final
  (clique no slot + espera do primeiro `.card-videos`) como
  `export async function selecionarSlot(page, horario)` → retorna `page` ou `null`
  quando o slot não é ofertado (comportamento atual, linhas 176-196).
  `navegarParaSlot` passa a chamar `selecionarSlot` no final. Necessário porque os
  slots seguintes são abertos apenas com o clique na lista de horários (a página
  permanece em `/perfil#` — mapeamento §1).
- Gate: `node --check scripts/clipes/filmaeu/automacao.mjs` +
  `node --check scripts/clipes/importar-clipes.mjs`.

Commit: `Extrair selecionarSlot da navegação da automação`.

### Passo 5 — Janela no orquestrador (núcleo da feature)

`scripts/clipes/importar-clipes.mjs`:

1. `buscarPartidaAlvo` passa a selecionar `inicio_real, fim_real` também (nos dois
   ramos, `partida_id` e por data) e a devolvê-los no objeto partida.
2. Data de navegação no site = data BRT de `partida.data_jogo`
   (`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`, padrão de
   `resolverDataAlvo`) — `dataAlvo` continua só para lookup/ledger. Isso também corrige
   um mismatch latente do caminho `partida_id` com `data` divergente.
3. Nova função `resolverPlanoDeSlots({ horarioInput, partida })`:
   - `horarioInput` preenchido → **override manual**: `{ slots: [horarioInput], janela: null }`
     (escape hatch pelo dispatch do GitHub UI — comportamento atual).
   - partida com `inicio_real` + `fim_real` → **janela**: `slots` = horas BRT de
     `hour(inicio_real)` a `hour(fim_real)` (inclusivas; a RPC garante mesmo dia),
     `janela = { inicio: Date.parse(inicio_real), fim: Date.parse(fim_real) }` (epoch ms).
   - senão → **fallback**: `slots = [hora BRT de data_jogo]`, `janela = null`.
   - Helpers BRT com offset fixo -03:00 (padrão 060:7): para ISO timestamptz,
     deslocar +3h e ler campos UTC; epoch do slot =
     `Date.parse(`${dataISO}T${HH}:00:00-03:00`)`.
4. Loop por slot em `importarClipesDaPartida`:
   - `selecionarSlot(page, horario)` → `coletarClipes(page)` → filtrar pela janela →
     `baixarClipes` (locators são por página: coleta e download por slot).
   - Slot 0 ausente → lista vazia → `sem_clipes` (comportamento atual). Slots seguintes
     ausentes → log e segue (condição esperada: pode não haver gravação da hora seguinte).
   - Sem janela: lista integral de cada slot (comportamento atual no fallback/override).
5. Parser do título (`parsearTimestampTitulo(titulo)` em `automacao.mjs`, exportada):
   - `^(\d{1,2})m(\d{2})s$` → `{ offsetSeg }` (offset dentro da hora do slot);
   - fallback `^(\d{1,2})[h:](\d{2})$` → `{ hora, minuto }` (relógio);
   - sem match → `null`. Logar TODOS os títulos coletados por slot (calibração da
     primeira run real).
   - Epoch do grupo: offset → `epochSlot + offsetSeg * 1000`; relógio →
     `Date.parse(`${dataISO}T${HH}:${MM}:00-03:00`)`. Mantém o grupo se
     `janela.inicio <= epoch <= janela.fim`.
   - Título não parseável: **mantém** no slot 0 (comportamento atual do slot principal),
     **exclui** nos slots seguintes (não invadir a gravação de outro grupo) — log em ambos.
6. Nomeclatura de arquivo: slot 0 mantém `v_{titulo}_cam{n}.mp4` (idempotência com todo
   o histórico); slots seguintes usam `v_{HH}h_{titulo}_cam{n}.mp4` (ex.:
   `v_20h_15m00s_cam1.mp4`) — elimina colisão de títulos iguais entre horas.
   Implementação: `baixarClipes(page, lista, { dirTemp, caminhosPendentes, prefixoNome })`
   com `prefixoNome = ''` no slot 0 e `'20h_'` nos seguintes (interno em
   `nomeArquivoDoClipe`).
7. `ordem` renumerada de forma global pelo orquestrador (acumulador entre slots),
   mantendo a ordenação cronológica da grade.
8. `detalhe` do ledger ao fechar registra a janela: ex.
   `2 novos, 10 totais; janela 19:07–20:04 (slots 19h+20h)` /
   `slot 19h (sem horários reais)` / `override slot 18:00`.
9. Config: `INPUT_HORARIO` vazio é válido (default `''`); validação HH:MM só quando
   preenchido.

Gates: `node --check` nos três .mjs + `npm run build` + `npm run lint`.

Commit: `Importar clipes pela janela de horários reais da partida`.

### Passo 6 — Workflow e textos da UI

- `.github/workflows/clipes-filmaeu.yml`: input `horario` com `default: ''` e descrição
  `Slot base no Filma Eu (HH:MM). Vazio = deriva da partida (horários reais ou hora do data_jogo).`
  (a validação de vazio/preenchido já é do script, Passo 5.9).
- `src/components/SecaoDisparoClipes.tsx`: remover o comentário da linha 4 e ajustar o
  texto da linha 30 — ex.: "Baixa os clipes do dia informado no Filma Eu — usando os
  horários reais da partida quando definidos — e os publica na partida correspondente."
- `src/routes/ClipesAdmin.tsx:112`: mensagem do `ConfirmDialog` sem "slot 19h" — ex.:
  `Disparar a importação dos clipes do dia ${data} no GitHub Actions? (usa os horários
  reais da partida, quando definidos)`.

Commit: `Derivar horário do workflow da partida e revisar textos de clipes`.

### Passo 7 — Adendos de documentação

- `docs/requisito-clipes-filmaeu.md`: adendo "Plano 38 — janela de horários reais"
  (RF novo: RF10 horários reais; comportamento de fallback; override por input).
- `docs/filmaeu-mapeamento-dom.md`: nota no §2 sobre a interpretação dos títulos dos
  grupos (offset dentro da hora vs relógio) e o log de calibração.

Commit: `Documentar janela de horários reais nos docs de clipes`.

## 5. Validação manual (dono — pendente por definição)

- Definir horários reais numa partida com clipes conhecidos → disparar importação
  manual → conferir no histórico/ledger a janela usada e os clipes importados
  (incluindo os do slot seguinte dentro da janela).
- Re-disparar sem alterar nada → 0 novos downloads (idempotência preservada).
- Disparar sem horários definidos → slot da partida inteiro (comportamento atual).
- Card admin: salvar/limpar/validação fim > início; não-admin não vê o card.
- Primeira run real: conferir no log da Action os títulos coletados/parseados por slot.

## 6. Fora de escopo

- Editar `data_jogo` (horário previsto) no frontend.
- Mudar cron, quadra ou suportar múltiplas partidas por dia.
- Filtrar por conteúdo/duração dos clipes (só o timestamp do grupo).
- Testes automáticos (AGENTS.md) e renomeação retroativa de arquivos do bucket.

## 7. Riscos e rollback

- **Semântica do título incerta** → parser aceita os dois formatos + log de calibração;
  ajuste fica isolado numa função única (`parsearTimestampTitulo`).
- **Site do Filma Eu mudar** → já coberto por `ErroFilmaeu` + screenshot de debug.
- **Nomeclatura nova** → slot 0 mantém o formato antigo, então o histórico permanece
  idempotente; reimportação após editar horários não duplica clipes do slot principal.
- **Janela entre a migration (Passo 1) e o script (Passo 5)** → a RPC passa a não enviar
  `horario`; o YAML ainda tem default `19:00` até o Passo 6 e o script atual faz
  `INPUT_HORARIO || '19:00'` — comportamento inalterado no intervalo.
- Rollback: cada passo revertível por `git revert` isolado; a migration é reversível
  (DROP COLUMN — perde apenas os horários salvos, dados operacionais).
