import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../hooks/useAdmin'
import { useJogadorLogado } from '../hooks/useJogadorLogado'
import { TIMES, POSICOES, type TimeId } from '../lib/times'
import { listarJogadoresAtivos, type JogadorLista } from '../lib/jogadores'
import {
  abrirPartida,
  carregarPartida,
  carregarPlacar,
  carregarParticipantes,
  carregarNotas,
  descartarVotos,
  confirmarPresenca,
  adminDefinirConfirmacao,
  adicionarParticipante,
  vagasOcupadas,
  podeConfirmar,
  CAPACIDADE_PARTIDA,
  STATUS_CONFIRMACAO_LABEL,
  STATUS_COR,
  STATUS_LABEL,
  type Partida,
  type Placar,
  type Participante,
  type NotaPartida,
  type StatusConfirmacao,
} from '../lib/partidas'
import { Carregando, MensagemEstado } from '../components/Estado'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatarDataCompleta, formatarDataMobile, formatarFechamento } from '../lib/formatacao'
import { Avatar } from '../components/Avatar'
import { Snackbar, type TipoSnackbar } from '../components/Snackbar'
import { Share2 } from 'lucide-react'
import { CardCraque } from '../components/CardCraque'
import { PlacarEstadio } from '../components/PlacarEstadio'
import { vibrateWhistle, vibrateSuccess, vibrateLight } from '../lib/haptics'

