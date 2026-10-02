// Automação Playwright do Filma Eu (Fase 3 — breakdown SDD 35).
// Funções puras de browser: recebem context/page, retornam dados; a orquestração
// com Supabase/ledger fica em importar-clipes.mjs. RNF02: credenciais são usadas
// só em page.fill — JAMAIS logadas. RNF04: log rico por passo, retry em
// login/download e screenshot por passo em falha.
// Seletores e timeouts vêm TODOS de ./seletores.mjs (RNF04).
import { chromium } from 'playwright';
import { mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URLS, SELETORES, PAGINA, QUADRA, seletorSlot, ErroFilmaeu } from './seletores.mjs';

function diretorioDebug() {
  return join(process.env.RUNNER_TEMP || tmpdir(), 'clipes-debug');
}

export async function abrirBrowser() {
  const browser = await chromium.launch({ headless: true });
  // acceptDownloads é obrigatório para page.waitForEvent('download').
  const context = await browser.newContext({ acceptDownloads: true });
  // O caller fecha o browser no finally.
  return { browser, context };
}

async function screenshot(page, nome, dirDebug = diretorioDebug()) {
  try {
    mkdirSync(dirDebug, { recursive: true });
    await page.screenshot({ path: join(dirDebug, `${nome}.png`), fullPage: true });
    console.log(`[clipes] screenshot salvo: ${nome}.png`);
  } catch (erroScreenshot) {
    // Screenshot é best-effort: nunca mascara o erro original.
    console.error(`[clipes] screenshot falhou (ignorado): ${erroScreenshot.message}`);
  }
}

async function comRetry(passo, fn, { tentativas = 1, page = null } = {}) {
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await fn(tentativa);
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) {
        console.log(`[clipes] passo "${passo}" falhou (tentativa ${tentativa}/${tentativas}): ${erro.message}`);
      }
    }
  }
  if (page) {
    await screenshot(page, `falha-${passo}`);
  }
  if (ultimoErro instanceof ErroFilmaeu) throw ultimoErro;
  throw new ErroFilmaeu(passo, ultimoErro ? ultimoErro.message : 'erro desconhecido');
}

// Passos de navegação/coleta fora do comRetry: capturam a falha, salvam
// screenshot de debug (best-effort, RNF04) e relançam o erro original.
async function comScreenshotDeFalha(page, passoPadrao, fn) {
  try {
    return await fn();
  } catch (erro) {
    await screenshot(page, `falha-${erro.passo || passoPadrao}`);
    throw erro;
  }
}

// Aguarda e clica num elemento; timeout → ErroFilmaeu(passo). Se o seletor
// configurado não resolver, tenta localizar pelo texto visível como fallback
// (RNF04: texto muda menos que markup em sites server-rendered).
async function clicarElemento(page, seletor, passo, { textoFallback = null, timeoutMs = PAGINA.timeoutElementoMs } = {}) {
  try {
    await page.waitForSelector(seletor, { state: 'visible', timeout: timeoutMs });
    await page.click(seletor);
    return;
  } catch {
    // seletor configurado não resolveu — tenta texto abaixo
  }
  if (textoFallback) {
    const porTexto = page.getByText(textoFallback).first();
    try {
      await porTexto.waitFor({ state: 'visible', timeout: timeoutMs });
      await porTexto.click();
      return;
    } catch (erroTexto) {
      throw new ErroFilmaeu(passo, `elemento não encontrado (seletor e texto "${textoFallback}"): ${erroTexto.message.split('\n')[0]}`);
    }
  }
  throw new ErroFilmaeu(passo, `elemento não encontrado: ${seletor}`);
}

