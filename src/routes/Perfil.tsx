import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../context/SessaoContext';
import { POSICOES } from '../lib/times';
import { atualizarNomeJogador } from '../lib/jogadores';
import { Carregando, MensagemEstado } from '../components/Estado';
import { Avatar } from '../components/Avatar';
import { SkeletonPerfil } from '../components/Skeletons';
import { formatarMensagemErro } from '../lib/erros';
import { ativarPush, desativarPush, statusPush, type StatusPush } from '../lib/pwa';

interface Stats {
  jogador_id: number;
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
  vitorias: number;
}

export function Perfil() {
  const { jogador, setJogador, logout } = useSessao();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats | null>(null);
  const [carregandoStats, setCarregandoStats] = useState(true);

  // formulário de alteração de nome
  const [nomeNovo, setNomeNovo] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [okNome, setOkNome] = useState<string | null>(null);

  // formulário de troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirma, setSenhaConfirma] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [okSenha, setOkSenha] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<StatusPush>('desativado');
  const [carregandoPush, setCarregandoPush] = useState(true);
  const [alterandoPush, setAlterandoPush] = useState(false);
  const [erroPush, setErroPush] = useState<string | null>(null);

  useEffect(() => {
    async function carregarStats() {
      if (!jogador) return;
      const { data, error } = await supabase
        .from('stats_jogador')
        .select('jogador_id, partidas, gols, assistencias, gols_contra, vitorias')
        .eq('jogador_id', jogador.id)
        .maybeSingle();
      if (!error) setStats(data);
      setCarregandoStats(false);
    }
    carregarStats();
  }, [jogador?.id]);

  useEffect(() => {
    let ativo = true;
    async function carregarPush() {
      if (!jogador) return;
      try {
        const status = await statusPush(jogador.id);
        if (ativo) setPushStatus(status);
      } catch {
        if (ativo) setPushStatus('desativado');
      } finally {
        if (ativo) setCarregandoPush(false);
      }
    }
    carregarPush();
    return () => {
      ativo = false;
    };
  }, [jogador?.id]);

  if (!jogador) return null;

  async function alterarNome(e: React.FormEvent) {
    e.preventDefault();
    setErroNome(null);
    setOkNome(null);

    const nome = nomeNovo.trim();
    if (!nome) {
      setErroNome('Digite um nome.');
      return;
    }
    if (nome.length > 60) {
      setErroNome('O nome deve ter no máximo 60 caracteres.');
      return;
    }
    if (nome === jogador!.nome) {
      setErroNome('O nome é igual ao atual.');
      return;
    }

    setSalvandoNome(true);
    try {
      await atualizarNomeJogador(jogador!.id, nome);
      setJogador({ ...jogador!, nome });
      setOkNome('Nome atualizado. Respeita a camisa nova.');
      setNomeNovo('');
    } catch (error) {
      setErroNome('Erro: ' + (error instanceof Error ? error.message : 'falha ao salvar.'));
    } finally {
      setSalvandoNome(false);
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
    const { data, error } = await supabase.rpc('trocar_senha', {
      p_jogador_id: jogador!.id,
      p_senha_atual: senhaAtual,
      p_senha_nova: senhaNova,
    });
    setTrocando(false);

    if (error) {
      setErroSenha('Erro: ' + error.message);
      return;
    }
    if (data === false) {
      setErroSenha('Senha atual incorreta.');
      return;
    }

    setOkSenha('Senha alterada com sucesso!');
    setSenhaAtual('');
    setSenhaNova('');
    setSenhaConfirma('');
  }

  function fazerLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function alternarPush() {
    setAlterandoPush(true);
    setErroPush(null);
    try {
      if (pushStatus === 'ativado') {
        await desativarPush(jogador!.id);
        setPushStatus('desativado');
      } else {
        await ativarPush(jogador!.id);
        setPushStatus('ativado');
      }
    } catch (error) {
      setErroPush(formatarMensagemErro(error));
    } finally {
      setAlterandoPush(false);
    }
  }

  if (carregandoStats && !stats) {
    return <SkeletonPerfil />;
  }

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-5 text-giz">
      {/* Cabeçalho da Súmula */}
      <div className="sumula-header pb-2 flex items-baseline justify-between">
        <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
          Ficha do Jogador
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
          Súmula CBO
        </span>
      </div>

      {/* Cartão de Identidade do Jogador */}
      <section className="flex items-center gap-3.5 p-4 rounded-[4px] border-2 border-borda bg-superficie shadow-carimbo">
        <Avatar nome={jogador.nome} posicao={jogador.posicao} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-xl uppercase tracking-wide text-giz truncate">
              {jogador.nome}
            </h3>
            {jogador.is_admin && (
              <span className="shrink-0 text-[9px] font-display font-bold uppercase tracking-wider bg-destaque text-destaque-tinta px-1.5 py-0.5 rounded-[2px] shadow-xs">
                Admin
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-giz-fraco mt-0.5">
            @{jogador.username} · {POSICOES[jogador.posicao]}
            {jogador.posicao_b && ` / 2ª ${POSICOES[jogador.posicao_b]}`}
            {jogador.is_mensalista && (
              <span className="text-destaque font-bold"> · Mensalista</span>
            )}
          </p>
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

      {/* Notificações Push */}
      <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-2">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
          Lembretes da Quinta (Notificações Push)
        </h3>
        <p className="text-xs text-giz-fraco">
          Receba convocação de presença e aviso de abertura da votação neste aparelho.
        </p>
        {erroPush && <MensagemEstado>{erroPush}</MensagemEstado>}
        {pushStatus === 'indisponivel' && (
          <MensagemEstado tipo="info">Seu navegador não quer saber dos lembretes.</MensagemEstado>
        )}
        {pushStatus === 'negado' && (
          <MensagemEstado tipo="info">
            As notificações estão bloqueadas nas configurações do navegador.
          </MensagemEstado>
        )}
        {pushStatus !== 'indisponivel' && pushStatus !== 'negado' && (
          <button
            type="button"
            onClick={alternarPush}
            disabled={carregandoPush || alterandoPush}
            className={`w-full min-h-[44px] rounded-[4px] border font-display font-bold uppercase tracking-wider text-xs shadow-carimbo transition active:translate-y-px disabled:opacity-50 ${
              pushStatus === 'ativado'
                ? 'border-borda bg-superficie-2 text-giz hover:bg-superficie'
                : 'border-destaque bg-destaque text-destaque-tinta hover:brightness-105'
            }`}
          >
            {carregandoPush || alterandoPush
              ? 'Atualizando…'
              : pushStatus === 'ativado'
                ? 'Desativar notificações'
                : 'Ativar lembretes do racha'}
          </button>
        )}
      </section>

      {/* Alterar nome */}
      <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz">
          Alterar Nome na Súmula
        </h3>
        <form onSubmit={alterarNome} className="space-y-3">
          <input
            type="text"
            placeholder={jogador.nome}
            autoCapitalize="words"
            autoComplete="name"
            maxLength={60}
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz shadow-xs focus:outline-none focus:border-destaque"
            required
          />
          {erroNome && <MensagemEstado>{erroNome}</MensagemEstado>}
          {okNome && <MensagemEstado tipo="sucesso">{okNome}</MensagemEstado>}
          <button
            type="submit"
            disabled={salvandoNome}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50"
          >
            {salvandoNome ? 'Salvando…' : 'Atualizar camisa'}
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
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-mono shadow-xs focus:outline-none focus:border-destaque"
            required
          />
          <input
            type="password"
            placeholder="Nova senha"
            autoComplete="new-password"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-mono shadow-xs focus:outline-none focus:border-destaque"
            required
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            value={senhaConfirma}
            onChange={(e) => setSenhaConfirma(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-mono shadow-xs focus:outline-none focus:border-destaque"
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

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[4px] border border-borda bg-superficie px-2 py-2.5 text-center shadow-carimbo">
      <div className="font-mono text-xl sm:text-2xl font-black text-destaque tabular-nums">
        {value}
      </div>
      <div className="font-display text-[10px] font-bold uppercase tracking-wider text-giz-fraco">
        {label}
      </div>
    </div>
  );
}
