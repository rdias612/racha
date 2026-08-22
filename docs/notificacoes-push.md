# Notificações Push (Web Push)

Sistema de lembretes de votação enviado via Web Push aos usuários que ativaram
a notificação na tela de perfil.

## Fluxo completo

```
┌────────────┐   POST a cada 1 min     ┌─────────────────────────┐   web-push    ┌─────────┐
│  pg_cron   │ ─────────────────────▶│ send-voting-reminders   │ ────────────▶ │ FCM/Moz │
│(* * * * *) │   header x-push-       │ (Edge Function)         │   VAPID-signed│  push   │
│            │   cron-secret          │ buckets: 6h/3h/1h/30m   │               │ srv     │
└────────────┘                        └────────┬────────────────┘               └─────────┘
                                               │ SELECT
                                               ▼
                                      ┌─────────────────────┐
                                      │ push_subscriptions  │ ◀── insert ao ativar no Perfil
                                      │ push_reminder_      │ ◀── ledger de idempotência
                                      │   deliveries        │     (partida_id, jogador_id, slot)
                                      └─────────────────────┘
```

- **Ativação**: o usuário opta na tela `/perfil`. O SW registra uma inscrição
  PushManager e o app faz upsert em `push_subscriptions`.
- **Envio (produção)**: a Edge Function `send-voting-reminders` roda **a cada
  minuto** e busca partidas `published` cuja votação fecha dentro dos próximos
  6h. Para cada partida, avalia em qual dos 4 buckets a partir do tempo
  restante e dispara push aos inscritos que ainda não votaram:
  - **`6h`** — quando faltam entre 5h50 e 6h
  - **`3h`** — quando faltam entre 2h50 e 3h
  - **`1h`** — quando faltam entre 50 min e 1h
  - **`30m`** — quando faltam entre 20 min e 30min
- **Idempotência**: cada `(partida_id, jogador_id, reminder_key)` só é enviado
  uma vez — PK em `push_reminder_deliveries`. Se o usuário votar após receber
  o lembrete de 6h, ele só voltará a ser elegível no próximo bucket (`3h`).

## Variáveis de ambiente (secrets)

Configuradas via `supabase secrets set`:

| Secret              | Descrição                                                             |
| ------------------- | --------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | Chave pública VAPID (mesma usada no front em `VITE_VAPID_PUBLIC_KEY`) |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID                                                   |
| `VAPID_SUBJECT`     | `mailto:seu@email.com`                                                |
| `PUSH_SUPABASE_KEY` | Service Role Key para a Edge Function                                 |
| `PUSH_CRON_SECRET`  | Header `x-push-cron-secret` validado pela função                      |

O `PUSH_CRON_SECRET` também precisa existir no **Vault** (`push_cron_secret`)
para que o `pg_cron` consiga ler via `vault.decrypted_secrets`.

---

## Função de teste manual (`send-test-push`)

Função isolada que envia um push **imediato** para um jogador, sem depender de
slot de 15 min, sem depender de partida aberta, sem depender de status. Serve
para validar o circuito de notificação (VAPID, inscrição push, SW) quando algo
parecer não estar funcionando.

### Como usar

```bash
# 1. Recupere o secret do cron no Vault
supabase db query --linked "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='push_cron_secret';"

# 2. Dispare a função (default: jogador_id = 1 = dico)
curl -X POST 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push' \
  -H 'x-push-cron-secret: <COLE_O_SECRET_AQUI>' \
  -H 'Content-Type: application/json' \
  -d '{}'

# Para disparar para outro jogador, informe no body:
curl -X POST 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push' \
  -H 'x-push-cron-secret: <COLE_O_SECRET_AQUI>' \
  -H 'Content-Type: application/json' \
  -d '{"jogador_id": 7}'
```

### Resposta esperada

```json
{
  "ok": true,
  "jogador_id": 1,
  "inscricoes": 1,
  "resultados": [{ "endpoint": "...Rl1dMuYmdQU8", "ok": true }],
  "ultimo_erro": null
}
```

- `"ok": true` para cada inscrição → push aceito pelo serviço push (FCM/Mozilla).
  A entrega no dispositivo depende do SW estar registrado e o app ter permissão
  de notificação ativa.
- `"ok": false` + `"erro"` → leia a mensagem:
  - `"...must have 'auth' and 'p256dh' keys"` → formato de subscription inválido.
  - `statusCode 404/410` → inscrição expirada; a função remove do banco
    automaticamente.

### PowerShell equivalente

```powershell
$secret = (supabase db query --linked "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='push_cron_secret';" | ConvertFrom-Json).rows[0].decrypted_secret

 Invoke-WebRequest -Method Post `
  -Uri 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push' `
  -Headers @{ 'x-push-cron-secret' = $secret; 'Content-Type' = 'application/json' } `
  -Body '{}' -UseBasicParsing | Select-Object -ExpandProperty Content
```

---

## Solução de problemas comuns

| Sintoma                                                  | Causa provável                                                  | Como validar                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Push não chega, mas função retorna `{ok:true}`           | Modo não perturbe / SW cacheado / PWA desinstalado              | Reinstale o PWA; abra Chrome → `chrome://serviceworker-internals/` e verifique o SW do domínio                     |
| Função retorna `"...must have 'auth' and 'p256dh' keys"` | Subscription sem wrapper `keys`                                 | Confirmar que o código envia `{ endpoint, keys: { p256dh, auth } }` para `webpush.sendNotification`                |
| `candidates: 0` na função de produção                    | Sem partida published dentro da janela 24h, ou todos já votaram | `SELECT id, status, voting_closes_at FROM partidas WHERE status='published';`                                      |
| `claimed: 0` em slot válido                              | Slot HH:MM já entregue antes (PK em `push_reminder_deliveries`) | `SELECT * FROM push_reminder_deliveries WHERE partida_id=<id> ORDER BY claimed_at DESC;`                           |
| `Unauthorized` (401)                                     | Header `x-push-cron-secret` divergente                          | Revalidar Valor via Vault (`push_cron_secret`) e secret da Edge Function (`PUSH_CRON_SECRET`) — têm que ser iguais |

## Rotinas de diagnóstico rápidas

```sql
-- Status do cron
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'enviar-lembretes%';

-- Inscrições push ativas
SELECT PS.jogador_id, j.nome, length(ps.p256dh) AS p256dh_len, length(ps.auth) AS auth_len
FROM push_subscriptions ps JOIN jogadores j ON j.id = ps.jogador_id;

-- Últimas entregas (sucesso e erro)
SELECT partida_id, jogador_id, reminder_key, claimed_at, sent_at, error_message
FROM push_reminder_deliveries
ORDER BY claimed_at DESC LIMIT 10;
```
