import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { invalidarCache } from '../hooks/useCache';
import { CHAVE_JOGOS, chaveResumo } from '../lib/chavesCache';
import { isRandomUsername } from '../lib/jogadores';
import {
  abrirPartida,
  carregarPartida,
  carregarPlacar,
  carregarParticipantes,
  carregarNotas,
  carregarPartidasVotadas,
  descartarVotos,
  votacaoAberta,
  STATUS_LABEL,
  type Partida,
  type Placar,
  type Participante,
  type NotaPartida,
} from '../lib/partidas';
import { MensagemEstado } from '../components/Estado';
import { SkeletonDetalhe } from '../components/Skeletons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CardCraquePartida } from '../components/CardCraquePartida';
import { ConfirmacoesPartida } from '../components/ConfirmacoesPartida';
import { GridTimesPartida } from '../components/GridTimesPartida';
import { ListaNotasPartida } from '../components/ListaNotasPartida';
import { formatarDataCompleta, formatarDataMobile, formatarFechamento } from '../lib/formatacao';
import { Badge } from '../components/Badge';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { PainelPlacar } from '../components/PainelPlacar';
import { formatarMensagemErro } from '../lib/erros';

export function PartidaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const jogadorLogado = useJogadorLogado();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [notas, setNotas] = useState<NotaPartida[]>([]);
  const [jaVotou, setJaVotou] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!id) return;
      setCarregando(true);
      setErro(null);
      try {
        const numeroId = Number(id);

        // Todas as queries dependem apenas do id da rota: disparam em paralelo.
        // Count de votos é tolerante a falhas (jaVotou = false) para não derrubar a tela.
        const contarVotos = jogadorLogado
          ? (async () => {
              try {
                const votadas = await carregarPartidasVotadas(jogadorLogado.id, [numeroId]);
                return votadas.has(numeroId) ? 1 : 0;
              } catch {
                return 0;
              }
            })()
          : Promise.resolve(0);

        const [p, pl, parts, ns, votos] = await Promise.all([
          carregarPartida(numeroId),
          carregarPlacar(numeroId),
          carregarParticipantes(numeroId),
          carregarNotas(numeroId),
          contarVotos,
        ]);
        if (isAtivo && !isAtivo()) return;
        setPartida(p);
        if (p) {
          setPlacar(pl);
          setParticipantes(parts);
          setNotas(ns);
          // O count só vira voto quando a partida está publicada e há jogador logado
          setJaVotou(p.status === 'published' && !!jogadorLogado && votos > 0);
        }
      } catch (e) {
        if (isAtivo && !isAtivo()) return;
        setErro(formatarMensagemErro(e, 'Não foi possível carregar a partida.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [id, jogadorLogado]
  );

  async function confirmarDescarte() {
    if (!partida || !jogadorLogado) return;
    setDescartando(true);
    try {
      const ok = await descartarVotos(partida.id, jogadorLogado.id);
      if (ok) {
        setConfirmandoDescarte(false);
        setJaVotou(false);
        navigate(`/partida/${partida.id}/votar`);
      } else {
        setConfirmandoDescarte(false);
        setErro('Não foi possível descartar — a votação pode estar encerrada.');
      }
    } catch (e) {
      setConfirmandoDescarte(false);
      setErro(formatarMensagemErro(e, 'Não foi possível descartar os votos.'));
    } finally {
      setDescartando(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  const craque = useMemo(() => notas.find((n) => n.is_craque) ?? null, [notas]);

  if (carregando) return <SkeletonDetalhe />;
  if (!partida)
    return (
      <MensagemEstado tipo={erro ? 'erro' : 'info'} className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro ?? 'Partida não encontrada.'}
      </MensagemEstado>
    );

  async function confirmarAbrir() {
    if (!partida) return;
    setAbrindo(true);
    setErro(null);
    try {
      const ok = await abrirPartida(partida.id, jogadorLogado?.id ?? null);
      if (!ok) {
        setErro(
          'Não foi possível abrir. Confira se os dois times têm 7 jogadores de linha e 1 goleiro escalados.'
        );
        return;
      }
      invalidarCache(CHAVE_JOGOS);
      invalidarCache(chaveResumo(new Date().getFullYear()));
      navigate(`/partida/${partida.id}/ao-vivo`, { replace: true });
    } catch (e) {
      setErro(formatarMensagemErro(e, 'Não foi possível iniciar a partida.'));
    } finally {
      setAbrindo(false);
    }
  }

  const isVotacaoAberta = votacaoAberta(partida);
  const jaEhParticipante =
    !!jogadorLogado && participantes.some((p) => p.jogador_id === jogadorLogado.id);
  const isRandom = !!jogadorLogado && isRandomUsername(jogadorLogado.username);

  return (
    <div className="px-3 py-4 pb-16 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <BotaoVoltar fallback="/jogos" />

      {/* Cabeçalho da Súmula */}
      <div className="sumula-header pb-2 flex items-start justify-between">
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Partida #{partida.id}
          </h2>
          <p className="text-xs text-giz-fraco capitalize font-mono mt-0.5">
            <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
            <span className="hidden sm:inline">{formatarDataCompleta(partida.data_jogo)}</span>
          </p>
        </div>
        <div className="text-right flex flex-col items-end">
          <Badge variante="status" status={partida.status}>
            {STATUS_LABEL[partida.status]}
          </Badge>
          {isVotacaoAberta && partida.voting_closes_at && (
            <p className="text-[10px] font-mono text-destaque-texto mt-1">
              Urna fecha {formatarFechamento(partida.voting_closes_at)}
            </p>
          )}
        </div>
      </div>

      {/* Placar: Painel de LED */}
      {placar && partida.status !== 'draft' && (
        <PainelPlacar
          golsTimeA={placar.gols_time_a}
          golsTimeB={placar.gols_time_b}
          status={partida.status}
          variante="completo"
        />
      )}

      {/* Card do Craque da Partida (quando closed) */}
      {partida.status === 'closed' && craque && <CardCraquePartida craque={craque} />}

      {/* Notas reveladas quando closed */}
      {partida.status === 'closed' && notas.length > 0 && <ListaNotasPartida notas={notas} />}

      {partida.status === 'draft' && (
        <ConfirmacoesPartida
          partida={partida}
          participantes={participantes}
          jogadorLogadoId={jogadorLogado?.id ?? null}
          isAdmin={isAdmin}
          onAtualizar={carregar}
        />
      )}

      {(partida.status !== 'draft' || participantes.some((p) => p.time !== null)) && (
        <GridTimesPartida participantes={participantes} />
      )}

      {/* Ações principais por status */}
      {partida.status === 'draft' && isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/times`}
            className="block text-center rounded-[4px] border border-borda bg-superficie-2 px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-giz shadow-carimbo hover:bg-superficie transition active:translate-y-px"
          >
            Escalar Times
          </Link>
          <button
            type="button"
            disabled={abrindo}
            onClick={confirmarAbrir}
            className="w-full rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px disabled:opacity-40"
          >
            {abrindo ? 'Iniciando partida…' : 'Iniciar Modo Ao Vivo'}
          </button>
        </div>
      )}

      {partida.status === 'live' && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/ao-vivo`}
            className="block text-center rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px"
          >
            {isAdmin ? 'Registrar Eventos na Súmula' : 'Acompanhar Ao Vivo'}
          </Link>
        </div>
      )}

      {(partida.status === 'published' || partida.status === 'closed') && isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/editar`}
            className="block text-center rounded-[4px] border border-borda bg-superficie-2 px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-giz shadow-carimbo hover:bg-superficie transition active:translate-y-px"
          >
            Editar partida e súmula
          </Link>
        </div>
      )}

      {isVotacaoAberta && jaEhParticipante && !isRandom && (
        <div className="space-y-2">
          {jaVotou ? (
            <>
              <p className="text-center text-xs font-mono text-ok">
                Seu voto tá garantido. Dá pra mudar até as urnas fecharem.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/partida/${partida.id}/votar`}
                  className="block text-center rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo transition active:translate-y-px"
                >
                  Editar votos
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmandoDescarte(true)}
                  className="block text-center rounded-[4px] border border-perigo/50 bg-superficie-2 px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-perigo shadow-carimbo hover:bg-perigo/10 transition active:translate-y-px"
                >
                  Descartar votos
                </button>
              </div>
            </>
          ) : (
            <Link
              to={`/partida/${partida.id}/votar`}
              className="block text-center rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px"
            >
              Votar nos Jogadores (Craque da Quinta)
            </Link>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmandoDescarte}
        onClose={() => setConfirmandoDescarte(false)}
        onConfirm={confirmarDescarte}
        titulo="Descartar seus votos?"
        mensagem="Isso vai apagar todas as notas que você deu nesta partida. Você poderá votar novamente enquanto a votação estiver aberta."
        textoConfirmar={descartando ? 'Descartando…' : 'Descartar'}
        tomConfirmar="perigo"
      />

      {partida.status === 'published' && !isVotacaoAberta && (
        <p className="text-center text-xs font-mono text-destaque-texto">
          As urnas fecharam. O craque está sendo apurado.
        </p>
      )}
    </div>
  );
}