export async function logarFilmaeu(context, { usuario, senha }) {
  const page = await context.newPage();
  console.log('[clipes] abrindo tela de login');

  await page.goto(URLS.login, { waitUntil: 'domcontentloaded', timeout: PAGINA.timeoutNavegacaoMs });

  // RNF02: os valores de usuario/senha existem SÓ aqui, dentro do fill.
  await comRetry('login', async () => {
    await page.waitForSelector(SELETORES.campoUsuario, { state: 'visible', timeout: PAGINA.timeoutElementoMs });
    await page.fill(SELETORES.campoUsuario, usuario);
    await page.fill(SELETORES.campoSenha, senha);
    await page.click(SELETORES.botaoEntrar);
    await page.waitForSelector(SELETORES.sinalPostLogin, { state: 'visible', timeout: PAGINA.timeoutElementoMs });
  }, { tentativas: 2, page });

  console.log('[clipes] login ok');
  return page;
}

export async function navegarParaSlot(page, { dataISO, horario }) {
  // Fluxo real (mapeamento §1): Trocar campo → buscar quadra no modal →
  // selecionar a linha → data → Pesquisar → horário. A URL permanece /perfil#
  // em todos os passos (AJAX); não há atalho por querystring.
  return comScreenshotDeFalha(page, 'navegacao', async () => {
    await clicarElemento(page, SELETORES.linkTrocarCampo, 'trocar-campo');
    await page.waitForSelector(SELETORES.modalLocais, { state: 'visible', timeout: PAGINA.timeoutElementoMs });
    console.log('[clipes] modal de locais aberto');

    // O filtro do modal reage a keyup (mapeamento §2): page.fill não dispara
    // eventos de teclado — digitar com pressSequentially.
    await page.waitForSelector(SELETORES.campoBuscaQuadra, { state: 'visible', timeout: PAGINA.timeoutElementoMs });
    await page.locator(SELETORES.campoBuscaQuadra).pressSequentially(QUADRA);
    await clicarElemento(page, SELETORES.itemQuadra, 'busca-quadra');
    console.log(`[clipes] quadra "${QUADRA}" selecionada`);

    await page
      .waitForSelector(SELETORES.campoData, { state: 'visible', timeout: PAGINA.timeoutElementoMs })
      .catch(() => {
        throw new ErroFilmaeu('data', `campo de data não encontrado: ${SELETORES.campoData}`);
      });
    await page.fill(SELETORES.campoData, dataISO);
    console.log(`[clipes] data informada: ${dataISO}`);

    await clicarElemento(page, SELETORES.botaoPesquisar, 'pesquisar');

    // Slot ausente ≠ erro: horário sem gravação no dia é condição esperada
    // (mapeamento §4 — ausente, não desabilitado). Retornar null para o caller
    // fechar o ledger com 'sem_clipes'.
    const seletorHorario = seletorSlot(horario);
    const slotVisivel = await page
      .waitForSelector(seletorHorario, { state: 'visible', timeout: PAGINA.timeoutElementoMs })
      .then(() => true)
      .catch(() => false);
    if (!slotVisivel) {
      console.log(`[clipes] horário ${horario} não ofertado — slot ausente`);
      return null;
    }
    await page.click(seletorHorario);
    console.log(`[clipes] slot ${horario} selecionado`);

    await page.waitForSelector(SELETORES.gradeClipes, { state: 'attached', timeout: PAGINA.timeoutElementoMs });
    return page;
  });
}

