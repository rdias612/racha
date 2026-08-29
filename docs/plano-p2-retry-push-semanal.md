# Plano P2 — Retry do push semanal de convocação (varredura guiada pelo ledger)

> **Base**: `main` @ `5106f1e` · **Origem**: [analise-notificacoes-push.md](./analise-notificacoes-push.md) §P2
> (linhas 122–139) · **Migrations desta entrega**: a partir de **106** (001–105 já aplicadas em produção).
> ⚠️ A numeração **pode deslocar** se os planos irmãos (P3 — push de votação aberta, P6 — painel de
> entregas) forem executados primeiro e consumirem 106/107. Nenhuma dependência técnica entre eles:
> o P2 é autocontido em uma migration.

---

## 1. Contexto e objetivo

A análise de notificações push (`docs/analise-notificacoes-push.md` §P2) diagnosticou que o push
semanal de convocação de presença é **tiro único**: o cron `agendar-partida-semanal` dispara a Edge
Function `send-confirmation-requests {partida_id}` uma única vez, no dia/horário configurado em
`notificacoes_config` (atualmente terça 16:05 BRT em produção). Se essa execução falhar — cold start
do Deno, erro runtime na function, blip do pg_net — a semana fica sem convocação. A única rede de
segurança é o **reforço** (`modo 2` da mesma function, chamado pelo cron de 1 minuto dentro da janela
`[prazo − reforco_horas_antes_prazo, prazo)`), que só alcança quem continua `'pendente'` e chega
somente na quarta, véspera do prazo.

O contraste da análise é instrutivo: os buckets de votação têm retry natural porque cada um tem
janela de captura varrida por um cron de 1 minuto; o disparo semanal não tem nada equivalente. A
proposta da análise (§P2, "Como corrigir") é aproveitar o job `enviar-push-reminders-1min` que já
roda todo minuto e adicionar uma varredura de reparo: _"existe partida draft desta semana, com
`confirmacao_closes_at` no futuro, sem nenhuma linha `reminder_key='confirmacao'` no ledger, e já
passaram N minutos do horário configurado? → dispara e grava"_.

**Objetivo deste plano**: tornar o disparo semanal **idempotente e auto-reparável**, com a varredura
de reparo rodando no job de 1 minuto, guiada pelo ledger `push_reminder_deliveries` (marcador
autoritativo de "já enviado", escrito pela própria Edge Function por jogador). Nada mais muda: sem
novo cron, sem mudança na Edge Function, sem mudança no frontend, sem alterar
`salvar_configuracoes_notificacoes`.

---

## 2. Estado atual medido (código real, base `5106f1e`)

Cada premissa com referência `arquivo:linha` verificada nesta sessão. Fatos apenas informados na
sessão (não verificáveis no código) estão marcados como tais.

