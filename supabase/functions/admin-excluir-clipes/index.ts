// Edge Function: admin-excluir-clipes (Plano 36 — Passo 1).
//
// Exclui clipes MANUALMENTE a pedido de um admin: linhas da tabela `clipes` +
// objetos do bucket Storage `clipes` (correção de importação errada — a limpeza
// por retenção RF09 só apaga por data_jogo, não por seleção).
//
// Quem chama: painel /clipes/admin/repositorio (Passo 3 do plano 36), via
// supabase.functions.invoke — chamada DO BROWSER.
//
// Por que ESTA função tem CORS e as irmãs não: notificar-clipes e demais são
// chamadas por cron/GitHub Action (server→server, sem preflight). Esta é a
// primeira chamada a partir do browser, e o invoke faz preflight OPTIONS
// (content-type JSON + Authorization) antes do POST — sem o tratamento aqui o
// browser bloqueia a resposta.
//
// Modelo de confiança idêntico ao RPC excluir_partida (migration 066): o app
// não usa JWT do Supabase (login próprio), então o gate de admin é feito
// server-side por parâmetro do corpo (admin_id com is_admin em jogadores).
// Por isso o deploy usa --no-verify-jwt, precedentes notificar-clipes/cron:
// a função não depende de auth do Supabase e faz o próprio gate.
// Deploy:
//   npx supabase functions deploy admin-excluir-clipes --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

// Mesmo bloco de segredos de notificar-clipes/index.ts:18-20 (mesmas envs de
// projeto — nenhuma variável nova; sem cron secret/VAPID porque não há push):
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey =
  Deno.env.get('PUSH_SUPABASE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing admin-excluir-clipes secrets.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Chamada pelo browser: supabase.functions.invoke faz preflight OPTIONS e
// exige estes headers também na resposta do POST (senão o body é bloqueado).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info',
};

// Teto de 500 itens: trava de abuso — a exclusão manual é pontual (correção
// pontual de importação), nunca varredura de bucket em massa.
const MAX_CLIPES_POR_CHAMADA = 500;

type PayloadEntrada = {
  admin_id?: unknown;
  clipes_ids?: unknown;
};

type LinhaClipe = {
  id: number;
  caminho: string;
  size_bytes: number | null;
  partida_id: number;
  data_jogo: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) return JSON.stringify(error);
  return String(error);
}

// Dia da partida em America/Sao_Paulo (mesmo helper de retencao.mjs:27-32).
function diaBRT(dataISO: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(dataISO)
  );
}

// Inteiro > 0 tolerante a string numérica (mesma coerção de partida_id em
// notificar-clipes:159-161); null se inválido.
function inteiroPositivo(valor: unknown): number | null {
  const numero =
    typeof valor === 'number' ? valor
    : typeof valor === 'string' && valor.trim() !== '' ? Number(valor)
    : null;
  if (numero === null || !Number.isInteger(numero) || numero <= 0) return null;
  return numero;
}

// Retorna o payload validado ou a mensagem de erro (400).
function validarPayload(
  bodyData: PayloadEntrada
): { adminId: number; clipesIds: number[] } | string {
  const adminId = inteiroPositivo(bodyData.admin_id);
  if (adminId === null) {
    return 'admin_id deve ser um inteiro positivo.';
  }

  const bruto = bodyData.clipes_ids;
  if (!Array.isArray(bruto) || bruto.length === 0) {
    return 'clipes_ids deve ser um array não-vazio de ids de clipes.';
  }
  if (bruto.length > MAX_CLIPES_POR_CHAMADA) {
    return `clipes_ids aceita no máximo ${MAX_CLIPES_POR_CHAMADA} itens por chamada.`;
  }

  const clipesIds: number[] = [];
  for (const item of bruto) {
    const id = inteiroPositivo(item);
    if (id === null) {
      return 'clipes_ids deve conter apenas inteiros positivos.';
    }
    clipesIds.push(id);
  }
  return { adminId, clipesIds: [...new Set(clipesIds)] };
}

