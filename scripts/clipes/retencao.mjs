// Limpeza por retenção (RF09 — Fase 4 do breakdown SDD 35).
// P12: o tamanho por partida vem da TABELA clipes (size_bytes denormalizado) —
// NENHUMA leitura de metadados/tamanho do Storage alimenta a decisão de deletar.
// O Storage é consultado só para LISTAR caminhos na hora de deletar a partida.
// P11: o limite chega pronto em bytes (resolvido no importar-clipes.mjs via
// input > var > default, Task 4); aqui é parâmetro puro — testável sem env.
// Ordem de deleção: data_jogo ASC (a data do JOGO, nunca a do upload — requisito :71).

const MB = 1024 * 1024;
const LIMITE_PADRAO_MB = 800;

export function resolverLimiteBytes(env = process.env) {
  const bruto = env.LIMITE_STORAGE_MB;
  if (bruto === undefined || bruto === '') {
    return LIMITE_PADRAO_MB * MB;
  }

  const mb = Number(bruto);
  if (!Number.isFinite(mb) || mb <= 0) {
    throw new Error(
      `LIMITE_STORAGE_MB inválido (esperado número de MB > 0): "${bruto}"`
    );
  }
  return mb * MB;
}

function diaBRT(dataISO) {
  // Dia da partida em America/Sao_Paulo (BRT = UTC-3 fixo, padrão da Fase 2).
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(dataISO)
  );
}

async function carregarGruposPorPartida(client) {
  // Sem paginação: a tabela é pequena (dezenas de linhas por partida semanal).
  // PostgREST não faz GROUP BY: agregar no Node é a opção simples — a
  // alternativa (RPC de agregação) é camada nova sem necessidade (KISS/YAGNI).
  const { data, error } = await client
    .from('clipes')
    .select('partida_id, data_jogo, caminho, size_bytes');
  if (error) throw error;

  const grupos = new Map();
  for (const linha of data ?? []) {
    let grupo = grupos.get(linha.partida_id);
    if (!grupo) {
      grupo = {
        partidaId: linha.partida_id,
        dataJogo: linha.data_jogo,
        bytes: 0,
        quantidade: 0,
        caminhos: [],
      };
      grupos.set(linha.partida_id, grupo);
    }

    // size_bytes é anulável na Fase 1 (a Fase 3 sempre preenche; null só de
    // dado semeado à mão) — conta como 0, com aviso para não virar falso teto.
    if (linha.size_bytes === null || linha.size_bytes === undefined) {
      console.warn(
        `[clipes] retenção: size_bytes nulo em ${linha.caminho} — contado como 0`
      );
    } else {
      grupo.bytes += Number(linha.size_bytes);
    }
    grupo.quantidade += 1;
    grupo.caminhos.push(linha.caminho);
  }
  return grupos;
}

async function registrarLimpezaNoLedger(client, grupo, { quantidadeLinhas, origem, totalApos }) {
  // Uma entrada por partida deletada; status 'limpeza' já existe no CHECK da
  // Fase 1 (limpeza é STATUS — origem segue sendo a da run, 'automatico'|'manual').
  const { error } = await client.from('clipes_importacoes').insert({
    partida_id: grupo.partidaId,
    data_referencia: diaBRT(grupo.dataJogo),
    origem,
    status: 'limpeza',
    sucesso: true,
    quantidade_clipes: quantidadeLinhas,
    bytes_total: grupo.bytes,
    detalhe: `Limpeza por retenção: prefixo clipes/${grupo.partidaId}/ removido; total do bucket após: ${(totalApos / MB).toFixed(1)} MB`,
  });
  if (error) throw error;
}

