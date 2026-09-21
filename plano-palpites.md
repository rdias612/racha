# Plano — Palpites (Bolão Preto × Branco)

> **Status**: Aguardando validação do usuário.
> **Commit-base**: HEAD de `main` (feature inexistente no código; premissas auditadas contra o estado atual em 07/09/2026).
> **Próxima migration livre**: `108`.

---

## 1. Visão Geral

Todo jogador cadastrado (exceto `random\d*`) pode palpitar, para cada partida, em qual time vai ganhar: **Time Preto (`a`)** ou **Time Branco (`b`)**. A janela abre quando o admin **salva a escalação pela primeira vez** (não existe "publicar times" como passo separado — salvar em `/partida/:id/times` já torna a escalação visível a todos) e **fecha quando a partida é finalizada** (status sai de `draft`/`live`). O palpite é público em tempo real, pode ser trocado até o fechamento, e alimenta um **bolão com ranking da temporada** (1 ponto por acerto).

Funciona para **os dois fluxos de partida**: a que passa por eventos ao vivo (`draft → live → published`) e a publicada direto (`draft → published` via edição).

## 2. Decisões Tomadas (com o usuário)

| #   | Pergunta     | Decisão                                                                                                                |
| --- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Escopo       | **Bolão com ranking** (pontos por acerto + classificação da temporada)                                                 |
| 2   | Quem palpita | **Todos os jogadores logados, exceto `random\d*`** (goleiros incluem-se; quem não joga naquela semana também)          |
| 3   | Janela       | **Abre ao dividir os times; fecha quando a partida é finalizada** — para ambos os fluxos (ao vivo e publicação direta) |
| 4   | Empate       | **Não é opção de palpite** (só Preto ou Branco). Jogo empatado = **todos erram**                                       |
| 5   | Visibilidade | **Público em tempo real**: dá para ver quem palpita o quê e a % por time antes do resultado                            |
| 6   | Push         | **Sim**: "Times divulgados — dê seu palpite" na **primeira escalação** (não a cada re-save)                            |

**Consequências conscientes**:

- Palpitar **durante o jogo ao vivo é permitido** (o placar ao vivo é visível; é escolha deliberada).
- Partida publicada direto **sem nunca ter escalação salva em draft**: a janela abre e fecha na hora → na prática, semana sem palpite. O admin precisa dividir os times no draft e publicar o resultado depois.
- **Re-escalação não invalida palpite**: o palpite é na letra do time (Preto/Branco), não nos jogadores.
- Admin também é jogador e pode palpitar.

## 3. Regras de Negócio (canônicas)

1. **Janela aberta** = partida em `status IN ('draft','live')` **E** existe ao menos um participante com `time IS NOT NULL` (escalação salva).
2. **Fechada** = status `published` ou `closed` (publicação/finalização). Não há reabertura.
3. **Elegibilidade do palpiter**: `jogadores.is_ativo = true`, `posicao <> 'random'` e `username NOT ILIKE 'random%'` (mesmo critério de elegibilidade dos pushes da migration 107).
4. **Um palpite por jogador por partida** (`UNIQUE (partida_id, jogador_id)`); novo palpite = troca (upsert), sem limite de trocas.
5. **Acerto** = `palpite = vencedor` da partida **E** `vencedor <> 'empate'`. **Pontuação: 1 ponto por acerto.**
6. **Ranking** = agregado de todas as partidas `published`/`closed` (**all-time**, espelhando a view `ranking` da migration 009, que não filtra por ano).
7. Palpites só entram no ranking quando a partida é publicada; palpites em partida `draft`/`live` não contam nada ainda.

## 4. Banco de Dados — Migration `108_palpites_bolao.sql`

Arquivo único: `supabase/migrations/108_palpites_bolao.sql` (numeração sequencial 3 dígitos, zero UUID — tudo `bigint`/`bigserial`).

### 4.1 Tabela `partida_palpites`

```sql
CREATE TABLE partida_palpites (
  id         bigserial PRIMARY KEY,
  partida_id bigint NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id bigint NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  palpite    char(1) NOT NULL CHECK (palpite IN ('a','b')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partida_id, jogador_id)
);

GRANT SELECT ON partida_palpites TO anon, authenticated;
```

