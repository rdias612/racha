// Action Clipes do Filma Eu (Fases 2 e 3 do breakdown SDD 35).
// Lê env, resolve a partida alvo, obtém as credenciais do Filma Eu dos GitHub
// Secrets (env FILMAEU_USER/FILMAEU_SECRET), automatiza o browser (login → slot → download dos clipes), sobe para o
// Storage com INSERT idempotente e grava a execução no ledger clipes_importacoes.
// Ao final de importação bem-sucedida roda a limpeza por retenção (Fase 4, RF09)
// e, em qualquer desfecho com partida, o push de resultado via Edge Function
// notificar-clipes (Fase 5, RF06/RF07 — best-effort, não derruba a run).
// RNF02: valores de segredo NUNCA vão para console/log — só existência.

import { createClient } from '@supabase/supabase-js';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  abrirBrowser,
  logarFilmaeu,
  navegarParaSlot,
  coletarClipes,
  baixarClipes,
} from './filmaeu/automacao.mjs';
import { caminhosExistentes, subirClipe, resumoDaPartida } from './armazenamento.mjs';
import { limparPorRetencao, resolverLimiteBytes } from './retencao.mjs';
import { notificarResultado } from './notificacoes.mjs';

const MB = 1024 * 1024;

// ---------- configuração ----------
function resolverConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Configuração de infra ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios'
    );
  }

  const filmaeuUsuario = process.env.FILMAEU_USER;
  const filmaeuSenha = process.env.FILMAEU_SECRET;
  if (!filmaeuUsuario || !filmaeuSenha) {
    throw new Error('Credenciais do Filma Eu ausentes: FILMAEU_USER e FILMAEU_SECRET são obrigatórios');
  }

  const horario = process.env.INPUT_HORARIO || '19:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    throw new Error(`Input horario inválido (esperado HH:MM): "${horario}"`);
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    filmaeuUsuario,
    filmaeuSenha,
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

