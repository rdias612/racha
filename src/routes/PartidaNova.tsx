import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  listarJogadoresAtivos,
  obterPartidasRecentesJogadores,
  type JogadorLista,
} from '../lib/jogadores';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { invalidarCache } from '../hooks/useCache';
import { CHAVE_JOGOS, chaveResumo } from '../lib/chavesCache';
import { Carregando, MensagemEstado } from '../components/Estado';
import { obterProximaQuintaFeira } from '../lib/formatacao';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { BarraAcaoInferior } from '../components/BarraAcaoInferior';
import { CampoBusca } from '../components/CampoBusca';
import { formatarMensagemErro } from '../lib/erros';

const LIMITE_LINHA = 14;
const STORAGE_KEY = 'racha_nova_partida';
const HORA_PADRAO = '19:00';

interface EstadoPersistido {
  selecionados: number[];
  dataJogo: string;
}

export function PartidaNova() {
  const isAdmin = useAdmin();
  const adminLogado = useJogadorLogado();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [partidasRecentes, setPartidasRecentes] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [dataJogo, setDataJogo] = useState(() => obterProximaQuintaFeira());
  const [busca, setBusca] = useState('');
  const [hidratado, setHidratado] = useState(false);

  // Hidratação no mount: lê localStorage e lista jogadores ativos.
  useEffect(() => {
    let ativo = true;
    let estadoInicial: EstadoPersistido | null = null;
    try {
      const cru = localStorage.getItem(STORAGE_KEY);
      if (cru) {
        const parsed = JSON.parse(cru) as EstadoPersistido;
        if (
          Array.isArray(parsed.selecionados) &&
          typeof parsed.dataJogo === 'string' &&
          parsed.dataJogo.trim().length > 0
        ) {
          estadoInicial = parsed;
        }
      }
    } catch {
      // localStorage inválido — ignora.
    }
    if (estadoInicial) {
      setSelecionados(estadoInicial.selecionados);
      setDataJogo(estadoInicial.dataJogo);
    }
    Promise.all([listarJogadoresAtivos(), obterPartidasRecentesJogadores(2)])
      .then(([jogadoresCarregados, recentesCarregadas]) => {
        if (!ativo) return;
        setJogadores(jogadoresCarregados);
        setPartidasRecentes(recentesCarregadas);
      })
      .catch((e) => {
        if (ativo) setErro(formatarMensagemErro(e, 'Não foi possível carregar os jogadores.'));
      })
      .finally(() => {
        if (!ativo) return;
        setHidratado(true);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Persiste a cada mudança (só depois de hidratado).
  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ selecionados, dataJogo }));
    } catch {
      // Storage indisponível — ignora silenciosamente.
    }
  }, [selecionados, dataJogo, hidratado]);

  // Derivação dos grupos de linha (filtrados pela busca).
  const termo = busca.trim().toLowerCase();
  const mensalistas = useMemo(
    () =>
      jogadores.filter(
        (j) =>
          j.is_mensalista && j.posicao !== 'goleiro' && j.username.toLowerCase().includes(termo)
      ),
    [jogadores, termo]
  );
  const avulsos = useMemo(
    () =>
      jogadores
        .filter(
          (j) =>
            !j.is_mensalista && j.posicao !== 'goleiro' && j.username.toLowerCase().includes(termo)
        )
        .sort((a, b) => {
          const qtdA = partidasRecentes[a.id] ?? 0;
          const qtdB = partidasRecentes[b.id] ?? 0;
          if (qtdB !== qtdA) return qtdB - qtdA;
          return a.username.localeCompare(b.username);
        }),
    [jogadores, termo, partidasRecentes]
  );

  // Contadores derivados.
  const linhaSel = selecionados.length;
  const podeCriar = linhaSel === LIMITE_LINHA && Boolean(dataJogo) && !salvando;

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando jogadores</Carregando>;

  function toggleSelecionado(id: number) {
    setSelecionados((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= LIMITE_LINHA) return prev;
      return [...prev, id];
    });
  }

  function limparGrupo(ids: number[]) {
    const conjunto = new Set(ids);
    setSelecionados((prev) => prev.filter((id) => !conjunto.has(id)));
  }

  async function handleCriarEEscalar() {
    if (!adminLogado || !podeCriar) return;
    setSalvando(true);
    setErro(null);

    try {
      const dataIso = new Date(`${dataJogo}T${HORA_PADRAO}`).toISOString();
      const payloadParticipantes = selecionados.map((id) => {
        const j = jogadores.find((x) => x.id === id);
        return {
          jogador_id: id,
          posicao: j?.posicao ?? 'random',
          time: null,
          gols: 0,
          assistencias: 0,
          gols_contra: 0,
        };
      });

      const { data: novaPartidaId, error } = await supabase.rpc('criar_partida', {
        p_data_jogo: dataIso,
        p_criado_por: adminLogado.id,
        p_participantes: payloadParticipantes,
      });

      if (error) throw error;
      if (!novaPartidaId) throw new Error('Falha ao criar partida (rollback).');

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage indisponível — ignora silenciosamente.
      }

      invalidarCache(CHAVE_JOGOS);
      invalidarCache(chaveResumo(new Date().getFullYear()));

      navigate(`/partida/${novaPartidaId}/times`, { replace: true });
    } catch (err) {
      setErro(formatarMensagemErro(err, 'Não foi possível criar a partida.'));
      setSalvando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-4 max-w-2xl mx-auto text-giz">
      <div>
        <BotaoVoltar fallback="/jogos" className="mb-2" />
        <div className="sumula-header pb-2 flex items-baseline justify-between">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Nova Partida da Súmula
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-destaque-texto">
            14 Titulares
          </span>
        </div>
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}

      {/* Data e Cota */}
      <div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
        <label className="block">
          <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
            Data do Jogo
          </span>
          <input
            type="date"
            value={dataJogo}
            onChange={(e) => setDataJogo(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz font-mono shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
          />
        </label>

        {/* Card de cota de linha */}
        <div
          className={`rounded-[3px] border p-2.5 flex items-center justify-between transition ${
            linhaSel >= LIMITE_LINHA
              ? 'border-ok/60 bg-ok/10 text-ok'
              : 'border-borda bg-superficie-2 text-giz-fraco'
          }`}
        >
          <div>
            <span className="text-xs font-display font-bold uppercase tracking-wider block">
              Jogadores de Linha Titulares
            </span>
            <span className="text-[10px] font-mono text-giz-fraco">
              Os 2 goleiros são escalados na etapa de times
            </span>
          </div>
          <span className="font-mono text-sm font-bold tabular-nums">
            {linhaSel >= LIMITE_LINHA ? '✓ ' : ''}
            {linhaSel}/{LIMITE_LINHA}
          </span>
        </div>
      </div>

      {/* Input de Busca */}
      <CampoBusca
        valor={busca}
        aoMudar={setBusca}
        placeholder="Buscar atleta por @username..."
        variante="superficie"
      />

      {/* Grupos */}
      <GrupoJogadores
        titulo="Mensalistas"
        jogadores={mensalistas}
        selecionados={selecionados}
        onToggle={toggleSelecionado}
        onLimpar={limparGrupo}
        cotaLinhaCheia={linhaSel >= LIMITE_LINHA}
      />
      <GrupoJogadores
        titulo="Avulsos"
        jogadores={avulsos}
        selecionados={selecionados}
        onToggle={toggleSelecionado}
        onLimpar={limparGrupo}
        cotaLinhaCheia={linhaSel >= LIMITE_LINHA}
      />

      {/* Barra Fixa Inferior */}
      <BarraAcaoInferior
        legenda={
          !podeCriar && !salvando
            ? `Selecione exatamente ${LIMITE_LINHA} jogadores de linha para avançar.`
            : undefined
        }
      >
        <button
          onClick={handleCriarEEscalar}
          disabled={!podeCriar}
          className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-40"
        >
          {salvando
            ? 'Criando partida…'
            : `Avançar para Escalação (${selecionados.length}/${LIMITE_LINHA})`}
        </button>
      </BarraAcaoInferior>
    </div>
  );
}