- `ON DELETE CASCADE` nos dois FKs: `excluir_partida` (066) e exclusão de jogador derrubam os palpites, igual a `votes`/`partida_eventos`.
- Escrita **só via RPC** (SECURITY DEFINER); leitura direta pelo client (padrão `carregarParticipantes`: `select('..., jogadores(username)')`).

### 4.2 RPC `registrar_palpite`

```sql
CREATE OR REPLACE FUNCTION registrar_palpite(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_palpite    char(1)
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_random boolean;
BEGIN
  -- Janela: partida existe, está em draft/live e já tem escalação salva
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status NOT IN ('draft','live') THEN
    RETURN false; -- palpite fechado (publicada/encerrada)
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM partidas_participantes
    WHERE partida_id = p_partida_id AND time IS NOT NULL
  ) THEN
    RETURN false; -- times ainda não divulgados
  END IF;

  -- Elegibilidade: jogador ativo, não-random
  SELECT (posicao = 'random' OR username ILIKE 'random%')
    INTO v_random
    FROM jogadores WHERE id = p_jogador_id AND is_ativo = true;
  IF v_random IS NULL OR v_random THEN
    RETURN false;
  END IF;

  INSERT INTO partida_palpites (partida_id, jogador_id, palpite)
  VALUES (p_partida_id, p_jogador_id, p_palpite)
  ON CONFLICT (partida_id, jogador_id)
  DO UPDATE SET palpite = EXCLUDED.palpite, updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_palpite(bigint, bigint, char) TO anon, authenticated;
```

Semântica de retorno igual a `registrar_votos`: `false` = servidor recusou (janela fechada / times não divulgados / inelegível) — a UI trata com `MensagemEstado`/`Snackbar`, sem expor erro cru.

### 4.3 RPC `salvar_times_e_goleiros_partida` — retorno passa a sinalizar primeira escalação

`CREATE OR REPLACE` com o **corpo atual da migration 093** (gate de admin, UPDATE dos 14 de linha, upsert dos goleiros, promoção de híbridos) mantido integralmente, com duas mudanças:

```sql
-- 1) Computar ANTES de qualquer escrita:
v_primeira_vez := NOT EXISTS (
  SELECT 1 FROM partidas_participantes
  WHERE partida_id = p_partida_id AND time IS NOT NULL
);

-- 2) No final: RETURN v_primeira_vez;  (em vez de RETURN true)
```

Semântica do `RETURNS boolean` passa a ser **"esta gravação foi a primeira escalação da partida"** (falha continua sendo exceção). Caller atual (front) ignora o retorno — sem quebra. `GRANT EXECUTE` mantido como está.

### 4.4 Push — ledger, listagem e disparo (espelho da migration 107)

**a) Ledger aceita a nova chave** (mesmo mecanismo da 107 §1):

```sql
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;
ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco','votacao-aberta','palpites-abertos')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );
```

**b) Listagem de alvos** (irmã de `listar_pendentes_votacao_abertura`): **todos os jogadores ativos não-random com subscription**, menos quem já palpita — **sem** filtro de participação na partida (palpite é para todo mundo, inclusive quem não joga):

```sql
CREATE OR REPLACE FUNCTION listar_alvos_push_palpites(
  p_partida_id bigint
)
RETURNS TABLE (partida_id bigint, jogador_id bigint, subscriptions jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_partida_id, j.id, jsonb_agg(jsonb_build_object(
           'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
  FROM jogadores j
  JOIN push_subscriptions ps ON ps.jogador_id = j.id
  WHERE j.is_ativo = true
    AND j.posicao <> 'random'
    AND j.username NOT ILIKE 'random%'
    AND NOT EXISTS (SELECT 1 FROM partida_palpites pp
                    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = j.id)
  GROUP BY j.id;
$$;
GRANT EXECUTE ON FUNCTION listar_alvos_push_palpites(bigint) TO anon, authenticated;
```

