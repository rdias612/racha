import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, UserCheck2 } from "lucide-react";
import { useAdmin } from "../hooks/useAdmin";
import { useGestaoJogadores } from "../hooks/useGestaoJogadores";
import { MAX_MENSALISTAS, type JogadorLista } from "../lib/jogadores";
import { Carregando, MensagemEstado } from "../components/Estado";
import { GestaoResumoCards } from "../components/gestao/GestaoResumoCards";
import { GestaoFiltros } from "../components/gestao/GestaoFiltros";
import { GestaoJogadorItem } from "../components/gestao/GestaoJogadorItem";
import { GestaoBarraConfirmacao } from "../components/gestao/GestaoBarraConfirmacao";

export function GestaoJogadores() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const {
    jogadores,
    jogadoresFiltrados,
    carregando,
    busca,
    setBusca,
    filtro,
    setFiltro,
    rascunhos,
    salvandoLote,
    mensagemSucesso,
    mensagemErro,
    totalJogadores,
    totalMensalistas,
    totalAdmins,
    totalSuperAdmins,
    qtdModificacoes,
    limiteAtingido,
    alternarMensalistaDraft,
    alternarAdminDraft,
    descartarAlteracoes,
    salvarTodasAlteracoes,
  } = useGestaoJogadores();

  const mapaJogadoresOriginais = useMemo(() => {
    const mapa = new Map<number, JogadorLista>();
    for (const j of jogadores) {
      mapa.set(j.id, j);
    }
    return mapa;
  }, [jogadores]);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="px-3 py-4 pb-32 sm:px-4 max-w-3xl mx-auto space-y-5 relative">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar
      </button>

      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Users className="w-6 h-6 text-[var(--cor-primaria)]" />
          Gestão de Jogadores
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Marque os mensalistas (máximo {MAX_MENSALISTAS}) e administradores. As alterações são aplicadas ao clicar em <strong>Confirmar Alterações</strong>.
        </p>
      </div>

      {mensagemErro && <MensagemEstado>{mensagemErro}</MensagemEstado>}
      {mensagemSucesso && (
        <MensagemEstado tipo="sucesso">{mensagemSucesso}</MensagemEstado>
      )}

      {limiteAtingido && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-xs">
          <UserCheck2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">
              Limite Máximo Atingido ({MAX_MENSALISTAS}/{MAX_MENSALISTAS} Mensalistas)
            </span>
            <span className="opacity-90">
              O limite de {MAX_MENSALISTAS} mensalistas foi alcançado. Para definir um novo mensalista, desmarque um mensalista atual.
            </span>
          </div>
        </div>
      )}

      <GestaoResumoCards
        totalJogadores={totalJogadores}
        totalMensalistas={totalMensalistas}
        totalAdmins={totalAdmins}
        totalSuperAdmins={totalSuperAdmins}
        limiteAtingido={limiteAtingido}
      />

      <GestaoFiltros
        busca={busca}
        onBuscaChange={setBusca}
        filtro={filtro}
        onFiltroChange={setFiltro}
        totalJogadores={totalJogadores}
        totalMensalistas={totalMensalistas}
        totalAdmins={totalAdmins}
      />

      {carregando ? (
        <Carregando>Carregando jogadores...</Carregando>
      ) : jogadoresFiltrados.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum jogador encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jogadoresFiltrados.map((j) => (
            <GestaoJogadorItem
              key={j.id}
              jogador={j}
              jogadorOriginal={mapaJogadoresOriginais.get(j.id) ?? j}
              modificado={Boolean(rascunhos[j.id])}
              limiteAtingido={limiteAtingido}
              salvandoLote={salvandoLote}
              onAlternarMensalista={alternarMensalistaDraft}
              onAlternarAdmin={alternarAdminDraft}
            />
          ))}
        </div>
      )}

      <GestaoBarraConfirmacao
        qtdModificacoes={qtdModificacoes}
        salvandoLote={salvandoLote}
        onDescartar={descartarAlteracoes}
        onSalvar={salvarTodasAlteracoes}
      />
    </div>
  );
}