interface GrupoJogadoresProps {
  titulo: string;
  jogadores: JogadorLista[];
  selecionados: number[];
  onToggle: (id: number) => void;
  onLimpar: (ids: number[]) => void;
  cotaLinhaCheia: boolean;
}

function GrupoJogadores({
  titulo,
  jogadores,
  selecionados,
  onToggle,
  onLimpar,
  cotaLinhaCheia,
}: GrupoJogadoresProps) {
  const idsDoGrupo = jogadores.map((j) => j.id);
  const selecionadosNoGrupo = selecionados.filter((id) => idsDoGrupo.includes(id)).length;
  const podeLimpar = selecionadosNoGrupo > 0;

  return (
    <section className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo">
      <div className="flex items-center justify-between px-3 py-2 bg-superficie-2 border-b border-borda">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-display font-bold uppercase tracking-wider text-giz">
            {titulo}
          </span>
          <span className="text-[11px] font-mono text-giz-fraco tabular-nums">
            {selecionadosNoGrupo} selecionado{selecionadosNoGrupo === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onLimpar(idsDoGrupo)}
          disabled={!podeLimpar}
          className="min-h-[44px] px-2 inline-flex items-center text-xs font-mono text-giz-fraco hover:text-perigo disabled:opacity-0 disabled:pointer-events-none transition cursor-pointer"
        >
          Limpar
        </button>
      </div>

      <div className="divide-y divide-borda">
        {jogadores.length === 0 ? (
          <p className="px-3 py-3 text-xs font-mono text-giz-fraco text-center">
            Nenhum jogador nesta categoria.
          </p>
        ) : (
          jogadores.map((j) => {
            const selecionado = selecionados.includes(j.id);
            const bloqueado = !selecionado && cotaLinhaCheia;
            return (
              <div
                key={j.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 transition ${
                  bloqueado ? 'opacity-40 bg-superficie' : 'bg-superficie hover:bg-superficie-2'
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-giz">
                  {j.username}
                </span>
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggle(j.id)}
                    disabled={bloqueado}
                    aria-pressed={selecionado}
                    aria-label={
                      selecionado ? `Remover ${j.username} da escalação` : `Escalar ${j.username}`
                    }
                    title={bloqueado ? 'Cota de 14 de linha atingida' : undefined}
                    className={`min-h-[44px] min-w-[7rem] px-3 rounded-[3px] border font-display font-bold uppercase tracking-wider text-xs transition active:translate-y-px ${
                      selecionado
                        ? 'bg-destaque text-destaque-tinta border-destaque shadow-xs'
                        : 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:border-destaque/50'
                    } disabled:cursor-not-allowed`}
                  >
                    {selecionado ? '✓ Escalado' : '+ Escalar'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