| #   | Premissa                                                                                                                                                                                                                                                                 | Evidência                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | O job semanal `agendar-partida-semanal` é agendado com expressão derivada de `notificacoes_config` (`%s %s * * %s`, minuto/hora **UTC** = BRT+3) e chama `criar_partida_semanal_mensalistas()`; se retornar NULL, cai no fallback "partida draft desta semana, maior id" | `supabase/migrations/104_fix_push_cron_fire_and_forget.sql:380-463` (seleção em 104:417–425, fallback idêntico ao da 081)                                   |
| 2   | O disparo semanal é **fire-and-forget** (`net.http_post` puro, timeout 8000ms, sem coleta de resposta) e grava apenas um **batimento honesto** em `cron_execucoes` ("Disparo fire-and-forget enfileirado para partida X")                                                | `104:444-458`; o mesmo corpo existe em `salvar_configuracoes_notificacoes` (`104:247-304`), que reagenda o job ao salvar dia/horário                        |
| 3   | O job `enviar-push-reminders-1min` (`* * * * *`) enfileira 2 POSTs fire-and-forget (`send-voting-reminders` e `send-confirmation-requests` com body `{}` — modo reforço), grava batimento e faz retenção de 30 dias em `cron_execucoes`                                  | `104:315-378` (POSTs em 104:351–363, batimento 104:365–372, retenção 104:374–375)                                                                           |
| 4   | `disparar_e_registrar_cron_http` (com coleta de resposta) hoje é usado **apenas** pelos disparos manuais do admin (`disparar_confirmacao_manual`, `disparar_push_teste`), com timeout de coleta de 2s; a coleta é assíncrona desde a 105                                 | `104:74-171` (chamadas com `2000` em 104:115–121 e 104:161–167); `105:19-136`                                                                               |
| 5   | Ledger `push_reminder_deliveries`: PK `(partida_id, jogador_id, reminder_key)`; CHECK aceita `'6h','3h','1h','30m','confirmacao','reforco'` (+ slots HH:MM); sem acesso direto do client (REVOKE)                                                                        | `036:18-29` e `036:35`; CHECK relaxado em `057:40-47` e `077:54-63`                                                                                         |
| 6   | Modo 1 da Edge Function (`{partida_id}`) é **idempotente por jogador via ledger**: `claim()` insere e trata 23505; envia só se o claim for dela; depois atualiza `sent_at`/`error_message`; se `confirmacao_ativo = false`, aborta com 200 sem enviar                    | `supabase/functions/send-confirmation-requests/index.ts:1-13` (docstring), `:143-156` (claim), `:193-200` (update), `:279-329` (modo 1; skip em `:281-283`) |
| 7   | Modo 2 (reforço, body `{}`) localiza a partida draft com maior id **e prazo NOT NULL**, e só envia dentro de `[prazo − horas, prazo)` com `reminder_key='reforco'`                                                                                                       | `index.ts:331-380` (janela em `:341-352`); audiência vem de `listar_pendentes_confirmacao`                                                                  |
| 8   | `listar_pendentes_confirmacao(p_partida_id)`: pendentes com subscrição em 1 round-trip — exige `status='draft'`, `confirmacao_closes_at IS NOT NULL` (no modo sem id), `status_confirmacao='pendente'`, não-goleiro, ativo, não-random                                   | `090:95-157` (seleção de partida em 090:117–123, filtros em 090:143–153)                                                                                    |
| 9   | `criar_partida_semanal_mensalistas()` cria a partida da semana com `confirmacao_closes_at` = quarta 16h BRT e pré-inscreve mensalistas como `'pendente'`; é idempotente (retorna NULL se já há draft na semana)                                                          | `059:11-62` (prazo em 059:29, insert em 059:47–49)                                                                                                          |
| 10  | **Partida manual (PartidaNova → RPC `criar_partida`) NÃO define `confirmacao_closes_at`** — drafts manuais ficam sem prazo e, portanto, fora do fluxo de convocação/reforço                                                                                              | `013:41-43` (INSERT sem a coluna)                                                                                                                           |
| 11  | `notificacoes_config`: `confirmacao_dia_semana BETWEEN 1 AND 3` (seg–qua), `confirmacao_horario < 21:00`, e CHECK composto "dia 3 ⇒ horário < 16:00" (nunca depois do prazo)                                                                                             | `077:16-45` (linhas 19, 20 e 42–44)                                                                                                                         |
| 12  | `push_reminder_deliveries` tem FK CASCADE para partidas e jogadores (sem órfãos)                                                                                                                                                                                         | `036:19-20`                                                                                                                                                 |
| 13  | TTL/urgency por envio já implementados (P4): convocação sai com `TTL 24h`, `urgency: 'high'`                                                                                                                                                                             | `index.ts:36-39` e `:180-183`                                                                                                                               |
| 14  | **Informado na sessão (não verificável no código)**: statement_timeout no hosted Supabase = 3s (anon) / 8s (authenticated); migrations 001–105 aplicadas; config de produção = **terça 16:05 BRT** (`dia=2`, `16:05`) — validar em produção no passo 6.1                 | —                                                                                                                                                           |

**Divergências análise × código** (a análise foi escrita na base `1e1408e`, antes do P5):

1. A análise §P2 diz que o disparo acontece "na segunda às 10h" — hoje o dia/horário é
   **configurável** (`077`), e em produção está em terça 16:05 BRT. O desenho abaixo é independente
   do dia/horário (lê a config a cada minuto).
2. A análise descreve o job semanal integrado ao pipeline de logging da 099; desde a
   104/105 ele é **fire-and-forget puro** e `disparar_e_registrar_cron_http` só sobrou nos disparos
   manuais. Isso **reforça** a premissa do enunciado: o marcador de "já enviado" para retry tem de
   ser o ledger (escrito pela Edge Function por jogador), nunca a `cron_execucoes` (cujo batimento
   diz apenas "enfileirado").
3. A análise sugeriu numeração a partir de 103 — desatualizado; esta entrega começa em **106**.

---

## 3. Design da solução (decisões e justificativas)

### 3.1 A varredura mora no job de 1 minuto, em SQL puro — sem tocar a Edge Function

**Decisão**: uma função plpgsql `verificar_e_disparar_convocacao_semanal()` chamada pelo corpo do
job `enviar-push-reminders-1min`, que replica a condição da análise e, quando positiva, enfileira o
**modo 1 já existente** da `send-confirmation-requests` (`{partida_id}`, fire-and-forget, padrão da
104).

**Justificativa**:

- O modo 1 já é idempotente por jogador (claim no ledger, `index.ts:143-156`) — re-disparar é seguro
  e a análise §P2 já apontava que "o que falta é quem chame de novo".
- Zero deploy de Edge Function (menor raio de explosão; as functions já estão deployadas com P4/P5).
- O job de 1 minuto **já roda**; a varredura inerte custa ~5 queries indexadas por minuto (sem POST).
  Colocar a decisão dentro da Edge Function exigiria uma invocação HTTP extra todo minuto mesmo quando
  não há nada a fazer, além de mover para o Deno a leitura de config/janela — mais caro e mais pontos
  de falha.
