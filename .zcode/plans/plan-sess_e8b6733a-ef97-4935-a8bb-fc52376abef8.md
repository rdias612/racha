# Agendamento automático + confirmação de mensalistas (revisão v3)

**Mudanças nesta revisão (ajustes pedidos):**
1. Jogador **confirmado pode desconfirmar** (imprevisto) na própria tela.
2. **Admins podem alterar o status de qualquer jogador** — confirmar, desconfirmar ou recusar qualquer um, inclusive o admin que criou a partida.

Tudo continua regido por **uma regra única de capacidade (16)**: sair (desconfirmar/recusar) sempre libera vaga; confirmar/reaver vaga respeita o limite de 16. Confirmamentos só valem enquanto a partida está em `draft`.

## Fluxo (visão geral)
Toda **segunda 10h (BR)**: (1) cria a partida de **quinta 19h (BR)** com os mensalistas ativos pré-inscritos, e (2) dispara um **push pedindo confirmação**. Lista **pública** em `/partida/:id`, com card na **home** (`<Resumo />`). **Quarta 16h (BR)** = `confirmacao_closes_at`: a partir daí, reservas dos `pendente` são liberadas; avulsos do admin e mensalistas atrasados disputam as vagas restantes (first-come-first-served). Admin monta os times e abre a partida na quinta.

## Modelo de dados
- Confirmação em **`partidas_participantes`**.
- `status_confirmacao ∈ ('pendente','confirmado','recusado')` (sem `expirado`).
- `confirmacao_closes_at timestamptz` em `partidas` = quarta 16h BR da semana.

### Regra única de capacidade (16)
`ocupa(p) = (status='confirmado') OR (status='pendente' AND now() < confirmacao_closes_at)`. `recusado` nunca ocupa.
Transição para `alvo` é permitida sse `vagas_ocupadas_excl_o_jogador + (1 se ocupa(alvo) senão 0) ≤ 16`.
- Saídas (→ pendente pós-prazo, → recusado): sempre permitidas (liberam vaga).
- Confirmar/reaver: permitido se houver vaga; bloqueado se cheio ("vagas esgotadas").
- Quem já ocupa vaga sempre pode trocar entre estados que também ocupam (não perde a vaga ao mexer).

## Backend — migrations (`supabase/migrations/`)

**`057_confirmacoes_presenca.sql`** — schema + RPCs
- `ALTER TABLE partidas ADD COLUMN confirmacao_closes_at timestamptz;`
- `ALTER TABLE partidas_participantes ADD COLUMN status_confirmacao text NOT NULL DEFAULT 'pendente' CHECK (status_confirmacao IN ('pendente','confirmado','recusado'))` + `ADD COLUMN confirmado_em timestamptz;`
- Relaxar o `CHECK` de `push_reminder_deliveries.reminder_key` para permitir `'confirmacao'` (reuso do ledger de idempotência).
- RPC **`confirmar_presenca(p_partida_id, p_jogador_id, p_status)`**, `p_status ∈ ('pendente','confirmado','recusado')`:
  - Só opera se `partidas.status='draft'`.
  - Aplica a **regra de capacidade** acima. `confirmado` seta `confirmado_em=now()`; demais limpam.
  - `SECURITY DEFINER`, grant `anon/authenticated` (modelo de confiança atual: `jogador_id` do client).
- RPC **`admin_definir_confirmacao(p_partida_id, p_jogador_id, p_status, p_admin_id)`**:
  - Valida `jogadores.is_admin = true` para `p_admin_id` (check server-side).
  - Mesma regra de capacidade (admin não extrapola 16), mas pode mexer em **qualquer** jogador (confirmar/desconfirmar/recusar, inclusive o `criado_por`).
- RPC **`adicionar_participante(p_partida_id, p_jogador_id)`** (admin/avulso): insere `status_confirmacao='confirmado'` só se `vagas_ocupadas < 16`. *Checar se já existe antes de criar.*
- RPC **`listar_confirmacoes(p_partida_id)`** → participantes + `nome/username` + `status_confirmacao`.

**`058_ajuste_abrir_partida.sql`** — contar só quem vai jogar
- Em `abrir_partida` (`050`, linhas 32-39), adicionar `AND status_confirmacao='confirmado'` nos 4 `COUNT(*) FILTER`. Zera contadores só dos confirmados. Assim valida 16 efetivos (8+8, 1 GK/time).

**`059_rpc_criar_partida_semanal.sql`** — criação automática
- RPC `criar_partida_semanal_mensalistas() RETURNS bigint`, `SECURITY DEFINER`:
  - **Idempotente:** se já existe `partida` em `draft` cuja `data_jogo` cai na mesma semana, retorna `NULL`.
  - `data_jogo` = quinta 19h BR: `((date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') + interval '3 days 19 hours') AT TIME ZONE 'America/Sao_Paulo')`.
  - `confirmacao_closes_at` = quarta 16h BR: `(... + interval '2 days 16 hours') AT TIME ZONE 'America/Sao_Paulo'`.
  - Insere `partidas (status='draft', data_jogo, confirmacao_closes_at, criado_por = (SELECT id FROM jogadores WHERE is_admin ORDER BY id LIMIT 1))`.
  - Insere `partidas_participantes` para cada `jogadores WHERE is_mensalista AND is_ativo`, `status_confirmacao='pendente'`, sem `time/posicao`.
  - Retorna `id` (ou `NULL`).

