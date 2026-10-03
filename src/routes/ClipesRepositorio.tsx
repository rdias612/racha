// Aba Repositório do painel de clipes (Plano 36, Passo 3): listagem por partida
// com seleção manual e exclusão definitiva via edge function admin-excluir-clipes.
// Guarda e estrutura idênticos aos de ClipesAdmin.tsx; cada fonte de dados
// (partidas / clipes) tem erro isolado — padrão Promise.allSettled de lá.

import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Archive, Trash2 } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useSnackbar } from '../hooks/useSnackbar';
import { AbasClipesAdmin } from '../components/AbasClipesAdmin';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { CabecalhoSumula } from '../components/ui/CabecalhoSumula';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GradeClipesPartida } from '../components/GradeClipesPartida';
import { SelectSumula } from '../components/SelectSumula';
import { Snackbar } from '../components/Snackbar';
import { Botao } from '../components/ui/Botao';
import {
  carregarClipesDaPartida,
  excluirClipes,
  obterPartidasComClipes,
  type ClipeComUrl,
  type PartidaComClipes,
} from '../lib/clipes';
import { STATUS_LABEL, type StatusPartida } from '../lib/partidas';
import { formatarDataLista, formatarTamanhoBytes } from '../lib/formatacao';
import { formatarMensagemErro } from '../lib/erros';

/** Rótulo do status no label do seletor (o campo vem como string da lib). */
function rotuloStatus(status: string): string {
  return STATUS_LABEL[status as StatusPartida] ?? status;
}