- A varredura lê `notificacoes_config` **a cada execução**: mudanças de dia/horário valem para o
  retry imediatamente, sem precisar reagendar nada (`salvar_configuracoes_notificacoes` continua
  cuidando apenas do job semanal primário).

### 3.2 Condição de disparo (todas obrigatórias)

```
confirmacao_ativo = true
E agora_brt >= (ocorrência do dia/horário configurado NESTA semana) + 5 min
E throttle: nenhuma tentativa de reparo nos últimos 15 min
E existe partida com status='draft', confirmacao_closes_at IS NOT NULL,
  cuja semana ISO (BRT) de data_jogo = semana atual        (maior id)
E confirmacao_closes_at > now()
E NÃO existe linha reminder_key='confirmacao' no ledger dessa partida
E existe ao menos 1 alvo real (listar_pendentes_confirmacao(partida) retorna linha)
→ enfileira POST {partida_id} e grava batimento em cron_execucoes
```

### 3.3 O que conta como "já enviado": o ledger, nunca a cron_execucoes

Como o disparo semanal é fire-and-forget (premissa 2/§2), nenhuma tabela de batimento pode dizer se
a entrega aconteceu. O marcador autoritativo é `push_reminder_deliveries` com
`reminder_key='confirmacao'`, escrito pela Edge Function **por jogador** no momento do claim
(`claim()` em `index.ts:144-156`, invocado pelo modo 1 em `index.ts:316-322`). Basta **uma** linha dessa chave para a partida estar "convocada" e a varredura
silenciar. Consequência aceita (documentada): falha **parcial** de envio (ex.: 3 de 14 notificados,
restante com erro transitório de web-push) deixa linhas no ledger → a varredura NÃO re-tenta os que
falharam. Isso é falha de entrega por aparelho (território P1/P6), não falha de disparo (P2) — fora
do escopo.

A `cron_execucoes` tem dois papéis **auxiliares**, ambos honestos:

1. **Throttle** (3.5): a linha `job_nome='retry-convocacao-semanal'` marca _tentativa de disparo_,
   nunca entrega.
2. **Observabilidade**: as linhas aparecem de graça na tela admin de execuções de cron
   (`obter_execucoes_cron`, `104:29-68`), sem nenhum trabalho de UI — o admin passa a VER que o
   reparo agiu.

### 3.4 Janela de retry: `[horário configurado + 5 min, confirmacao_closes_at)`

- **Início com tolerância de 5 min**: dá ao tiro primário (cron semanal + cold start + envio
  sequencial) tempo de concluir e popular o ledger antes da varredura acordar. Sem tolerância, os
  dois disparariam no mesmo minuto — inofensivo pelo ledger, mas geraria par de linhas confuso no log.
- **Fim em `confirmacao_closes_at`**: após o prazo, as reservas dos pendentes são liberadas
  (`057:8-10`, codificada operacionalmente em `057:14-17`) e a mensagem "confirme até {prazo}"
  ficaria mentirosa. É o mesmo limite do modo 2 e
  espelha a condição da análise ("com `confirmacao_closes_at` no futuro"). Na semana típica
  (terça 16:05 → quarta 16:00), a janela dura ~24h.
- **Interação com o reforço**: os dois alcançam a **mesma audiência** (pendentes com subscrição,
  `listar_pendentes_confirmacao`), mudando template e timing. Se o disparo semanal falhar e o reparo
  também (instabilidade prolongada), o reforço continua como rede de segurança na quarta; se ambos
  atuarem, cada jogador recebe no máximo 1 convocação + 1 reforço (chaves separadas no ledger, PK
  individual). Nenhuma mudança no modo 2.

### 3.5 Throttle de 15 minutos + gate de audiência (evita tiros inúteis em loop)

Dois cenários deixam o ledger **vazio para sempre** mesmo com envio funcionando:
(a) não há pendentes (todos confirmaram); (b) há pendentes mas **nenhum tem subscrição ativa** —
o modo 1 devolve `targets: 0` sem escrever nada. Sem proteção, a varredura dispararia um POST por
minuto até o prazo (~1.400 executions/dia). Proteção em duas camadas:

1. **Gate de audiência**: só dispara se `listar_pendentes_confirmacao(partida)` retorna ao menos uma
   linha — fonte única de verdade sobre "alguém a notificar" (sem duplicar os filtros da `090` em
   SQL). Se não há ninguém, não há o que reparar: silêncio.
2. **Throttle de 15 min** via linha em `cron_execucoes`: cobre o caso em que a function falha
   **antes** do primeiro claim (ex.: config read falha, 500) — ledger vazio + audiência presente →
   re-tenta a cada 15 min em vez de a cada minuto (≤ 96 POSTs/dia no pior caso), e ainda serve de
   trilha de auditoria. No caso saudável, o primeiro POST já grava os claims no ledger e a varredura
   nunca mais dispara naquela partida: **1 linha de log por semana reparada**.

