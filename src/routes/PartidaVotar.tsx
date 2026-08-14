import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useJogadorLogado } from "../hooks/useJogadorLogado";
import {
  carregarPartida,
  carregarParticipantes,
  type Partida,
} from "../lib/partidas";
import { POSICOES, TIMES, type PosicaoId, type TimeId } from "../lib/times";
import { Carregando, MensagemEstado } from "../components/Estado";
import { SeletorNota } from "../components/SeletorNota";
import { Avatar } from "../components/Avatar";
import { Check } from "lucide-react";
import { vibrateLight, vibrateSuccess } from "../lib/haptics";

interface Alvo {
  jogador_id: number;
  nome: string;
  posicao: PosicaoId;
  time: TimeId;
}

export function PartidaVotar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const jogador = useJogadorLogado();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [alvos, setAlvos] = useState<Alvo[]>([]);
  const [notas, setNotas] = useState<Record<number, number>>({});
  const [bagreId, setBagreId] = useState<number | null>(null);
  const [votosOriginais, setVotosOriginais] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [votosEnviados, setVotosEnviados] = useState(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);

  const STORAGE_KEY = id && jogador ? `racha_voto_draft_${id}_${jogador.id}` : null;

  const temModificacoes =
    Object.keys(notas).length > 0 && !votosEnviados && !salvando;

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (temModificacoes) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [temModificacoes]);

  // Persiste rascunho de notas e bagre automaticamente no sessionStorage
  useEffect(() => {
    if (!STORAGE_KEY || votosEnviados || carregando) return;
    try {
      if (Object.keys(notas).length > 0) {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            notas,
            bagreId,
            timestamp: Date.now(),
          }),
        );
      }
    } catch {}
  }, [notas, bagreId, STORAGE_KEY, votosEnviados, carregando]);

  useEffect(() => {
    async function carregar() {
      if (!id || !jogador) return;
      try {
        const p = await carregarPartida(Number(id));
        if (!p) {
          setErro("Partida não encontrada.");
          setCarregando(false);
          return;
        }
        setPartida(p);

        // valida janela
        const aberta =
          p.status === "published" &&
          p.voting_closes_at &&
          new Date(p.voting_closes_at) > new Date();
        if (!aberta) {
          setErro("A votação para esta partida não está aberta.");
          setCarregando(false);
          return;
        }

        // Jogadores 'random' (placeholders do sorteio) nunca votam.
        if (jogador.username.toLowerCase().startsWith("random")) {
          setErro("Jogadores random não podem votar.");
          setCarregando(false);
          return;
        }

        const participantes = await carregarParticipantes(p.id);
        // Só quem jogou a partida pode votar.
        const ehParticipante = participantes.some(
          (part) => part.jogador_id === jogador.id,
        );
        if (!ehParticipante) {
          setErro("Você não participou desta partida.");
          setCarregando(false);
          return;
        }
        // esconde o próprio votante (não vota em si)
        const alvosFiltrados = participantes
          .filter(
            (part) => part.jogador_id !== jogador.id && part.time !== null,
          )
          .map((part) => ({
            jogador_id: part.jogador_id,
            nome: part.nome ?? "?",
            posicao: part.posicao,
            time: part.time!,
          }));
        setAlvos(alvosFiltrados);

        // pré-carrega votos já dados no banco (pra permitir edição)
        const { data: meusVotos } = await supabase
          .from("votes")
          .select("target_id, rating")
          .eq("partida_id", p.id)
          .eq("voter_id", jogador.id);

        const notasIniciais: Record<number, number> = {};
        for (const a of alvosFiltrados) {
          notasIniciais[a.jogador_id] = 6;
        }
        const originais = new Set<number>();
        for (const v of meusVotos ?? []) {
          notasIniciais[v.target_id] = v.rating;
          originais.add(v.target_id);
        }

        // Tenta recuperar rascunho do sessionStorage caso o usuário tenha recarregado ou perdido sinal
        const draftKey = `racha_voto_draft_${p.id}_${jogador.id}`;
        let draftRecuperado = false;
        try {
          const draftSalvo = sessionStorage.getItem(draftKey);
          if (draftSalvo) {
            const parsed = JSON.parse(draftSalvo);
            if (parsed.notas && typeof parsed.notas === "object") {
              Object.assign(notasIniciais, parsed.notas);
              draftRecuperado = true;
            }
            if (parsed.bagreId !== undefined) {
              setBagreId(parsed.bagreId);
            }
          }
        } catch {}

        setNotas(notasIniciais);
        setVotosOriginais(originais);
        if (draftRecuperado) {
          setRascunhoRestaurado(true);
        }
      } catch (e: any) {
        setErro(e.message ?? String(e));
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, jogador?.id]);

  if (!jogador) return <Navigate to="/login" replace />;
  if (carregando) return <Carregando>Carregando votação</Carregando>;
  if (erro)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        {erro}
      </MensagemEstado>
    );
  if (!partida) return null;

  function setNota(targetId: number, rating: number) {
    vibrateLight();
    setFeedback(null);
    setNotas((prev) => ({ ...prev, [targetId]: rating }));
  }

  const todosAvaliados = alvos.every((a) => notas[a.jogador_id] !== undefined);
  const editando = votosOriginais.size > 0;

  function handleVoltar() {
    if (
      temModificacoes &&
      !window.confirm("Você tem votos não salvos. Deseja realmente sair sem salvar?")
    ) {
      return;
    }
    navigate(-1);
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

    const { data, error } = await supabase.rpc("registrar_votos", {
      p_partida_id: partida.id,
      p_voter_id: jogador.id,
      p_votos: payload,
    });

    setSalvando(false);

    if (error) {
      setErro("Erro ao registrar votos: " + error.message);
      return;
    }
    if (data === false) {
      setErro(
        "Não foi possível registrar (a votação pode ter fechado ou há voto inválido).",
      );
      return;
    }

    setVotosEnviados(true);
    vibrateSuccess();
    if (STORAGE_KEY) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    if (bagreId) {
      try {
        const bagreJogador = alvos.find((a) => a.jogador_id === bagreId);
        if (bagreJogador) {
          localStorage.setItem(
            `racha_bagre_${partida.id}`,
            JSON.stringify({
              jogador_id: bagreId,
              nome: bagreJogador.nome,
              data: new Date().toISOString(),
            }),
          );
        }
      } catch {}
    }

    setFeedback(
      editando
        ? "Votos atualizados com sucesso!"
        : bagreId
          ? "Votos e Troféu Bagre registrados com sucesso! 🐟"
          : "Votos registrados com sucesso!",
    );
    setTimeout(
      () => navigate(`/partida/${partida.id}`, { replace: true }),
      900,
    );
  }

  const tempoRestante = partida.voting_closes_at
    ? Math.max(0, new Date(partida.voting_closes_at).getTime() - Date.now())
    : 0;
  const horasRestantes = Math.floor(tempoRestante / (1000 * 60 * 60));
  const minutosRestantes = Math.floor(
    (tempoRestante % (1000 * 60 * 60)) / (1000 * 60),
  );

  return (
    <div className="px-3 py-4 pb-24 sm:px-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={handleVoltar}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </button>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {editando ? "Editar votos" : "Votação"} — partida #{partida.id}
        </h2>
        <p className="text-xs text-[var(--cor-destaque)]">
          ⏳ Fecha em {horasRestantes}h {minutosRestantes}min
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Dê uma nota de 1 a 10 para cada jogador. O craque será definido pela
          média. Votos anônimos.
        </p>
      </div>

      {rascunhoRestaurado && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
          <span>💾 Rascunho de votos recuperado automaticamente da sessão.</span>
          <button
            type="button"
            onClick={() => setRascunhoRestaurado(false)}
            className="text-[10px] font-bold uppercase underline ml-2"
          >
            OK
          </button>
        </div>
      )}

      <div className="space-y-4">
        {(["a", "b"] as TimeId[]).map((t) => {
          const jogadoresDoTime = alvos
            .filter((a) => a.time === t)
            .sort((a, b) =>
              a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
            );
          if (jogadoresDoTime.length === 0) return null;
          return (
            <div
              key={t}
              className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <div
                className="px-3 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: t === "a" ? "#f9fafb" : "#111827",
                }}
              >
                {TIMES[t].nome}
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {jogadoresDoTime.map((a) => {
                  const nota = notas[a.jogador_id];
                  return (
                    <div
                      key={a.jogador_id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {a.nome}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
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

      {/* Eleição Troféu Bagre da Rodada (Caneludo) */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐟</span>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              Troféu Bagre da Rodada (Caneludo) 🩴
              <span className="text-[10px] uppercase font-normal tracking-wide text-amber-700 dark:text-amber-400 bg-amber-200/60 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                Opcional
              </span>
            </h3>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Votação para a resenha pós-jogo. Quem foi o mais caneludo em campo hoje?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setBagreId(null)}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium border transition ${
              bagreId === null
                ? "border-amber-500 bg-amber-100 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 font-bold shadow-xs"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            {bagreId === null && <Check className="size-3.5 text-amber-600 dark:text-amber-400" />}
            Nenhum / Não eleger
          </button>

          {alvos.map((a) => {
            const isSelected = bagreId === a.jogador_id;
            return (
              <button
                key={a.jogador_id}
                type="button"
                onClick={() => setBagreId(a.jogador_id)}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium border text-left transition ${
                  isSelected
                    ? "border-amber-500 bg-amber-100 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 font-bold shadow-xs ring-1 ring-amber-500"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <Avatar nome={a.nome} size="xs" />
                <span className="truncate flex-1">{a.nome}</span>
                {isSelected && <span className="text-xs shrink-0">🐟</span>}
              </button>
            );
          })}
        </div>
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      <div
        className="fixed inset-x-0 z-40 p-3 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-800"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={enviar}
            disabled={!todosAvaliados || salvando}
            className="w-full min-h-[44px] rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {salvando
              ? "Enviando…"
              : editando
                ? "Atualizar votos"
                : todosAvaliados
                  ? "Enviar votos"
                  : `Avalie todos (${alvos.length - Object.keys(notas).length} restantes)`}
          </button>
        </div>
      </div>
    </div>
  );
}