export function PartidaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useAdmin()
  const jogadorLogado = useJogadorLogado()

  const [partida, setPartida] = useState<Partida | null>(null)
  const [placar, setPlacar] = useState<Placar | null>(null)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [notas, setNotas] = useState<NotaPartida[]>([])
  const [jaVotou, setJaVotou] = useState(false)
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    visivel: boolean
    mensagem: string
    tipo: TipoSnackbar
  }>({
    visivel: false,
    mensagem: '',
    tipo: 'sucesso',
  })

  async function carregar() {
    if (!id) return
    setCarregando(true)
    setErro(null)
    try {
      const p = await carregarPartida(Number(id))
      setPartida(p)
      if (p) {
        const [pl, parts, ns] = await Promise.all([
          carregarPlacar(p.id),
          carregarParticipantes(p.id),
          carregarNotas(p.id),
        ])
        setPlacar(pl)
        setParticipantes(parts)
        setNotas(ns)

        // Verifica se o jogador logado já votou nesta partida
        if (jogadorLogado && p.status === 'published') {
          const { count } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('partida_id', p.id)
            .eq('voter_id', jogadorLogado.id)
          setJaVotou((count ?? 0) > 0)
        } else {
          setJaVotou(false)
        }
      }
    } catch (e: any) {
      setErro(e.message ?? String(e))
    } finally {
      setCarregando(false)
    }
  }

  async function confirmarDescarte() {
    if (!partida || !jogadorLogado) return
    setDescartando(true)
    try {
      const ok = await descartarVotos(partida.id, jogadorLogado.id)
      if (ok) {
        setConfirmandoDescarte(false)
        setJaVotou(false)
        vibrateLight()
        navigate(`/partida/${partida.id}/votar`)
      } else {
        setConfirmandoDescarte(false)
        setErro('Não foi possível descartar — a votação pode estar encerrada.')
      }
    } catch (e: any) {
      setConfirmandoDescarte(false)
      setErro(e.message ?? String(e))
    } finally {
      setDescartando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (carregando) return <Carregando>Carregando súmula da partida</Carregando>
  if (!partida)
    return (
      <MensagemEstado
        tipo={erro ? 'erro' : 'info'}
        className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl"
      >
        {erro ?? 'Partida não encontrada.'}
      </MensagemEstado>
    )

  async function confirmarAbrir() {
    if (!partida) return
    setAbrindo(true)
    setErro(null)
    try {
      const ok = await abrirPartida(partida.id)
      if (!ok) {
        setErro('Não foi possível abrir. Confira se os dois times têm 8 jogadores.')
        return
      }
      vibrateWhistle()
      navigate(`/partida/${partida.id}/ao-vivo`, { replace: true })
    } catch (e: any) {
      setErro(e.message ?? String(e))
    } finally {
      setAbrindo(false)
    }
  }

  async function handleCopiarListaWhatsApp() {
    if (!partida) return
    try {
      const confirmados = participantes.filter((p) => p.status_confirmacao === 'confirmado')
      const pendentes = participantes.filter((p) => p.status_confirmacao === 'pendente')
      const desfalques = participantes.filter((p) => p.status_confirmacao === 'recusado')

      const goleirosConfirmados = confirmados.filter((p) => p.posicao === 'goleiro')
      const linhaConfirmados = confirmados.filter((p) => p.posicao !== 'goleiro')

      const dataFormatada = formatarDataCompleta(partida.data_jogo)

      let texto = `⚽ *RACHA GRAGOATÁ - LISTA DE PRESENÇA* ⚽\n`
      texto += `📅 *Data/Horário:* ${dataFormatada}\n`
      texto += `📍 *Status:* ${STATUS_LABEL[partida.status]}\n\n`

      texto += `🧤 *GOLEIROS (${goleirosConfirmados.length}/2):*\n`
      if (goleirosConfirmados.length === 0) {
        texto += `  _(Nenhum goleiro confirmado)_\n`
      } else {
        goleirosConfirmados.forEach((p, i) => {
          texto += `  ${i + 1}. ${p.nome ?? `#${p.jogador_id}`}\n`
        })
      }

      texto += `\n🏃 *JOGADORES DE LINHA (${linhaConfirmados.length}/14):*\n`
      if (linhaConfirmados.length === 0) {
        texto += `  _(Nenhum jogador de linha confirmado)_\n`
      } else {
        linhaConfirmados.forEach((p, i) => {
          texto += `  ${i + 1}. ${p.nome ?? `#${p.jogador_id}`}\n`
        })
      }

      if (pendentes.length > 0) {
        texto += `\n⏳ *PENDENTES / LISTA DE ESPERA (${pendentes.length}):*\n`
        pendentes.forEach((p, i) => {
          texto += `  ${i + 1}. ${p.nome ?? `#${p.jogador_id}`}\n`
        })
      }

      if (desfalques.length > 0) {
        texto += `\n❌ *DESFALQUES (${desfalques.length}):*\n`
        desfalques.forEach((p) => {
          texto += `  - ${p.nome ?? `#${p.jogador_id}`}\n`
        })
      }

      const urlApp = window.location.origin
        ? `${window.location.origin}/partida/${partida.id}`
        : window.location.href
      texto += `\n🔗 *Acompanhe e confirme pelo app:*\n${urlApp}`

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = texto
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      vibrateSuccess()
      setSnackbar({
        visivel: true,
        mensagem: 'Lista copiada para o WhatsApp com sucesso! 📋',
        tipo: 'sucesso',
      })
    } catch {
      setSnackbar({
        visivel: true,
        mensagem: 'Não foi possível copiar automaticamente.',
        tipo: 'erro',
      })
    }
  }

  const participantesDoTime = (t: TimeId) =>
    participantes
      .filter((p) => p.time === t)
      .sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias)

  const craque = notas.find((n) => n.is_craque) ?? null
  const jogadorCraqueParticipante = craque
    ? participantes.find((p) => p.jogador_id === craque.target_id)
    : null

  const votacaoAberta =
    partida.status === 'published' &&
    partida.voting_closes_at &&
    new Date(partida.voting_closes_at) > new Date()
  const jaEhParticipante =
    !!jogadorLogado &&
    participantes.some((p) => p.jogador_id === jogadorLogado.id)
  const isRandom =
    !!jogadorLogado &&
    jogadorLogado.username.toLowerCase().startsWith("random")

  return (
    <div className="px-3 py-4 pb-10 sm:px-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => {
          vibrateLight()
          navigate(-1)
        }}
        className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer"
      >
        ← voltar
      </button>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-xs">
        <div className="space-y-0.5">
          <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
            Partida #{partida.id}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
            <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
            <span className="hidden sm:inline">{formatarDataCompleta(partida.data_jogo)}</span>
          </p>
          <p className={`text-xs font-semibold ${STATUS_COR[partida.status]}`}>
            {STATUS_LABEL[partida.status]}
            {partida.status === 'published' && partida.voting_closes_at && (
              <> — fecha {formatarFechamento(partida.voting_closes_at)}</>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopiarListaWhatsApp}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Share2 className="size-4 shrink-0" />
          <span>Copiar Lista WhatsApp</span>
        </button>
      </div>

      {/* Placar Dinâmico de Estádio: Preto × Branco */}
      {placar && partida.status !== 'draft' && (
        <PlacarEstadio
          golsTimeA={placar.gols_time_a}
          golsTimeB={placar.gols_time_b}
          status={partida.status}
          dataJogo={partida.data_jogo}
        />
      )}

      {/* Card Colecionável Panini/FUT do Craque da Partida (quando fechada) */}
      {partida.status === 'closed' && craque && (
        <div className="my-2">
          <CardCraque
            nome={craque.nome ?? ""}
            nota={craque.avg_rating}
            votos={craque.vote_count}
            gols={jogadorCraqueParticipante?.gols ?? 0}
            assistencias={jogadorCraqueParticipante?.assistencias ?? 0}
            posicao={
              jogadorCraqueParticipante?.posicao
                ? POSICOES[jogadorCraqueParticipante.posicao]
                : undefined
            }
            time={jogadorCraqueParticipante?.time}
          />
        </div>
      )}

      {/* Notas reveladas quando fechada */}
      {partida.status === 'closed' && notas.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900/60 shadow-xs">
          <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-900 text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
            📊 Boletim de Notas do Racha
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {[...notas]
              .sort(
                (a, b) =>
                  Number(b.avg_rating) - Number(a.avg_rating) ||
                  b.vote_count - a.vote_count,
              )
              .map((n) => (
                <div
                  key={n.target_id}
                  className="flex items-center justify-between px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <Avatar nome={n.nome} size="xs" />
                    <span className="font-medium">
                      {n.is_craque ? '⭐ ' : ''}
                      {n.nome}
                    </span>
                  </div>
                  <span className="font-scoreboard font-bold text-neutral-800 dark:text-neutral-200">
                    {Number(n.avg_rating).toFixed(1)}{' '}
                    <span className="text-xs font-sans text-neutral-400">({n.vote_count} {n.vote_count === 1 ? 'voto' : 'votos'})</span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {partida.status === 'draft' && (
        <Confirmacoes
          partida={partida}
          participantes={participantes}
          jogadorLogadoId={jogadorLogado?.id ?? null}
          isAdmin={isAdmin}
          onAtualizar={carregar}
        />
      )}

      {(partida.status !== 'draft' ||
        participantes.some((p) => p.time !== null)) && (
        <>
          {/* Times com gols/assists/gols contra */}
          <div className="grid grid-cols-2 gap-3">
        {(['a', 'b'] as TimeId[]).map((t) => {
          const jogadoresDoTime = participantesDoTime(t)
          return (
            <div
              key={t}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900/60 shadow-xs"
            >
              <div
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800"
                style={{
                  backgroundColor: TIMES[t].cor,
                  color: t === 'a' ? '#f9fafb' : '#111827',
                }}
              >
                {TIMES[t].nome}
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {jogadoresDoTime.map((p) => (
                  <div
                    key={p.jogador_id}
                    className="flex items-center justify-between gap-1.5 px-3 py-2 text-xs min-h-[36px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {p.nome}
                      </span>
                      {(p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0) && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0 font-bold">
                          {p.gols > 0 && <span>⚽ {p.gols}</span>}
                          {p.assistencias > 0 && <span>🅰️ {p.assistencias}</span>}
                          {p.gols_contra > 0 && <span>GC {p.gols_contra}</span>}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 shrink-0">
                      {POSICOES[p.posicao]}
                    </span>
                  </div>
                ))}
                {jogadoresDoTime.length === 0 && (
                  <div className="px-3 py-3 text-xs text-neutral-400 italic">Nenhum jogador escalado neste time ainda.</div>
                )}
              </div>
            </div>
          )
        })}
          </div>
        </>
      )}

      {erro && <MensagemEstado>{erro}</MensagemEstado>}

      {partida.status === 'draft' && isAdmin && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Escale os times (8 por time, 1 goleiro cada) e depois abra a partida para registrar os gols no campo.
          </p>
          <Link
            to={`/partida/${partida.id}/times`}
            onClick={() => vibrateLight()}
            className="block text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white shadow-sm active:scale-95 transition"
          >
            Escalar times
          </Link>
          <button
            type="button"
            onClick={confirmarAbrir}
            disabled={abrindo}
            className="block w-full text-center rounded-lg border border-[var(--cor-destaque)] px-4 py-3 font-medium text-[var(--cor-destaque)] disabled:opacity-40 active:scale-95 transition cursor-pointer"
          >
            {abrindo ? 'Abrindo partida…' : '🏁 Abrir partida (Apito Inicial)'}
          </button>
          <Link
            to={`/partida/${partida.id}/editar`}
            onClick={() => vibrateLight()}
            className="block text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 active:scale-95 transition"
          >
            Lançar resultado direto na súmula
          </Link>
        </div>
      )}

      {partida.status === 'live' && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/ao-vivo`}
            onClick={() => vibrateLight()}
            className="block text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-bold text-white shadow-md active:scale-95 transition"
          >
            {isAdmin ? '⚽ Registrar gols e eventos no campo' : '🔴 Acompanhar ao vivo no estádio'}
          </Link>
        </div>
      )}

      {partida.status === 'published' && isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/partida/${partida.id}/editar`}
            onClick={() => vibrateLight()}
            className="block text-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 active:scale-95 transition"
          >
            Editar súmula do resultado
          </Link>
        </div>
      )}

      {votacaoAberta && jaEhParticipante && !isRandom && (
        <div className="space-y-2">
          {jaVotou ? (
            <>
              <p className="text-center text-xs font-semibold text-green-600 dark:text-green-400">
                ✓ Seus votos já foram computados! Você pode ajustar suas notas até o encerramento.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/partida/${partida.id}/votar`}
                  onClick={() => vibrateLight()}
                  className="block text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-medium text-white active:scale-95 transition"
                >
                  Editar votos
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    vibrateLight()
                    setConfirmandoDescarte(true)
                  }}
                  className="block text-center rounded-lg border border-red-300 dark:border-red-900 px-4 py-3 font-medium text-red-600 dark:text-red-400 active:scale-95 transition cursor-pointer"
                >
                  Descartar votos
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-center">
                <p className="text-xs font-bold text-amber-500 dark:text-amber-400">
                  🔥 Votação na Resenha Aberta!
                </p>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5">
                  Quem foi o craque que gastou a bola e quem foi o bagre da rodada? Deixe sua nota!
                </p>
              </div>
              <Link
                to={`/partida/${partida.id}/votar`}
                onClick={() => vibrateLight()}
                className="block text-center rounded-lg bg-[var(--cor-destaque)] px-4 py-3 font-bold text-white shadow-md active:scale-95 transition"
              >
                ⭐ Avaliar companheiros & votar no Craque
              </Link>
            </div>
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

      {partida.status === 'published' && !votacaoAberta && (
        <p className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">
          🏁 Votação encerrada — a resenha está apurando as notas dos craques!
        </p>
      )}

      <Snackbar
        mensagem={snackbar.mensagem}
        tipo={snackbar.tipo}
        visivel={snackbar.visivel}
        onFechar={() => setSnackbar((prev) => ({ ...prev, visivel: false }))}
      />
    </div>
  )
}

function BadgeStatus({ status }: { status: StatusConfirmacao }) {
  const cls: Record<StatusConfirmacao, string> = {
    confirmado: 'text-green-600 dark:text-green-400',
    pendente: 'text-neutral-500 dark:text-neutral-400',
    recusado: 'text-red-600 dark:text-red-400',
  }
  const icon: Record<StatusConfirmacao, string> = {
    confirmado: '✓ ',
    pendente: '⏳ ',
    recusado: '✗ ',
  }
  return (
    <span className={`text-[11px] font-medium ${cls[status]}`}>
      {icon[status]}
      {STATUS_CONFIRMACAO_LABEL[status]}
    </span>
  )
}

type PropsBotoes = {
  status: StatusConfirmacao
  podeConf: boolean
  ocupadas: number
  processando: boolean
  onAtualizar: (alvo: StatusConfirmacao) => void
}

// Botões do próprio jogador (confirma/desconfirma/recusa a própria presença).
function BotoesSelf({ status, podeConf, ocupadas, processando, onAtualizar }: PropsBotoes) {
  const btn =
    'min-h-[44px] px-3 rounded-lg border text-xs font-semibold active:scale-95 transition disabled:opacity-40 flex items-center justify-center cursor-pointer'
  const lotado = ocupadas >= CAPACIDADE_PARTIDA
  return (
    <>
      {status !== 'confirmado' && (
        <button
          type="button"
          disabled={processando || !podeConf}
          onClick={() => {
            vibrateSuccess()
            onAtualizar('confirmado')
          }}
          title={lotado ? 'Vagas esgotadas' : undefined}
          className={`${btn} border-[var(--cor-destaque)] bg-[var(--cor-destaque)]/10 text-[var(--cor-destaque)]`}
        >
          Vou jogar
        </button>
      )}
      {status === 'confirmado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => {
            vibrateLight()
            onAtualizar('pendente')
          }}
          className={`${btn} border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300`}
        >
          Desconfirmar
        </button>
      )}
      {status !== 'recusado' && (
        <button
          type="button"
          disabled={processando}
          onClick={() => {
            vibrateLight()
            onAtualizar('recusado')
          }}
          className={`${btn} border-red-300 dark:border-red-800 text-red-600 dark:text-red-400`}
        >
          Não vou
        </button>
      )}
    </>
  )
}

// Controles do admin (pode mexer em qualquer jogador) com touch target mínimo de 44px.
function BotoesAdmin({ status, podeConf, processando, onAtualizar }: PropsBotoes) {
  const mini =
    'min-h-[44px] min-w-[44px] rounded-lg border text-sm font-bold active:scale-95 transition disabled:opacity-30 flex items-center justify-center cursor-pointer'
  const off = 'border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={processando || (status !== 'confirmado' && !podeConf)}
        onClick={() => {
          vibrateLight()
          onAtualizar('confirmado')
        }}
        title="Confirmar"
        aria-label="Confirmar presença"
        className={`${mini} ${
          status === 'confirmado'
            ? 'border-green-500 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 shadow-xs'
            : off
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        disabled={processando}
        onClick={() => {
          vibrateLight()
          onAtualizar('pendente')
        }}
        title="Pendente"
        aria-label="Marcar como pendente"
        className={`${mini} ${
          status === 'pendente'
            ? 'border-[var(--cor-destaque)] bg-amber-50 dark:bg-amber-950/40 text-[var(--cor-destaque)] shadow-xs'
            : off
        }`}
      >
        ⏳
      </button>
      <button
        type="button"
        disabled={processando}
        onClick={() => {
          vibrateLight()
          onAtualizar('recusado')
        }}
        title="Não vai"
        aria-label="Marcar como não vai"
        className={`${mini} ${
          status === 'recusado'
            ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 shadow-xs'
            : off
        }`}
      >
        ✗
      </button>
    </div>
  )
}

function Confirmacoes({
  partida,
  participantes,
  jogadorLogadoId,
  isAdmin,
  onAtualizar,
}: {
  partida: Partida
  participantes: Participante[]
  jogadorLogadoId: number | null
  isAdmin: boolean
  onAtualizar: () => Promise<void> | void
}) {
  const [processando, setProcessando] = useState<number | null>(null)
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const [mostrandoAvulso, setMostrandoAvulso] = useState(false)
  const [todosAtivos, setTodosAtivos] = useState<JogadorLista[]>([])

  const closesAt = partida.confirmacao_closes_at
  const agora = new Date()
  const prazoPassou = !!closesAt && agora.getTime() >= new Date(closesAt).getTime()
  const ocupadas = vagasOcupadas(participantes, closesAt, agora)
  const livres = Math.max(0, CAPACIDADE_PARTIDA - ocupadas)

  const ordenados = [...participantes].sort((a, b) => {
    const peso = (s: StatusConfirmacao) =>
      s === 'confirmado' ? 0 : s === 'pendente' ? 1 : 2
    return (
      peso(a.status_confirmacao) - peso(b.status_confirmacao) ||
      (a.nome ?? '').localeCompare(b.nome ?? '')
    )
  })

  async function atualizar(jogadorId: number, alvo: StatusConfirmacao) {
    setErroLocal(null)
    setProcessando(jogadorId)
    try {
      const ehSelf = jogadorId === jogadorLogadoId
      const ok =
        !ehSelf && isAdmin && jogadorLogadoId != null
          ? await adminDefinirConfirmacao(partida.id, jogadorId, alvo, jogadorLogadoId)
          : await confirmarPresenca(partida.id, jogadorId, alvo)
      if (!ok) {
        setErroLocal('Não foi possível atualizar — confira as vagas disponíveis.')
      } else {
        await onAtualizar()
      }
    } catch (e: any) {
      setErroLocal(e.message ?? String(e))
    } finally {
      setProcessando(null)
    }
  }

  async function adicionar(jogadorId: number) {
    setErroLocal(null)
    setProcessando(jogadorId)
    try {
      const ok = await adicionarParticipante(partida.id, jogadorId)
      if (!ok) {
        setErroLocal('Não foi possível adicionar — pode não haver vaga.')
      } else {
        setMostrandoAvulso(false)
        await onAtualizar()
      }
    } catch (e: any) {
      setErroLocal(e.message ?? String(e))
    } finally {
      setProcessando(null)
    }
  }

  async function abrirAvulso() {
    setMostrandoAvulso((v) => !v)
    if (todosAtivos.length === 0) {
      try {
        setTodosAtivos(await listarJogadoresAtivos())
      } catch {
        /* ignora erro de listagem */
      }
    }
  }

  const idsNoElenco = new Set(participantes.map((p) => p.jogador_id))
  const candidatosAvulso = todosAtivos.filter((j) => !idsNoElenco.has(j.id))

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900/60 shadow-xs">
      <div className="px-3 py-2.5 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
          📋 Convocação &amp; Presença
        </h3>
        <span className="text-xs font-extrabold text-[var(--cor-destaque)]">
          {ocupadas}/{CAPACIDADE_PARTIDA} vagas preenchidas
        </span>
      </div>

      {closesAt && (
        <p className="px-3 pt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          {prazoPassou
            ? '⚡ Prazo encerrado: quem confirmou confirmou! As vagas restantes estão livres para os reservas.'
            : `⏳ Confirmações dos titulares abertas até ${formatarFechamento(closesAt)}.`}
        </p>
      )}

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {ordenados.map((p) => {
          const ehSelf = p.jogador_id === jogadorLogadoId
          const podeConf = podeConfirmar(p, 'confirmado', participantes, closesAt, agora)
          return (
            <div
              key={p.jogador_id}
              className="flex items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar nome={p.nome ?? ""} size="xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {p.nome ?? `#${p.jogador_id}`}
                    {ehSelf && (
                      <span className="ml-1 text-[10px] font-bold text-amber-500">(você)</span>
                    )}
                  </p>
                  <BadgeStatus status={p.status_confirmacao} />
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                {ehSelf ? (
                  <BotoesSelf
                    status={p.status_confirmacao}
                    podeConf={podeConf}
                    ocupadas={ocupadas}
                    processando={processando === p.jogador_id}
                    onAtualizar={(alvo) => atualizar(p.jogador_id, alvo)}
                  />
                ) : isAdmin ? (
                  <BotoesAdmin
                    status={p.status_confirmacao}
                    podeConf={podeConf}
                    ocupadas={ocupadas}
                    processando={processando === p.jogador_id}
                    onAtualizar={(alvo) => atualizar(p.jogador_id, alvo)}
                  />
                ) : null}
              </div>
            </div>
          )
        })}
        {ordenados.length === 0 && (
          <div className="px-3 py-4 text-xs text-neutral-400 text-center italic">
            Nenhum jogador convocado ainda. Bora fechar o elenco!
          </div>
        )}
      </div>

      {isAdmin && livres > 0 && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={abrirAvulso}
            className="w-full px-3 py-2.5 text-xs font-bold text-[var(--cor-destaque)] cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          >
            {mostrandoAvulso
              ? 'Fechar seleção de avulsos'
              : `+ Adicionar Avulso (${livres} vaga${livres > 1 ? 's' : ''} aberta${livres > 1 ? 's' : ''})`}
          </button>
          {mostrandoAvulso && (
            <div className="max-h-52 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
              {candidatosAvulso.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  disabled={processando !== null}
                  onClick={() => adicionar(j.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 active:scale-[.99] cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar nome={j.nome} size="xs" />
                    <span className="truncate font-medium">{j.nome}</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-neutral-400">
                    {POSICOES[j.posicao]}
                  </span>
                </button>
              ))}
              {candidatosAvulso.length === 0 && (
                <div className="px-3 py-3 text-xs text-neutral-400 text-center">
                  Todos os jogadores ativos já estão na lista.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {erroLocal && (
        <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-neutral-200 dark:border-neutral-800">
          {erroLocal}
        </p>
      )}
    </section>
  )
}