export function ClipesRepositorio() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  const [partidas, setPartidas] = useState<PartidaComClipes[]>([]);
  const [partidaId, setPartidaId] = useState<number | null>(null);
  const [clipes, setClipes] = useState<ClipeComUrl[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [carregandoClipes, setCarregandoClipes] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Ids que o ConfirmDialog está confirmando: lote do botão do topo OU 1 id
  // vindo da exclusão individual do card. null = diálogo fechado.
  const [idsPendenteExclusao, setIdsPendenteExclusao] = useState<number[] | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Fonte 1: partidas com clipes. A primeira da lista (mais recente) sai
  // pré-selecionada; a pré-seleção só ocorre sem partida escolhida — assim a
  // recarga pós-exclusão não troca a partida silenciosamente.
  const carregarPartidas = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      try {
        const lista = await obterPartidasComClipes();
        if (isAtivo && !isAtivo()) return;
        setPartidas(lista);
        setErro(null);
        setPartidaId((atual) => atual ?? lista[0]?.partidaId ?? null);
      } catch (e) {
        if (isAtivo && !isAtivo()) return;
        setErro(formatarMensagemErro(e, 'Erro ao carregar as partidas com clipes.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [jogador, isAdmin]
  );

  // Fonte 2: clipes da partida selecionada (a lib já embute urlPublicaDoClipe →
  // ClipeComUrl). Falha aqui não derruba o seletor de partidas.
  const carregarClipesDaSelecionada = useCallback(
    async (id: number, isAtivo?: () => boolean) => {
      setCarregandoClipes(true);
      try {
        const lista = await carregarClipesDaPartida(id);
        if (isAtivo && !isAtivo()) return;
        setClipes(lista);
      } catch (e) {
        if (isAtivo && !isAtivo()) return;
        setClipes([]);
        mostrarSnackbar('erro', formatarMensagemErro(e, 'Erro ao carregar os clipes da partida.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregandoClipes(false);
      }
    },
    [mostrarSnackbar]
  );

  useEffect(() => {
    let ativo = true;
    carregarPartidas(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregarPartidas]);

  useEffect(() => {
    if (partidaId == null) return;
    let ativo = true;
    carregarClipesDaSelecionada(partidaId, () => ativo);
    return () => {
      ativo = false;
    };
  }, [partidaId, carregarClipesDaSelecionada]);

  function selecionarPartida(valor: string) {
    // Troca de partida zera a seleção: os ids marcados pertencem à anterior.
    setSelecionados(new Set());
    setPartidaId(valor === '' ? null : Number(valor));
  }

  function alternarSelecao(clipeId: number) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(clipeId)) {
        proximo.delete(clipeId);
      } else {
        proximo.add(clipeId);
      }
      return proximo;
    });
  }

  // Recarga pós-exclusão das DUAS fontes com erro isolado por fonte. A partida
  // que ficou sem clipes some do seletor (a lib só lista partidas com clipes);
  // se for a atual, limpa a partida selecionada.
  async function recarregarAposExclusao(id: number) {
    setCarregandoClipes(true);
    const [rPartidas, rClipes] = await Promise.allSettled([
      obterPartidasComClipes(),
      carregarClipesDaPartida(id),
    ]);
    if (rPartidas.status === 'fulfilled') {
      setPartidas(rPartidas.value);
      if (!rPartidas.value.some((p) => p.partidaId === id)) {
        setPartidaId(null);
        setClipes([]);
      }
    } else {
      mostrarSnackbar(
        'erro',
        formatarMensagemErro(rPartidas.reason, 'Erro ao atualizar a lista de partidas.')
      );
    }
    if (rClipes.status === 'fulfilled') {
      setClipes(rClipes.value);
    } else {
      // Refetch pelo caminho de carga normal: a grade obsoleta mostraria clipes já excluídos como disponíveis.
      await carregarClipesDaSelecionada(id);
    }
    setCarregandoClipes(false);
  }

  // Padrão de fluxo de EventosAutomaticosFinanceiro/ClipesAdmin: captura o
  // snapshot, limpa o diálogo e só então chama a operação.
  async function confirmarExclusao() {
    if (excluindo || !jogador || !idsPendenteExclusao || idsPendenteExclusao.length === 0) return;
    const ids = idsPendenteExclusao;
    const partidaAlvo = partidaId;
    setIdsPendenteExclusao(null);
    setExcluindo(true);
    try {
      const resultado = await excluirClipes(jogador.id, ids);
      const liberados = formatarTamanhoBytes(resultado.bytes_liberados);
      mostrarSnackbar(
        'sucesso',
        `${resultado.excluidos} clipe(s) excluído(s)${liberados ? ` — ${liberados} liberados.` : '.'}`
      );
      // Remove só os ids excluídos: exclusão individual de clipe não marcado
      // preserva as marcações restantes (o lote do topo limpa tudo naturalmente).
      setSelecionados((atual) => new Set([...atual].filter((id) => !ids.includes(id))));
      if (partidaAlvo != null) await recarregarAposExclusao(partidaAlvo);
    } catch (e) {
      mostrarSnackbar('erro', formatarMensagemErro(e, 'Não foi possível excluir os clipes.'));
    } finally {
      setExcluindo(false);
    }
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const classeBotaoSelecao =
    'min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-giz hover:bg-superficie transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="px-3 py-4 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      <BotaoVoltar fallback="/" />

      <CabecalhoSumula
        titulo="Repositório de Clipes"
        icone={<Archive className="size-5 text-destaque-texto" />}
        acao="Filma Eu"
        className="items-center"
      />

      <AbasClipesAdmin />

      {carregando ? (
        <Carregando>Carregando repositório de clipes…</Carregando>
      ) : erro ? (
        <MensagemEstado tipo="erro">{erro}</MensagemEstado>
      ) : partidas.length === 0 ? (
        <MensagemEstado tipo="info">Nenhuma partida com clipes publicados ainda.</MensagemEstado>
      ) : (
        <>
          <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-3">
            <label className="block">
              <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
                Partida
              </span>
              <SelectSumula
                value={partidaId != null ? String(partidaId) : ''}
                onChange={selecionarPartida}
                disabled={excluindo}
                aria-label="Partida com clipes"
                opcoes={partidas.map((p) => ({
                  value: String(p.partidaId),
                  label: `${formatarDataLista(p.dataJogo)} · ${rotuloStatus(p.status)} · #${p.partidaId}`,
                }))}
              />
            </label>
          </section>

          {carregandoClipes ? (
            <Carregando compacto>Carregando clipes da partida…</Carregando>
          ) : clipes.length === 0 ? (
            partidaId == null ? (
              <MensagemEstado tipo="info">Selecione uma partida no seletor acima.</MensagemEstado>
            ) : (
              // Defensivo: o seletor só lista partidas com clipes, mas uma exclusão
              // concorrente (outro admin) pode esvaziá-la entre o load e a exibição.
              <MensagemEstado tipo="info">Esta partida não tem mais clipes.</MensagemEstado>
            )
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-giz-fraco tabular-nums">
                  {selecionados.size} de {clipes.length} selecionado(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelecionados(new Set(clipes.map((c) => c.id)))}
                    disabled={excluindo || selecionados.size === clipes.length}
                    className={classeBotaoSelecao}
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelecionados(new Set())}
                    disabled={excluindo || selecionados.size === 0}
                    className={classeBotaoSelecao}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Botão de exclusão no TOPO (antes da grade): a antiga
                  BarraAcaoInferior era coberta pela TabBar do Layout (ambas
                  fixed bottom-0 z-40, a TabBar vem depois no DOM). */}
              <div className="space-y-1">
                <Botao
                  variante="perigo"
                  larguraCompleta
                  disabled={selecionados.size === 0 || excluindo}
                  onClick={() => setIdsPendenteExclusao([...selecionados])}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {excluindo ? 'Excluindo…' : `Excluir selecionados (${selecionados.size})`}
                </Botao>
                <p className="text-[11px] text-giz-fraco">
                  A exclusão é definitiva: os vídeos saem do ar.
                </p>
              </div>

              <GradeClipesPartida
                clipes={clipes}
                selecionadoIds={selecionados}
                onToggleSelecao={alternarSelecao}
                desabilitarSelecao={excluindo}
                onExcluirClipe={(clipeId) => setIdsPendenteExclusao([clipeId])}
                desabilitarExclusao={excluindo}
              />
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={idsPendenteExclusao != null && idsPendenteExclusao.length > 0}
        onClose={() => setIdsPendenteExclusao(null)}
        onConfirm={confirmarExclusao}
        titulo="Excluir clipes?"
        mensagem={
          idsPendenteExclusao?.length === 1
            ? 'Excluir este clipe? O vídeo sai do ar definitivamente.'
            : `Excluir os ${idsPendenteExclusao?.length ?? 0} clipes selecionados? Os vídeos saem do ar definitivamente.`
        }
        textoConfirmar="Excluir"
        tomConfirmar="perigo"
      />

      <Snackbar {...snackbarProps} />
    </div>
  );
}
