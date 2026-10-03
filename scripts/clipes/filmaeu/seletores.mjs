// Única fonte de rotas e seletores do filmaeu.com.br (RNF04 — requisito §1 e §7:
// o site muda sem aviso; correção pontual AQUI, nunca espalhada pelo código).
// Valores CONFIRMADOS no mapeamento DOM do dono de 02/10/2026
// (docs/filmaeu-mapeamento-dom.md). Estratégia de resiliência, em ordem:
// id > data-* > name > classe estável > texto visível (getByRole/getByText).
// Site server-rendered (jQuery/Bootstrap): conteúdo carregado por AJAX sobre
// /perfil# — NÃO há URL endereçável da grade (mapeamento §1); usar
// waitForSelector, não waitForURL/networkidle.

export const QUADRA = 'Society Gragoatá'; // D7 — quadra fixa (requisito §2)
// Linha da quadra no modal de locais (mapeamento §2: tr#client803; o clique
// preenche input#society com o client-id).
export const QUADRA_CLIENT_ID = '803';

export const URLS = {
  base: 'https://filmaeu.com.br',
  login: 'https://filmaeu.com.br/login',
};

export const SELETORES = {
  campoUsuario: '#loginForm input[name="email"]',
  campoSenha: '#loginForm input[name="password"]',
  botaoEntrar: '#loginForm button.login_btn',
  sinalPostLogin: '#datepicker', // só visível autenticado, em /perfil
  linkTrocarCampo: 'a:has-text("Trocar campo")', // abre o modal #myModal (só existe SEM quadra vinculada à conta)
  quadraVinculada: 'input#society', // client-id da quadra vinculada ao perfil (preenchido server-side)
  modalLocais: '#myModal',
  campoBuscaQuadra: '#myModal #client-search', // SEMPRE escopado ao modal (há outro #client-search oculto)
  itemQuadra: `#myModal tr#client${QUADRA_CLIENT_ID}`,
  campoData: 'input#datepicker[type="date"]', // valor ISO AAAA-MM-DD
  botaoPesquisar: 'span#submitDate', // texto "Pesquisar"; carrega a lista de horários
  gradeClipes: '#showVideos',
  cardClipe: '#showVideos .card-videos', // um grupo por horário de gravação
  tituloClipe: '.card-header',
  botaoBaixar: 'span.download-video', // um por vídeo/câmera (2 por grupo)
};

// O link do horário usa atributo hour="19HR" para o slot 19:00 (mapeamento §2).
export function seletorSlot(horario) {
  return `a.hour[hour="${horario.split(':')[0]}HR"]`;
}

export const PAGINA = {
  timeoutNavegacaoMs: 30_000, // page.goto / waitForURL
  timeoutElementoMs: 15_000, // waitForSelector de cada passo
  timeoutVerificacaoMs: 5_000, // presença OPCIONAL de elemento (ramo adaptativo do fluxo)
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
