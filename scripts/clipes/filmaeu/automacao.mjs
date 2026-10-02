// Automação Playwright do Filma Eu (Fase 3 — breakdown SDD 35).
// Funções puras de browser: recebem context/page, retornam dados; a orquestração
// com Supabase/ledger fica em importar-clipes.mjs. RNF02: credenciais são usadas
// só em page.fill — JAMAIS logadas. RNF04: log rico por passo, retry em
// login/download e screenshot por passo em falha.
// Seletores e timeouts vêm TODOS de ./seletores.mjs (RNF04).
import { chromium } from 'playwright';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { URLS, SELETORES, PAGINA, QUADRA, ErroFilmaeu } from './seletores.mjs';

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
  // Sequência de cliques prevista no requisito §1 (busca da quadra → data →
  // slot). Se o mapeamento 1.3 confirmar URL endereçável da grade, este método
  // passa a ser page.goto direto — menos cliques, mais resiliência (RNF04).
  return comScreenshotDeFalha(page, 'navegacao', async () => {
    await page
      .waitForSelector(SELETORES.campoBuscaQuadra, { state: 'visible', timeout: PAGINA.timeoutElementoMs })
      .catch(() => {
        throw new ErroFilmaeu('busca-quadra', `campo de busca não encontrado: ${SELETORES.campoBuscaQuadra}`);
      });
    await page.fill(SELETORES.campoBuscaQuadra, QUADRA);
    await clicarElemento(page, SELETORES.itemQuadra, 'busca-quadra', { textoFallback: QUADRA });
    console.log(`[clipes] quadra "${QUADRA}" selecionada`);

    await page
      .waitForSelector(SELETORES.campoData, { state: 'visible', timeout: PAGINA.timeoutElementoMs })
      .catch(() => {
        throw new ErroFilmaeu('data', `campo de data não encontrado: ${SELETORES.campoData}`);
      });
    await page.fill(SELETORES.campoData, dataISO);
    console.log(`[clipes] data informada: ${dataISO}`);

    await clicarElemento(page, SELETORES.itemSlot, 'slot', { textoFallback: horario });
    console.log(`[clipes] slot ${horario} selecionado`);

    return page;
  });
}

export async function coletarClipes(page) {
  return comScreenshotDeFalha(page, 'coleta', async () => {
    await page
      .waitForSelector(SELETORES.gradeClipes, { state: 'visible', timeout: PAGINA.timeoutElementoMs })
      .catch(() => {
        throw new ErroFilmaeu('grade-clipes', `grade de clipes não encontrada: ${SELETORES.gradeClipes}`);
      });

    const cards = page.locator(SELETORES.cardClipe);
    const total = await cards.count();
    console.log(`[clipes] grade carregada: ${total} clipe(s) na listagem`);

    const lista = [];
    for (let indice = 0; indice < total; indice++) {
      const card = cards.nth(indice);
      const botao = card.locator(SELETORES.botaoBaixar).first();
      const tituloLocator = card.locator(SELETORES.tituloClipe).first();

      const titulo =
        (await tituloLocator.count()) > 0 ? ((await tituloLocator.textContent()) ?? '').trim() : '';
      // href presente = padrão B do mapeamento 3.1 (âncora direta para o S3).
      const href = (await botao.count()) > 0 ? await botao.getAttribute('href') : null;

      // ordem = posição na listagem do slot, 1-based (fixa a semântica da
      // divergência 3 da Fase 1).
      lista.push({ ordem: indice + 1, titulo, botaoBaixar: botao, href });
    }

    // Lista vazia NÃO é erro aqui — o caller decide 'sem_clipes'.
    return lista;
  });
}

function nomeArquivoDeUrl(url) {
  try {
    // href pode ser relativo à base do site (ex.: '/media/clipe.mp4') —
    // resolver contra URLS.base cobre absolutas e relativas.
    return decodeURIComponent(basename(new URL(url, URLS.base).pathname));
  } catch {
    return null;
  }
}

export async function baixarClipes(page, listaClipes, { dirTemp, caminhosPendentes }) {
  // caminhosPendentes: Set de NOMES DE ARQUIVO que ainda não têm linha na
  // tabela (decisão da Task 6 — tabela antes de baixar). O prefixo
  // {partida_id}/ é constante na run, então basename é suficiente para
  // decidir o que falta. Um clipe cujo nome já existe é PULADO (sem baixar).
  mkdirSync(dirTemp, { recursive: true });

  const baixados = [];
  const total = listaClipes.length;

  for (const [indice, clipe] of listaClipes.entries()) {
    const rotulo = `${indice + 1}/${total}`;

    // Padrão B do mapeamento 3.1: âncora aponta direto para o S3 — baixa via
    // context.request, reusando os cookies da sessão (sem segundo login).
    // RNF02: a URL (que pode carregar token assinado) nunca vai para log.
    if (clipe.href) {
      const nomeArquivo = nomeArquivoDeUrl(clipe.href);
      if (!nomeArquivo) {
        throw new ErroFilmaeu('download', 'não foi possível derivar o nome do arquivo a partir da URL da âncora');
      }
      if (caminhosPendentes && !caminhosPendentes.has(nomeArquivo)) {
        console.log(`[clipes] ${rotulo}: ${nomeArquivo} já existente — download pulado`);
        continue;
      }

      // href relativo é resolvido contra a base (request.get exige URL absoluta);
      // aqui a âncora já foi validada por nomeArquivoDeUrl.
      const urlDownload = new URL(clipe.href, URLS.base).href;

      const resposta = await comRetry('download', async () => {
        const tentativa = await page.context().request.get(urlDownload, { timeout: PAGINA.timeoutDownloadMs });
        if (!tentativa.ok()) {
          throw new ErroFilmaeu('download', `resposta HTTP ${tentativa.status()} da URL da âncora`);
        }
        return tentativa;
      }, { tentativas: PAGINA.tentativasDownload, page });

      const arquivoLocal = join(dirTemp, nomeArquivo);
      writeFileSync(arquivoLocal, await resposta.body());
      const sizeBytes = statSync(arquivoLocal).size; // P12: tamanho real do arquivo salvo
      baixados.push({ ordem: clipe.ordem, titulo: clipe.titulo, nomeArquivo, arquivoLocal, sizeBytes });
      console.log(`[clipes] baixado ${rotulo}: ${nomeArquivo} (${sizeBytes} bytes)`);
      continue;
    }

    // Padrão A do mapeamento 3.1: clique dispara evento de download do browser.
    const download = await comRetry('download', async () => {
      const [evento] = await Promise.all([
        page.waitForEvent('download', { timeout: PAGINA.timeoutDownloadMs }),
        clipe.botaoBaixar.click(),
      ]);
      return evento;
    }, { tentativas: PAGINA.tentativasDownload, page });

    const nomeArquivo = basename(download.suggestedFilename());
    if (caminhosPendentes && !caminhosPendentes.has(nomeArquivo)) {
      await download.cancel().catch(() => {});
      console.log(`[clipes] ${rotulo}: ${nomeArquivo} já existente — download pulado`);
      continue;
    }

    const arquivoLocal = join(dirTemp, nomeArquivo);
    await download.saveAs(arquivoLocal);
    const sizeBytes = statSync(arquivoLocal).size; // P12: tamanho real do arquivo salvo
    baixados.push({ ordem: clipe.ordem, titulo: clipe.titulo, nomeArquivo, arquivoLocal, sizeBytes });
    console.log(`[clipes] baixado ${rotulo}: ${nomeArquivo} (${sizeBytes} bytes)`);
  }

  return baixados;
}
