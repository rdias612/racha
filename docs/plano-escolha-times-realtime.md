# Plano — Escolha de Times em Tempo Real (Draft ao Vivo com Capitães)

> **Status**: plano de implementação (nada implementado ainda). **v4** — v2 incorporou as correções das revisões técnica e de UX (mapeamento em §15); v3 incorporou as decisões do usuário de 25/09/2026 (capitães definidos pelo admin, sem timeout/substituição automática, **push em 2 eventos** — detalhado no §10); v4 incorpora a decisão do usuário (30/09/2026): **sem confirmação de "estou online"** — ao disparar a divisão, o admin já inicia o draft em andamento.
> **Funcionalidade**: dois capitães escolhem os times da semana ao vivo, no formato snake 1-2-2-2-…-2-1, a partir dos confirmados de linha (goleiros fora). Resultado final preenche os mesmos times que a tela de escalação já usa.

---

## 1. Contexto (estado real do código hoje)

- **Tela única de escalação**: `src/routes/PartidaTimes.tsx` (rota `/partida/:id/times`, declarada em `src/App.tsx:57`). Somente admin (`useAdmin()`, `PartidaTimes.tsx:140`). Carrega participantes, filtra confirmados de linha (`status_confirmacao === 'confirmado' && posicao !== 'goleiro'`, `PartidaTimes.tsx:63-67`) e salva via RPC `salvar_times_e_goleiros_partida` (`src/lib/partidas.ts:452-468`), que grava `partidas_participantes.time` e faz upsert dos 2 goleiros.
- **Persistência dos times**: não há tabela de times — o "time" é a coluna `partidas_participantes.time` (`char(1)` 'a'/'b', migrations 004/005). PK composta `(partida_id, jogador_id)`.
- **Confirmação**: RPC `confirmar_presenca` (migrations 057 → 100), capacidade 14 de linha via `capacidade_partida()` (migration 100). Só `status='confirmado'` ocupa vaga. **Importante para este plano**: `confirmar_presenca` continua funcionando enquanto `partidas.status='draft'` — ou seja, o pool do draft pode mudar durante a escolha (jogador desiste ou é removido; a remoção é DELETE direto via REST, `removerParticipanteDraft`, `src/lib/partidas.ts:407-410`).
- **Goleiros**: fora do pool de linha; escalados à parte nos seletores de `PartidaTimes` (RPC `criar_goleiro_rapido`, migration 083).
- **Identidade**: o app **não usa Supabase Auth** — login é a RPC `fazer_login` com sessão em `localStorage` (`racha_sessao`, `src/context/SessaoContext.tsx`). O cliente usa a **anon key** (`src/lib/supabase.ts`, `persistSession: false`). Autorização sensível é gate **dentro das RPCs** (`p_admin_id` + `is_admin`, padrão corrigido na migration 091). Não há RLS/privilégios por usuário (baseline da migration 016).
- **Realtime**: **zero uso hoje** (`grep .channel(` em `src/` = 0 resultados). Esta é a primeira feature realtime do app — o mecanismo vira precedente.
- **Push**: pipeline pesado (ledger `push_reminder_deliveries`, buckets, Edge Functions, `notificacoes_config`) — ver §10.
- **Migrations**: última aplicada é `108_username_regra_unica.sql`; a próxima livre é **109**.
- **Conflito de numeração**: `plano-palpites.md` (plano NÃO implementado) diz "próxima migration livre: 108", mas 108 já foi consumida por `108_username_regra_unica.sql`. Este plano usa **109**; se o palpites for implementado depois, ele deve se renumerar (ex.: 110+) e ajustar a migration que ele chama de `108_palpites_bolao.sql`. Prioridade: estado real da pasta `supabase/migrations/`.
- **Agregação de notas**: RPC `obter_medias_notas_jogadores` (migration 070, wrapper em `src/lib/jogadores.ts:252`) já expõe a média aparada por jogador — usada pela tela `/times` para renderizar `X.X★` por linha (`EscalacaoTimesEditor.tsx:403-408`).
- Convenções obrigatórias (DESIGN.md §7, §9): zero UUID (bigint/bigserial), migrations `XXX_nome.sql`, RPCs `SECURITY DEFINER SET search_path = public` + `GRANT EXECUTE ... TO anon, authenticated`, nomes em português, agregação no Postgres, tokens semânticos, alvos ≥ 44px, `voltar()` nos retornos, `formatarMensagemErro` nos catch, sem `window.confirm`.

---

## 2. Decisões-chave (resumo)

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| Fonte da verdade do draft | Tabelas Postgres (`partida_drafts` + `partida_draft_picks`) | Cada pick é uma linha transacional; auditável; cancelamento sem efeito colateral |
| Mecanismo "tempo real" | **Supabase Realtime `postgres_changes`** nas duas tabelas + revalidação por RPC completa | Autoritativo, sem nova infra; conexão instável é coberta por revalidação (evento ≠ fonte da verdade) |
| Broadcast / Presence | **Não usar** | Broadcast não persiste (pick perdido = inconsistência) e exige refetch anyway; presence é efêmero e não sobrevive a refresh — e o "estou online" deixou de existir (v4: sem confirmação) |
| Escrita dos times no final | `partidas_participantes.time` só é gravado quando o draft **conclui** | Cancelar/refazer draft fica sem side effects; editor `/times` continua sendo o fallback do admin |
| Integração com `/times` | Draft apenas preenche `partidas_participantes.time`; goleiros seguem no fluxo existente | Não duplica nada; `PartidaTimes` já pré-carrega `part.time` (`PartidaTimes.tsx:114-125`) |
| Quem define capitães | Admin inicia o draft escolhendo os 2 capitães (**decidido pelo usuário, §13 Q1**) | Alinha com arquitetura admin-driven e evita corrida/abuso de auto-reivindicação |
| Quem começa **e quem é qual cor** | Dois sorteios independentes no servidor ao iniciar: `primeira_escolha` (moeda) e qual capitão cai no slot 'a' (Preto) | A ordem em que o admin seleciona os capitães na UI não decide mais a cor involuntariamente; o anúncio da moeda é pelo nome ("Cara ou coroa: FULANO começa") |
| Conclusão do draft | Helper interno `tentar_concluir_draft(partida_id)` extraído ao fim de `registrar_pick_draft` | O pool pode esvaziar fora de um pick (desistência/remoção durante o status draft); conclusão é um bloco coeso, separado da transação de pick por legibilidade |
| Confirmação de escolha | **Dois toques**: 1º seleciona a linha do pool, 2º confirma em barra fixa inferior com o nome ("Escolher FULANO"), reusando `BarraAcaoInferior` | Pick é irreversível; mis-tap tem custo social alto (só se recupera cancelando o draft na frente de todos). Padrão já usado em `EscalacaoTimesEditor.tsx:454` |
| Push | **Sim, 2 eventos discretos** (**decidido pelo usuário, §13 Q6**): abertura (capitães definidos, no ato do `iniciar_draft`) e conclusão (times fechados), no molde da migration 107 | Eventos de estado, não sinal de vez ao vivo — encaixam no pipeline de lembretes existente (ledger/config/edge). Push por pick/vez segue fora (latência não determinística; todos estarão com o app aberto) |
| Vez do capitão | Função pura do nº de picks: `vez(k)` — sem sequência armazenada | Prefixo estável mesmo se o pool encolher/crescer no meio (ver §3.2) |

---

## 3. Modelo de dados — Migration `109_draft_times_ao_vivo.sql`

### 3.1 Tabelas

