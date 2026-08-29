# Análise do Pipeline de Notificações Push (PWA)

> **Data**: 28/08/2026 · **Base**: `main` @ `1e1408e` · **Escopo**: diagnóstico somente leitura — nenhum fix foi aplicado.
> **Sintoma relatado**: "muitas vezes não estou recebendo as notificações" no uso do app como PWA.

---

## 1. Resumo executivo

O lado do servidor está razoavelmente sólido: as Edge Functions limpam endpoints mortos (404/410), usam
ledger de idempotência (`push_reminder_deliveries`) e, desde a migration 099, todas as chamadas de cron
são registradas em `cron_execucoes` com status HTTP e corpo da resposta.

**O ponto fraco é a manutenção da inscrição no aparelho do jogador.** Subscrições Web Push morrem no
dispositivo com frequência (rotação de token FCM no Android, revogação em PWAs pouco usados no iOS,
evicção de storage pelo navegador) e o app **não tem nenhum mecanismo de auto-recuperação**: quando a
subscrição morre, as notificações param de chegar em silêncio e só voltam se o jogador notar o card
"Lembretes" no Resumo e tocar manualmente em "Ativar" novamente.

Há ainda três gaps secundários que amplificam a percepção de "notificação perdida": o push semanal de
convocação é um tiro único sem retry, não existe push no momento em que a votação abre, e os envios não
definem TTL/urgency (um lembrete de "faltam 30 minutos" pode ser entregue horas depois).

---

## 2. Arquitetura atual do pipeline

```text
[Aparelho]
  ativarPush() (src/lib/pwa.ts:182)
    └─ Notification.requestPermission() + pushManager.subscribe(VAPID)
    └─ UPSERT em push_subscriptions (endpoint, p256dh, auth)

[Postgres — crons pg_cron + pg_net]
  enviar-push-reminders-1min  (todo minuto, migration 099 §5.1)
    ├─ POST send-voting-reminders      (buckets 6h/3h/1h/30m antes de fechar a votação)
    └─ POST send-confirmation-requests ({} → modo reforço: janela [prazo−4h, prazo))
  agendar-partida-semanal     (segunda 10h BRT, migration 099 §5.2 + 081)
    └─ criar_partida_semanal_mensalistas() → POST send-confirmation-requests {partida_id}

  disparar_e_registrar_cron_http() (migration 099 §2)
    └─ net.http_post com timeout de 8s + polling de resposta + log em cron_execucoes

[Edge Functions — Deno, web-push@3.6.7]
  send-confirmation-requests  (3 modos: semanal, reforço 1min, reenvio manual do admin)
  send-voting-reminders       (4 buckets fixos, janela de captura de 10 min cada)
  send-test-push              (diagnóstico: push direto a um jogador_id)
    └─ envios sequenciais; 404/410 → DELETE da push_subscriptions

[Destinatários — montados no banco, sem N+1 (migration 090)]
  listar_pendentes_confirmacao(p_partida_id)  → draft + status 'pendente' + tem subscrição
  listar_pendentes_votacao(p_janela_maxima)   → published + ainda não votou + tem subscrição
```

Elementos que foram verificados e **estão corretos** (teorias descartadas na seção 6): o CHECK de
`reminder_key` já aceita `'reforco'` (migration 077), o ledger previne duplicidade, o cleanup de endpoints
expirados existe nas três functions, e o `sw.js` tem headers de cache corretos no `vercel.json`.

---

## 3. Problemas encontrados

### P1 — Subscrição morta não se recupera sozinha (causa mais provável do sintoma)

**O que acontece.** O navegador/FCM invalida subscrições periodicamente: o Android rotaciona tokens
FCM (semanas a meses), o iOS pode revogar permissão/subscrição de PWAs que ficam muito tempo sem ser
abertos, e o navegador pode descartar o storage do service worker sob pressão. Quando isso ocorre:

1. O banco continua com o endpoint antigo.
2. O próximo push bate no endpoint morto → FCM responde 404/410 → a Edge Function apaga a linha
   ([send-confirmation-requests/index.ts:178-181](../supabase/functions/send-confirmation-requests/index.ts),
   idem em voting-reminders e test-push).
3. O jogador fica desinscrito **sem nenhum aviso** — nem local, nem remoto.

**Por que o app não se recupera:**

- `public/sw.js` só trata `push` e `notificationclick`
  ([sw.js:46-81](../public/sw.js)). **Não existe handler de `pushsubscriptionchange`** — o evento que
  o navegador dispara exatamente para o site renovar a inscrição é ignorado.
