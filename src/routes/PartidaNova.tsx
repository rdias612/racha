import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { listarJogadoresAtivos, type JogadorLista } from "../lib/jogadores";
import { useAdmin } from "../hooks/useAdmin";
import { Carregando, MensagemEstado } from "../components/Estado";

const LIMITE_LINHA = 14;
const LIMITE_GOLEIROS = 2;
const TOTAL_PARTICIPANTES = LIMITE_LINHA + LIMITE_GOLEIROS; // 16
const STORAGE_KEY = "racha_nova_partida";

interface EstadoPersistido {
  selecionados: number[];
  dataJogo: string;
  horaJogo: string;
}

export function PartidaNova() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [dataJogo, setDataJogo] = useState("");
  const [horaJogo, setHoraJogo] = useState("20:00");
  const [busca, setBusca] = useState("");
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
          typeof parsed.dataJogo === "string" &&
          typeof parsed.horaJogo === "string"
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
      setHoraJogo(estadoInicial.horaJogo);
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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selecionados, dataJogo, horaJogo }),
      );
    } catch {
      // Storage indisponível — ignora silenciosamente.
    }
  }, [selecionados, dataJogo, horaJogo, hidratado]);

  // Derivação dos 3 grupos (filtrados pela busca).
  const termo = busca.trim().toLowerCase();
  const goleiros = useMemo(
    () =>
      jogadores.filter(
        (j) =>
          j.posicao === "goleiro" &&
          (j.nome.toLowerCase().includes(termo) ||
            j.username.toLowerCase().includes(termo)),
      ),
    [jogadores, termo],
  );
  const mensalistas = useMemo(
    () =>
      jogadores.filter(
        (j) =>
          j.is_mensalista &&
          j.posicao !== "goleiro" &&
          (j.nome.toLowerCase().includes(termo) ||
            j.username.toLowerCase().includes(termo)),
      ),
    [jogadores, termo],
  );
  const avulsos = useMemo(
    () =>
      jogadores.filter(
        (j) =>
          !j.is_mensalista &&
          j.posicao !== "goleiro" &&
          (j.nome.toLowerCase().includes(termo) ||
            j.username.toLowerCase().includes(termo)),
      ),
    [jogadores, termo],
  );

  // Contadores derivados.
  const linhaSel = selecionados.filter((id) => {
    const j = jogadores.find((x) => x.id === id);
    return j && j.posicao !== "goleiro";
  }).length;
  const goleiroSel = selecionados.length - linhaSel;
  const podeRevisar =
    linhaSel === LIMITE_LINHA &&
    goleiroSel === LIMITE_GOLEIROS &&
    !!dataJogo;

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando jogadores</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Erro: {erro}
      </MensagemEstado>
    );

  function toggleSelecionado(id: number) {
    setSelecionados((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      const jogador = jogadores.find((j) => j.id === id);
      const ehGoleiro = jogador?.posicao === "goleiro";
      const linhaAtual = prev.filter((pid) => {
        const j = jogadores.find((x) => x.id === pid);
        return j && j.posicao !== "goleiro";
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
    <div className="px-3 py-4 pb-40 sm:px-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-neutral-500 dark:text-neutral-400 mb-2"
        >
          ← voltar
        </button>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Nova partida
        </h2>
      </div>

      {/* Data */}
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            Data
          </span>
          <input
            type="date"
            value={dataJogo}
            onChange={(e) => setDataJogo(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </label>
        <label className="w-28">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            Hora
          </span>
          <input
            type="time"
            value={horaJogo}
            onChange={(e) => setHoraJogo(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </label>
      </div>

      {/* Cards de cota */}
      <div className="flex gap-3">
        <div
          className={`flex-1 rounded-lg border px-3 py-2 flex items-center justify-between transition ${
            linhaSel >= LIMITE_LINHA
              ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
          }`}
        >
          <span className="text-sm font-medium">Linha</span>
          <span className="text-sm font-semibold tabular-nums">
            {linhaSel >= LIMITE_LINHA ? "✓ " : ""}
            {linhaSel}/{LIMITE_LINHA}
          </span>
        </div>
        <div
          className={`flex-1 rounded-lg border px-3 py-2 flex items-center justify-between transition ${
            goleiroSel >= LIMITE_GOLEIROS
              ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
          }`}
        >
          <span className="text-sm font-medium">Goleiros</span>
          <span className="text-sm font-semibold tabular-nums">
            {goleiroSel >= LIMITE_GOLEIROS ? "✓ " : ""}
            {goleiroSel}/{LIMITE_GOLEIROS}
          </span>
        </div>
      </div>

      {/* Input de Busca */}
      <div className="relative">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar jogador por nome..."
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500/50"
        />
        {busca && (
          <button
            onClick={() => setBusca("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            Limpar
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
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Aviso: há apenas {jogadores.length} jogadores ativos. Uma partida
          precisa de {TOTAL_PARTICIPANTES}.
        </p>
      )}

      <div
        className="fixed inset-x-0 z-40 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() =>
              navigate("/partida/nova/confirma", {
                state: { selecionados, jogadores, dataJogo, horaJogo },
              })
            }
            disabled={!podeRevisar}
            className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40 active:scale-95 transition"
          >
            Revisar escalação
          </button>
          {!podeRevisar && (
            <p className="mt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Selecione {LIMITE_LINHA} jogadores de linha e{" "}
              {LIMITE_GOLEIROS} goleiros.
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
  const selecionadosNoGrupo = selecionados.filter((id) =>
    idsDoGrupo.includes(id),
  ).length;
  const podeLimpar = selecionadosNoGrupo > 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {titulo}
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {mostrarCota
              ? `${selecionadosNoGrupo}/${LIMITE_GOLEIROS}`
              : `${selecionadosNoGrupo} selecionado${selecionadosNoGrupo === 1 ? "" : "s"}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onLimpar(idsDoGrupo)}
          disabled={!podeLimpar}
          className="text-xs text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 disabled:opacity-0 disabled:pointer-events-none transition"
        >
          Limpar
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 overflow-hidden">
        {jogadores.length === 0 ? (
          <p className="px-3 py-2 text-xs text-neutral-500">
            Nenhum jogador nesta categoria.
          </p>
        ) : (
          jogadores.map((j) => {
            const selecionado = selecionados.includes(j.id);
            const bloqueado = !selecionado && cotaLinhaCheia;
            return (
              <div
                key={j.id}
                className={`flex items-center gap-2 px-3 bg-white dark:bg-neutral-900 ${
                  bloqueado ? "opacity-40" : ""
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {j.nome}
                </span>
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggle(j.id)}
                    disabled={bloqueado}
                    aria-pressed={selecionado}
                    aria-label={
                      selecionado
                        ? `Remover ${j.nome} da escalação`
                        : `Escalar ${j.nome}`
                    }
                    title={bloqueado ? "Cota cheia" : undefined}
                    className={`min-h-[44px] min-w-[7rem] px-3 rounded-lg border text-xs font-semibold transition active:scale-95 ${
                      selecionado
                        ? "bg-[var(--cor-destaque)] text-white border-[var(--cor-destaque)]"
                        : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                    } disabled:cursor-not-allowed`}
                  >
                    {selecionado ? "✓ Selecionado" : "+ Escalar"}
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
