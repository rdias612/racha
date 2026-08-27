import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../context/SessaoContext';
import { POSICOES } from '../lib/times';
import {
  atualizarUsernameJogador,
  atualizarDadosPixTelefone,
  carregarStatsJogador,
  isSuperAdminId,
  validarFormatoUsername,
  type StatsJogador,
} from '../lib/jogadores';
import { vibrateError, vibrateSuccess } from '../lib/haptics';
import { Carregando, MensagemEstado } from '../components/Estado';
import { Avatar } from '../components/Avatar';
import { StatBox } from '../components/StatBox';
import { SkeletonPerfil } from '../components/Skeletons';
import { CreditCard, Phone } from 'lucide-react';
import { formatarMensagemErro } from '../lib/erros';

export function Perfil() {
  const { jogador, setJogador, logout } = useSessao();
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsJogador | null>(null);
  const [carregandoStats, setCarregandoStats] = useState(true);

  // formulário de alteração de username
  const [usernameNovo, setUsernameNovo] = useState('');
  const [salvandoUsername, setSalvandoUsername] = useState(false);
  const [erroUsername, setErroUsername] = useState<string | null>(null);
  const [okUsername, setOkUsername] = useState<string | null>(null);

  // formulário de dados de pagamento (PIX / WhatsApp)
  const [telefone, setTelefone] = useState(jogador?.telefone ?? '');
  const [chavePix, setChavePix] = useState(jogador?.chave_pix ?? '');
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [erroContato, setErroContato] = useState<string | null>(null);
  const [okContato, setOkContato] = useState<string | null>(null);

  // formulário de troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirma, setSenhaConfirma] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [okSenha, setOkSenha] = useState<string | null>(null);

  const jogadorId = jogador?.id;

  useEffect(() => {
    let ativo = true;
    async function carregarStats() {
      if (!jogadorId) return;
      try {
        const dados = await carregarStatsJogador(jogadorId);
        if (ativo) {
          setStats(dados);
        }
      } catch {
        if (ativo) {
          setStats(null);
        }
      } finally {
        if (ativo) {
          setCarregandoStats(false);
        }
      }
    }
    carregarStats();
    return () => {
      ativo = false;
    };
  }, [jogadorId]);

  if (!jogador) return null;

  async function alterarUsername(e: React.FormEvent) {
    e.preventDefault();
    setErroUsername(null);
    setOkUsername(null);

    const erroValidacao = validarFormatoUsername(usernameNovo);
    if (erroValidacao) {
      setErroUsername(erroValidacao);
      vibrateError();
      return;
    }

    const limpo = usernameNovo.trim();
    // Mudança apenas de maiúsculas/minúsculas é permitida.
    if (limpo === jogador!.username) {
      setErroUsername('O novo usuário é igual ao atual.');
      vibrateError();
      return;
    }

    setSalvandoUsername(true);
    try {
      await atualizarUsernameJogador(jogador!.id, usernameNovo);
      setJogador({ ...jogador!, username: limpo });
      vibrateSuccess();
      setOkUsername('Usuário alterado com sucesso. Use @' + limpo + ' no próximo login.');
      setUsernameNovo('');
    } catch (error) {
      vibrateError();
      setErroUsername(formatarMensagemErro(error, 'Não foi possível alterar o nome de usuário.'));
    } finally {
      setSalvandoUsername(false);
    }
  }

  async function salvarDadosContato(e: React.FormEvent) {
    e.preventDefault();
    setErroContato(null);
    setOkContato(null);

    if (!jogador?.id) return;

    setSalvandoContato(true);
    try {
      await atualizarDadosPixTelefone(
        jogador.id,
        {
          telefone: telefone.trim(),
          chave_pix: chavePix.trim(),
        },
        jogador.id
      );
      setJogador({
        ...jogador,
        telefone: telefone.trim() || null,
        chave_pix: chavePix.trim() || null,
      });
      vibrateSuccess();
      setOkContato('Dados de pagamento e contato salvos com sucesso.');
    } catch (error) {
      vibrateError();
      setErroContato(formatarMensagemErro(error, 'Não foi possível salvar os dados de contato.'));
    } finally {
      setSalvandoContato(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha(null);
    setOkSenha(null);

    if (senhaNova.length < 3) {
      setErroSenha('A nova senha deve ter ao menos 3 caracteres.');
      return;
    }
    if (senhaNova !== senhaConfirma) {
      setErroSenha('A confirmação não confere.');
      return;
    }

    setTrocando(true);
    try {
      const { error } = await supabase.rpc('trocar_senha', {
        p_jogador_id: jogador!.id,
        p_senha_atual: senhaAtual,
        p_senha_nova: senhaNova,
      });

      if (error) {
        if (error.message && error.message.includes('incorreta')) {
          throw new Error('Senha atual incorreta.');
        }
        throw error;
      }

      setSenhaAtual('');
      setSenhaNova('');
      setSenhaConfirma('');
      setOkSenha('Senha alterada com sucesso!');
      vibrateSuccess();
    } catch (error) {
      vibrateError();
      setErroSenha(formatarMensagemErro(error, 'Não foi possível alterar a senha.'));
    } finally {
      setTrocando(false);
    }
  }

  function fazerLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  if (carregandoStats && !stats) {
    return <SkeletonPerfil />;
  }

  return (
    <div className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      {/* Cartão de Identidade do Jogador */}
      <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo">
        <div className="flex items-center gap-3">
          <Avatar username={jogador.username} posicao={jogador.posicao} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-display text-xl font-bold uppercase tracking-wider text-giz">
                @{jogador.username}
              </h2>
              {isSuperAdminId(jogador.id) && (
                <span className="shrink-0 rounded-[2px] bg-destaque px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-destaque-tinta shadow-xs">
                  Admin
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-mono text-giz-fraco">
              <span>{POSICOES[jogador.posicao]}</span>
              {jogador.posicao_b && <span>· 2ª {POSICOES[jogador.posicao_b]}</span>}
              <span>· {jogador.is_mensalista ? 'Mensalista' : 'Avulso'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Estatísticas */}
      <section className="space-y-2">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
          Números na Temporada
        </h3>
        {carregandoStats ? (
          <Carregando compacto>Carregando estatísticas</Carregando>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <StatBox label="Partidas" value={stats?.partidas ?? 0} />
            <StatBox label="Vitórias" value={stats?.vitorias ?? 0} />
            <StatBox label="Gols" value={stats?.gols ?? 0} />
            <StatBox label="Assists" value={stats?.assistencias ?? 0} />
            <StatBox label="Gols contra" value={stats?.gols_contra ?? 0} />
          </div>
        )}
      </section>

      {/* Alterar Usuário de Acesso */}
      <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
            Nome de Usuário (@)
          </h3>
          <p className="text-[11px] font-sans text-giz-fraco mt-0.5">
            Seu identificador no racha, súmulas e rankings.
          </p>
        </div>

        <form onSubmit={alterarUsername} className="space-y-3">
          <div>
            <input
              type="text"
              placeholder={jogador.username}
              value={usernameNovo}
              onChange={(e) => setUsernameNovo(e.target.value)}
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm font-mono text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2 min-h-[44px]"
            />
          </div>
          {erroUsername && <MensagemEstado tipo="erro">{erroUsername}</MensagemEstado>}
          {okUsername && <MensagemEstado tipo="sucesso">{okUsername}</MensagemEstado>}
          <button
            type="submit"
            disabled={salvandoUsername || !usernameNovo.trim()}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50"
          >
            {salvandoUsername ? 'Salvando…' : 'Salvar novo username'}
          </button>
        </form>
      </section>

      {/* Dados de Pagamento / PIX e Contato */}
      <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz flex items-center gap-1.5">
            <CreditCard className="size-3.5 text-destaque-texto" />
            <span>Dados de Pagamento (PIX / WhatsApp)</span>
          </h3>
          <p className="text-[11px] font-sans text-giz-fraco mt-0.5">
            Utilizado para recebimento de diárias e contato pelo grupo.
          </p>
        </div>

        <form onSubmit={salvarDadosContato} className="space-y-3">
          <div>
            <label className="block text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco mb-1 flex items-center gap-1">
              <Phone className="size-3.5 text-destaque-texto" />
              <span>Telefone / WhatsApp</span>
            </label>
            <input
              type="tel"
              placeholder="(21) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm font-mono text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco mb-1 flex items-center gap-1">
              <CreditCard className="size-3.5 text-destaque-texto" />
              <span>Chave PIX</span>
            </label>
            <input
              type="text"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm font-mono text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2 min-h-[44px]"
            />
          </div>

          {erroContato && <MensagemEstado tipo="erro">{erroContato}</MensagemEstado>}
          {okContato && <MensagemEstado tipo="sucesso">{okContato}</MensagemEstado>}

          <button
            type="submit"
            disabled={salvandoContato}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-destaque-texto"
          >
            {salvandoContato ? 'Salvando dados…' : 'Salvar dados de pagamento'}
          </button>
        </form>
      </section>

      {/* Trocar senha */}
      <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
          Alterar Senha de Acesso
        </h3>
        <form onSubmit={trocarSenha} className="space-y-3">
          <input
            type="password"
            placeholder="Senha atual"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
            required
          />
          <input
            type="password"
            placeholder="Nova senha"
            autoComplete="new-password"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
            required
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            value={senhaConfirma}
            onChange={(e) => setSenhaConfirma(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
            required
          />
          {erroSenha && <MensagemEstado>{erroSenha}</MensagemEstado>}
          {okSenha && <MensagemEstado tipo="sucesso">{okSenha}</MensagemEstado>}
          <button
            type="submit"
            disabled={trocando}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50"
          >
            {trocando ? 'Alterando…' : 'Salvar nova senha'}
          </button>
        </form>
      </section>

      {/* Logout */}
      <section className="pt-2">
        <button
          onClick={fazerLogout}
          className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-giz-fraco hover:text-perigo hover:border-perigo/50 shadow-xs active:translate-y-px transition"
        >
          Encerrar sessão
        </button>
      </section>

      {/* Footer de Boletim */}
      <div className="pt-2 text-center">
        <p className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
          Racha Gragoatá · desde 2024 · toda quinta, CBO
        </p>
      </div>
    </div>
  );
}