- Não há verificação no boot do app. `statusPush()` ([pwa.ts:166-180](src/lib/pwa.ts)) consulta o estado,
  mas só é chamado pelo `CardNotificacoes` (Resumo) e pela tela admin de Notificações; se a permissão já
  está concedida mas a subscrição sumiu, o app apenas mostra o botão "Ativar lembretes do racha" de novo
  ([CardNotificacoes.tsx:117-137](src/components/CardNotificacoes.tsx)) — exige ação manual que ninguém
  sabe que precisa tomar.
- `statusPush()` confia na existência da linha no banco: se a subscrição morreu mas o 404 de limpeza
  ainda não aconteceu, o card exibe **"Lembretes Ativos"** para um aparelho que não vai receber nada.

**Impacto.** Jogador que não abre o app entre duas semanas perde silenciosamente a convocação de
segunda e os lembretes de votação; ao abrir o app na quinta (uso natural), nada o avisa que estava
desconectado.

**Como corrigir.**

1. **Re-check silencioso no boot/login** (maior retorno, menor esforço): no `SessaoContext` (ou no
   próprio `CardNotificacoes`, que já monta no Resumo), sempre que houver sessão e
   `Notification.permission === 'granted'`:
   - `getSubscription()` → se `null`, re-executar `subscribe()` com a chave VAPID e upsert;
   - se existir, upsert idempotente (`onConflict: 'endpoint'`) para garantir que a linha existe no banco.
   - O fato de o jogador abrir o app semanalmente (comportamento natural da pelada) passa a ser o
     mecanismo de auto-cura.
2. **Handler `pushsubscriptionchange` no `sw.js`**: re-subscribir e sincronizar o novo endpoint via
   `fetch` para uma RPC anônima dedicada (ex.: `sincronizar_push_subscription(p_endpoint_antigo, p_novo, p_keys)`).
   Detalhe: o SW não sabe o `jogador_id`; ou a RPC casa pelo endpoint antigo, ou o app grava o id em
   IndexedDB no momento da ativação.
3. **Estar preparado para inscrever de novo quando `permission === 'granted'` mas não há subscription**
   — hoje `ativarPush()` reutiliza a subscrição existente ou cria nova; falta só chamá-lo
   automaticamente no caso "permissão ok, inscrição perdida" (o item 1 cobre isso).

### P2 — Push semanal de convocação é tiro único, sem retry

**O que acontece.** O cron `agendar-partida-semanal` (migration 099 §5.2) dispara
`send-confirmation-requests {partida_id}` uma única vez, na segunda às 10h. Se a execução falhar
naquela janela — cold start do Deno, blip de rede do `pg_net`, instabilidade momentânea — a semana
fica sem push de convocação. A única rede de segurança é o **reforço** de quarta-feira (4h antes do
prazo, default da config), que só alcança quem continua 'pendente' — e se o jogador já tinha perdido
a inscrição (P1), também não recebe.

**Contraste.** Os buckets de votação têm retry natural: janela de captura de 10 min (migration 043)
varrida por um cron de 1 min — até ~9 tentativas por bucket. O disparo semanal não tem nada equivalente.

**Como corrigir.** Aproveitar o job `enviar-push-reminders-1min` que já roda todo minuto: adicionar
uma varredura "existe partida draft desta semana, com `confirmacao_closes_at` no futuro, **sem
nenhuma** linha `reminder_key='confirmacao'` no ledger, e já passaram N minutos do horário configurado?
→ dispara e grava no ledger". Torna o envio semanal idempotente e auto-reparável sem novo cron.
(Nota: hoje o modo 1 da Edge Function é idempotente por jogador/partida via ledger, então re-disparar
é seguro; o que falta é quem chame de novo.)

### P3 — Não existe push de "votação aberta"

**O que acontece.** Quando o admin finaliza/publica a partida, nenhum push é enviado. O primeiro
lembrete de voto chega ~18h depois (bucket de 6h antes do fechamento das 24h). O texto do
`CardNotificacoes` promete justamente "convocação de presença e **aviso de abertura da votação**"
([CardNotificacoes.tsx:95-99](src/components/CardNotificacoes.tsx)) — promessa que o backend não cumpre.

**Impacto.** Percepção de "notificação que não chegou" no momento de maior engajamento (fim do jogo),
e janela ociosa de ~18h em que quem vota cedo não é lembrado.