**c) Disparo** (espelho de `disparar_push_votacao_aberta`, 107 §4): gate de admin, valida partida em `draft`/`live` com escalação salva, secret `push_cron_secret` no vault, e:

```sql
PERFORM disparar_e_registrar_cron_http(
  'disparar_push_palpites_abertos',
  'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-palpites-open-push',
  v_headers,
  jsonb_build_object('partida_id', p_partida_id),
  2000
);
```

`GRANT EXECUTE ... TO anon, authenticated;` em tudo, conforme padrão.

### 4.5 View `ranking_palpites`

```sql
CREATE OR REPLACE VIEW ranking_palpites AS
WITH base AS (
  SELECT p.jogador_id, p.palpite, pl.vencedor
  FROM partida_palpites p
  JOIN partidas pa ON pa.id = p.partida_id AND pa.status IN ('published','closed')
  JOIN partidas_com_placar pl ON pl.partida_id = p.partida_id
)
SELECT
  j.id        AS jogador_id,
  j.username,
  j.posicao,
  COUNT(*)                                                    AS palpites,
  COUNT(*) FILTER (WHERE base.vencedor <> 'empate'
                     AND base.vencedor = base.palpite)        AS acertos,
  CASE WHEN COUNT(*) > 0 THEN
    ROUND(COUNT(*) FILTER (WHERE base.vencedor <> 'empate'
                             AND base.vencedor = base.palpite)::numeric / COUNT(*), 4)
  END                                                         AS percentual
FROM jogadores j
JOIN base b ON b.jogador_id = j.id
GROUP BY j.id, j.username, j.posicao;

GRANT SELECT ON ranking_palpites TO anon, authenticated;
```

- `acertos` **é** os pontos do bolão (1 por acerto). All-time, igual à view `ranking` (009).
- `percentual` segue o padrão null-safe do `pares_racha`.

## 5. Push — Edge Function `send-palpites-open-push`

Novo diretório `supabase/functions/send-palpites-open-push/` (espelho do esqueleto de `send-voting-reminders` — **não** reaproveitar aquela função, a elegibilidade é completamente diferente):

1. Valida header `x-push-cron-secret` contra o secret do vault (igual às demais).
2. Chama `listar_alvos_push_palpites(partida_id)`.
3. Para cada jogador: envia o web push (lib `web-push`, mesmas VAPID keys) e grava no ledger `push_reminder_deliveries` com `reminder_key='palpites-abertos'`, capturando `23505` para dedupe.
4. Payload da notificação: título **"Times divulgados!"**, corpo **"Preto × Branco definido. Dê seu palpite antes do apito final."**, `data: { partida_id, rota: '/partida/<id>' }` — deep-link no mesmo formato das demais notificações.

**Mensagem hardcoded na v1** (sem colunas em `notificacoes_config` nem campos no painel admin — simplificação deliberada; ver §10).

**Gatilho no front** (`PartidaTimes.tsx`): após `salvar()` bem-sucedido, se o retorno da RPC for `true` (primeira escalação), chama `dispararPushPalpitesAbertos(adminId, partidaId)` em **best-effort** — `.catch(() => {})`, sem bloquear navegação (mesmo padrão do push de votação aberta em `PartidaAoVivo.tsx`).

## 6. Frontend

### 6.1 Novo módulo `src/lib/palpites.ts`

- `interface Palpite { partida_id, jogador_id, palpite: TimeId, updated_at, username? }`
- `carregarPalpites(partidaId)`: `from('partida_palpites').select('partida_id, jogador_id, palpite, updated_at, jogadores(username)')` + flatten do join (padrão `carregarParticipantes`). Serve lista pública **e** "meu palpite" (um `find`) — uma query só.
- `registrarPalpite(partidaId, jogadorId, palpite)`: RPC `registrar_palpite`, retorna `boolean`.
- `carregarRankingPalpites()`: `from('ranking_palpites').select(...).order('acertos', desc).order('percentual', desc).order('username', asc)`.
- `palpitesAbertos(status, timesDivulgados)`: helper puro (`(status === 'draft' || status === 'live') && timesDivulgados`).

### 6.2 Novo componente `src/components/CardPalpites.tsx`

