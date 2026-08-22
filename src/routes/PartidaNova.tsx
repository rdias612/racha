import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { listarJogadoresAtivos, type JogadorLista } from '../lib/jogadores';
import { useAdmin } from '../hooks/useAdmin';
import { Carregando, MensagemEstado } from '../components/Estado';
import { obterProximaQuintaFeira } from '../lib/formatacao';
import { voltar } from '../lib/navegacao';

const LIMITE_LINHA = 14;
const LIMITE_GOLEIROS = 2;
const TOTAL_PARTICIPANTES = LIMITE_LINHA + LIMITE_GOLEIROS; // 16
const STORAGE_KEY = 'racha_nova_partida';
const HORA_PADRAO = '19:00';

interface EstadoPersistido {
  selecionados: number[];
  dataJogo: string;
}

export function PartidaNova() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [dataJogo, setDataJogo] = useState(() => obterProximaQuintaFeira());
  const [busca, setBusca] = useState('');
  const [hidratado, setHidratado] = useState(false);

  // Hidratação no mount: lê localStorage e lista jogadores ativos.
  useEffect(() => {
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
    listarJogadoresAtivos()
      .then(setJogadores)
      .catch((e) => setErro(e.message))
      .finally(() => {
        setHidratado(true);
        setCarregando(false);
      });
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

  // Derivação dos 3 grupos (filtrados pela busca).
  const termo = busca.trim().toLowerCase();
  const goleiros = useMemo(
    () =>
      jogadores.filter(
        (j) =>
          j.posicao === 'goleiro' &&
          (j.nome.toLowerCase().includes(termo) || j.username.toLowerCase().includes(termo))
      ),
    [jogadores, termo]
  );
  const mensalistas = useMemo(
    () =>
      jogadores.filter(
        (j) =>
          j.is_mensalista &&
          j.posicao !== 'goleiro' &&
          (j.nome.toLowerCase().includes(termo) || j.username.toLowerCase().includes(termo))
      ),
    [jogadores, termo]
  );
  const avulsos = useMemo(
    () =>
      jogadores.filter(
        (j) =>
          !j.is_mensalista &&
          j.posicao !== 'goleiro' &&
          (j.nome.toLowerCase().includes(termo) || j.username.toLowerCase().includes(termo))
      ),
    [jogadores, termo]
  );

  // Contadores derivados.
  const linhaSel = selecionados.filter((id) => {
    const j = jogadores.find((x) => x.id === id);
    return j && j.posicao !== 'goleiro';
  }).length;
  const goleiroSel = selecionados.length - linhaSel;
  const podeRevisar = linhaSel === LIMITE_LINHA && goleiroSel === LIMITE_GOLEIROS && !!dataJogo;

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando jogadores</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">Erro: {erro}</MensagemEstado>
    );

  function toggleSelecionado(id: number) {
    setSelecionados((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      const jogador = jogadores.find((j) => j.id === id);
      const ehGoleiro = jogador?.posicao === 'goleiro';
      const linhaAtual = prev.filter((pid) => {
        const j = jogadores.find((x) => x.id === pid);
        return j && j.posicao !== 'goleiro';
      }).length;
      const goleiroAtual = prev.length - linhaAtual;
      if (ehGoleiro && goleiroAtual >= LIMITE_GOLEIROS) return prev;
      if (!ehGoleiro && linhaAtual >= LIMITE_LINHA) return prev;
      return [...prev, id];
    });
  }

  function limparGrupo(ids: number[]) {
    const conjunto = new Set(ids);
    setSelecionados((prev) => prev.filter((id) => !conjunto.has(id)));
  }

  return (
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-4 max-w-2xl mx-auto text-giz">
      <div>
        <button
          onClick={() => voltar(navigate, '/jogos')}
          className="text-xs font-mono text-giz-fraco hover:text-giz mb-2 transition"
        >
          ← voltar
        </button>
        <div className="sumula-header pb-2 flex items-baseline justify-between">
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Nova Partida da Súmula
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
            Etapa 1 de 2
          </span>
        </div>
      </div>

      {/* Data */}
      <div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
        <label className="block">
          <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
            Data do Jogo
          </span>
          <input
            type="date"
            value={dataJogo}
            onChange={(e) => setDataJogo(e.target.value)}
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-sm text-giz font-mono shadow-xs focus:outline-none focus:border-destaque"
          />
        </label>

        {/* Cards de cota com visual de selo postal */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div
            className={`rounded-[3px] border p-2.5 flex items-center justify-between transition ${
              linhaSel >= LIMITE_LINHA
                ? 'border-ok/60 bg-ok/10 text-ok'
                : 'border-borda bg-superficie-2 text-giz-fraco'
            }`}
          >
            <span className="text-xs font-display font-bold uppercase tracking-wider">
              Jogadores Linha
            </span>
            <span className="font-mono text-xs font-bold tabular-nums">
              {linhaSel >= LIMITE_LINHA ? '✓ ' : ''}
              {linhaSel}/{LIMITE_LINHA}
            </span>
          </div>
          <div
            className={`rounded-[3px] border p-2.5 flex items-center justify-between transition ${
              goleiroSel >= LIMITE_GOLEIROS
                ? 'border-ok/60 bg-ok/10 text-ok'
                : 'border-borda bg-superficie-2 text-giz-fraco'
            }`}
          >
            <span className="text-xs font-display font-bold uppercase tracking-wider">
              Goleiros
            </span>
            <span className="font-mono text-xs font-bold tabular-nums">
              {goleiroSel >= LIMITE_GOLEIROS ? '✓ ' : ''}
              {goleiroSel}/{LIMITE_GOLEIROS}
            </span>
          </div>
        </div>
      </div>

      {/* Input de Busca */}
      <div className="relative">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar jogador por nome ou apelido..."
          className="w-full rounded-[4px] border border-borda bg-superficie px-3 py-2.5 text-sm text-giz placeholder-giz-fraco shadow-carimbo focus:outline-none focus:border-destaque"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-xs text-giz-fraco hover:text-giz"
          >
            ✕
          </button>
        )}
      </div>

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
      <GrupoJogadores
        titulo="Goleiros"
        jogadores={goleiros}
        selecionados={selecionados}
        onToggle={toggleSelecionado}
        onLimpar={limparGrupo}
        cotaLinhaCheia={goleiroSel >= LIMITE_GOLEIROS}
        mostrarCota
      />

      {jogadores.length < TOTAL_PARTICIPANTES && (
        <p className="text-xs font-mono text-destaque">
          Aviso: há apenas {jogadores.length} jogadores ativos. Uma partida precisa de{' '}
          {TOTAL_PARTICIPANTES}.
        </p>
      )}

      {/* Barra Fixa Inferior */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 p-3 bg-superficie/95 backdrop-blur border-t border-borda shadow-carimbo-preto"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-2xl mx-auto space-y-1">
          <button
            onClick={() =>
              navigate('/partida/nova/confirma', {
                state: { selecionados, jogadores, dataJogo, horaJogo: HORA_PADRAO },
              })
            }
            disabled={!podeRevisar}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-40"
          >
            Revisar escalação ({selecionados.length}/{TOTAL_PARTICIPANTES})
          </button>
          {!podeRevisar && (
            <p className="text-center text-[10px] font-mono text-giz-fraco">
              Selecione {LIMITE_LINHA} jogadores de linha e {LIMITE_GOLEIROS} goleiros para avançar.
            </p>
          )}
        </div>
      </div>
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
  mostrarCota?: boolean;
}

function GrupoJogadores({
  titulo,
  jogadores,
  selecionados,
  onToggle,
  onLimpar,
  cotaLinhaCheia,
  mostrarCota = false,
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
            {mostrarCota
              ? `${selecionadosNoGrupo}/${LIMITE_GOLEIROS}`
              : `${selecionadosNoGrupo} selecionado${selecionadosNoGrupo === 1 ? '' : 's'}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onLimpar(idsDoGrupo)}
          disabled={!podeLimpar}
          className="text-xs font-mono text-giz-fraco hover:text-perigo disabled:opacity-0 disabled:pointer-events-none transition"
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
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-giz">{j.nome}</span>
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggle(j.id)}
                    disabled={bloqueado}
                    aria-pressed={selecionado}
                    aria-label={
                      selecionado ? `Remover ${j.nome} da escalação` : `Escalar ${j.nome}`
                    }
                    title={bloqueado ? 'Cota cheia' : undefined}
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