```sql
-- 109_draft_times_ao_vivo.sql
-- Draft ao vivo de escolha de times: 2 capitães entre os confirmados de linha
-- escolhem em snake 1-2-2-...-2-1. Um draft por partida (PK partida_id);
-- reiniciar = upsert resetando campos + limpando picks.

CREATE TABLE partida_drafts (
  partida_id         bigint PRIMARY KEY REFERENCES partidas(id) ON DELETE CASCADE,
  capitao_a_id       bigint NOT NULL REFERENCES jogadores(id),
  capitao_b_id       bigint NOT NULL REFERENCES jogadores(id),
  primeira_escolha   char(1) NOT NULL CHECK (primeira_escolha IN ('a','b')),
  status             text NOT NULL DEFAULT 'em_andamento'
                     CHECK (status IN ('em_andamento','concluido','cancelado')),
  criado_por         bigint NOT NULL REFERENCES jogadores(id),
  iniciado_em        timestamptz,
  concluido_em       timestamptz,
  cancelado_em       timestamptz,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partida_drafts_capitaes_distintos CHECK (capitao_a_id <> capitao_b_id)
);

-- Uma linha por escolha feita. `time` é o time DESTINO do jogador escolhido
-- (denormalizado do slot do capitão que pickou — fica estável mesmo se o
-- capitão for substituído no meio; ver §8).
CREATE TABLE partida_draft_picks (
  id          bigserial PRIMARY KEY,
  partida_id  bigint NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  ordem       integer NOT NULL CHECK (ordem >= 1),
  time        char(1) NOT NULL CHECK (time IN ('a','b')),
  capitao_id  bigint NOT NULL REFERENCES jogadores(id),
  jogador_id  bigint NOT NULL REFERENCES jogadores(id),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partida_id, ordem),      -- blinda corrida de ordem
  UNIQUE (partida_id, jogador_id)  -- jogador só é escolhido uma vez
);

-- Sem indexes extras: os dois UNIQUE acima já atendem por (partida_id, ...)
-- todo acesso deste plano (lock, contagem, board); um índice só em
-- (partida_id) duplicaria o prefixo, e status da partida é uniqueness-1
-- (uma linha por partida) — filtro por status não se paga.

-- Realtime: expõe as duas tabelas no WAL (primeira usage do app).
-- REPLICA IDENTITY FULL em picks: o filtro realtime `partida_id=eq.X` precisa
-- bater contra o registro "old" dos eventos DELETE, e com a identidade
-- DEFAULT o old carrega apenas a PK (id) — o DELETE não casaria o filtro.
ALTER TABLE partida_draft_picks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partida_drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partida_draft_picks;

-- RLS não é habilitada — mesma postura de leitura aberta do baseline (016).
-- SELECT é concedido porque o Realtime autoriza o assinante de postgres_changes
-- pelo privilégio de leitura do papel (sem ele, a inscrição ocorre mas NENHUM
-- evento é entregue). Escrita continua só via RPC SECURITY DEFINER.
GRANT SELECT ON partida_drafts, partida_draft_picks TO anon, authenticated;
```

Notas:

- `ON DELETE CASCADE` em `partida_id` nas duas: excluir a partida (`excluir_partida`, migration 066) varre o draft junto.
- Não há histórico de drafts abortados: "refazer" reseta a mesma linha (YAGNI — pelada semanal, não é preciso auditoria de tentativas).
- **Sem `GRANT INSERT/UPDATE/DELETE`** nas tabelas de draft: toda escrita passa pelas RPCs `SECURITY DEFINER` (§9).

### 3.2 Helper interno da vez (sem GRANT — mesmo padrão de `capacidade_partida()`, migration 100)

```sql
-- Vez do k-ésimo pick (k = nº de picks já feitos, 0-based), em snake
-- 1-2-2-...-2-1 começando por `p_primeira`:
--   bloco(k) = (k + 1) / 2  (divisão inteira)
--   bloco par  -> primeira_escolha; bloco ímpar -> o outro.
-- k=0 -> 1o escolhe 1 | k=1,2 -> 2o escolhe 2 | k=3,4 -> 1o escolhe 2 | ...
-- O último bloco trunca sozinho quando o pool esvazia (não precisa de R).
CREATE OR REPLACE FUNCTION vez_escolha_draft(p_k integer, p_primeira char(1))
RETURNS char(1)
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN (((p_k + 1) / 2) % 2) = 0
         THEN p_primeira
         ELSE (CASE WHEN p_primeira = 'a' THEN 'b' ELSE 'a' END)
         END;
$$;
```

Verificação com 14 confirmados (12 picks, primeira = 'a'): `a,b,b,a,a,b,b,a,a,b,b,a` → time A = 1 capitão + 6 picks = 7; time B = 1 + 6 = 7. O último jogador sozinho (k=11) cai para o capitão que começou — exatamente "sobra um último para o último capitão a escolher".

**Simulação da vez por tamanho do pool** (pool = confirmados de linha − 2 capitães; sequência com `primeira='a'`, time A/B contam capitão + picks):

| Pool (picks) | Blocos | Sequência da vez | Time A | Time B | \|A−B\| |
| --- | --- | --- | --- | --- | --- |
| 2 | 1-1 | `a, b` | 2 | 2 | 0 |
| 3 | 1-2 | `a, b, b` | 2 | 3 | 1 |
| 11 | 1-2-2-2-2-2 | `a, b,b, a,a, b,b, a,a, b,b` | 6 | 7 | 1 |
| 12 | 1-2-2-2-2-2-1 (literal) | `a, b,b, a,a, b,b, a,a, b,b, a` | 7 | 7 | 0 |
| 13 | 1-2-2-2-2-2-2 | `a, b,b, a,a, b,b, a,a, b,b, a,a` | 8 | 7 | 1 |

A sequência idealizada "1-2-…-2-1" só é **literal** quando o pool é múltiplo de 4 (pool ≡ 0 mod 4, ex.: 4, 8, 12): nesse caso o bloco final fecha com exatamente 1 pick, espelhando o início. Nos demais casos a sequência simplesmente termina onde o pool acaba — o último bloco trunca de 2 para 1 (ex.: pool 10 → `1-2-2-2-2-1`) ou o corte cai ao fim de um bloco cheio (ex.: pool 11 e 13) — mantendo sempre a diferença entre os times em no máximo 1.

**Propriedade que salva os edge cases**: a sequência de blocos é prefixo-estável. Se o pool encolhe (jogador desiste) ou cresce (admin adiciona avulso) no meio do draft, apenas o último bloco muda de tamanho — os picks históricos e as próximas vezes continuam idênticos. Nada precisa ser recalculado.

### 3.3 Helper interno de conclusão (sem GRANT — mesmo padrão de `capacidade_partida()`)

```sql
-- Conclui o draft SE ele está em_andamento E o pool escolhível esvaziou,
-- persistindo os times no MESMO formato existente. Extraído do corpo da
-- registrar_pick_draft (chamador único): a conclusão pesada (2 UPDATEs +
-- push) fora do corpo mantém a transação crítica legível.
CREATE OR REPLACE FUNCTION tentar_concluir_draft(p_partida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d partida_drafts%ROWTYPE;
BEGIN
  SELECT * INTO d FROM partida_drafts
   WHERE partida_id = p_partida_id
     AND status = 'em_andamento'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Ainda existe pool escolhível? Não há o que concluir.
  IF EXISTS (
    SELECT 1 FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.status_confirmacao = 'confirmado'
      AND pp.posicao <> 'goleiro'
      AND pp.jogador_id NOT IN (d.capitao_a_id, d.capitao_b_id)
      AND NOT EXISTS (SELECT 1 FROM partida_draft_picks dp
                       WHERE dp.partida_id = p_partida_id
                         AND dp.jogador_id = pp.jogador_id)
  ) THEN
    RETURN;
  END IF;

  UPDATE partida_drafts
     SET status = 'concluido', concluido_em = now()
   WHERE partida_id = p_partida_id;

  UPDATE partidas_participantes pp
     SET time = 'a'
   WHERE pp.partida_id = p_partida_id
     AND pp.status_confirmacao = 'confirmado'
     AND pp.posicao <> 'goleiro'
     AND (pp.jogador_id = d.capitao_a_id
          OR EXISTS (SELECT 1 FROM partida_draft_picks dp
                      WHERE dp.partida_id = p_partida_id
                        AND dp.jogador_id = pp.jogador_id
                        AND dp.time = 'a'));

  UPDATE partidas_participantes pp
     SET time = 'b'
   WHERE pp.partida_id = p_partida_id
     AND pp.status_confirmacao = 'confirmado'
     AND pp.posicao <> 'goleiro'
     AND (pp.jogador_id = d.capitao_b_id
          OR EXISTS (SELECT 1 FROM partida_draft_picks dp
                      WHERE dp.partida_id = p_partida_id
                        AND dp.jogador_id = pp.jogador_id
                        AND dp.time = 'b'));

  -- Push "times fechados" (decisão do usuário, §10): best-effort — falha
  -- de push NUNCA derruba o pick/conclusão (vira linha em cron_execucoes).
  PERFORM disparar_push_draft(p_partida_id, 'conclusao');
END;
$$;
```

