import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../context/SessaoContext';
import { SeletorNota } from '../components/SeletorNota';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { carregarParticipantes, type Partida, type Participante } from '../lib/partidas';
import { TIMES, POSICOES, type TimeId } from '../lib/times';
import { isRandomUsername } from '../lib/jogadores';
import { voltar } from '../lib/navegacao';

export function PartidaVotar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jogador } = useSessao();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [alvos, setAlvos] = useState<Participante[]>([]);
  const [notas, setNotas] = useState<Record<number, number>>({});
  const [votosOriginais, setVotosOriginais] = useState<Map<number, number>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [votosEnviados, setVotosEnviados] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const temModificacoes =
    !votosEnviados &&
    alvos.some((a) => {
      const notaAtual = notas[a.jogador_id];
      const notaOriginal = votosOriginais.get(a.jogador_id);
      return notaAtual !== undefined && notaAtual !== notaOriginal;
    });

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (temModificacoes) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [temModificacoes]);

  const draftKey = partida && jogador ? `racha_voto_draft_${partida.id}_${jogador.id}` : null;

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      if (!id || !jogador) return;
      const partidaId = Number(id);
      if (!Number.isFinite(partidaId)) {
        setErro('ID de partida inválido.');
        setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro(null);

      try {
        const { data: p, error: errP } = await supabase
          .from('partidas')
          .select('*')
          .eq('id', partidaId)
          .single();

        if (errP || !p) {
          if (ativo) {
            setErro('Partida não encontrada.');
            setCarregando(false);
          }
          return;
        }

        const agora = new Date().toISOString();
        const aberta =
          p.status === 'published' && (!p.voting_closes_at || p.voting_closes_at > agora);

        if (!aberta) {
          if (ativo) {
            setErro('A votação desta partida não está aberta.');
            setCarregando(false);
          }
          return;
        }

        const participantes = await carregarParticipantes(partidaId);
        if (!ativo) return;

        const eu = participantes.find((x) => x.jogador_id === jogador.id);
        if (!eu) {
          setErro('Apenas jogadores que participaram da partida podem votar.');
          setCarregando(false);
          return;
        }

        if (isRandomUsername(jogador.username)) {
          setErro('Jogadores convidados não votam. O capitão responsável vota.');
          setCarregando(false);
          return;
        }

        const outros = participantes.filter((x) => x.jogador_id !== jogador.id && x.time !== null);

        const { data: meusVotos } = await supabase
          .from('votes')
          .select('target_id, rating')
          .eq('match_id', partidaId)
          .eq('voter_id', jogador.id);

        if (!ativo) return;

        let mapaNotas: Record<number, number> = {};
        const mapaOriginais = new Map<number, number>();

        if (meusVotos && meusVotos.length > 0) {
          for (const v of meusVotos) {
            mapaNotas[v.target_id] = v.rating;
            mapaOriginais.set(v.target_id, v.rating);
          }
        } else {
          // Tenta restaurar rascunho prévio do localStorage
          const storageKey = `racha_voto_draft_${partidaId}_${jogador.id}`;
          try {
            const rawDraft = localStorage.getItem(storageKey);
            if (rawDraft) {
              const draftObj = JSON.parse(rawDraft);
              if (draftObj && typeof draftObj === 'object') {
                mapaNotas = draftObj;
              }
            }
          } catch {
            // Ignora falha de localStorage
          }
        }

        setPartida(p as Partida);
        setAlvos(outros);
        setNotas(mapaNotas);
        setVotosOriginais(mapaOriginais);
      } catch (e) {
        if (ativo) {
          setErro(e instanceof Error ? e.message : 'Erro ao carregar votação.');
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [id, jogador]);

  if (!jogador) return <Navigate to="/login" replace />;
  if (carregando) return <Carregando>Carregando cédula de votação…</Carregando>;
  if (erro)
    return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>;
  if (!partida) return null;

  function setNota(targetId: number, rating: number) {
    setFeedback(null);
    setNotas((prev) => {
      const atualizado = { ...prev, [targetId]: rating };
      if (draftKey && votosOriginais.size === 0) {
        try {
          localStorage.setItem(draftKey, JSON.stringify(atualizado));
        } catch {
          // Ignora silenciosamente
        }
      }
      return atualizado;
    });
  }

  const avaliadosCount = alvos.filter((a) => notas[a.jogador_id] !== undefined).length;
  const todosAvaliados = alvos.length > 0 && avaliadosCount === alvos.length;
  const editando = votosOriginais.size > 0;

  function handleVoltar() {
    if (temModificacoes) {
      setConfirmandoSaida(true);
      return;
    }
    voltar(navigate, partida ? `/partida/${partida.id}` : `/jogos`);
  }

  async function enviar() {
    if (!jogador || !partida || !todosAvaliados) return;
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    const payload = alvos.map((a) => ({
      target_id: a.jogador_id,
      rating: notas[a.jogador_id],
    }));

    const { data, error } = await supabase.rpc('registrar_votos', {
      p_partida_id: partida.id,
      p_voter_id: jogador.id,
      p_votos: payload,
    });

    setSalvando(false);

    if (error) {
      setErro('Erro ao registrar votos: ' + error.message);
      return;
    }
    if (data === false) {
      setErro('Não foi possível registrar (a votação pode ter fechado ou há voto inválido).');
      return;
    }

    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Ignora
      }
    }

    setVotosEnviados(true);
    setFeedback(editando ? 'Votos atualizados com sucesso!' : 'Votos registrados na urna!');
    setTimeout(() => navigate(`/partida/${partida.id}`, { replace: true }), 800);
  }

  const tempoRestante = partida.voting_closes_at
    ? Math.max(0, new Date(partida.voting_closes_at).getTime() - Date.now())
    : 0;
  const horasRestantes = Math.floor(tempoRestante / (1000 * 60 * 60));
  const minutosRestantes = Math.floor((tempoRestante % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="px-3 py-4 pb-28 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <button
        onClick={handleVoltar}
        className="text-xs font-mono text-giz-fraco hover:text-giz transition"
      >
        ← voltar
      </button>

      <div className="sumula-header pb-2">
        <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
          {editando ? 'Editar Votos da Súmula' : 'Cédula de Votação'} — Partida #{partida.id}
        </h2>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs font-mono font-bold text-destaque">
            ⏳ Fecha em {horasRestantes}h {minutosRestantes}min
          </p>
          <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Urna Anônima
          </span>
        </div>
        <p className="mt-1 text-xs text-giz-fraco">
          Dê uma nota de 1 a 10 para cada parceiro e adversário. O craque nasce da média da galera.
        </p>

        {/* Barra de Progresso Real */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-giz-fraco">Progresso da cédula:</span>
            <span className={todosAvaliados ? 'text-ok font-bold' : 'text-destaque font-bold'}>
              {avaliadosCount}/{alvos.length} avaliados
            </span>
          </div>
          <div className="h-2 w-full bg-superficie-2 rounded-[2px] overflow-hidden border border-borda">
            <div
              className={`h-full transition-all duration-200 ease-out ${todosAvaliados ? 'bg-ok' : 'bg-destaque'}`}
              style={{ width: `${alvos.length ? (avaliadosCount / alvos.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {(['a', 'b'] as TimeId[]).map((t) => {
          const jogadoresDoTime = alvos
            .filter((a) => a.time === t)
            .sort((a, b) =>
              (a.username ?? '').localeCompare(b.username ?? '', 'pt-BR', { sensitivity: 'base' })
            );
          if (jogadoresDoTime.length === 0) return null;
          return (
            <div
              key={t}
              className="overflow-hidden rounded-[4px] border border-borda bg-superficie shadow-carimbo"
            >
              <div
                className="px-3 py-2 text-xs font-display font-bold uppercase tracking-wider border-b border-borda"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: t === 'a' ? '#f4f1e8' : '#0d0d0e',
                }}
              >
                {TIMES[t].nome}
              </div>
              <div className="divide-y divide-borda">
                {jogadoresDoTime.map((a) => {
                  const nota = notas[a.jogador_id];
                  return (
                    <div
                      key={a.jogador_id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 bg-superficie hover:bg-superficie-2 transition"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-bold text-giz">
                          @{a.username}
                        </span>
                        <span className="text-[10px] font-display uppercase tracking-wider text-giz-fraco">
                          {POSICOES[a.posicao]}
                        </span>
                      </div>
                      <SeletorNota
                        variant="compact"
                        value={nota}
                        onChange={(n) => setNota(a.jogador_id, n)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      <div
        className="fixed inset-x-0 bottom-0 z-40 p-3 bg-superficie/95 backdrop-blur border-t border-borda shadow-carimbo-preto"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={enviar}
            disabled={!todosAvaliados || salvando}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo transition active:translate-y-px disabled:opacity-40"
          >
            {salvando
              ? 'Depositando votos na urna…'
              : editando
                ? 'Atualizar votos'
                : todosAvaliados
                  ? 'Enviar todos os votos'
                  : `Avalie todos (${alvos.length - avaliadosCount} restantes)`}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmandoSaida}
        onClose={() => setConfirmandoSaida(false)}
        onConfirm={() => {
          setConfirmandoSaida(false);
          voltar(navigate, `/partida/${partida.id}`);
        }}
        titulo="Sair da votação?"
        mensagem="Você tem notas não salvas nesta cédula. Se sair agora, as alterações serão descartadas."
        textoConfirmar="Sair sem salvar"
        tomConfirmar="perigo"
      />
    </div>
  );
}
