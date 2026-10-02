// Workflow base da Action Clipes do Filma Eu (Fase 2 do breakdown SDD 35).
// Lê env, resolve a partida alvo, valida o segredo do Filma Eu no Vault e
// grava a execução no ledger clipes_importacoes. O download (Playwright) é a
// Fase 3; limpeza é a Fase 4; push é a Fase 5 — pontos de extensão marcados.
// RNF02: valores de segredo NUNCA vão para console/log — só existência.

import { createClient } from '@supabase/supabase-js';

// ---------- configuração ----------
function resolverConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Configuração de infra ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios'
    );
  }

  const horario = process.env.INPUT_HORARIO || '19:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    throw new Error(`Input horario inválido (esperado HH:MM): "${horario}"`);
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    inputData: process.env.INPUT_DATA || '',
    horario,
    inputPartidaId: process.env.INPUT_PARTIDA_ID || '',
    eventName: process.env.GITHUB_EVENT_NAME || 'workflow_dispatch',
  };
}

// ---------- client ----------
function criarClienteSupabase({ supabaseUrl, supabaseServiceKey }) {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// ---------- datas (BRT = UTC-3 fixo, padrão 060:7) ----------
function resolverDataAlvo(dataInput) {
  if (dataInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInput)) {
      throw new Error(`Input data inválido (esperado AAAA-MM-DD): "${dataInput}"`);
    }
    return dataInput;
  }

  // Última quinta-feira ANTERIOR ao dia corrente em America/Sao_Paulo
  // (no cron de sexta = ontem).
  const formatoData = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  const hojeBRT = formatoData.format(new Date()); // 'AAAA-MM-DD'
  const [ano, mes, dia] = hojeBRT.split('-').map(Number);
  const UTC_DIA = 24 * 60 * 60 * 1000;

  for (let retrocedeDias = 1; retrocedeDias <= 7; retrocedeDias++) {
    const data = new Date(Date.UTC(ano, mes - 1, dia) - retrocedeDias * UTC_DIA);
    if (data.getUTCDay() === 4) {
      // 4 = quinta
      return data.toISOString().slice(0, 10);
    }
  }
  throw new Error('Não foi possível resolver a última quinta-feira anterior'); // inalcançável
}

function calcularFaixaDataBRT(dataISO) {
  // [início, fim) do dia em timestamptz, com offset fixo -03:00 (sem DST).
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const UTC_DIA = 24 * 60 * 60 * 1000;
  const diaSeguinte = new Date(Date.UTC(ano, mes - 1, dia + 1));
  const dataSeguinteISO = diaSeguinte.toISOString().slice(0, 10);
  return [`${dataISO}T00:00:00-03:00`, `${dataSeguinteISO}T00:00:00-03:00`];
}

// ---------- partida alvo ----------
async function buscarPartidaAlvo(client, { partidaId, dataAlvo }) {
  // partidaId do input tem precedência (caminho de reimportação/histórico).
  if (partidaId) {
    const { data, error } = await client
      .from('partidas')
      .select('id, data_jogo, status')
      .eq('id', partidaId)
      .maybeSingle();
    if (error) throw error;
    // null = partida inexistente (erro registrado, run "verde com falha lógica").
    return { partida: data ? { id: data.id, data_jogo: data.data_jogo } : null };
  }

  const [inicio, fim] = calcularFaixaDataBRT(dataAlvo);
  // "Society Gragoatá" é implícito — o app não tem coluna de quadra (004:11-17).
  const { data, error } = await client
    .from('partidas')
    .select('id, data_jogo, status')
    .gte('data_jogo', inicio)
    .lt('data_jogo', fim)
    .in('status', ['published', 'closed'])
    .order('data_jogo')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return { partida: data ? { id: data.id, data_jogo: data.data_jogo } : null };
}