**Como corrigir.** Disparar um push imediato no fluxo de publicação (o admin finaliza a partida na UI):
uma RPC `disparar_push_votacao_aberta(p_admin_id, p_partida_id)` seguindo o padrão da 099 — chama uma
variante/new mode da `send-voting-reminders` (`{partida_id, abertura: true}`) que notifica todos os
participantes de linha aptos a votar, com template próprio na `notificacoes_config`. Ledger com
`reminder_key='votacao-aberta'` (o CHECK da 077 precisaria dessa entrada). Alternativa mais barata:
reduzir para um bucket "abertura+1h" — mas o push imediato é o que corresponde à expectativa criada.

### P4 — Envios sem TTL nem Urgency

**O que acontece.** Todas as chamadas `webpush.sendNotification(subscription, payload)` vão sem
opções (ex.: [send-voting-reminders/index.ts:137](../supabase/functions/send-voting-reminders/index.ts),
[send-confirmation-requests/index.ts:174](../supabase/functions/send-confirmation-requests/index.ts)).
O padrão do web-push é TTL de 4 semanas: mensagem fica retida no push service e é entregue quando o
aparelho desperta. Um "Faltam 30 minutos para votar" entregue 5h depois (celular em Doze/bateria
fraca) é pior do que não entregar — e é mais um caso que o jogador relata como notificação estranha/atrasada.

**Como corrigir.** Passar `options` por bucket:

```ts
await webpush.sendNotification(pushSubscription, payload, {
  TTL: ttlSegundos,        // ex.: 30m → 1800; 1h → 3600; confirmação → algumas horas
  urgency: 'high',         // wake-up mais agressivo no Android/FCM
});
```

Regra prática: TTL nunca maior que a validade da informação (para o bucket de 30 min, TTL ≤ 30 min).
Para o push de confirmação de segunda, TTL de ~12-24h é razoável (chega quando o aparelho acordar,
ainda dentro do prazo de quarta).

### P5 — Timeout de 8s no `disparar_e_registrar_cron_http` gera falso-negativo no log

**O que acontece.** A função central da 099 usa `p_timeout_ms` default 8000
([099 §2](../supabase/migrations/099_cron_http_response_logging.sql)) tanto no `net.http_post` quanto
no polling. Um cold start da Edge Function (import de `npm:web-push`) + envios sequenciais a 14+
jogadores pode passar de 8s: o log registra `sucesso=false`/"Timeout" **mesmo que o push tenha sido
entregue** (o `pg_net` desiste de esperar, mas a requisição já chegou na function).

**Impacto.** Não perde notificação, mas polui a `cron_execucoes` e mascara falhas reais — quando
tudo aparece como timeout, o admin para de confiar no log (e o log é a principal ferramenta de
diagnóstico, seção 5).

**Como corrigir.** Opções (combináveis): subir o timeout para ~25-30s no job de 1 min (ele não
concorre com a próxima execução — pg_cron não sobrepõe runs do mesmo job); ou deixar o disparo do
job de 1 min fire-and-forget (`net.http_post` puro, como na 060) e coletar resposta apenas nos
disparos manuais do admin; ou paralelizar os envios dentro das Edge Functions
(`Promise.allSettled`) para reduzir a duração total.

### P6 — Falta visibilidade de entrega por jogador (observabilidade incompleta)

**O que acontece.** A `cron_execucoes` mostra a saúde do disparo (HTTP da function), e o ledger
`push_reminder_deliveries` guarda `sent_at`/`error_message` **por jogador** — mas nada na UI admin
surfaza isso. Não existe como responder "quem está inscrito agora?", "qual o último push que o Dico
recebeu de verdade?", "quantos jogadores têm subscrição viva?". O `statusPush` só enxerga o próprio
aparelho do admin.

**Impacto.** O sintoma "não recebi" vira investigação manual no banco; sem drill-down, não há como
distinguir falha de disparo (P2/P5) de inscrição morta (P1) por pessoa.

**Como corrigir.** Nova seção na tela admin de Notificações alimentada por RPC (padrão da
`obter_execucoes_cron`): por jogador — quantidade de subscrições, `created_at`/`updated_at` de cada
endpoint, última entrega com sucesso no ledger, último `error_message`. Com o P1 implementado, essa
tabela vira o painel de saúde: "subscreveu há 3 semanas, sem entrega desde então" = candidato a
aparelho com problema.

### Notas de ambiente (fora do código, mas parte do sintoma)

- **iOS**: push só funciona no PWA **instalado** na tela de início (iOS 16.4+) — notificações não
  chegam se o usuário só usa a aba do Safari; e o iOS suspende push de web apps que ficam muito tempo
  sem ser abertos. Reforçar na comunicação do grupo: "abrir o app pelo menos 1× na semana".
- **Android**: economia de bateria agressiva (Samsung/Motorola/Xiaomi) atrasa FCM; `urgency: 'high'`
  (P4) mitiga. PWAs instalados têm tratamento melhor que aba aberta.