### 3.6 Mudança de dia/horário no meio da semana

A ocorrência de referência é **recalculada a cada minuto** com a config vigente (semana ISO atual,
`date_trunc('week')` em BRT — mesmo padrão de `059:25` e `104:421`):

| Cenário                                                                            | Efeito                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config movida para **frente** (ex.: terça 16:05 → quarta 12:00) na quarta de manhã | A ocorrência desta semana passa a estar no futuro → varredura silenciosa; o cron semanal foi reagendado por `salvar_configuracoes_notificacoes` e dispara na quarta 12:00. Alinhados por construção. |
| Config movida para **trás** (ex.: terça → segunda) após a terça                    | A ocorrência desta semana já passou → a varredura repara em ≤ 15 min (o cron semanal, reagendado, só dispararia na próxima segunda). É exatamente o auto-reparo desejado.                            |
| Config movida **antes** do disparo da semana (caso comum)                          | Sem efeito: o tiro primário acontece no novo horário; a varredura só entra se ele falhar.                                                                                                            |

### 3.7 Quando não há partida draft: a varredura NÃO cria partida

**Decisão deliberada, fiel à análise** ("existe partida draft desta semana"): o reparo cobre o
**push**, não a criação. Se a semana não tem draft, a varredura retorna `false` sem efeito colateral.

**Justificativa**: incluir `criar_partida_semanal_mensalistas()` na varredura traria uma regressão
real — hoje, se o admin **exclui** o draft da semana (ex.: feriado, "não terá racha"), a exclusão
permanece; com criação na varredura, a partida seria ressuscitada em ≤ 15 min contra a decisão do
admin. O gap residual (o job semanal falhar ANTES de criar a partida) é muito mais raro e tem
remediação manual barata (PartidaNova + reenvio manual do admin), já prevista no produto.

**Detalhe**: a partida é selecionada já filtrando `confirmacao_closes_at IS NOT NULL` — o mesmo
critério do modo sem-id de `listar_pendentes_confirmacao` (`090:120`). Isso blinda contra falsos
positivos: drafts manuais da semana (PartidaNova) não têm prazo (premissa 10/§2) e são ignorados pela
varredura, mesmo que tenham id maior que o draft do cron.

### 3.8 Reenvio manual do admin não interage com a varredura

O modo 3 (`{partida_id, reenviar:true}`) é ação explícita do admin e **não consulta nem escreve no
ledger** (`index.ts:12-13, 236-277`). Se o admin reenviar manualmente e a varredura disparar depois
(ledger ainda vazio), os pendentes podem receber a convocação 2× com minutos de diferença. **Aceito**:
é raro (o reenvio manual costuma acontecer depois que o reparo automático já agiu), as mensagens são
idênticas e verdadeiras, e alterar a semântica do modo 3 está fora do escopo fechado.

### 3.9 Corpo do job: varredura por último e embrulhada em EXCEPTION

Lição da P5 (`104:1-7`): uma exceção no bloco DO do job faz **rollback da transação inteira** e
descarta os POSTs já enfileirados. Portanto a chamada da varredura entra **após** os dois POSTs
existentes e embrulhada em `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END;` — o código novo jamais
pode quebrar o comportamento atual do job.

### 3.10 Orçamento de tempo / statement_timeout

A função é O(poucas queries indexadas + `listar_pendentes_confirmacao`, que é STABLE e indexada) e o
`net.http_post` é apenas enfileiramento no pg_net — cabe folgado nos 3s/8s dos roles de cliente caso
alguém a invoque manualmente (inclusive para validação no passo 6). Dentro do cron a sessão do
worker **também** está sujeita a statement_timeout — a era 099 provou isso empiricamente (a coleta
bloqueante cancelava o job; ver §P5 da análise). A segurança deste desenho apoia-se em dois fatos
medidos: (a) o trabalho novo é leve e o fire-and-forget da 104 não bloqueia — os batimentos
`sucesso=true` minuto a minuto em produção desde a 104 comprovam que o job cabe no orçamento; e
(b) mesmo num cancelamento hipotético, o `EXCEPTION WHEN OTHERS` do §3.9 contém o dano ao
comportamento existente do job.

---

## 4. Plano de execução passo a passo

Artefato único: **`supabase/migrations/106_retry_convocacao_semanal.sql`**. Nenhuma mudança em
`src/` (lint/build/format ficam trivialmente verdes), nenhuma mudança em `supabase/functions/`,
nenhuma mudança em `salvar_configuracoes_notificacoes` nem no job semanal.