Card de destaque semântico (card com borda + `shadow-carimbo` é permitido: é destaque da rodada). Autocontido: recebe `partidaId`, `status`, `timesDivulgados`, `jogadorLogadoId`; carrega os próprios palpites com o padrão de race condition obrigatório (`let ativo = true` / cleanup) — **sem** `useCache` (estado local com refresh otimista após o voto).

**Estados:**

1. **Janela fechada por falta de escalação** (`draft`/`live` sem times): card discreto "Times ainda não divulgados — os palpites abrem na divisão das equipes."
2. **Aberto** (draft/live com times): dois botões grandes lado a lado — **TIME PRETO** (`bg-preto-time`) e **TIME BRANCO** (`bg-branco-time`), `min-h-[44px]`, `font-display uppercase tracking-wider`, `rounded-[4px]`, seleção com anel `outline-destaque-texto`. Toque = `registrarPalpite` otimista + `vibrateSuccess` + `Snackbar` "Palpite registrado no Time X"; falha = `vibrateError` + `MensagemEstado`. Abaixo, distribuição em tempo real: linha de % por time em `font-mono tabular-nums` (ex.: `PRETO 62% × 38% BRANCO`) e **lista contínua** (`divide-y divide-borda/40`) de `@username` + badge do time, com o palpite do usuário logado destacado.
3. **Encerrado** (published/closed): card mostra o resultado ("Venceu o Time Preto 5×3" ou "Empate — ninguém pontuou") e a lista com marcação de acerto/erro por palpiter (✓/✗ em `font-mono`), palpiteiro logado destacado. Vazio: "Nenhum palpite nesta rodada."
4. **Sem sessão**: segue o padrão das telas (convite a entrar, sem botão de voto).

Placar final vem de `carregarPlacar` (view `partida_placar`) — já importável de `lib/partidas.ts`.

### 6.3 `src/routes/PartidaDetalhe.tsx`

Renderizar `<CardPalpites />` abaixo de `GridTimesPartida` quando a escalação existir (`status !== 'draft' || algum time não-nulo` — mesma condição atual do grid, `PartidaDetalhe.tsx:219`). Nenhuma mudança no carregamento de dados da tela (o card é autossuficiente).

### 6.4 `src/routes/PartidaTimes.tsx`

`salvar()` captura o retorno de `salvarTimesEGoleirosPartida` (agora `primeira_vez`); se `true` e o operador é admin, dispara o push best-effort antes da navegação de volta (sem `await` bloqueante do resultado do push).

### 6.5 `src/lib/partidas.ts` e `src/lib/notificacoes.ts`

- `salvarTimesEGoleirosPartida`: `Promise<void>` → `Promise<boolean>` (retorna o valor da RPC).
- Novo wrapper `dispararPushPalpitesAbertos(adminId, partidaId)` → RPC `disparar_push_palpites_abertos`.

### 6.6 `src/routes/Ranking.tsx` — 5ª aba "Palpites"

- Adicionar `/ranking/palpites` ao array de `useSwipeTabs` e ao mapa de abas (`NavLink` "Palpites", mesmo estilo das demais).
- `metrica === 'palpites'`: `useCache` com chave própria (`ranking-palpites`; adicionar em `chavesCache.ts` se o padrão exigir) e `buscar` consultando a view `ranking_palpites`.
- Tabela com colunas próprias: `# / Atleta / PTS (acertos) / Palpites / %Acerto` — ordenação client-side local (coerente com o resto da tela; os dados agregados vêm prontos do banco).
- Pódio Top 3 reutilizado: generalizar `PodioTop3` para receber um acessor de valor (`valor: (linha) => string`) em vez do `campoMetrica` tipado em `LinhaRanking` — pequeno refactor sem mudança visual. 🏆 = maior acertos, desempate % depois alfabético (ordem já vem da query).

### 6.7 Rotas / rotas.ts

**Nenhuma rota nova**: `/ranking/:metrica` já é paramétrico e a TabBar já faz prefetch de `/ranking`.

## 7. Casos de Borda

