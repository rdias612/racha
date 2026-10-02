// Persistência dos clipes: Storage (service key) + tabela clipes.
// Interface EXATA da Fase 1 (fase-1-tasks.md:48-95): caminho = '{partida_id}/
// {arquivo}' dentro do bucket 'clipes' (sem o nome do bucket — fase-1-tasks.md:99);
// UNIQUE(partida_id, caminho) → ON CONFLICT DO NOTHING; size_bytes real por
// clipe (P12). Bucket público de leitura (P4): a URL pública é determinística
// e NÃO é gravada — a Fase 7 a monta em src/lib/clipes.ts a partir de caminho.
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

const BUCKET = 'clipes';

export function montarCaminho(partidaId, nomeArquivo) {
  // Mesmo formato do caminho do objeto no bucket (fase-1-tasks.md:99):
  // '{partida_id}/{arquivo}'. URL pública determinística (não gravada):
  //   `${SUPABASE_URL}/storage/v1/object/public/clipes/${caminho}`
  return `${partidaId}/${basename(nomeArquivo)}`;
}

export async function caminhosExistentes(client, partidaId) {
  // Base da idempotência RF02 (decisão da Task 6: consultar a TABELA antes de
  // tocar no site — baixar só o que não tem linha).
  const { data, error } = await client
    .from('clipes')
    .select('caminho')
    .eq('partida_id', partidaId);
  if (error) throw error;
  return new Set((data ?? []).map((linha) => linha.caminho));
}

export async function subirClipe(client, { partidaId, dataJogo, ordem, arquivoLocal, nomeArquivo }) {
  const caminho = montarCaminho(partidaId, nomeArquivo);

  // 1. size_bytes do arquivo salvo em disco (P12) — é o conteúdo que de fato
  //    vai ao Storage, determinístico para a limpeza da Fase 4.
  const sizeBytes = (await stat(arquivoLocal)).size;

  // 2. Upload com upsert: cobre crash entre upload e INSERT — a reexecução
  //    sobrescreve o objeto órfão em vez de falhar.
  const body = await readFile(arquivoLocal);
  const { error: erroUpload } = await client.storage.from(BUCKET).upload(caminho, body, {
    contentType: 'video/mp4', // confirmado no mapeamento DOM §3 (.mp4)
    upsert: true,
  });
  if (erroUpload) throw erroUpload;

  // 3. INSERT idempotente: { onConflict: 'partida_id,caminho',
  //    ignoreDuplicates: true } = ON CONFLICT DO NOTHING no PostgREST
  //    (UNIQUE(partida_id, caminho) da Fase 1).
  const { error: erroInsert } = await client.from('clipes').insert(
    {
      partida_id: partidaId,
      caminho,
      data_jogo: dataJogo,
      size_bytes: sizeBytes,
      ordem,
    },
    { onConflict: 'partida_id,caminho', ignoreDuplicates: true }
  );
  if (erroInsert) throw erroInsert;

  console.log(`[clipes] subido ${caminho} (${sizeBytes} bytes)`);
  return { caminho, sizeBytes };
}

export async function resumoDaPartida(client, partidaId) {
  // Reflete o ESTADO DA PARTIDA ao final (inclui linhas de runs anteriores),
  // coerente com o painel da Fase 8; o delta da run fica no detalhe do ledger.
  const { data, error } = await client
    .from('clipes')
    .select('size_bytes')
    .eq('partida_id', partidaId);
  if (error) throw error;

  const quantidade = (data ?? []).length;
  const bytesTotal = (data ?? []).reduce((soma, linha) => soma + (linha.size_bytes ?? 0), 0);
  return { quantidade, bytesTotal };
}