async function deletarPartida(client, grupo, { origem, totalApos }) {
  // ORDEM IMPORTA: Storage primeiro, linhas depois, ledger por último.
  // (Se o Storage falha e as linhas fossem primeiro, a partida sairia do radar
  //  da limpeza para sempre e os objetos virariam órfãos permanentes.)

  // 1. Lista o prefixo no Storage: alcança também objetos órfãos de crash
  //    pós-upload que a tabela não cobre (cobertura da idempotência da Fase 3).
  const { data: listados, error: erroList } = await client.storage
    .from('clipes')
    .list(String(grupo.partidaId), { limit: 1000 });
  if (erroList) throw erroList;

  const caminhos = new Set(grupo.caminhos);
  for (const item of listados ?? []) {
    caminhos.add(`${grupo.partidaId}/${item.name}`);
  }

  // 2. Remove objetos: 'Not Found' é tolerado (idempotência de reexecução);
  //    qualquer outro erro ABORTA ANTES de tocar a tabela — a partida continua
  //    candidata na próxima run.
  if (caminhos.size > 0) {
    const { data: removidos, error: erroRemove } = await client.storage
      .from('clipes')
      .remove([...caminhos]);
    if (erroRemove) throw erroRemove;
    for (const item of removidos ?? []) {
      if (item.error && item.error !== 'Not Found') {
        throw new Error(
          `Falha ao remover objeto ${item.name} do bucket clipes: ${item.error}`
        );
      }
    }
    console.log(`[clipes] retenção: ${caminhos.size} objetos removidos de clipes/${grupo.partidaId}/`);
  }

  // 3. Linhas da tabela: se falhar aqui, o Storage já foi mas as linhas
  //    permanecem — a próxima run tenta de novo (list vazio, remove pulado,
  //    DELETE reexecutado — seguro).
  const { error: erroDelete } = await client
    .from('clipes')
    .delete()
    .eq('partida_id', grupo.partidaId);
  if (erroDelete) throw erroDelete;

  // 4. Ledger por último (append-only; uma entrada por partida deletada).
  await registrarLimpezaNoLedger(client, grupo, {
    quantidadeLinhas: grupo.quantidade,
    origem,
    totalApos,
  });

  return { liberadosBytes: grupo.bytes, quantidadeLinhas: grupo.quantidade };
}

export async function limparPorRetencao(client, { limiteBytes, partidaAtualId, origem }) {
  // 1. Guarda: limite inválido é erro do caller (config), não condição de dados.
  if (!Number.isFinite(limiteBytes) || limiteBytes <= 0) {
    throw new Error(`Limite de retenção inválido: ${limiteBytes}`);
  }

  // 2. Estado do bucket segundo P12 (tabela clipes), por partida.
  const grupos = await carregarGruposPorPartida(client);
  let total = [...grupos.values()].reduce((soma, grupo) => soma + grupo.bytes, 0);
  if (total <= limiteBytes) {
    return { deletadas: [], totalRestante: total };
  }

  // 3. Loop de deleção: sempre o menor data_jogo (empate: menor partida_id —
  //    determinístico). A recém-importada NUNCA é candidata (RF09).
  const deletadas = [];
  while (total > limiteBytes) {
    const candidatos = [...grupos.values()].filter(
      (grupo) => grupo.partidaId !== partidaAtualId
    );

    // GUARDA ANTI-LOOP: uma única partida pode exceder o limite — ela é
    // preservada; o excesso é logado e a run segue normal.
    if (candidatos.length === 0) {
      console.log(
        `[clipes] retenção: total acima do limite (${(total / MB).toFixed(1)} MB) mas nenhuma outra partida além da atual para deletar`
      );
      break;
    }

    candidatos.sort(
      (a, b) =>
        new Date(a.dataJogo) - new Date(b.dataJogo) || a.partidaId - b.partidaId
    );
    const alvo = candidatos[0];
    const totalApos = total - alvo.bytes;

    const liberado = await deletarPartida(client, alvo, { origem, totalApos });

    grupos.delete(alvo.partidaId); // progresso garantido a cada iteração: ou
    total -= alvo.bytes;           // reduz o total, ou esgota candidatos =>
    deletadas.push({               // o while termina (loop finito por construção)
      partidaId: alvo.partidaId,
      dataJogo: alvo.dataJogo,
      ...liberado,
    });
  }

  const liberadosTotal = deletadas.reduce((soma, item) => soma + item.liberadosBytes, 0);
  console.log(
    `[clipes] retenção: ${deletadas.length} partida(s) deletada(s), ` +
      `${(liberadosTotal / MB).toFixed(1)} MB liberados, total restante ${(total / MB).toFixed(1)} MB`
  );
  return { deletadas, totalRestante: total };
}