async function fecharRegistroImportacao(
  client,
  registroId,
  { status, sucesso, quantidadeClipes, bytesTotal, detalhe, erro }
) {
  const { error } = await client
    .from('clipes_importacoes')
    .update({
      status,
      sucesso,
      quantidade_clipes: quantidadeClipes,
      bytes_total: bytesTotal ?? null,
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

// ---------- importação dos clipes (Fase 3) ----------
async function importarClipesDaPartida(client, { partida, dataAlvo, horario, credenciais }) {
  // IDEMPOTÊNCIA (RF02): consultar a TABELA antes de tocar no site e derivar o
  // caminho de forma determinística ({partida_id}/{nomeArquivo}) — baixar
  // SOMENTE o que não tem linha. Comparar hash exigiria baixar tudo (derrota o
  // RF02 "não rebaixar"); o nome do arquivo é a chave natural do slot (o
  // mapeamento 3.2 do dono confirma a estabilidade; plano B: nome por ordem,
  // previsto no docs/filmaeu-mapeamento-dom.md). Reexecução com tudo presente
  // → 0 downloads. O prefixo {partida_id}/ é constante na run, então comparar
  // o basename é equivalente a comparar o caminho completo.
  const existentes = await caminhosExistentes(client, partida.id);
  const nomesExistentes = new Set([...existentes].map((caminho) => basename(caminho)));
  console.log(`[clipes] ${nomesExistentes.size} clipe(s) já registrados na tabela para a partida ${partida.id}`);

  const dirTemp = join(process.env.RUNNER_TEMP || tmpdir(), 'clipes-baixa');

  let status;
  let novos = 0;
  const { browser, context } = await abrirBrowser();
  try {
    const page = await logarFilmaeu(context, credenciais);
    await navegarParaSlot(page, { dataISO: dataAlvo, horario });
    const lista = await coletarClipes(page);

    if (lista.length === 0) {
      // Slot sem clipes: condição esperada — caller fecha o ledger com
      // 'sem_clipes' (sucesso false, exit 0).
      console.log('[clipes] grade do slot vazia — nada a importar');
      status = 'sem_clipes';
    } else {
      const baixados = await baixarClipes(page, lista, {
        dirTemp,
        caminhosPendentes: nomesExistentes,
      });

      for (const clipe of baixados) {
        await subirClipe(client, {
          partidaId: partida.id,
          dataJogo: partida.data_jogo,
          ordem: clipe.ordem,
          arquivoLocal: clipe.arquivoLocal,
          nomeArquivo: clipe.nomeArquivo,
        });
      }

      novos = baixados.length;
      status = 'concluido';
    }
  } finally {
    await browser.close();
  }

  // Resumo = estado final da partida (inclui runs anteriores), coerente com o
  // painel da Fase 8; o delta desta run fica no detalhe do ledger.
  const resumo = await resumoDaPartida(client, partida.id);
  return { status, resumo, novos };
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
  let partidaIdAlvo = null; // para o push de falha no catch (partida pode não ter sido aberta)
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
    partidaIdAlvo = partida.id;
    registroId = await abrirRegistroImportacao(client, {
      partidaId: partida.id,
      dataReferencia: dataAlvo,
      origem,
    });

    const credenciais = { usuario: config.filmaeuUsuario, senha: config.filmaeuSenha };
    console.log('[clipes] credenciais filmaeu presentes no ambiente');

    const resultado = await importarClipesDaPartida(client, {
      partida,
      dataAlvo,
      horario: config.horario,
      credenciais,
    });
    // --- 5.6 (Fase 4): limpeza por retenção | Fase 5: push de resultado
    if (resultado.status === 'concluido') {
      // RF09: limpeza só após importação BEM-SUCEDIDA. 'sem_clipes' não
      // dispara (nada novo entrou no bucket — requisito :71).
      const limiteBytes = resolverLimiteBytes();
      console.log(
        `[clipes] retenção: limite ${limiteBytes / MB} MB, partida atual ${partida.id}`
      );
      const { deletadas, totalRestante } = await limparPorRetencao(client, {
        limiteBytes,
        partidaAtualId: partida.id,
        origem,
      });
      resultado.limpeza = { deletadas: deletadas.length, totalRestante };
    }

    await fecharRegistroImportacao(client, registroId, {
      status: resultado.status, // 'concluido' | 'sem_clipes'
      sucesso: resultado.status === 'concluido',
      quantidadeClipes: resultado.resumo.quantidade,
      bytesTotal: resultado.resumo.bytesTotal,
      detalhe:
        `${resultado.novos} novos, ${resultado.resumo.quantidade} totais` +
        (resultado.limpeza
          ? `; retenção: ${resultado.limpeza.deletadas} partida(s) deletada(s), total restante ${Math.round(resultado.limpeza.totalRestante / MB)} MB`
          : ''),
    });
    console.log(
      `[clipes] ledger ${registroId} fechado como '${resultado.status}' ` +
        `(${resultado.novos} novos, ${resultado.resumo.quantidade} totais, ${resultado.resumo.bytesTotal} bytes)`
    );

    // 7. (Fase 5, RF06/RF07) Push de resultado — best-effort, DEPOIS do ledger
    //    (se falhar, o painel da Fase 8 já reflete o desfecho; reexecução
    //    re-tenta e os claims da Edge Function impedem duplicata).
    await notificarResultado(client, {
      partidaId: partida.id,
      resultado: resultado.status, // 'concluido' | 'sem_clipes' — literais do ledger
      supabaseUrl: config.supabaseUrl,
    });

    if (resultado.status === 'sem_clipes') {
      // sucesso false é condição de alerta para a Fase 5 (RF07); a infra está
      // ok — run verde (exit 0), como "partida não encontrada" da Fase 2.
      console.log('[clipes] sem clipes no slot — run verde, ledger com sucesso=false (alerta para fase 5)');
    }
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
    // Push de aviso de falha aos admins (RF07) — também best-effort
    // (notificarResultado nunca rejeita), entre o fechamento do ledger e o
    // exit: run segue vermelha (comportamento da Fase 2 mantido).
    if (partidaIdAlvo) {
      await notificarResultado(client, {
        partidaId: partidaIdAlvo,
        resultado: 'falha',
        supabaseUrl: config.supabaseUrl,
      });
    }
    process.exit(1);
  }
}

main();