> **Nota v3**: `disparar_push_draft` (§10.3) é fire-and-forget (`net.http_post` enfileirado, envio pós-commit — se a transação do pick sofrer rollback, o push não sai, que é o correto). Sem coleta bloqueante de 2s: este helper roda dentro da transação de `registrar_pick_draft` (capitão anon, `statement_timeout` 3s) e a coleta da 107 aqui custaria o timeout.

---

## 4. RPCs (contratos)

Todas com `SECURITY DEFINER SET search_path = public` + `GRANT EXECUTE ... TO anon, authenticated`. Gates de admin seguem o padrão da migration 091 (**rejeitar `p_admin_id IS NULL`**, nunca o contrário).

### 4.1 `iniciar_draft(p_admin_id, p_partida_id, p_capitao_1_id, p_capitao_2_id) -> boolean`

1. Gate admin (`p_admin_id IS NULL OR NOT is_admin` → `RAISE EXCEPTION`).
2. Partida existe e `status = 'draft'`.
3. Capitães distintos e ambos participantes `status_confirmacao='confirmado' AND posicao <> 'goleiro'` (híbridos de linha valem — mesmo filtro de `PartidaTimes.tsx:63-67`). Os parâmetros são **simétricos** (1º/2º não carregam significado de cor).
4. **Pool escolhível ≥ 1**: existe ao menos um confirmado de linha que não é nenhum dos dois capitães. Sem isso o draft nasceria morto (nenhum pick possível). O piso prático recomendado é N ≥ 4 confirmados de linha (Q7, §13) — enforced pela UI (§7); o RPC trava só o caso degenerado de pool 0, retornando `false`.
5. **Dois sorteios independentes no servidor**: (a) qual capitão cai no slot 'a' (Preto) — elimina a decisão involuntária de cor pela ordem dos seletores; (b) `primeira_escolha` (moeda). `criado_por = p_admin_id`.
6. Upsert em `partida_drafts`: zera `concluido_em`/`cancelado_em`, `status='em_andamento'`, `iniciado_em=now()`, sorteios acima.
7. `DELETE FROM partida_draft_picks WHERE partida_id = p_partida_id` (permite refazer).
8. Dispara o push de abertura: `PERFORM disparar_push_draft(p_partida_id, 'abertura')` (§10.3 — best-effort; falha vira linha em `cron_execucoes`, nunca exceção para o admin).
9. Retorna `true`.

### 4.2 `registrar_pick_draft(p_partida_id, p_capitao_id, p_jogador_id) -> boolean` (a transação crítica)

```sql
CREATE OR REPLACE FUNCTION registrar_pick_draft(
  p_partida_id bigint,
  p_capitao_id bigint,
  p_jogador_id bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d          partida_drafts%ROWTYPE;
  v_k        bigint;
  v_vez      char(1);
BEGIN
  -- 1) Lock de linha: serializa picks concorrentes (2 tabs, 2 requests)
  SELECT * INTO d FROM partida_drafts
   WHERE partida_id = p_partida_id
   FOR UPDATE;
  IF NOT FOUND OR d.status <> 'em_andamento' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM partidas WHERE id = p_partida_id AND status = 'draft') THEN
    RETURN false;
  END IF;

  -- 2) Só o capitão da vez, que precisa seguir confirmado de linha
  -- (capitão que recusou presença ou foi removido no meio do draft não picka;
  -- a vez segue roteando para o slot até o admin substituir — §8)
  IF NOT EXISTS (
    SELECT 1 FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id = p_capitao_id
      AND pp.status_confirmacao = 'confirmado'
      AND pp.posicao <> 'goleiro'
  ) THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_k FROM partida_draft_picks WHERE partida_id = p_partida_id;
  v_vez := vez_escolha_draft(v_k, d.primeira_escolha);
  IF (v_vez = 'a' AND p_capitao_id <> d.capitao_a_id)
     OR (v_vez = 'b' AND p_capitao_id <> d.capitao_b_id) THEN
    RETURN false;
  END IF;

  -- 3) Alvo disponível: confirmado de linha, não capitão, ainda não escolhido
  IF NOT EXISTS (
    SELECT 1 FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id = p_jogador_id
      AND pp.status_confirmacao = 'confirmado'
      AND pp.posicao <> 'goleiro'
      AND pp.jogador_id NOT IN (d.capitao_a_id, d.capitao_b_id)
      AND NOT EXISTS (SELECT 1 FROM partida_draft_picks dp
                       WHERE dp.partida_id = p_partida_id
                         AND dp.jogador_id = pp.jogador_id)
  ) THEN
    RETURN false;
  END IF;

  -- 4) Registra o pick (UNIQUEs da tabela são o cinto de segurança do lock)
  INSERT INTO partida_draft_picks (partida_id, ordem, time, capitao_id, jogador_id)
  VALUES (p_partida_id, v_k + 1, v_vez, p_capitao_id, p_jogador_id);

  -- 5) Pool esvaziou -> conclui e persiste os times (helper do §3.3)
  PERFORM tentar_concluir_draft(p_partida_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_pick_draft(bigint, bigint, bigint) TO anon, authenticated;
```

Por que isso cobre os requisitos do pedido:

- **Só o capitão da vez picka** (passo 2) — validado no servidor, não no client. E o capitão da vez precisa **seguir confirmado de linha**: um capitão que recusou presença ou foi removido durante o draft é recusado (o admin o substitui — §8).
- **Jogador escolhido ainda disponível** (passo 3) — confirmado de linha, não capitão, não escolhido.
- **Sem corrida** (passos 1 + UNIQUEs) — `FOR UPDATE` serializa; o segundo request reconta `v_k` depois do lock e vê a vez/atualização do pool já commitadas.
- **Goleiros não contam** — `posicao <> 'goleiro'` em todo lugar (mesmo critério da tela de times).
- **Resultado no formato existente** — grava `partidas_participantes.time`, exatamente o que `salvar_times_e_goleiros_partida` (migrations 082/083/093) e `PartidaTimes` leem/escrevem.
- Se um jogador **recusou depois de ser pickado**, o `UPDATE` do helper simplesmente o pula (filtro `status_confirmacao='confirmado'`): o draft conclui com time menor e o admin completa em `/times` (sinalizado na UI, §7).

### 4.3 `substituir_capitao_draft(p_admin_id, p_partida_id, p_slot, p_novo_capitao_id) -> boolean`

1. Gate admin; draft em `em_andamento`.
2. `p_slot ∈ ('a','b')`; novo capitão: confirmado de linha, ≠ outro capitão, **não pickado**.
3. Atualiza o slot; o andamento segue (o novo herda a vez quando for).
4. O capitão antigo volta ao pool automaticamente (nunca foi pickado).
5. Os picks passados não mudam: `time` está gravado por pick, não derivado do capitão.

Na UI, esta RPC também é o atalho oferecido ao admin no aviso de inatividade do capitão da vez (§7).

### 4.4 `cancelar_draft(p_admin_id, p_partida_id) -> boolean`

Gate admin; só se `status = 'em_andamento'` (draft concluído já gravou times — desfazer é pela tela `/times`). Marca `status='cancelado'`, `cancelado_em=now()`. Zero efeitos em `partidas_participantes`.

### 4.5 `obter_estado_draft(p_partida_id) -> jsonb` (leitura, `STABLE`)

Fonte única do estado para todas as telas — uma viagem só, agregação no Postgres (DESIGN §7.5). Retorna:

```jsonc
{
  "existe": true,
  "status": "em_andamento",          // em_andamento | concluido | cancelado
  "primeira_escolha": "a",
  "capitao_a": { "id": 3, "username": "joao", "online": true },
  "capitao_b": { "id": 7, "username": "pedro", "online": false },
  "picks": [ { "ordem": 1, "time": "a", "jogador_id": 9, "username": "tiago" } ],
  "pool": [ { "jogador_id": 12, "username": "lucas", "posicao": "meia", "media_nota": 6.4 } ],
  "vez": "b",                         // char(1) | null quando não está em_andamento
  "ultima_escolha_em": "2026-09-24T23:31:02Z",  // max(picks.criado_em) | iniciado_em | null
  "tamanho_time_a": 4, "tamanho_time_b": 3      // capitão + picks (contagem derivada)
}
```