- **VAPID**: se `VITE_VAPID_PUBLIC_KEY` (Vercel) divergir de `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
  (secrets da Edge Function), tudo falha com 403 silencioso — vale uma conferida única. A troca de
  chave VAPID também invalida todas as subscrições existentes (o upsert do P1 repara na primeira visita).
- **Aparelho compartilhado**: o upsert usa `onConflict: 'endpoint'` — se duas contas logam no mesmo
  aparelho, a subscrição fica do último que ativou, e o primeiro para de receber sem aviso. Cenário
  raro, mas vale registrar.

---

## 4. Plano priorizado

| # | Ação | Endereça | Esforço | Risco |
|---|------|----------|---------|-------|
| 1 | Re-check silencioso de subscrição no boot/login (`SessaoContext` ou `CardNotificacoes`) | P1 | P | Baixo |
| 2 | Handler `pushsubscriptionchange` no `sw.js` + RPC de sincronização | P1 | M | Baixo |
| 3 | Varredura de retry do push semanal no job de 1 min (ledger-based) | P2 | M | Baixo (idempotente) |
| 4 | Push imediato "votação aberta" no fluxo de publicação + template na config | P3 | M | Baixo |
| 5 | TTL + urgency por bucket nas Edge Functions | P4 | P | Baixo |
| 6 | Painel admin de entregas por jogador (RPC + seção na tela Notificações) | P6 | M | Baixo |
| 7 | Ajustar timeout/estratégia de log do job de 1 min | P5 | P | Baixo |

(P = pequeno, M = médio. Os itens 1 e 3 são os de maior impacto no sintoma relatado; o 7 é higiene.)

Notas de implementação: itens 1, 2 e 5 não tocam banco; itens 3, 4 e 6 exigem migration (próxima
numeração livre: **103**, ver `docs/plano-refatoracoes.md`); item 4 altera a Edge Function
`send-voting-reminders` (novo modo) e o CHECK de `reminder_key`.

## 5. Como diagnosticar em produção agora (sem esperar fix)

1. **Push de teste pela tela admin** (`SecaoNotificacaoTestes` → RPC `disparar_push_teste`): o retorno
   lista cada endpoint com `ok`/`erro`/`statusCode`. 404/410 = subscrição morta (P1); 403 = VAPID.
2. **`cron_execucoes`** (tela admin / RPC `obter_execucoes_cron`): jobs `send-voting-reminders` e
   `send-confirmation-requests` com `sucesso=false` recorrentes = problema servidor (P2/P5);
   tudo verde + jogador sem notificação = inscrição morta no aparelho (P1).
3. **No banco**: comparar jogadores ativos × com subscrição viva
   (`push_subscriptions` por `jogador_id`, idade do `updated_at`) e o `error_message` do ledger —
   quem tem erro registrado no último envio é o candidato a aparelho problemático.
4. **No aparelho**: conferir que o app está instalado na tela de início (iOS), permissão concedida
   nas configurações do navegador/SO, e bateria/economia de energia não bloqueando o navegador.

## 6. Teorias investigadas e descartadas

- **CHECK de `reminder_key` rejeitaria `'reforco'`** — falso: a migration 057 relaxou para
  `'confirmacao'` e a **077** incluiu `'reforco'` e os slots HH:MM. Ledger íntegro.
- **`sw.js` mal cacheado atrapalharia atualizações** — falso: `vercel.json` envia `no-cache` para
  `sw.js`, `index.html`, `manifest` e `offline.html`.
- **Limpeza de endpoints 404/410 inexistente** — falso: presente nas três Edge Functions.
- **N+1 nas Edge Functions** — falso: migration 090 centralizou candidatos+subscrições em RPC única.
- **Race de duplicidade de envio** — falso: ledger com PK `(partida_id, jogador_id, reminder_key)` e
  catch do 23505 no claim.

## 7. Observação de segurança (fora do escopo de confiabilidade)

`push_subscriptions` tem `GRANT SELECT, INSERT, UPDATE, DELETE TO anon, authenticated`
(migration 036), sem gate por jogador: qualquer cliente com a anon key pode inserir subscrição em
nome de outro jogador ou **apagar as dele** (DoS de notificações). Para um app de pelada o risco
prático é baixo, mas quando houver uma passada de segurança de grants (ver REVOKE pendente em
`docs/plano-refatoracoes.md`), incluir a proteção dessa tabela (RPC `SECURITY DEFINER` para
ativar/desativar/sincronizar — que o P1 item 2 já introduziria de qualquer forma).