**`060_cron_agendar_partida_semanal.sql`** — gatilho semanal
- `cron.schedule('agendar-partida-semanal', '0 13 * * 1', $$ DO $$ ... $$)`: roda a RPC; se vier id, `net.http_post` para a Edge Function `send-confirmation-requests` com `{ partida_id }` e header `x-push-cron-secret` do Vault. Padrão `043`/`055`. (10h BR = 13h UTC; segunda = `1`.)

- Atualizar `supabase/aplicar_tudo.sql` com `057`→`060`.

*(Sem cron de expiração — o prazo é aplicado em tempo real pelas RPCs.)*

## Edge Function — `supabase/functions/send-confirmation-requests/index.ts`
- Cópia do esqueleto de `send-voting-reminders/index.ts` (mesmo `web-push`, mesmas env vars VAPID, `PUSH_SUPABASE_KEY` service-role).
- Recebe `{ partida_id }` + header `x-push-cron-secret`. Busca a partida (`draft`) e os mensalistas `pendente` com `push_subscriptions` ativas.
- **Idempotência** via `push_reminder_deliveries`, `reminder_key='confirmacao'` (insert-or-nothing por `(partida_id, jogador_id, 'confirmacao')`).
- Payload: `{ title: 'Confirme sua presença', body: 'Partida quinta 19h — reserve sua vaga!', url: '/partida/<id>', tag: 'confirmacao-<id>', partida_id }`. SW (`public/sw.js`) já trata payload genérico.

## Frontend

**`src/lib/partidas.ts`**
- Estender `Participante` (`status_confirmacao`, `confirmado_em`) e `Partida` (`confirmacao_closes_at`); atualizar `carregarParticipantes`.
- Wrappers: `confirmarPresenca(partidaId, jogadorId, status)`, `adminDefinirConfirmacao(partidaId, jogadorId, status, adminId)`, `listarConfirmacoes(partidaId)`, `adicionarParticipante(partidaId, jogadorId)`.
- Helper `vagaOcupada(p, now, closesAt)` / `vagasLivres`.

**`src/routes/PartidaDetalhe.tsx` — lista pública**
- Seção visível a **todos**: cada jogador com badge ✓ confirmado / ✗ recusado / ⏳ pendente; contagem "X/16 confirmados" + prazo (quarta 16h).
- **Próprio jogador:** botões contextuais conforme o status atual:
  - `pendente` → "Vou jogar" / "Não vou"
  - `confirmado` → **"Desconfirmar"** / "Não vou"
  - `recusado` → "Vou jogar"
  - Desabilita com "vagas esgotadas" quando a regra de capacidade bloquear.
- **Admin:** ao lado de **cada** jogador, controle para setar status (confirmar/desconfirmar/recusar) via `adminDefinirConfirmacao`, + botão "Adicionar avulso" (quando `vagas_ocupadas < 16`).

**`src/routes/Resumo.tsx` — card na home**
- Acima do grid de destaques, card com a **próxima partida draft**: data/hora, "X/16 confirmados" e link para `/partida/:id`. (Consulta `partidas` where status='draft' order by data_jogo limit 1 + `listar_confirmacoes`/contagem.)

**`src/routes/PartidaEditar.tsx`** — admin avulso também por aqui (além do detalhe), conforme o fluxo existente.

## Ordem de implementação
1. Migrations `057`→`060` + `aplicar_tudo.sql`.
2. Edge Function `send-confirmation-requests`.
3. Wrappers + tipos em `partidas.ts`.
4. Lista pública + botões (self c/ desconfirmar, admin c/ controle total) em `PartidaDetalhe.tsx`.
5. Card na home (`Resumo.tsx`).
6. Fluxo de avulso no admin (`PartidaEditar.tsx`, se necessário além do detalhe).
7. `tsc -b && vite build`.

## Assunções/riscos
- **Auth/trust:** auth própria com `jogador_id` confiado no payload. `admin_definir_confirmacao` adiciona um check server-side de `is_admin` (fortalece o que hoje é só client-side).
- **Capacidade 16** vale para todos (inclusive admin) — não faz sentido >16 numa partida de 16. "Controle total" = mexer em qualquer jogador dentro desse limite.
- **`criado_por`** automático = primeiro `is_admin`; falhar graceful se não houver.
- **Conferir antes de criar** se já existe RPC de adicionar participante.
- Push semanal = **1 envio na segunda**; reenvio de lembrete = fase futura.
- Horários em BRT (UTC-3 fixo), padrão `AT TIME ZONE 'America/Sao_Paulo'`.

## Escopo
Feature média-grande (4 migrations + Edge Function + 3 telas). Posso entregar tudo ou **fasear** (Fase 1: backend + cron + push; Fase 2: UI pública + home + admin). É só dizer.