> Antes de escrever a migration, **capturar o corpo vigente do job de 1 minuto em produção**
> (`SELECT command FROM cron.job WHERE jobname = 'enviar-push-reminders-1min';`) e partir dele —
> se um plano irmão alterou o job no intervalo, a base de cópia é a de produção, não a da 104.

### Passo 1 — Migration `106_retry_convocacao_semanal.sql`

Estrutura (esboço **estrutural**: os blocos marcados "IDÊNTICOS" NÃO estão transcritos — o executor
deve copiá-los literal do `command` vigente do job em produção, conforme a nota que antecede esta
seção):

```sql
-- 106_retry_convocacao_semanal.sql
--
-- P2 (docs/analise-notificacoes-push.md §P2): o push semanal de convocação é
-- tiro único. Esta migration torna o disparo auto-reparável: o job de 1 minuto
-- ganha uma varredura guiada pelo ledger — se já passou (com 5 min de
-- tolerância) o horário configurado desta semana, existe partida draft com
-- confirmacao_closes_at no futuro e NENHUMA linha reminder_key='confirmacao'
-- no ledger, re-dispara o modo 1 da send-confirmation-requests (idempotente
-- por jogador via claim no ledger). Sem mudanças na Edge Function; a config
-- é relida a cada execução, então mudar dia/horário no painel vale para o
-- retry imediatamente.

-- ----------------------------------------------------------------------------
-- 1. VARREDURA DE REPARO (inerte fora da janela; chamada pelo job de 1 min)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verificar_e_disparar_convocacao_semanal()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ativo      boolean;
  v_dia        smallint;
  v_horario    time;
  v_agora_brt  timestamp;
  v_ocorrencia timestamp;
  v_partida_id bigint;
  v_closes_at  timestamptz;
  v_secret     text;
  v_req        bigint;
BEGIN
  -- 1) Config vigente (lida a cada execução: mudança no painel vale na hora)
  SELECT confirmacao_ativo, confirmacao_dia_semana, confirmacao_horario
    INTO v_ativo, v_dia, v_horario
    FROM notificacoes_config
    WHERE id = 1;

  IF v_ativo IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- 2) Ocorrência do disparo semanal NESTA semana (segunda ISO), em BRT
  --    (mesmo padrão de semana/fuso de 059:25 e 104:421; BRT fixo UTC-3)
  v_agora_brt := now() AT TIME ZONE 'America/Sao_Paulo';
  v_ocorrencia := date_trunc('week', v_agora_brt)
    + (v_dia - 1) * interval '1 day'
    + EXTRACT(HOUR FROM v_horario) * interval '1 hour'
    + EXTRACT(MINUTE FROM v_horario) * interval '1 minute';

  -- Tolerância: dá ao tiro primário (cron semanal) tempo de concluir
  IF v_agora_brt < v_ocorrencia + interval '5 minutes' THEN
    RETURN false;
  END IF;

  -- 3) Throttle: no máx. 1 tentativa de reparo a cada 15 min. A linha em
  --    cron_execucoes é batimento de TENTATIVA — nunca marca entrega
  --    (entrega é papel do ledger, escrito pela Edge Function por jogador).
  IF EXISTS (
    SELECT 1 FROM cron_execucoes
    WHERE job_nome = 'retry-convocacao-semanal'
      AND executado_em > now() - interval '15 minutes'
  ) THEN
    RETURN false;
  END IF;

  -- 4) Partida alvo: draft DESTA semana com prazo definido, maior id.
  --    Drafts manuais (PartidaNova/013) não têm prazo e ficam de fora.
  SELECT p.id, p.confirmacao_closes_at
    INTO v_partida_id, v_closes_at
    FROM partidas p
    WHERE p.status = 'draft'
      AND p.confirmacao_closes_at IS NOT NULL
      AND date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo')
        = date_trunc('week', v_agora_brt)
    ORDER BY p.id DESC
    LIMIT 1;

  -- Sem draft: NÃO cria partida (evita ressuscitar draft excluído pelo admin)
  IF v_partida_id IS NULL THEN
    RETURN false;
  END IF;

  -- 5) Prazo tem de estar no futuro (após closes_at a convocação mente)
  IF v_closes_at <= now() THEN
    RETURN false;
  END IF;

  -- 6) Marcador autoritativo de "já enviado": o ledger (claim por jogador
  --    com PK + catch 23505 na Edge Function). Uma linha basta para calar.
  IF EXISTS (
    SELECT 1 FROM push_reminder_deliveries
    WHERE partida_id = v_partida_id
      AND reminder_key = 'confirmacao'
  ) THEN
    RETURN false;
  END IF;

  -- 7) Gate de audiência: só dispara se há alguém a notificar (pendentes com
  --    subscrição). Fonte única de verdade = listar_pendentes_confirmacao (090).
  --    Sem isso, ledger vazio + zero alvos geraria POST inútil a cada ciclo.
  PERFORM 1 FROM listar_pendentes_confirmacao(v_partida_id) LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 8) Disparo fire-and-forget (padrão 104): enfileira o modo 1 da function;
  --    entrega e ledger ficam por conta dela.
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  IF v_secret IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('retry-convocacao-semanal', false, 'Secret push_cron_secret não encontrado no vault.');
    RETURN false;
  END IF;

  SELECT net.http_post(
    url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', v_secret
    ),
    body := jsonb_build_object('partida_id', v_partida_id),
    timeout_milliseconds := 8000
  ) INTO v_req;

  IF v_req IS NOT NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, resposta)
    VALUES ('retry-convocacao-semanal', true,
            'Varredura reparou a convocação da partida ' || v_partida_id::text || ' (migration 106).');
  ELSE
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('retry-convocacao-semanal', false, 'Falha ao enfileirar net.http_post.');
  END IF;

  RETURN v_req IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION verificar_e_disparar_convocacao_semanal() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. REAGENDA O JOB DE 1 MINUTO: corpo da 104 + varredura (por último e com
--    EXCEPTION, para que um erro do código novo jamais faça rollback dos
--    POSTs já enfileirados — lição da P5)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-push-reminders-1min') THEN
    PERFORM cron.unschedule('enviar-push-reminders-1min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'enviar-push-reminders-1min',
  '* * * * *',
  $push_job$
  DO $$
  DECLARE
    v_secret  text;
    v_headers jsonb;
    v_req_1   bigint;
    v_req_2   bigint;
  BEGIN
    -- ... bloco IDÊNTICO à 104:327-363 (vault → headers → 2 POSTs
    --     fire-and-forget: send-voting-reminders e send-confirmation-requests
    --     com body '{}') — copiar literal da 104 / do command vigente ...

    -- 3. Varredura de reparo da convocação semanal (P2)
    BEGIN
      PERFORM verificar_e_disparar_convocacao_semanal();
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- defensivo: o reparo não pode derrubar o job (lição da P5)
    END;

    -- ... batimento e retenção IDÊNTICOS à 104:365-375 ...
  END $$;
  $push_job$
);
```