// ---------- ledger (interface exata da Fase 1) ----------
async function abrirRegistroImportacao(client, { partidaId, dataReferencia, origem }) {
  // Idempotência: mesma (data_referencia, partida_id) com status ativo
  // ('iniciado'/'concluido'/'sem_clipes') => UPDATE; senão INSERT.
  // 'falha' anteriores NÃO bloqueiam — histórico de tentativas é preservado.
  let consultaAtivos = client
    .from('clipes_importacoes')
    .select('id')
    .eq('data_referencia', dataReferencia)
    .in('status', ['iniciado', 'concluido', 'sem_clipes']);

  consultaAtivos =
    partidaId === null || partidaId === undefined
      ? consultaAtivos.is('partida_id', null)
      : consultaAtivos.eq('partida_id', partidaId);

  const { data: ativo, error: erroBusca } = await consultaAtivos.maybeSingle();
  if (erroBusca) throw erroBusca;

  if (ativo) {
    const { data, error } = await client
      .from('clipes_importacoes')
      .update({ status: 'iniciado', atualizado_em: new Date().toISOString() })
      .eq('id', ativo.id)
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await client
    .from('clipes_importacoes')
    .insert({
      partida_id: partidaId ?? null,
      data_referencia: dataReferencia,
      origem,
      status: 'iniciado',
      sucesso: false,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function validarSegredoFilmaEu(client) {
  // Só existência — o VALOR nunca é usado nem logado (download é Fase 3).
  const { data: valor, error } = await client.rpc('obter_segredo_vault', {
    p_nome: 'filmaeu_credenciais',
  });
  if (error) throw error;
  if (!valor) {
    throw new Error('Secret filmaeu_credenciais não configurado no vault');
  }
}

async function fecharRegistroImportacao(
  client,
  registroId,
  { status, sucesso, quantidadeClipes, detalhe, erro }
) {
  const { error } = await client
    .from('clipes_importacoes')
    .update({
      status,
      sucesso,
      quantidade_clipes: quantidadeClipes,
      detalhe,
      erro: erro ?? null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', registroId);
  if (error) throw error;
}

async function registrarFalhaSemPartida(client, { dataReferencia, origem, erro }) {
  // Partida não encontrada: condição esperada (quinta sem jogo / data sem
  // partida), registrada como 'falha' no ledger — run segue verde (exit 0).
  const { error } = await client.from('clipes_importacoes').insert({
    partida_id: null,
    data_referencia: dataReferencia,
    origem,
    status: 'falha',
    sucesso: false,
    erro,
  });
  if (error) throw error;
}

// ---------- orquestração ----------
async function main() {
  const config = resolverConfig();
  const client = criarClienteSupabase(config);

  const dataAlvo = resolverDataAlvo(config.inputData);
  const origem = config.eventName === 'schedule' ? 'automatico' : 'manual';
  const partidaIdInput = config.inputPartidaId ? Number(config.inputPartidaId) : null;

  console.log(`[clipes] data alvo: ${dataAlvo} | origem: ${origem} | partida_id input: ${partidaIdInput ?? '—'}`);

  let registroId = null;
  try {
    const { partida } = await buscarPartidaAlvo(client, {
      partidaId: partidaIdInput,
      dataAlvo,
    });

    if (!partida) {
      await registrarFalhaSemPartida(client, {
        dataReferencia: dataAlvo,
        origem,
        erro: 'Partida alvo não encontrada para a data/hora informada',
      });
      console.log(`[clipes] partida não encontrada para ${dataAlvo} — ledger 'falha' registrado (exit 0)`);
      return;
    }

    console.log(`[clipes] partida alvo: ${partida.id} (${partida.data_jogo})`);
    registroId = await abrirRegistroImportacao(client, {
      partidaId: partida.id,
      dataReferencia: dataAlvo,
      origem,
    });

    await validarSegredoFilmaEu(client);
    console.log('[clipes] secret filmaeu_credenciais presente no vault');
    // --- Fase 3: login Filma Eu + download + upload + INSERT em `clipes`
    // --- Fase 4: limpeza por retenção | Fase 5: push de resultado

    await fecharRegistroImportacao(client, registroId, {
      status: 'concluido',
      sucesso: true,
      quantidadeClipes: 0,
      detalhe: 'Workflow base — download implementado na Fase 3',
    });
    console.log(`[clipes] ledger ${registroId} fechado como 'concluido' (0 clipes — fase 2)`);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (registroId) {
      await fecharRegistroImportacao(client, registroId, {
        status: 'falha',
        sucesso: false,
        quantidadeClipes: 0,
        detalhe: null,
        erro: mensagem,
      });
    }
    console.error(`[clipes] falha: ${mensagem}`);
    process.exit(1);
  }
}

main();