export async function coletarClipes(page) {
  return comScreenshotDeFalha(page, 'coleta', async () => {
    // state 'attached': a grade pode existir vazia (sem caixa visível) —
    // contagem 0 cai no caminho 'sem_clipes' do caller.
    await page
      .waitForSelector(SELETORES.gradeClipes, { state: 'attached', timeout: PAGINA.timeoutElementoMs })
      .catch(() => {
        throw new ErroFilmaeu('grade-clipes', `grade de clipes não encontrada: ${SELETORES.gradeClipes}`);
      });

    const grupos = page.locator(SELETORES.cardClipe);
    const totalGrupos = await grupos.count();

    const lista = [];
    let ordem = 0;
    for (let indiceGrupo = 0; indiceGrupo < totalGrupos; indiceGrupo++) {
      const grupo = grupos.nth(indiceGrupo);
      const tituloLocator = grupo.locator(SELETORES.tituloClipe).first();
      const titulo =
        (await tituloLocator.count()) > 0 ? ((await tituloLocator.textContent()) ?? '').trim() : '';

      // Cada grupo tem um span.download-video por vídeo/câmera (mapeamento §2:
      // dois por grupo) — enumerar TODOS para não omitir uma câmera.
      const botoes = grupo.locator(SELETORES.botaoBaixar);
      const totalBotoes = await botoes.count();
      for (let indiceCamera = 0; indiceCamera < totalBotoes; indiceCamera++) {
        ordem += 1;
        lista.push({ ordem, titulo, camera: indiceCamera + 1, botaoBaixar: botoes.nth(indiceCamera) });
      }
    }
    console.log(`[clipes] grade carregada: ${totalGrupos} grupo(s), ${ordem} clipe(s)`);

    // Lista vazia NÃO é erro aqui — o caller decide 'sem_clipes'.
    return lista;
  });
}

function sanitizarParaNome(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function nomeArquivoDoClipe(clipe) {
  // O endpoint de download sugere o MESMO nome para todos os clipes do dia
  // (filmaeu_AAAA_MM_DD.mp4 — mapeamento §3): a identidade única vem do grupo
  // (horário de gravação no .card-header) + índice da câmera, ambos estáveis
  // na listagem (grupos em ordem crescente). É a chave da idempotência RF02.
  const titulo = sanitizarParaNome(clipe.titulo) || `g${clipe.ordem}`;
  return `v_${titulo}_cam${clipe.camera}.mp4`;
}

export async function baixarClipes(page, listaClipes, { dirTemp, caminhosPendentes }) {
  // caminhosPendentes: Set de NOMES DE ARQUIVO que ainda não têm linha na
  // tabela (decisão da Task 6 — tabela antes de baixar). O prefixo
  // {partida_id}/ é constante na run, então basename é suficiente para
  // decidir o que falta. O nome é derivado da PRÓPRIA LISTAGEM, então a
  // checagem acontece antes do clique (sem baixar o que já existe).
  mkdirSync(dirTemp, { recursive: true });

  const baixados = [];
  const total = listaClipes.length;

  for (const [indice, clipe] of listaClipes.entries()) {
    const rotulo = `${indice + 1}/${total}`;
    const nomeArquivo = nomeArquivoDoClipe(clipe);

    if (caminhosPendentes && caminhosPendentes.has(nomeArquivo)) {
      console.log(`[clipes] ${rotulo}: ${nomeArquivo} já existente — download pulado`);
      continue;
    }

    // Clique no span.download-video: o site define window.location.href para
    // o endpoint PHP que responde com Content-Disposition: attachment
    // (mapeamento §3) — a página não navega, o browser dispara o evento de
    // download. O nome sugerido (repetido) é descartado; salvamos com o nome
    // derivado acima.
    const download = await comRetry('download', async () => {
      const [evento] = await Promise.all([
        page.waitForEvent('download', { timeout: PAGINA.timeoutDownloadMs }),
        clipe.botaoBaixar.click(),
      ]);
      return evento;
    }, { tentativas: PAGINA.tentativasDownload, page });

    const arquivoLocal = join(dirTemp, nomeArquivo);
    await download.saveAs(arquivoLocal);
    const sizeBytes = statSync(arquivoLocal).size; // P12: tamanho real do arquivo salvo
    baixados.push({ ordem: clipe.ordem, titulo: clipe.titulo, nomeArquivo, arquivoLocal, sizeBytes });
    console.log(`[clipes] baixado ${rotulo}: ${nomeArquivo} (${sizeBytes} bytes)`);
  }

  return baixados;
}