Notas de convenção (AGENTS.md §7): migration sequencial de 3 dígitos (`106_...`), função em
português no infinitivo (composto `verificar_e_disparar_*`, precedido por
`disparar_e_registrar_cron_http` da 099), `SECURITY DEFINER SET search_path = public`,
`GRANT EXECUTE ... TO anon, authenticated` explícito, zero UUID, sem nova tabela e sem ALTER
(o CHECK do ledger já aceita `'confirmacao'` desde a 057). A função é `VOLATILE` (escreve em
`cron_execucoes` e enfileira POST) — não marcar `STABLE`.

### Passo 2 — Aplicar

- `npx supabase db push` (padrão do projeto, ver `GUIA/MIGRACOES_AUTOMATICAS.md`).
- Conferir no resultado que as duas statements (CREATE FUNCTION + cron.schedule) aplicaram sem erro.

### Passo 3 — Verificação pós-deploy imediata (barata)

Queries de leitura (passo 6.1 abaixo). Nada de código novo no repositório além da migration.

### Rollback (se necessário)

A migration é aditiva e a função é inerte fora da janela. Reverter = reexecutar o bloco
"REAGENDAR O JOB DE 1 MINUTO" da 104 (corpo sem a varredura) e `DROP FUNCTION IF EXISTS
verificar_e_disparar_convocacao_semanal();`.

---

## 5. Casos de borda e estados de erro

