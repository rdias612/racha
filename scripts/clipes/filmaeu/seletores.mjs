// Única fonte de rotas e seletores do filmaeu.com.br (RNF04 — requisito §1 e §7:
// o site muda sem aviso; correção pontual AQUI, nunca espalhada pelo código).
// TODOS os valores marcados "A CONFIRMAR" vêm do mapeamento do dono
// (docs/filmaeu-mapeamento-dom.md). Estratégia de resiliência, em ordem:
// id > data-* > name > classe estável > texto visível (getByRole/getByText).
// Site server-rendered (jQuery/Bootstrap): navegação clássica, sem SPA —
// usar waitForSelector/waitForURL, não networkidle.

export const QUADRA = 'Society Gragoatá'; // D7 — quadra fixa (requisito §2)
export const URLS = {
  base: 'https://filmaeu.com.br',
  login: 'https://filmaeu.com.br/login', // A CONFIRMAR (requisito §1: "atrás de /login")
  // grade: se o mapeamento 1.3 mostrar URL endereçável, montar aqui
  // (ex.: `${base}/quadra/...?data=${dataISO}&horario=${horario}`) — A CONFIRMAR
};

// A CONFIRMAR NO MAPEAMENTO DO DONO — valores iniciais plausíveis para
// jQuery/Bootstrap, substituídos pelos reais antes da primeira run de validação.
export const SELETORES = {
  campoUsuario: 'A CONFIRMAR', // ex.: 'input[name="usuario"]'
  campoSenha: 'A CONFIRMAR', // ex.: 'input[type="password"]'
  botaoEntrar: 'A CONFIRMAR', // ex.: 'button[type="submit"]'
  sinalPostLogin: 'A CONFIRMAR', // elemento só visível autenticado
  campoBuscaQuadra: 'A CONFIRMAR',
  itemQuadra: 'A CONFIRMAR', // card/linha contendo QUADRA (texto)
  campoData: 'A CONFIRMAR', // input date? calendário? (mapeamento 2.3)
  itemSlot: 'A CONFIRMAR', // elemento do horário (ex.: link '19:00')
  gradeClipes: 'A CONFIRMAR', // container da grade
  cardClipe: 'A CONFIRMAR', // card individual (para contar/ordenar)
  tituloClipe: 'A CONFIRMAR',
  botaoBaixar: 'A CONFIRMAR', // ex.: 'a:has-text("Baixar")'
};

export const PAGINA = {
  timeoutNavegacaoMs: 30_000, // page.goto / waitForURL
  timeoutElementoMs: 15_000, // waitForSelector de cada passo
  timeoutDownloadMs: 120_000, // por clipe (~30s de vídeo)
  tentativasDownload: 2, // retry por clipe
};

// Erro de domínio: a automação distingue "o site não se comportou como esperado"
// (ErroFilmaeu → ledger 'falha' + screenshot) de erro de infra (throw comum).
export class ErroFilmaeu extends Error {
  constructor(passo, causa) {
    super(`Filma Eu: falha no passo "${passo}"${causa ? `: ${causa}` : ''}`);
    this.name = 'ErroFilmaeu';
    this.passo = passo;
  }
}
