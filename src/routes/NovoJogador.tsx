import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';
import { POSICOES, POSICOES_B, type PosicaoId } from '../lib/times';
import { MensagemEstado } from '../components/Estado';
import { User, Shield, Star, Copy, Check, UserPlus } from 'lucide-react';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { formatarMensagemErro } from '../lib/erros';

export function NovoJogador() {
  const isAdmin = useAdmin();

  const [username, setUsername] = useState('');
  const [posicao, setPosicao] = useState<PosicaoId>('meia');
  const [posicaoB, setPosicaoB] = useState<PosicaoId>('meia');
  const [isMensalista, setIsMensalista] = useState(false);
  const [isAdminNovo, setIsAdminNovo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (!isAdmin) return <Navigate to="/" replace />;

  function copiarSenhaPadrao() {
    navigator.clipboard.writeText('123');
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);

    const usernameLimpo = username.trim().toLowerCase();
    if (!usernameLimpo) {
      setErro('Preencha o nome de usuário para cadastrar.');
      return;
    }

    setCriando(true);
    const { data, error } = await supabase.rpc('criar_jogador', {
      p_username: usernameLimpo,
      p_posicao: posicao,
      p_is_admin: isAdminNovo,
      p_posicao_b: posicao === 'goleiro' ? undefined : (posicaoB ?? undefined),
      p_is_mensalista: isMensalista,
    });
    setCriando(false);

    if (error) {
      if (error.code === '23505') {
        setErro(`Já existe um jogador cadastrado com o usuário "${usernameLimpo}".`);
      } else {
        setErro(formatarMensagemErro(error, 'Erro ao criar jogador.'));
      }
      return;
    }
    if (data === null) {
      setErro('Não foi possível criar o jogador.');
      return;
    }

    setOk(`Jogador "@${usernameLimpo}" criado com sucesso! Senha padrão: 123`);
    setUsername('');
    setPosicao('meia');
    setPosicaoB('meia');
    setIsMensalista(false);
    setIsAdminNovo(false);
  }

  return (
    <div className="px-3 py-4 pb-24 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <BotaoVoltar fallback="/administrador" />

      <div className="sumula-header pb-2 flex items-baseline justify-between">
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz flex items-center gap-2">
            <UserPlus className="size-5 text-destaque-texto" />
            Novo Jogador da Súmula
          </h2>
          <p className="text-xs font-mono text-giz-fraco mt-0.5">
            Cadastro oficial de atleta do racha
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
          Ficha CBO
        </span>
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {ok && <MensagemEstado tipo="sucesso">{ok}</MensagemEstado>}

      <form onSubmit={criar} className="space-y-4">
        {/* Seção 1: Identificação */}
        <div className="rounded-[4px] border border-borda bg-superficie p-4 space-y-3 shadow-carimbo">
          <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
            <User className="size-4 text-destaque-texto" />
            Identificação do Atleta
          </div>

          <div>
            <label className="block">
              <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
                Nome de Usuário (@username) *
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                placeholder="ex: joaosilva"
                className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2.5 text-sm text-giz font-mono shadow-xs focus:outline-none focus:border-destaque"
                required
              />
            </label>
          </div>
        </div>

        {/* Seção 2: Posições em Campo */}
        <div className="rounded-[4px] border border-borda bg-superficie p-4 space-y-3 shadow-carimbo">
          <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
            <Star className="size-4 text-destaque-texto" />
            Posições em Campo
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
                Posição principal
              </span>
              <select
                value={posicao}
                onChange={(e) => {
                  const val = e.target.value as PosicaoId;
                  setPosicao(val);
                  if (val === 'goleiro') {
                    setIsMensalista(false);
                    setIsAdminNovo(false);
                  }
                }}
                className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz shadow-xs focus:outline-none focus:border-destaque"
              >
                {(Object.keys(POSICOES) as PosicaoId[]).map((p) => (
                  <option key={p} value={p}>
                    {POSICOES[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
                Posição secundária{posicao === 'goleiro' ? ' (não aplicável)' : ''}
              </span>
              <select
                value={posicaoB}
                onChange={(e) => setPosicaoB(e.target.value as PosicaoId)}
                disabled={posicao === 'goleiro'}
                className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz shadow-xs focus:outline-none focus:border-destaque disabled:opacity-40"
              >
                {(Object.keys(POSICOES_B) as (keyof typeof POSICOES_B)[]).map((p) => (
                  <option key={p} value={p}>
                    {POSICOES_B[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Seção 3: Configurações & Permissões */}
        <div className="rounded-[4px] border border-borda bg-superficie p-4 space-y-3 shadow-carimbo">
          <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
            <Shield className="size-4 text-destaque-texto" />
            Configurações & Permissões
          </div>

          <label
            className={`flex items-start gap-3 p-3 rounded-[3px] border border-borda bg-superficie-2 transition ${
              posicao === 'goleiro'
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:border-destaque/40 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={isMensalista}
              disabled={posicao === 'goleiro'}
              onChange={(e) => {
                const val = e.target.checked;
                setIsMensalista(val);
                if (!val) setIsAdminNovo(false);
              }}
              className="accent-destaque size-4 rounded-[2px] mt-0.5"
            />
            <div className="text-xs">
              <span className="font-display font-bold uppercase tracking-wider text-giz block">
                É Mensalista{posicao === 'goleiro' ? ' (Não aplicável)' : ''}
              </span>
              <span className="text-giz-fraco">
                {posicao === 'goleiro'
                  ? 'Goleiros não pagam para jogar (isentos de mensalidade e taxa de avulso).'
                  : 'Tem vaga garantida na confirmação das partidas e contribuição mensal.'}
              </span>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-[3px] border border-borda bg-superficie-2 transition ${
              posicao === 'goleiro'
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:border-destaque/40 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={isAdminNovo}
              disabled={posicao === 'goleiro'}
              onChange={(e) => {
                const val = e.target.checked;
                setIsAdminNovo(val);
                if (val) setIsMensalista(true);
              }}
              className="accent-destaque size-4 rounded-[2px] mt-0.5"
            />
            <div className="text-xs">
              <span className="font-display font-bold uppercase tracking-wider text-giz block">
                É Administrador{posicao === 'goleiro' ? ' (Não aplicável)' : ''}
              </span>
              <span className="text-giz-fraco">
                Pode criar, editar partidas, lançar eventos e gerenciar o racha (requer ser
                Mensalista).
              </span>
            </div>
          </label>
        </div>

        {/* Seção 4: Senha Padrão */}
        <div className="rounded-[4px] border border-destaque/40 bg-destaque/10 p-3.5 flex items-center justify-between gap-3 text-xs shadow-carimbo">
          <div>
            <span className="font-display font-bold uppercase tracking-wider text-destaque-texto block">
              Senha inicial padrão:
            </span>
            <span className="text-giz-fraco text-xs">
              O jogador utilizará a senha{' '}
              <code className="font-mono font-bold text-destaque-texto bg-superficie px-1.5 py-0.5 rounded-[2px] border border-destaque/30">
                123
              </code>{' '}
              no primeiro acesso.
            </span>
          </div>
          <button
            type="button"
            onClick={copiarSenhaPadrao}
            className="flex min-h-[44px] items-center gap-1 px-3 py-1.5 rounded-[3px] border border-destaque bg-destaque text-destaque-tinta font-display font-bold uppercase tracking-wider text-xs shadow-xs hover:brightness-105 active:translate-y-px transition shrink-0"
          >
            {copiado ? (
              <>
                <Check className="size-3.5" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Botão de Submissão */}
        <button
          type="submit"
          disabled={criando}
          className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {criando ? (
            'Gravando na súmula...'
          ) : (
            <>
              <UserPlus className="size-4" />
              <span>Cadastrar Jogador no Racha</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