| #   | Caso                                                                                                             | Comportamento                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sem draft na semana (job semanal falhou antes de criar, ou partida excluída de propósito)                        | Varredura retorna `false` sem criar nada (§3.7). Gap residual documentado: criação manual via PartidaNova + reenvio manual do admin.                                                                                                  |
| 2   | Draft manual da semana (PartidaNova, sem prazo)                                                                  | Ignorado: filtro `confirmacao_closes_at IS NOT NULL` (§3.7). Se existirem draft do cron + manual, a varredura pega o de maior id **com prazo** — que é o do cron.                                                                     |
| 3   | Tiro primário ok (ledger populado)                                                                               | Varredura silenciosa para sempre naquela partida (condição 6).                                                                                                                                                                        |
| 4   | Tiro primário falhou (cold start / blip pg_net / function 500 antes do 1º claim)                                 | Reparo em ≤ 15 min (throttle) dentro da janela; nova falha → nova tentativa a cada 15 min até `closes_at`.                                                                                                                            |
| 5   | Envio falhou DEPOIS do claim (erro web-push por jogador)                                                         | Ledger tem linha (com `error_message`) → varredura não re-tenta. Falha por aparelho = P1/P6, fora do escopo (§3.3).                                                                                                                   |
| 6   | Zero pendentes (todos confirmaram) ou zero pendentes com subscrição                                              | Gate de audiência (condição 7) → silêncio, zero POSTs inúteis (§3.5).                                                                                                                                                                 |
| 7   | Config mudada no meio da semana                                                                                  | §3.6: para frente = alinhado com o cron reagendado; para trás = reparo imediato; antes do disparo = sem efeito.                                                                                                                       |
| 8   | `confirmacao_ativo = false`                                                                                      | Varredura retorna `false` na 1ª condição; o modo 1 re-verifica (`index.ts:281-283`) — dupla proteção.                                                                                                                                 |
| 9   | Disparo semanal e varredura no mesmo minuto (corrida)                                                            | Inofensivo: claims com PK `(partida_id, jogador_id, reminder_key)` + catch 23505; cada jogador recebe no máximo 1 convocação.                                                                                                         |
| 10  | Job semanal e job de 1 min executam simultaneamente na mesma vira-de-minuto                                      | pg_cron não sobrepõe runs do mesmo job; entre jobs distintos a idempotência do ledger resolve.                                                                                                                                        |
| 11  | Secret `push_cron_secret` ausente no vault                                                                       | Linha de erro em `cron_execucoes` (`sucesso=false`) — visível na tela admin; throttle segura o ritmo das retentativas.                                                                                                                |
| 12  | Exceção inesperada na varredura                                                                                  | `EXCEPTION WHEN OTHERS` no corpo do job: os dois POSTs existentes e o batimento commitam normalmente (§3.9).                                                                                                                          |
| 13  | Reforço dispara antes do reparo (janela de reforço já aberta quando o reparo acorda)                             | Ambos enviam (chaves `confirmacao` × `reforco` separadas); jogador recebe no máx. 1 de cada; mensagens distintas e verdadeiras (§3.4).                                                                                                |
| 14  | Deploy no meio da janela, com ledger já populado                                                                 | Varredura nasce silenciosa (condição 6); com ledger vazio e janela ativa, repara uma única vez. Sem push retrô fora da janela (prazo passado → condição 5).                                                                           |
| 15  | Primeira/múltipla drafts na semana após `date_trunc('week')` (domingo pós-jogo ainda em draft com prazo vencido) | Condição 5 (prazo futuro) falha → silêncio.                                                                                                                                                                                           |
| 16  | Config degenerada: `dia=3` (quarta) com horário ≥ 15:55 (o CHECK `077:42-44` permite até 15:59)                  | Janela de reparo `[horário+5min, closes_at = qua 16:00)` fica vazia → a varredura jamais age naquela semana se o primário falhar. Benigno: o reforço `[12:00, 16:00)` continua como rede e o CHECK impede configurar depois do prazo. |

---

## 6. Estratégia de validação em produção

Sem testes automatizados (decisão do usuário) — validação 100% via SQL editor / REST após o push,
em 4 momentos:

### 6.1 Imediatamente após o deploy (invariância)

```sql
-- a) Config vigente (confirma a premissa "terça 16:05" e o valor de dia/horário
--    para interpretar as janelas nos testes seguintes)
SELECT confirmacao_ativo, confirmacao_dia_semana, confirmacao_horario,
       reforco_ativo, reforco_horas_antes_prazo
FROM notificacoes_config;

-- b) Job de 1 min reagendado com a varredura no corpo
SELECT jobname, schedule, command LIKE '%verificar_e_disparar_convocacao_semanal%' AS tem_varredura
FROM cron.job WHERE jobname = 'enviar-push-reminders-1min';   -- espera: true, '* * * * *'

-- c) Job semanal intacto (horário da config)
SELECT jobname, schedule FROM cron.job WHERE jobname = 'agendar-partida-semanal';

-- d) Função criada e executável
SELECT proname FROM pg_proc WHERE proname = 'verificar_e_disparar_convocacao_semanal';

-- e) Batimentos continuando minuto a minuto (job não quebrou)
SELECT executado_em, sucesso FROM cron_execucoes
WHERE job_nome = 'enviar-push-reminders-1min' ORDER BY id DESC LIMIT 5;
```

### 6.2 Teste dirigido do caminho feliz (invasivo, controlado)

Com a partida draft da semana atual com prazo futuro e **fora** do horário do reforço:

```sql
-- 1) Estado inicial: convocação ainda não entregue
SELECT count(*) FROM push_reminder_deliveries
WHERE partida_id = <id_draft_semana> AND reminder_key = 'confirmacao';   -- espera: 0

-- 2) Invocar a varredura manualmente (cabe no statement_timeout de 8s; é o
--    mesmo caminho que o job executa — inclusive grava o batimento)
SELECT public.verificar_e_disparar_convocacao_semanal();                 -- espera: true

-- 3) Batimento do reparo (conferir de imediato) + conferência do ledger
SELECT job_nome, sucesso, resposta FROM cron_execucoes
WHERE job_nome = 'retry-convocacao-semanal' ORDER BY id DESC LIMIT 3;

-- ATENÇÃO: o ledger só é populado quando a Edge Function TERMINAR de rodar
-- (cold start do Deno pode levar dezenas de segundos). Aguarde 30–60s antes
-- da query abaixo; se vier vazia, aguarde mais e reconsulte — vazio na
-- primeira checagem NÃO é falha.

SELECT jogador_id, claimed_at, sent_at, error_message
FROM push_reminder_deliveries
WHERE partida_id = <id_draft_semana> AND reminder_key = 'confirmacao';   -- espera: 1 linha por pendente com subscrição
```