| Caso                                     | Comportamento                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Draft sem escalação                      | Palpitar indisponível (RPC devolve `false`; card em estado informativo)                          |
| Publicação direta sem escalação prévia   | Sem palpites; card pós-publicação mostra "Nenhum palpite nesta rodada"                           |
| Jogo empatado                            | `vencedor = 'empate'` → ninguém pontua; card exibe "Empate — ninguém pontuou"                    |
| Re-escalação no draft                    | Palpites mantidos (são por letra do time); **sem** segundo push (primeira_vez = false)           |
| `excluir_partida`                        | Palpites somem por CASCADE; ranking recalcula sozinho (view)                                     |
| Jogador inativado após palpitar          | Palpite histórico permanece na lista/ranking (view não filtra `is_ativo`, igual à `ranking` 009) |
| Dois dispositivos / duplo toque          | `UNIQUE(partida_id, jogador_id)` + upsert = último palpite vale                                  |
| Palpite durante `live`                   | Permitido por decisão (fecha só na publicação)                                                   |
| Sem palpite do usuário no card encerrado | Só estatística da rodada, sem destaque pessoal                                                   |

## 8. Ordem de Implementação

1. **Migration `108_palpites_bolao.sql`** — tabela, `registrar_palpite`, retorno da `salvar_times_e_goleiros_partida`, ledger, `listar_alvos_push_palpites`, `disparar_push_palpites_abertos`, view `ranking_palpites` (§4 completo). Aplicar com `npx supabase db push`.
2. **Edge Function** `supabase/functions/send-palpites-open-push/` (§5) + deploy (`npx supabase functions deploy send-palpites-open-push`).
3. **`src/lib/palpites.ts`** + mudanças em `src/lib/partidas.ts` / `src/lib/notificacoes.ts` (§6.1, §6.5).
4. **`CardPalpites.tsx`** + integração em `PartidaDetalhe.tsx` (§6.2, §6.3).
5. **Gatilho de push em `PartidaTimes.tsx`** (§6.4).
6. **Aba Palpites em `Ranking.tsx`** + `chavesCache` + generalização do `PodioTop3` (§6.6).
7. **Validação** (§9).

Passos 3–6 podem ser um commit único de feature após o commit da migration. Executor **não commita sem pedido**.

## 9. Validação

**Obrigatória antes de fechar (AGENTS 11.2):** `npm run lint` (0 erros), `npm run format`, `npm run build`.

**Validação funcional manual (smoke):**

1. Draft com escalação salva → card de palpites visível a usuário não-admin não-participante; palpitar Preto; trocar para Branco; lista pública atualiza.
2. RPC recusa: palpitar em partida `published` (retorna `false` → feedback de erro); palpitar com username random (bloqueado).
3. Primeira escalação → push chega em dispositivo inscrito; re-save da escalação → **não** há segundo push (ledger dedupe).
4. Finalizar partida ao vivo (`live → published`) → card mostra resultado e ✓/✗; aba Palpites do Ranking reflete pontos.
5. Publicação direta via edição (`draft → published`) → mesmo fechamento de janela e resultado.
6. Empate simulado → ninguém pontua no ranking e no card.
7. `ranking_palpites` não conta palpites de partida ainda em `draft`/`live`.

## 10. Fora de Escopo (extensões futuras, não implementar agora)

- Linha/CTA "Palpites abertos" no card "Próxima Quinta" do **Resumo**.
- Templates e gate configuráveis do push em `notificacoes_config` + painel admin.
- Streak de acertos, "Palpiteiro do Ano" no Boletim Oficial (`resumo_ano`).
- Filtro por temporada no ranking de palpites (hoje: all-time, igual à view `ranking`).
- Palpite com placar exato.

---

_Checklist de conformidade AGENTS aplicável a toda implementação: zero UUID · migration 3 dígitos · RPCs com `SECURITY DEFINER SET search_path = public` + `GRANT EXECUTE` · agregação no PostgreSQL · tokens semânticos e cantos 4px · alvos ≥ 44px · hooks no topo · flag `ativo` nos effects · sem `window.confirm` · `voltar()` nos botões de retorno · `formatarMensagemErro` nos catch de UI._