- `vez = vez_escolha_draft(count(picks), primeira_escolha)` quando `em_andamento`.
- `pool[].media_nota` via `LEFT JOIN obter_medias_notas_jogadores()` (migration 070 — a agregação já existe): dá ao capitão a mesma informação da tela `/times`. Sem notas recebidas → `null`; o client aplica o default `6.0` e renderiza o mesmo `X.X★` de `EscalacaoTimesEditor.tsx:403-408`.
- `ultima_escolha_em` alimenta o aviso de inatividade do banner de vez (§7): `coalesce(max(picks.criado_em), iniciado_em)`.

---

## 5. Tempo real — avaliação e recomendação

### 5.1 Alternativas

| Opção | Prós | Contras |
| --- | --- | --- |
| **A. Realtime `postgres_changes`** (recomendada) | Sem infra nova (já no Supabase); eventos derivam do dado autoritativo; latência típica 100-500 ms; gratuito na escala do app (≤ ~20 clientes por ~5 min) | Primeira usage (precedente a documentar); eventos podem se perder em desconexão — por isso NÃO são a fonte da verdade |
| B. Broadcast (canal) | Latência mínima | Não persiste: pick perdido em desconexão = estado inconsistente; qualquer cliente anon pode broadcastar (spoof visual); exigiria refetch de qualquer forma — caminho duplo, complexidade |
| C. Presence para "capitão online" | Nativo | Efêmero: refresh do browser marcaria offline; não sobrevive a reconexão — o requisito é confirmar e registrar, não detectar |
| D. Polling puro | Simples e resiliente | Latência de intervalo; custo de rede repetido; "tempo real" de verdade fica pior para o espectador |

### 5.2 Padrão escolhido: "DB é a verdade, evento é sino"

Cada evento realtime é apenas um gatilho para revalidar o estado completo via `obter_estado_draft` (debounce ~300 ms). Nunca aplicamos o payload do evento incrementalmente no client. Isso elimina bugs de ordenação/duplicação e torna a resiliência trivial:

```ts
// src/lib/draft.ts (esqueleto do subscriber — precedente realtime do app)
export function inscreverDraft(partidaId: number, revalidar: () => void) {
  const canal = supabase
    .channel(`draft-${partidaId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partida_drafts', filter: `partida_id=eq.${partidaId}` },
      revalidar
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partida_draft_picks', filter: `partida_id=eq.${partidaId}` },
      revalidar
    )
    .subscribe((status) => {
      // SUBSCRIBED: sincroniza o que perdeu antes de assinar;
      // CHANNEL_ERROR / TIMED_OUT: o driver do supabase-js reconecta sozinho,
      // revalidamos para cobrir o vão.
      revalidar();
    });

  return () => {
    supabase.removeChannel(canal);
  };
}
```

Revalidações adicionais (conexão instável na hora do jogo):

- `visibilitychange → visible` (PWA em background no iOS/Android mata WS silenciosamente);
- `PullToRefresh` já existente (`src/components/PullToRefresh.tsx`) na tela do draft;
- **Poll de segurança de 10 s** apenas enquanto `status = 'em_andamento'` — cinto e segurança barato (1 RPC/10 s/cliente durante ~5 min). Se a validação manual mostrar que sobra, remove-se sem tocar em mais nada.

### 5.3 Pré-requisitos de infra

- `ALTER PUBLICATION supabase_realtime ADD TABLE ...` (já na migration 109).
- `ALTER TABLE partida_draft_picks REPLICA IDENTITY FULL` (já na migration 109) — sem isso os eventos **DELETE** de picks (ex.: re-início do draft limpando a tabela) não casam o filtro `partida_id=eq.X` e nunca chegam ao client.
- `GRANT SELECT` nas duas tabelas para `anon, authenticated` (já na migration 109) — o Realtime autoriza o assinante de `postgres_changes` pelo privilégio de leitura do papel; sem o grant a inscrição ocorre mas nenhum evento é entregue.
- Realtime habilitado no projeto (dashboard Supabase; hosted projects têm por padrão — validar no passo 1 da implementação).
- Sem RLS nas tabelas → eventos vão a todos os assinantes anon, coerente com a postura de leitura aberta do baseline (migration 016). Documentar no cabeçalho da migration.

---

## 6. Fluxo completo (feliz path)

1. **Segunda 10h**: cron cria a partida de quinta (`060_cron_agendar_partida_semanal.sql`) — sem mudanças.
2. **Quinta, na hora do jogo**: admin abre `/partida/:id/times` e toca em **"Escolha ao vivo com capitães"** (novo botão) → `/partida/:id/draft`.
3. **Admin define os 2 capitães** entre os confirmados de linha (`ModalSelecionarOpcao` 2×, bloqueando não confirmados). Os seletores são neutros ("1º capitão"/"2º capitão") com legenda de que as cores são sorteadas no servidor. Botão "Iniciar escolha ao vivo" desabilitado abaixo do mínimo (§7). Ao iniciar: o servidor sorteia qual capitão é Preto/Branco e joga a moeda; a UI anuncia pelo nome — "Cara ou coroa: [FULANO] começa". **Push de abertura sai no ato** (§10): todos os confirmados ativos recebem "a escolha de times começou — acompanhe ao vivo".
4. **Draft começa imediatamente**: sem confirmação de "estou online" (decisão v4) — o board acende no ato. O capitão da vez (anunciado pela moeda) já vê o banner "SUA VEZ" com o pool aberto; capitão que espera e espectadores veem "Aguardando [FULANO] fazer a primeira escolha…" com o nome realçado, mais a linha do formato ("Turma da vez escolhe 1, depois 2, 2, 2… até fechar os times").
5. **Draft ao vivo**: capitão da vez vê o banner sticky no topo com a cor do time e a contagem do turno ("Branco escolhe 2 · 1ª de 2"); quando a vez chega ao próprio usuário, transição visível + vibração de sucesso. No pool (linhas com nome, posição e média `X.X★`): **1º toque seleciona a linha** (destaque + `vibrateLight`), **2º toque confirma na barra fixa inferior** com o nome ("Escolher FULANO") → `registrar_pick_draft` → evento realtime → todos os clients revalidam. Haptics: `vibrateSuccess()` para quem pickou, `vibrateLight()` para espectadores a cada pick novo. Erro efêmero (vez passou/alvo pego) → Snackbar + `vibrateError` + revalidação.
6. **Último jogador**: sobra 1 → copy própria ("Só sobrou [FULANO] — confirma aí, capitão") e vai para o capitão do último bloco (fórmula da vez). Pool esvazia → RPC conclui e grava `partidas_participantes.time` numa transação — e **dispara o push de conclusão** (§10): "Times fechados! Confira a escalação".
7. **Resultado**: tela mostra os dois times completos com o copy por papel — admin vê aviso + botão "Definir goleiros e abrir a partida" (→ `/partida/:id/times`); jogador comum vê "Times fechados! Aguardando goleiros e início"; se fecharam desiguais (ex.: 6+6), o aviso "Times fecharam 6 a 6 — o admin completa com avulsos". Admin volta a `/partida/:id/times`: os times já vêm pré-preenchidos (`PartidaTimes.tsx:114-125` já hidrata de `part.time`), seleciona os goleiros, salva (`salvar_times_e_goleiros_partida`) e segue o fluxo existente (`abrir_partida` exige 7+7+1+1, migration 082/083).

O botão "Equilibrar" (sorteio automático, `docs/algoritmo-sorteio-times.md`) continua existindo em `/times`: são dois modos alternativos de montar os mesmos times.

---

## 7. UX por papel (mobile-first, DESIGN.md §4/§6)

Nova rota `/partida/:id/draft` — **uma tela, três papéis** (o papel deriva do estado, não da rota):

### 7.1 Setup (admin, sem draft)

- Dois seletores de capitão via `ModalSelecionarOpcao` sobre os confirmados de linha, rotulados **"1º capitão"** e **"2º capitão"** (neutros: a cor não é decidida aqui — legenda "a cor de cada capitão é sorteada no início").
- Botão "Iniciar escolha ao vivo" na `BarraAcaoInferior`; **desabilitado com menos de 4 confirmados de linha**, com legenda condicional explicativa ("Mínimo de 4 confirmados de linha para a escolha ao vivo") — mesmo padrão de legenda condicional de `EscalacaoTimesEditor.tsx:454-467`.
- Após iniciar: banner/cartões rotulam explicitamente "Capitão do Preto"/"Capitão do Branco" (a cor passou a ser um dado do estado, sorteado no servidor) + anúncio da moeda pelo nome: "Cara ou coroa: [nome do capitão] começa".

### 7.2 `em_andamento` — início do draft (sem picks)

- Sem confirmação de "estou online" (decisão v4): ao iniciar, o board já está ao vivo para todos. O capitão que começa vê o banner "SUA VEZ" (§7.3) com o pool aberto; capitão que espera e espectadores veem "Aguardando [FULANO] fazer a primeira escolha…" com o nome realçado.
- Linha do formato do snake para todos: "Turma da vez escolhe 1, depois 2, 2, 2… até fechar os times" (o turno duplo não pode parecer bug depois).

### 7.3 `em_andamento` — banner de vez (presente em todos os papéis)

- **Sticky no topo**, com a cor do time da vez (`bg-preto-time`/`bg-branco-time`) e `aria-live="polite"` — o momento "é a minha vez" precisa chegar ao usuário mesmo com a página rolada.
- Texto com **contagem do turno**, derivada no client de `picks.length` + tamanho do pool: `k=0` → "escolhe 1"; depois "escolhe 2 · 1ª de 2" / "escolhe 2 · 2ª de 2"; quando restar exatamente 1 no pool → "escolhe 1".
- Quando a vez é do usuário logado: tratamento visual reforçado ("SUA VEZ"), transição visível na chegada e `vibrateSuccess()` (ou padrão próprio distinto do feedback de pick) — garantia de perceber sem estar olhando.
- **Inatividade**: após ~45 s sem escolha (delta sobre `ultima_escolha_em`, exposto no estado), o banner acrescenta linha "Sem escolha há 45s" visível a todos; para o admin, atalho "Substituir capitão" junto ao aviso (`substituir_capitao_draft`, §4.3).

### 7.4 `em_andamento` — pool (bloco "Ainda sem time")

- Bloco do pool **realçado quando é a vez do usuário logado** (borda/fundo de destaque); para os demais, leitura simples.
- Cada linha: nome (`font-display`), posição, **média `X.X★`** (mesma renderização de `EscalacaoTimesEditor.tsx:403-408`, default 6.0 sem notas) e sufixo **"(você)"** ao lado do próprio nome (padrão de `ConfirmacoesPartida.tsx:300`). Alvos ≥ 44 px.
- **Escolha em dois toques** (o pick é irreversível):
  1. 1º toque **seleciona** a linha — destaque visual + `vibrateLight()` (tocar de novo em outra linha move a seleção; nenhum efeito no servidor);
  2. `BarraAcaoInferior` fixa acende com o botão **"Escolher FULANO"** — 2º toque confirma e chama `registrar_pick_draft`.
- Botão desabilitado enquanto a RPC está em voo (evita double-tap); tocar fora/retornar limpa a seleção.
- **Erro de pick efêmero** ("não era sua vez"/"jogador já escolhido") → `Snackbar` + `vibrateError()` + revalidação imediata (o estado pode ter mudado). `MensagemEstado` fica reservado para falha de carregamento da tela.
- Quando restar **1 jogador**: o botão de confirmação mantém o fluxo de dois toques, mas o copy do banner/pool muda para "Só sobrou [FULANO] — confirma aí, capitão" (o turno de 1 não pode parecer um botão igual aos outros sem contexto).

### 7.5 `em_andamento` — board (todos os papéis)

- Dois times com `CabecalhoTime` + listas contínuas `divide-y divide-borda` (padrão do DESIGN §4.2), **escolhas numeradas** (campo `ordem` já existe no payload), último pick destacado, contagem por time e "(você)" no próprio nome.
- Capitão esperando e espectador: board ao vivo; pool visível sem botões; indicador "aguardando escolha de X…".

### 7.6 Conclusão / cancelamento

- **Concluído**: resumo dos dois times + copy **por papel**:
  - admin: aviso + botão "Definir goleiros e abrir a partida" → `/partida/:id/times`;
  - jogador comum: "Times fechados! Aguardando goleiros e início";
  - times desiguais (ex.: 6+6): "Times fecharam 6 a 6 — o admin completa com avulsos".
- **Cancelado**: estado informativo + (admin) reiniciar.
- **Draft re-iniciado após conclusão**: enquanto o novo draft não concluir, `partidas_participantes.time` ainda guarda os times do draft anterior (e `abrir_partida` segue validando contra eles). A tela do draft refeito exibe a sinalização "Times ativos são do draft anterior até a nova conclusão" — puramente informativo, sem código extra.
- Estados: `Carregando`/`MensagemEstado` existentes para falha de carregamento.

### 7.7 Casca da rota

- Sem TabBar: adicionar `draft` à regex `isFluxoFocado` (`src/routes/Layout.tsx:106`).
- Retorno: `BotaoVoltar` → `voltar(navigate, `/partida/${id}`)` (DESIGN §6.3).
- `PullToRefresh` envolvendo a tela (revalidação manual), além do poll interno.

### 7.8 Pontos de entrada e descoberta

- `PartidaDetalhe.tsx` (bloco `partida.status === 'draft'`, ~linha 224): botão **"Escolha ao vivo com capitães"** para o admin (sempre) e, para os demais logados, **"Acompanhar escolha dos times"** quando existe draft. Rótulo unificado — nunca mais de uma formulação para a mesma ação.
  - **Descoberta**: com o push de abertura (§10) o aviso chega sozinho; `PartidaDetalhe` ganha ainda `PullToRefresh` (padrão já usado em `Jogos.tsx`/`Estatisticas.tsx`) e um **poll leve de 30 s apenas da existência de draft** enquanto `partida.status='draft'` (consulta barata; para de rodar em qualquer outro status) — quem está com a página da partida aberta vê o draft começar sem refresh manual mesmo sem push (push não entregue/cancelado pelo SO).
- `PartidaTimes.tsx`: botão secundário "Escolha ao vivo com capitães" (admin) — o editor manual continua como fallback.

---

## 8. Edge cases

| Caso | Comportamento |
| --- | --- |
| Pool insuficiente ao iniciar | `iniciar_draft` recusa pool escolhível 0 (retorna `false`); a UI trava abaixo de 4 confirmados de linha com legenda (§7.1). Draft não nasce morto. |
| Pool esvazia durante `em_andamento` fora de um pick | Último jogador do pool desiste (`confirmar_presenca` segue ativo no status draft) ou é removido (DELETE via REST). Sem pick posterior, nenhum gatilho server-side de conclusão — a tela exibe o estado visível "pool vazio" com ações do admin (cancelar/reiniciar a escolha). Residual aceito e documentado (ver §15); sem corrupção de dados. |
| Capitão nunca começa / desconecta / desiste no meio | Sem confirmação online (v4) e **sem timeout automático** (decisão do usuário, §13 Q3): o capitão da vez pode demorar quanto quiser. Inatividade visível a todos após ~45 s ("Sem escolha há 45s", §7.3) + atalho admin "Substituir capitão". Se o capitão recusar presença ou for removido no meio: `registrar_pick_draft` recusa o pick dele (capitão da vez precisa seguir `confirmado`, §4.2); admin substitui manualmente — o novo herda o slot; picks passados intactos (`time` gravado por pick); antigo volta ao pool. |
| Jogador confirmado desiste durante o draft | `confirmar_presenca → recusado` o tira do pool (query filtra `confirmado`). Prefixo da vez é estável (§3.2) — draft segue com 1 a menos. Se ele já tinha sido pickado, o `UPDATE` final o pula (time fica menor; admin completa em `/times`). |
| Admin adiciona avulso durante o draft | Entra no pool (confirmado de linha); apenas o bloco final cresce. Se o draft já concluiu, admin monta manualmente como hoje. |
| Repetir/cancelar draft | `cancelar_draft` só antes de concluir; `iniciar_draft` de novo reseta picks e os dois sorteios. Depois de concluído, o admin re-inicia um novo draft (sobrescreve os times ao concluir) ou edita em `/times` — não existe "desfazer" dedicado. Enquanto o novo draft não conclui, os times ativos são os do anterior (sinalizado na UI, §7.6; `abrir_partida` segue validando os times antigos até lá). |
| Dois tabs abertos | Pick é transacional: `FOR UPDATE` + `UNIQUE(ordem)`/`UNIQUE(jogador_id)`. O tab lento recebe `false` (vez passou) e revalida. A confirmação em dois toques reduz mis-taps na origem. |
| Retorno a um draft em andamento | `obter_estado_draft` reconstrói tudo (board, pool, vez, médias, última escolha) — refresh/deep-link/reabrir PWA caem no mesmo caminho. |
| Confirmados ≠ 14 (12, 13, 15…) | Funciona com qualquer N ≥ 4 (UI) / pool ≥ 1 (RPC): times ficam desiguais no máximo 1 (snake, §3.2). UI informa totais e avisa no fechamento desigual; `abrir_partida` segue exigindo 7+7+1+1 — com menos de 14 o admin completa com avulsos depois, como já faz hoje. (Recomendação Q7.) |
| Draft em partida não-`draft` | Todas as RPCs recusam (`status='draft'` obrigatório) — espelha `confirmar_presenca` (057). |
| Dois capitães = mesmo jogador | CHECK `capitao_a_id <> capitao_b_id` + validação na `iniciar_draft`. |

---

## 9. Autorização e segurança

- **Modelo vigente preservado**: sem Supabase Auth/RLS por usuário. O client passa ids; RPCs `SECURITY DEFINER` validam.
- **Pick**: `registrar_pick_draft` só aceita do capitão cujo slot bate com `vez_escolha_draft(count(picks))` — client não decide vez. Spoof de `p_capitao_id` tem o mesmo alcance do spoof de `p_jogador_id` em `confirmar_presenca` (postura documentada: DESIGN §9.4, comentário da migration 016). Não introduzimos auth novo — fora de escopo.
- **Setup/substituição/cancelamento**: gate `is_admin` server-side no padrão da migration 091 (`p_admin_id IS NULL OR NOT EXISTS(...)` → exceção).
- **Leitura do estado**: aberta a logados (dados já públicos no app via REST).
- **Grants da migration** (explícitos no SQL do §3.1):
  - `GRANT SELECT ON partida_drafts, partida_draft_picks TO anon, authenticated` — **necessário para o Realtime entregar os eventos** de `postgres_changes` (o assinante é autorizado pelo privilégio de leitura do papel) e coerente com a postura de leitura aberta do baseline (migration 016). O que o SELECT expõe (picks, nomes) é exatamente o que `obter_estado_draft` retorna.
  - `INSERT/UPDATE/DELETE` **não** são concedidos ao anon — toda escrita via RPC `SECURITY DEFINER`.
  - A leitura estruturada do app segue sendo uma viagem só via `obter_estado_draft` (`STABLE` + `GRANT EXECUTE`); os helpers `vez_escolha_draft` e `tentar_concluir_draft` não recebem `GRANT EXECUTE` (padrão de `capacidade_partida()`, migration 100).

---

## 10. Push — 2 eventos discretos (decidido pelo usuário em 25/09/2026)

O usuário decidiu: **push quando os 2 capitães são definidos** (chamando os capitães a "bater o time") **e push quando a divisão dos times finaliza**. São eventos de estado, não sinais de vez ao vivo — exatamente o perfil do pipeline existente (ledger `push_reminder_deliveries`, `notificacoes_config`, Edge Function via `pg_net`), no molde da `107_push_votacao_aberta.sql`. **Fora de escopo segue o push de vez/pick** (latência não determinística; durante o draft todos estarão com o app aberto — banner sticky + vibração resolvem).

### 10.1 Os dois eventos

| Evento | Momento do disparo | Público-alvo | `reminder_key` | Fallback (título / mensagem) |
| --- | --- | --- | --- | --- |
| **Abertura** — capitães definidos | No ato do `iniciar_draft` (passo 8 do §4.1) | Confirmados ativos da partida (linha **e** goleiros — evento social da partida) com `push_subscriptions` | `draft-aberto` | "Vai bater o time ao vivo!" / "Os capitães foram definidos e a escolha de times começou no app — acompanhe ao vivo." |
| **Conclusão** — times fechados | No ato da conclusão (`tentar_concluir_draft`, §3.3) | Mesmo público | `draft-concluido` | "Times fechados!" / "A escolha de times terminou. Confira a escalação no app." |

Sem interpolação de nomes nos templates (mesmo padrão da 107 — template fixo por evento, configurável no painel).

### 10.2 Peças da migration 109 (mesmo molde da 107)

1. **Ledger**: relaxar o CHECK de `push_reminder_deliveries.reminder_key` acrescentando `'draft-aberto'` e `'draft-concluido'` (relax idêntico ao §1 da 107 — dedupe por PK + catch 23505 na Edge).
2. **Config**: `notificacoes_config` ganha `draft_abertura_ativo` (default `true`), `draft_template_abertura_titulo/msg` e `draft_conclusao_ativo`, `draft_template_conclusao_titulo/msg` (NULL = fallback hardcoded na Edge, na linha dos templates da 077/107). Atualizar `salvar_configuracoes_notificacoes` com os 6 campos (corpo espelha o §5 da 107).
3. **Listagem dos destinatários**: RPC `listar_destinatarios_draft_push(p_partida_id)` — irmã da `listar_pendentes_votacao_abertura` (107 §3): mesmo join (`partidas_participantes` + `jogadores` + `push_subscriptions`, `jsonb_agg` de subscriptions), mas **sem** filtro de voto/pendência — filtra `status_confirmacao='confirmado'`, `j.is_ativo=true` e `p.status='draft'`. `STABLE SECURITY DEFINER` + `GRANT EXECUTE`.
4. **Helper de disparo** `disparar_push_draft(p_partida_id, p_evento text)` — **sem GRANT** (só chamado por RPCs do draft), `SECURITY DEFINER`:
   - `p_evento ∈ ('abertura','conclusao')`; lê o secret `push_cron_secret` do vault;
   - **fire-and-forget puro** (`net.http_post` para `.../functions/v1/send-draft-pushes` com body `{partida_id, evento}`, `timeout_milliseconds 8000`, sem coleta — padrão do cron semanal da 104): roda dentro da transação de `registrar_pick_draft` (anon, `statement_timeout` 3s) e a coleta de 2s da 107 aqui custaria o timeout; o envio acontece pós-commit (rollback do pick cancela o push — correto);
   - **best-effort absoluto**: secret ausente, `pg_net` indisponível etc. viram linha `sucesso=false` em `cron_execucoes` — **nunca** `RAISE` (falha de push não pode derrubar pick nem conclusão).
5. **Edge Function nova** `supabase/functions/send-draft-pushes/index.ts` — espelho da `send-voting-reminders` no modo abertura (107): valida `x-push-cron-secret`, resolve o modo pelo body `{partida_id, evento}`, respeita os gates `draft_*_ativo`, chama `listar_destinatarios_draft_push`, aplica template (config || fallback §10.1), entrega via Web Push e grava no ledger com a `reminder_key` do evento (dedupe por PK + catch 23505). Nada de buckets/janelas — evento único no ato.

### 10.3 Por que Edge nova (e não estender `send-voting-reminders`)

O modo "abertura" da 107 foi acrescentado à Edge de votação porque o evento era de votação. Aqui o domínio é outro (draft de times) — a Edge nova é pequena (um modo, sem buckets) e evita inflar a de votação com mais um ramo. Precedente de Edge por domínio: `send-confirmation-requests`, `send-test-push`, `send-voting-reminders` (+ `send-palpites-open-push` planejada no plano-palpites.md).

---

## 11. Passos de implementação (ordem de execução)

1. **Migration** `supabase/migrations/109_draft_times_ao_vivo.sql` — tabelas sem indexes redundantes (§3.1), `REPLICA IDENTITY FULL` em picks, publication, `GRANT SELECT`, helpers `vez_escolha_draft` (§3.2) e `tentar_concluir_draft` (§3.3), RPCs (§4) **e as peças de push do §10.2** (CHECK do ledger com `'draft-aberto'`/`'draft-concluido'`, 6 colunas em `notificacoes_config`, `listar_destinatarios_draft_push`, helper `disparar_push_draft`, update da `salvar_configuracoes_notificacoes`). Aplicar com `npx supabase db push` (docs/MIGRATE.md).
2. **Types**: regenerar `src/lib/database.types.ts` (`npx supabase gen types typescript --project-id jtavmrlllyctkuxefhpc > src/lib/database.types.ts`, projeto já linkado no MIGRATE.md).
3. **Camada de dados** `src/lib/draft.ts` (novo): tipos `EstadoDraft`/`PickDraft`/`JogadorPool` (com `media_nota` e `ultima_escolha_em`), wrappers tipados das 5 RPCs, `inscreverDraft(partidaId, revalidar)` (§5.2) — este módulo vira o **precedente realtime** do app; documentar o padrão "evento é sino, não verdade" no cabeçalho.
4. **Board** `src/components/PainelEscolhaTimes.tsx` (novo): dois times com `CabecalhoTime` + listas contínuas, **escolhas numeradas** (`ordem`), destaque do último pick, contagem por time, lista de pendentes com "(você)". Puro/props-driven (recebe `EstadoDraft`), para servir capitão e espectador.
5. **Rota** `src/routes/PartidaDraft.tsx` (novo): orquestra `obter_estado_draft` + `inscreverDraft` + visibilitychange + poll de 10 s; renderiza por papel (§7): banner de vez sticky com contagem de turno e aviso de inatividade, seleção de pick em dois toques com `BarraAcaoInferior` ("Escolher FULANO"), pool com médias `X.X★`, `useSnackbar` para erros efêmeros de pick, copy de conclusão por papel. Debounce da revalidação; flag `ativo` nos effects; hooks no topo.
6. **Registro de rota**: `src/lib/rotas.ts` — loader lazy + export E entrada na `TABELA_PRE_CARREGAMENTO` (`/^\/partida\/\d+\/draft/` → `carregarPartidaDraft`, posicionada ANTES do padrão genérico `/partida/\d+`, pois a ordem importa — fonte única de imports dinâmicos); `src/App.tsx` declara `/partida/:id/draft`.
7. **Layout**: `src/routes/Layout.tsx:106` — incluir `draft` na regex de fluxo focado (esconde TabBar).
8. **Entradas e descoberta**: `src/routes/PartidaDetalhe.tsx` — `PullToRefresh` + poll de 30 s da existência de draft enquanto `status='draft'` + botões com rótulo unificado ("Escolha ao vivo com capitães" admin / "Acompanhar escolha dos times" demais) — e `src/routes/PartidaTimes.tsx` (botão admin "Escolha ao vivo com capitães"). Nenhuma mudança na lógica de salvar times.
9. **Edge Function** `supabase/functions/send-draft-pushes/index.ts` (§10.2.5): espelho do modo abertura da `send-voting-reminders` — secret, gates `draft_*_ativo`, `listar_destinatarios_draft_push`, templates config||fallback, Web Push, ledger com dedupe. Deploy: `npx supabase functions deploy send-draft-pushes`.
10. **Verificação local**: `npm run lint` (tsc + eslint) e revisão contra o checklist de conformidade (tokens semânticos, cantos 4px, haptics, `voltar()`, `formatarMensagemErro`).
11. **Validação manual** (§12) — não criar testes automáticos (AGENTS.md).

Commits sugeridos: (a) migration + types; (b) `lib/draft.ts` + components; (c) rota + entradas; (d) Edge `send-draft-pushes`. Não commitar sem pedido.

---

## 12. Riscos e validação manual

Riscos:

- **Primeira usage de Realtime**: se o serviço estiver desabilitado no projeto ou a publicação não pegar, os eventos não chegam — o poll de 10 s mascara, mas a experiência degrada. Validar cedo (passo 1) com dois navegadores. **O `GRANT SELECT` é parte do mecanismo**: sem ele a inscrição ocorre mas nenhum evento chega (já coberto pelo SQL do §3.1 — só não remover).
- **Filtro de eventos DELETE**: depende do `REPLICA IDENTITY FULL` em `partida_draft_picks` (§3.1); testar re-início do draft e confirmar que os clients veem os picks sumirem.
- **WS em background (PWA iOS/Android)**: navegadores matam sockets em background; cobertura por `visibilitychange`. Validar backgroundar/retornar durante o draft.
- **Latência do evento**: raro, mas um espectador pode ver o pick "pular" a ordem — o debounce + revalidação completa corrige na próxima batida.
- **Pool esvaziando fora de pick durante `em_andamento`**: estado residual visível (pool vazio), sem gatilho automático de conclusão — a UI expõe e o admin resolve (cancelar/reiniciar). Aceito na revisão (§15); sem risco de dados.
- **Postura de confiança do client**: ids spoofáveis no pick (idêntico ao `confirmar_presenca` existente). Se um dia o app migrar para Supabase Auth, as RPCs já têm o ponto de gate pronto (`p_capitao_id`).
- **Push best-effort**: `disparar_push_draft` é fire-and-forget dentro da transação — cold start da Edge pode registrar timeout falso-negativo com o push entregue mesmo assim (comportamento já conhecido e documentado da 104/105; observabilidade = ledger/painel do P6). Falha de push **nunca** derruba pick/conclusão (§10.2.4). Re-iniciar um draft re-dispara o push de abertura (aceitável: lembrete novo de que a escolha recomeçou).
- **Conflito de numeração** com `plano-palpites.md` (§1) — registrar na hora de implementar o palpites.

Validação manual obrigatória (2 dispositivos + 1 anônimo):

1. Admin tenta iniciar com < 4 confirmados de linha → botão desabilitado com legenda; com pool 0 via RPC direto → `false`.
2. Admin inicia draft com 14 confirmados: cores dos capitães variam entre execuções (sorteio de slot) e a moeda anuncia pelo nome ("Cara ou coroa: FULANO começa").
3. Sequência de vez confere 1-2-2-2-2-2-1 (observar contagem no banner — "1ª de 2"/"2ª de 2" — e `ordem` numerada no board).
4. Escolha em dois toques: 1º toque só seleciona; confirmar na barra ("Escolher FULANO") é o que picka; mis-tap na lista não registra pick.
5. Capitão errado tenta pickar (aba com outro user) → recusado com Snackbar + vibração de erro, sem efeito.
6. Double-tap rápido na confirmação → só 1 pick; segundo request retorna false e UI revalida.
7. Espectador vê picks chegando sem refresh; refresh no meio reconstrói o estado (com médias do pool).
8. Desiste de um jogador não-pickado no meio (via tela de confirmação) → draft segue com 13 e conclui 7+6, com aviso de fechamento desigual.
9. Capitão da vez recusa presença (ou é removido) durante o draft e tenta pickar → recusado (`false`, sem efeito); admin substitui e o draft segue com os picks intactos.
10. Substituir capitão durante `em_andamento` (incluído via atalho do aviso "Sem escolha há 45s") → vez e picks preservados; antigo capitão volta ao pool.
11. Cancelar e reiniciar → times de `partidas_participantes` não mudam até concluir de novo; eventos DELETE de picks chegam (board limpa sozinho); tela do draft refeito sinaliza "times do draft anterior".
12. Concluir → copy por papel (admin com botão para `/times`; jogador com "Times fechados!"); `/partida/:id/times` pré-preenchido; salvar goleiros; `abrir_partida` passa (7+7+1+1).
13. Backgroundar o app 30 s durante o draft e voltar → estado atualiza sozinho; manter a tela da **partida** (não do draft) aberta em outro aparelho → o botão "Acompanhar escolha dos times" aparece sozinho (poll de 30 s) e PullToRefresh também o traz.
14. Com a vez do usuário logado e a página rolada, o banner sticky "SUA VEZ" entra na viewport com transição e vibração.
15. Push de abertura: ao `iniciar_draft`, confirmados ativos com subscription recebem a notificação (ledger com `reminder_key='draft-aberto'`); desligar `draft_abertura_ativo` no painel → não envia e não quebra o fluxo.
16. Push de conclusão: ao esvaziar o pool, destinatários recebem "Times fechados!" (ledger `draft-concluido`); cancelar/reiniciar **não** dispara push de conclusão; falha simulada da Edge (secret errado) não derruba o pick (`cron_execucoes` registra).

---

## 13. Decisões (estado após decisões do usuário em 25/09/2026)

1. **Quem define os capitães?** — **RESOLVIDA (usuário)**: **admin define os dois** (seletores na tela do draft). Alternativa descartada: auto-reivindicação (abriria corrida/abuso no modelo sem auth real).
2. **Quem escolhe primeiro (e quem é qual cor)?** — **Resolvida na revisão v2**: moeda e atribuição de cores ambas sorteadas no servidor no `iniciar_draft`; anúncio pelo nome ("Cara ou coroa: FULANO começa").
3. **Capitão que nunca confirma online / para de escolher?** — **RESOLVIDA (usuário)**: **sem timeout e sem substituição automática** — o draft espera o capitão indefinidamente (ele pode demorar quanto quiser). Válvulas existentes: aviso de inatividade "Sem escolha há 45s" (só sinalização) e substituição **manual** pelo admin (`substituir_capitao_draft`) ou cancelamento.
4. **Confirmados < 14: liberar draft?** — **Resolvida na revisão v2**: sim, qualquer N ≥ 4 (times desequilibram no máx. 1; admin completa depois). UI trava abaixo do mínimo com legenda; RPC trava pool 0 (§4.1).
5. **Escrever `partidas_participantes.time` progressivamente a cada pick (em vez de só no final)?** — Recomendo: **só no final** (cancelamento limpo). Alternativa: progressivo para outras telas exibirem ao vivo — ganho pequeno, acoplamento maior.
6. **Push?** — **RESOLVIDA (usuário)**: **sim, 2 eventos** — abertura quando os 2 capitães são definidos (`iniciar_draft`) e conclusão quando a divisão finaliza (`tentar_concluir_draft`), no molde da 107 (§10 reescrito na v3). Push de vez/pick permanece fora.
7. **Poll de segurança de 10 s**: manter (recomendo) ou confiar só em WS + visibilitychange?

---

## 14. Referências rápidas para o implementador

- Filtro de confirmados de linha: `src/routes/PartidaTimes.tsx:63-87`.
- Salvamento atual dos times/goleiros: `src/lib/partidas.ts:452-468` → RPC migrations `082`/`083`/`093`.
- Capacidade e confirmação: migrations `057`/`080`/`085`/`100`; `CAPACIDADE_PARTIDA` em `src/lib/partidas.ts:330`.
- Padrão de gate admin: migration `091` (nunca `IS NOT NULL` sozinho).
- Padrão de helper interno sem grant: `capacidade_partida()` na migration `100`.
- Publicação realtime + postura sem RLS: baseline migration `016`.
- Médias de notas: RPC `obter_medias_notas_jogadores` (migration `070`), wrapper `src/lib/jogadores.ts:252`, renderização `X.X★` em `EscalacaoTimesEditor.tsx:403-408`.
- Componentes reutilizáveis: `ModalSelecionarOpcao`, `ConfirmDialog`, `CabecalhoTime`, `Estado` (`Carregando`/`MensagemEstado`), `BotaoVoltar`, `PullToRefresh` (uso: `Jogos.tsx:107`), `Badge`, `BarraAcaoInferior` (legenda condicional: `EscalacaoTimesEditor.tsx:454-467`), `Snackbar` + `useSnackbar` (erros efêmeros).
- Marcação "(você)": padrão de `ConfirmacoesPartida.tsx:300`.
- Sorteio automático (coexiste): `src/lib/escalacao.ts` + `docs/algoritmo-sorteio-times.md`.
- **Molde do push (§10)**: migration `107_push_votacao_aberta.sql` (CHECK do ledger, colunas de config, listagem de aptos, disparo com gate) + `supabase/functions/send-voting-reminders/index.ts` modo `abertura` (gates, templates config||fallback, ledger com dedupe) + disparo client-side de referência em `src/lib/notificacoes.ts:108`; fire-and-forget da 104 (cron semanal) e `disparar_e_registrar_cron_http` da 105 (coleta 2s — **não** usar no draft, ver §10.2.4).

---

## 15. Decisões da revisão (v2)

Correções das duas revisões incorporadas. Mapeamento e decisões tomadas:

**Aplicadas integralmente**: T2, T3, T5, T6, T7, T8, U2, U4, U5, U6, U8, U9, U10, U11, U12, U13 e o fix consolidado T1+U7 (helper `tentar_concluir_draft` chamado em `registrar_pick_draft` e `confirmar_capitao_online`; `iniciar_draft` valida pool ≥ 1; UI trava abaixo do mínimo com legenda).

**Aplicadas com decisão de variante**:

- **U1 (confirmação de pick)**: escolhida a variante **dois toques + barra fixa inferior** ("Escolher FULANO", `BarraAcaoInferior`) — mais fluida que `ConfirmDialog` a cada pick e alinhada ao padrão existente; nenhuma incompatibilidade encontrada no padrão de `EscalacaoTimesEditor.tsx:454`.
- **U3 (cor decidida pela ordem dos seletores)**: escolhida a **randomização de slot no servidor** (junto da moeda) + rótulos explícitos. Combinação prática: seletores neutros ("1º capitão"/"2º capitão") com legenda de sorteio de cores (rotular os seletores de "Capitão do Preto/Branco" seria incoerente com a randomização — a cor ainda não existe na seleção), e os rótulos explícitos de cor passam a viver no pós-início (banner/cartões "Capitão do Preto/Branco"). Resolve também a Q2 do §13 (anotada como resolvida).

**Divergências deliberadas das recomendações**:

- **T4 (SELECT nas tabelas de draft)**: a decisão do validador era NÃO conceder SELECT (leitura só via `obter_estado_draft`). **Divergi**: sem `GRANT SELECT` para `anon/authenticated`, o Realtime `postgres_changes` autoriza o assinante pelo privilégio de leitura do papel e **não entrega evento nenhum** (a inscrição até ocorre) — ou seja, a recomendação quebraria silenciosamente o mecanismo central do §5, restando o poll de 10 s. O grant está explícito no SQL (§3.1) e o §9 agora descreve com precisão o que é concedido e por quê. O dado exposto pelo SELECT (picks e nomes) é exatamente o que a RPC de leitura retorna; a postura de leitura aberta é a do baseline (016). A escrita segue só via RPC (sem INSERT/UPDATE/DELETE para anon).
- **T1+U7, caso residual**: o helper cobre conclusão via pick e via 2ª confirmação, e o `iniciar_draft` impede pool 0 na origem. Resta o caso de o pool esvaziar **durante `em_andamento`** por desistência/remoção (a desistência passa por `confirmar_presenca`, migration 100; a remoção é DELETE direto via REST). Fechar isso por completo exigiria (a) redefinir `confirmar_presenca` na 109 para chamar o helper — cópia de uma RPC de ~80 linhas com risco real de drift — ou (b) trigger em `partidas_participantes` — padrão inexistente no projeto (AGENTS.md: sem padrões novos sem necessidade clara). Decisão: aceitar o residual como estado visível e sem risco de dados — a UI mostra "pool vazio" com ações do admin (cancelar/reiniciar) — e documentar em §8/§12.

**Não aplicadas**: nenhuma. Todas as CRÍTICAS e IMPORTANTES foram incorporadas; as MENORES (T2–T8, U8–U13) foram todas aplicadas por serem correção de spec/copy no documento, sem custo de complexidade.

**v3 — decisões do usuário (25/09/2026)**: Q1 (admin define capitães) e Q3 (sem timeout/substituição automática — capitão escolhe infinitamente; substituição manual e aviso de 45s permanecem) fechadas sem mudança estrutural — eram as recomendações. Q6 (push) **inverteu** a recomendação v2: §10 reescrito com push em 2 eventos discretos (abertura no `iniciar_draft`, conclusão no `tentar_concluir_draft`) no molde da 107 — helper `disparar_push_draft` fire-and-forget best-effort (§10.2.4), Edge nova `send-draft-pushes` (§10.3), 6 colunas de config, 2 `reminder_key`s; migration 109 e passos do §11 atualizados; riscos/validações de push em §12.

**v4 — decisão do usuário (30/09/2026)**: removida a etapa de confirmação "estou online" — ao disparar a divisão, o admin já inicia o draft direto em `em_andamento` (RPC `confirmar_capitao_online` removida; status `aguardando_capitaes` e colunas `*_online_em` removidos; §7.2 reescrito para início imediato do board; copy do push de abertura atualizado em §10.1; o caso "pool esvazia antes das confirmações" deixa de existir). Em contrapartida, `registrar_pick_draft` passa a exigir que o capitão da vez siga `confirmado` de linha (§4.2) — fecha o pick de "capitão fantasma" que recusa presença ou é removido durante o draft (§8). Com a remoção, `tentar_concluir_draft` volta a ter chamador único (`registrar_pick_draft`), mantido como helper por legibilidade da transação crítica.