Confirmação fim-a-fim: ao menos um aparelho real (do admin) recebe a notificação de convocação.

### 6.3 Idempotência e silêncio (anti-duplicidade)

```sql
-- a) Segunda chamada com ledger já populado: false, sem nova linha de log
SELECT public.verificar_e_disparar_convocacao_semanal();                 -- espera: false

-- b) Modo 1 da Edge Function é idempotente (claim já feito): claimed: 0, nada novo no ledger
--    (POST REST com header x-push-cron-secret e body {"partida_id": <id>})

-- c) Job de 1 min parou de tentar reparar: nenhuma linha nova de
--    'retry-convocacao-semanal' após 2–3 minutos
SELECT max(executado_em) FROM cron_execucoes WHERE job_nome = 'retry-convocacao-semanal';
```

### 6.4 Semana natural (observação passiva, sem intervenção)

- **Antes** do horário configurado: nenhuma linha `retry-convocacao-semanal`.
- **Depois** do disparo de terça (ou do dia configurado) com sucesso: apenas o batimento
  `agendar-partida-semanal`; **zero** linhas de retry.
- Simulação de falha (opcional, uma única semana): renomear temporariamente o secret no vault NÃO é
  recomendado; alternativa segura — aguardar uma semana em que o disparo falhe naturalmente, ou
  validar pelo cenário 6.2 já executado fora do horário (que reproduz exatamente o estado
  "convocação pendente").
- Tela admin de execuções de cron (existente, via `obter_execucoes_cron`) deve exibir as linhas
  `retry-convocacao-semanal` quando houver reparo — zero trabalho de UI, só conferir.

---

## 7. Esforço, riscos e ordem de execução

**Esforço**: P-M — **uma** migration (~150 linhas de SQL), sem TS, sem Edge Function, sem UI.
Estimativa: 2–4 h incluindo a validação do passo 6 (o cenário 6.2 depende de estar fora do horário
do reforço ou de uma semana em andamento com convocação pendente).

**Riscos e mitigações**:

| Risco                                                                                        | Prob. | Impacto | Mitigação                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Recriar o corpo do job de 1 min por cópia (104) e regredir algo se outro plano alterou o job | Baixa | Médio   | Copiar do **command vigente em produção** (`cron.job`), não do arquivo; varredura entra como bloco isolado + EXCEPTION; validação 6.1e/6.4 |
| Duplicação de convocação (reenvio manual do admin + varredura)                               | Baixa | Baixo   | Aceito e documentado (§3.8); mensagens idênticas e verdadeiras                                                                             |
| Ruído em `cron_execucoes` no pior caso (function fora do ar por horas: 1 linha/15 min)       | Baixa | Baixo   | Throttle de 15 min; retenção de 30 dias já existente (`104:374-375`)                                                                       |
| Drift do gate de audiência se `listar_pendentes_confirmacao` mudar no futuro                 | Baixa | Baixo   | O gate chama a própria RPC (fonte única), não replica filtros em SQL (§3.5)                                                                |
| Aritmética de semana/fuso errada                                                             | Baixa | Médio   | Replicada do padrão consolidado (`059:25`, `104:421`); BRT fixo UTC-3 (sem DST); validação 6.2/6.3 exercita a condição inteira             |
| Comportamento novo: push tardio de convocação dentro da janela (até `closes_at`)             | —     | Baixo   | É exatamente o objetivo (mensagem verdadeira até o prazo); reforço e convocação têm templates distintos                                    |

**Ordem sugerida**: executar o P2 sozinho, a qualquer momento — não depende dos planos irmãos
(P3 toca `send-voting-reminders` + CHECK de `reminder_key`; P6 toca RPC de leitura + UI; nenhum
conflita semanticamente com a varredura). Se P3 ou P6 aplicarem migration antes, renumerar esta para
o próximo número livre (107, 108...) e rebasear o corpo do job do command vigente.

---

## 8. Escopo fechado

Dentro: migration 106 (função de varredura + reagenda do job de 1 min), validação em produção.
Fora (explicitamente): criação de partida na varredura; re-tentativa de entregas parciais falhadas
por aparelho (P1/P6); push de "votação aberta" (P3); qualquer tela/painel novo no frontend (P6);
mudanças na Edge Function `send-confirmation-requests` (incl. modo 3/reenviar); novos campos em
`notificacoes_config`; refatorações paralelas em `disparar_e_registrar_cron_http` ou nos demais jobs.
