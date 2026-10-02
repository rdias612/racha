// Notificação de resultado das importações (RF06/RF07 — Fase 5 do breakdown
// SDD 35). P2/P3: a Action chama a Edge Function notificar-clipes com o secret
// push_cron_secret lido do Vault pela RPC obter_segredo_vault (migration 111) —
// o MESMO secret das Edge Functions de push existentes; nenhum segredo novo no
// GitHub (o YAML fica intocado).
// Notificação é BEST-EFFORT: o desfecho da importação já está no ledger
// clipes_importacoes (fonte da verdade, painel da Fase 8) — falha de push não
// derruba a run; é logada (RNF04) e a reexecução re-tenta (claims impedem
// duplicata).
// RNF02: o VALOR do secret NUNCA vai para console/log — só existência.

const TIMEOUT_MS = 15_000; // cold start da Edge Function pode demorar (nota 107:88-93)

async function obterSecretPush(client) {
  const { data: valor, error } = await client.rpc('obter_segredo_vault', {
    p_nome: 'push_cron_secret',
  });
  if (error) throw error;
  return valor ?? null;
}

export async function notificarResultado(client, { partidaId, resultado, supabaseUrl }) {
  let secret = null;
  try {
    secret = await obterSecretPush(client);
  } catch (erro) {
    console.error(
      `[clipes] aviso de push não enviado: falha ao ler push_cron_secret do vault: ${
        erro instanceof Error ? erro.message : String(erro)
      }`
    );
    return { notificado: false };
  }

  if (!secret) {
    console.error(
      '[clipes] aviso de push não enviado: secret push_cron_secret ausente no vault'
    );
    return { notificado: false };
  }

  try {
    const resposta = await fetch(`${supabaseUrl}/functions/v1/notificar-clipes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-push-cron-secret': secret, // secret SÓ no header — nunca em log
      },
      body: JSON.stringify({ partida_id: partidaId, resultado }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resposta.ok) {
      console.error(
        `[clipes] aviso de push não enviado: notificar-clipes respondeu HTTP ${resposta.status}`
      );
      return { notificado: false };
    }

    const corpo = await resposta.json().catch(() => null);
    console.log(
      `[clipes] notificação: resultado=${resultado} targets=${corpo?.targets ?? '?'} claimed=${corpo?.claimed ?? '?'}`
    );
    return { notificado: true, corpo };
  } catch (erro) {
    // Timeout (AbortError) ou erro de rede: log e segue — run NÃO falha por push.
    console.error(
      `[clipes] aviso de push não enviado: ${erro instanceof Error ? erro.message : String(erro)}`
    );
    return { notificado: false };
  }
}
