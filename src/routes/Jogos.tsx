import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../hooks/useAdmin'
import { useSessao } from '../context/SessaoContext'
import { Carregando, MensagemEstado } from '../components/Estado'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Snackbar, type TipoSnackbar } from '../components/Snackbar'
import { formatarDataLista } from '../lib/formatacao'
import { STATUS_COR, STATUS_LABEL, excluirPartida, type StatusPartida } from '../lib/partidas'
import { PullToRefresh } from '../components/PullToRefresh'

interface Partida {
  id: number
  data_jogo: string
  status: StatusPartida
}

interface Placar {
  partida_id: number
  gols_time_a: number
  gols_time_b: number
}

export function Jogos() {
  const isAdmin = useAdmin()
  const { jogador } = useSessao()
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [placares, setPlacares] = useState<Record<number, Placar>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [partidaParaExcluir, setPartidaParaExcluir] = useState<Partida | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    visivel: boolean
    tipo: TipoSnackbar
    mensagem: string
  }>({ visivel: false, tipo: 'sucesso', mensagem: '' })

  function mostrarSnackbar(tipo: TipoSnackbar, mensagem: string) {
    setSnackbar({ visivel: true, tipo, mensagem })
  }

  const carregar = useCallback(async () => {
    const { data: ps, error } = await supabase
      .from('partidas')
      .select('id, data_jogo, status')
      .order('data_jogo', { ascending: false })

    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }
    setPartidas(ps ?? [])

    if (ps && ps.length > 0) {
      const ids = ps.map((p) => p.id)
      const { data: pls } = await supabase
        .from('partida_placar')
        .select('partida_id, gols_time_a, gols_time_b')
        .in('partida_id', ids)
      const mapa: Record<number, Placar> = {}
      for (const pl of pls ?? []) mapa[pl.partida_id] = pl
      setPlacares(mapa)
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function confirmarExclusao() {
    const alvo = partidaParaExcluir
    if (!alvo || !jogador) return
    setExcluindo(true)
    try {
      const ok = await excluirPartida(alvo.id, jogador.id)
      if (ok) {
        setPartidas((prev) => prev.filter((p) => p.id !== alvo.id))
        mostrarSnackbar('sucesso', 'Partida excluída')
      } else {
        mostrarSnackbar('erro', 'Não foi possível excluir a partida')
      }
    } catch {
      mostrarSnackbar('erro', 'Não foi possível excluir a partida')
    } finally {
      setExcluindo(false)
      setPartidaParaExcluir(null)
    }
  }

  if (carregando) return <Carregando>Carregando jogos</Carregando>
  if (erro) return <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">{erro}</MensagemEstado>

  return (
    <PullToRefresh onRefresh={carregar}>
      <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Jogos</h2>
          {isAdmin && (
            <Link
              to="/partida/nova"
              className="text-xs rounded-lg bg-destaque text-white px-3 py-1.5"
            >
              + Nova partida
            </Link>
          )}
        </div>

        {partidas.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {isAdmin
              ? 'Nenhuma partida ainda. Crie a primeira com "Nova partida".'
              : 'Nenhuma partida ainda.'}
          </p>
        ) : (
          <div className="space-y-2">
            {partidas.map((p) => {
              const pl = placares[p.id]
              return (
                <Link
                  key={p.id}
                  to={p.status === 'live' ? `/partida/${p.id}/ao-vivo` : `/partida/${p.id}`}
                  className="block rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-3 hover:border-destaque transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatarDataLista(p.data_jogo)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium ${STATUS_COR[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          aria-label="Excluir partida"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setPartidaParaExcluir(p)
                          }}
                          className="text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-500 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-3">
                    <span className="text-xs text-neutral-500">Preto</span>
                    <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      {p.status === 'draft' || !pl
                        ? '— × —'
                        : `${pl.gols_time_a} × ${pl.gols_time_b}`}
                    </span>
                    <span className="text-xs text-neutral-500">Branco</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {partidaParaExcluir && (
        <ConfirmDialog
          open={partidaParaExcluir != null}
          onClose={() => setPartidaParaExcluir(null)}
          onConfirm={confirmarExclusao}
          titulo="Excluir partida?"
          mensagem={`A partida de ${formatarDataLista(partidaParaExcluir.data_jogo)} será removida permanentemente, junto com placar, votos, eventos e dívidas vinculados.`}
          textoConfirmar={excluindo ? 'Excluindo...' : 'Excluir'}
          tomConfirmar="perigo"
        />
      )}

      <Snackbar
        mensagem={snackbar.mensagem}
        tipo={snackbar.tipo}
        visivel={snackbar.visivel}
        onFechar={() => setSnackbar((s) => ({ ...s, visivel: false }))}
      />
    </PullToRefresh>
  )
}