Deno.serve(async (request) => {
  // Preflight do browser vem antes de qualquer checagem de método/payload.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') return json({ erro: 'Method not allowed' }, 405);

  let bodyData: PayloadEntrada = {};
  try {
    bodyData = await request.json().catch(() => ({}));
  } catch {
    /* body vazio */
  }

  const validacao = validarPayload(bodyData);
  if (typeof validacao === 'string') {
    return json({ erro: validacao }, 400);
  }
  const { adminId, clipesIds } = validacao;

  try {
    // Gate de admin server-side (padrão excluir_partida, migration 066 — o app
    // não tem JWT Supabase, o corpo é a única credencial da chamada):
    const { data: admin, error: adminErr } = await supabase
      .from('jogadores')
      .select('id')
      .eq('id', adminId)
      .eq('is_admin', true)
      .limit(1)
      .maybeSingle();
    if (adminErr) throw adminErr;
    if (!admin) {
      return json({ erro: 'Acesso restrito a administradores.' }, 403);
    }

    // Ids inexistentes são simplesmente ignorados (idempotência); se nenhuma
    // linha existir, nada é tocado (Storage, tabela ou ledger).
    const { data, error: clipesErr } = await supabase
      .from('clipes')
      .select('id, caminho, size_bytes, partida_id, data_jogo')
      .in('id', clipesIds);
    if (clipesErr) throw clipesErr;
    const linhas = (data ?? []) as LinhaClipe[];
    if (linhas.length === 0) {
      return json({ excluidos: 0, bytes_liberados: 0 });
    }

    // ORDEM IMPORTA (padrão scripts/clipes/retencao.mjs:88-140): Storage
    // primeiro, linhas depois, ledger por último. Se a ordem invertesse, um
    // erro deixaria objetos órfãos permanentes (a linha já teria sumido do
    // radar da limpeza).
    const caminhos = [...new Set(linhas.map((linha) => linha.caminho))];
    const { data: removidos, error: erroRemove } = await supabase.storage
      .from('clipes')
      .remove(caminhos);
    if (erroRemove) throw erroRemove;
    for (const item of removidos ?? []) {
      // 'Not Found' por item é tolerado (idempotência de reexecução); qualquer
      // outro erro ABORTA ANTES de tocar a tabela.
      if (item.error && item.error !== 'Not Found') {
        throw new Error(
          `Falha ao remover objeto ${item.name} do bucket clipes: ${item.error}`
        );
      }
    }

    // Linhas da tabela: se falhar aqui, o Storage já foi mas as linhas ficam —
    // nova execução com os mesmos ids reexecuta o remove ('Not Found' ok).
    const { error: erroDelete } = await supabase
      .from('clipes')
      .delete()
      .in('id', linhas.map((linha) => linha.id));
    if (erroDelete) throw erroDelete;

    // Agrupa por partida para o ledger (uma entrada por partida afetada;
    // partida_id em clipes é NOT NULL, agrupamento direto).
    const grupos = new Map<
      number,
      { dataJogo: string; bytes: number; quantidade: number; caminhos: string[] }
    >();
    for (const linha of linhas) {
      let grupo = grupos.get(linha.partida_id);
      if (!grupo) {
        grupo = { dataJogo: linha.data_jogo, bytes: 0, quantidade: 0, caminhos: [] };
        grupos.set(linha.partida_id, grupo);
      }
      // size_bytes é anulável (Fase 1) — conta como 0, padrão retencao.mjs:59-64.
      if (linha.size_bytes === null || linha.size_bytes === undefined) {
        console.warn(
          `[clipes] exclusão manual: size_bytes nulo em ${linha.caminho} — contado como 0`
        );
      } else {
        grupo.bytes += Number(linha.size_bytes);
      }
      grupo.quantidade += 1;
      grupo.caminhos.push(linha.caminho);
    }

    // Ledger por último (append-only, padrão retencao.mjs:72-86): status
    // 'limpeza' já existe no CHECK da migration 109; origem 'manual' é a da
    // ação do admin, não de uma run de retenção.
    let bytesLiberados = 0;
    for (const [partidaId, grupo] of grupos) {
      const { error: erroLedger } = await supabase.from('clipes_importacoes').insert({
        partida_id: partidaId,
        data_referencia: diaBRT(grupo.dataJogo),
        origem: 'manual',
        status: 'limpeza',
        sucesso: true,
        quantidade_clipes: grupo.quantidade,
        bytes_total: grupo.bytes,
        detalhe: `Exclusao manual no painel admin: ${grupo.quantidade} clipe(s) removido(s); caminhos: ${grupo.caminhos.join(', ')}`,
      });
      if (erroLedger) throw erroLedger;
      bytesLiberados += grupo.bytes;
    }

    console.log(
      `[clipes] exclusão manual: admin ${adminId} excluiu ${linhas.length} clipe(s), ` +
        `${(bytesLiberados / (1024 * 1024)).toFixed(1)} MB liberados`
    );
    return json({ excluidos: linhas.length, bytes_liberados: bytesLiberados });
  } catch (error) {
    console.error(
      `[clipes] exclusão manual: falha para admin ${adminId}, ids ${clipesIds.join(', ')}:`,
      error
    );
    return json({ erro: errorMessage(error) }, 500);
  }
});
