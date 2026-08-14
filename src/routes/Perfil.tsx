import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../context/SessaoContext'
import { POSICOES } from '../lib/times'
import { Carregando, MensagemEstado } from '../components/Estado'
import { ativarPush, desativarPush, statusPush, type StatusPush } from '../lib/pwa'
import { PixCopiaECola } from '../components/PixCopiaECola'
import { formatarReais } from '../lib/formatacao'
import { RadarAtleta } from '../components/RadarAtleta'
import { vibrateLight, vibrateSuccess } from '../lib/haptics'

interface Stats {
  jogador_id: number
  partidas: number
  gols: number
  assistencias: number
  gols_contra: number
  vitorias: number
}

interface DividaItem {
  id: number
  tipo: string
  valor: number
  descricao: string | null
  referencia: string | null
  data_divida: string
}

export function Perfil() {
  const { jogador, logout } = useSessao()
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats | null>(null)
  const [mediaNota, setMediaNota] = useState<number | undefined>(undefined)
  const [carregandoStats, setCarregandoStats] = useState(true)
  const [dividas, setDividas] = useState<DividaItem[]>([])
  const [carregandoDividas, setCarregandoDividas] = useState(true)

  // formulário de troca de senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false)
  const [mostrarSenhaNova, setMostrarSenhaNova] = useState(false)
  const [mostrarSenhaConfirma, setMostrarSenhaConfirma] = useState(false)
  const [trocando, setTrocando] = useState(false)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [okSenha, setOkSenha] = useState<string | null>(null)

  const [pushStatus, setPushStatus] = useState<StatusPush>('desativado')
  const [carregandoPush, setCarregandoPush] = useState(true)
  const [alterandoPush, setAlterandoPush] = useState(false)
  const [erroPush, setErroPush] = useState<string | null>(null)

  useEffect(() => {
    async function carregarDados() {
      if (!jogador) return
      const [resStats, resDividas, resNotas] = await Promise.all([
        supabase
          .from('stats_jogador')
          .select('jogador_id, partidas, gols, assistencias, gols_contra, vitorias')
          .eq('jogador_id', jogador.id)
          .maybeSingle(),
        supabase
          .from('dividas')
          .select('id, tipo, valor, descricao, referencia, data_divida')
          .eq('jogador_id', jogador.id)
          .eq('paga', false)
          .order('data_divida', { ascending: false }),
        supabase
          .from('partida_notas')
          .select('avg_rating, vote_count')
          .eq('target_id', jogador.id),
      ])

      if (!resStats.error) setStats(resStats.data)
      if (!resDividas.error) setDividas(resDividas.data ?? [])

      if (resNotas.data && resNotas.data.length > 0) {
        let soma = 0
        let totalVotos = 0
        for (const n of resNotas.data) {
          const avg = Number(n.avg_rating)
          const cnt = Number(n.vote_count)
          if (!isNaN(avg) && !isNaN(cnt) && cnt > 0) {
            soma += avg * cnt
            totalVotos += cnt
          }
        }
        if (totalVotos > 0) {
          setMediaNota(Number((soma / totalVotos).toFixed(2)))
        }
      }

      setCarregandoStats(false)
      setCarregandoDividas(false)
    }
    carregarDados()
  }, [jogador?.id])

  useEffect(() => {
    let ativo = true
    async function carregarPush() {
      if (!jogador) return
      try {
        const status = await statusPush(jogador.id)
        if (ativo) setPushStatus(status)
      } catch {
        if (ativo) setPushStatus('desativado')
      } finally {
        if (ativo) setCarregandoPush(false)
      }
    }
    carregarPush()
    return () => {
      ativo = false
    }
  }, [jogador?.id])

  if (!jogador) return null

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErroSenha(null)
    setOkSenha(null)

    const sAtual = senhaAtual.trim()
    const sNova = senhaNova.trim()
    const sConfirma = senhaConfirma.trim()

    if (!sAtual) {
      setErroSenha('Informe sua senha atual.')
      return
    }
    if (sNova.length < 4) {
      setErroSenha('A nova senha deve ter no mínimo 4 caracteres.')
      return
    }
    if (sNova !== sConfirma) {
      setErroSenha('A confirmação da nova senha não confere.')
      return
    }
    if (sNova === sAtual) {
      setErroSenha('A nova senha deve ser diferente da senha atual.')
      return
    }

    setTrocando(true)
    const { data, error } = await supabase.rpc('trocar_senha', {
      p_jogador_id: jogador!.id,
      p_senha_atual: sAtual,
      p_senha_nova: sNova,
    })
    setTrocando(false)

    if (error) {
      setErroSenha('Erro: ' + error.message)
      return
    }
    if (data === false) {
      setErroSenha('Senha atual incorreta.')
      return
    }

    vibrateSuccess()
    setOkSenha('Senha alterada com sucesso!')
    setSenhaAtual('')
    setSenhaNova('')
    setSenhaConfirma('')
    setMostrarSenhaAtual(false)
    setMostrarSenhaNova(false)
    setMostrarSenhaConfirma(false)
  }

  function fazerLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  async function alternarPush() {
    setAlterandoPush(true)
    setErroPush(null)
    try {
      if (pushStatus === 'ativado') {
        await desativarPush(jogador!.id)
        setPushStatus('desativado')
      } else {
        await ativarPush(jogador!.id)
        setPushStatus('ativado')
      }
    } catch (error) {
      setErroPush(error instanceof Error ? error.message : 'Erro ao alterar notificações.')
    } finally {
      setAlterandoPush(false)
    }
  }

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-5">
      <h2 className="text-lg font-bold font-heading text-neutral-900 dark:text-neutral-100">
        Perfil do Atleta
      </h2>

      {/* Dados */}
      <section className="space-y-1">
        <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          {jogador.nome}
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          @{jogador.username} · {POSICOES[jogador.posicao]}
          {jogador.posicao_b && (
            <span className="text-neutral-400 dark:text-neutral-500">
              {" · "}2ª {POSICOES[jogador.posicao_b]}
            </span>
          )}
          {jogador.is_admin && (
            <span className="ml-2 text-[10px] uppercase bg-[var(--cor-destaque)] text-white font-bold px-1.5 py-0.5 rounded">
              Admin
            </span>
          )}
        </p>
      </section>

      {/* Stats e Radar do Atleta */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Estatísticas & Desempenho
        </h3>
        {carregandoStats ? (
          <Carregando compacto>Carregando estatísticas</Carregando>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <StatBox label="Partidas" value={stats?.partidas ?? 0} />
              <StatBox label="Vitórias" value={stats?.vitorias ?? 0} />
              <StatBox label="Gols" value={stats?.gols ?? 0} />
              <StatBox label="Assists" value={stats?.assistencias ?? 0} />
              <StatBox label="Gols contra" value={stats?.gols_contra ?? 0} />
            </div>

            <RadarAtleta
              stats={{
                jogador_id: jogador.id,
                partidas: stats?.partidas ?? 0,
                vitorias: stats?.vitorias ?? 0,
                gols: stats?.gols ?? 0,
                assistencias: stats?.assistencias ?? 0,
                gols_contra: stats?.gols_contra ?? 0,
                media_nota: mediaNota,
                posicao: jogador.posicao,
                nome: jogador.nome,
              }}
            />
          </div>
        )}
      </section>

      {/* Financeiro / Pix */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Financeiro & Pix
        </h3>
        {carregandoDividas ? (
          <Carregando compacto>Carregando situação financeira</Carregando>
        ) : (
          <>
            {dividas.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 p-3.5 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-xs font-bold text-red-900 dark:text-red-200 block">
                      Pendências em aberto ({dividas.length})
                    </span>
                    <span className="text-[11px] text-red-700 dark:text-red-300">
                      Total a acertar com o administrador
                    </span>
                  </div>
                  <span className="text-base font-extrabold text-red-600 dark:text-red-400">
                    {formatarReais(dividas.reduce((acc, d) => acc + Number(d.valor), 0))}
                  </span>
                </div>
                <PixCopiaECola
                  valor={dividas.reduce((acc, d) => acc + Number(d.valor), 0)}
                  nomeDevedor={jogador.nome}
                  permitirEditarChave={jogador.is_admin}
                  descricao="Pague suas pendências copiando o código ou chave Pix abaixo"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-green-200 dark:border-green-900/60 bg-green-50/50 dark:bg-green-950/20 p-3.5 text-xs text-green-800 dark:text-green-300 font-semibold shadow-xs">
                  🎉 Tudo certo! Nenhuma pendência financeira no momento.
                </div>
                <PixCopiaECola
                  permitirEditarChave={jogador.is_admin}
                  descricao="Chave Pix para pagamentos e mensalidades"
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Notificações */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Notificações de Votação
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Receba um lembrete quando houver uma votação pendente neste dispositivo.
        </p>
        {erroPush && <MensagemEstado>{erroPush}</MensagemEstado>}
        {pushStatus === 'indisponivel' && (
          <MensagemEstado tipo="info">Web Push não está disponível neste navegador.</MensagemEstado>
        )}
        {pushStatus === 'negado' && (
          <MensagemEstado tipo="info">As notificações estão bloqueadas no navegador.</MensagemEstado>
        )}
        {pushStatus !== 'indisponivel' && pushStatus !== 'negado' && (
          <button
            type="button"
            onClick={alternarPush}
            disabled={carregandoPush || alterandoPush}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-50 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            {carregandoPush || alterandoPush
              ? 'Atualizando…'
              : pushStatus === 'ativado'
                ? 'Desativar notificações'
                : 'Ativar notificações'}
          </button>
        )}
      </section>

      {/* Trocar senha segura */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Alterar Senha
        </h3>
        <form onSubmit={trocarSenha} className="space-y-3">
          <div className="relative">
            <input
              type={mostrarSenhaAtual ? 'text' : 'password'}
              placeholder="Senha atual"
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 pr-11 text-sm text-neutral-900 dark:text-neutral-100 shadow-xs"
              required
            />
            <button
              type="button"
              onClick={() => {
                vibrateLight()
                setMostrarSenhaAtual((v) => !v)
              }}
              aria-label={mostrarSenhaAtual ? 'Ocultar senha atual' : 'Mostrar senha atual'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
            >
              {mostrarSenhaAtual ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <div className="relative">
            <input
              type={mostrarSenhaNova ? 'text' : 'password'}
              placeholder="Nova senha (mínimo 4 caracteres)"
              autoComplete="new-password"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 pr-11 text-sm text-neutral-900 dark:text-neutral-100 shadow-xs"
              required
              minLength={4}
            />
            <button
              type="button"
              onClick={() => {
                vibrateLight()
                setMostrarSenhaNova((v) => !v)
              }}
              aria-label={mostrarSenhaNova ? 'Ocultar nova senha' : 'Mostrar nova senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
            >
              {mostrarSenhaNova ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <div className="relative">
            <input
              type={mostrarSenhaConfirma ? 'text' : 'password'}
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              value={senhaConfirma}
              onChange={(e) => setSenhaConfirma(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 pr-11 text-sm text-neutral-900 dark:text-neutral-100 shadow-xs"
              required
              minLength={4}
            />
            <button
              type="button"
              onClick={() => {
                vibrateLight()
                setMostrarSenhaConfirma((v) => !v)
              }}
              aria-label={mostrarSenhaConfirma ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
            >
              {mostrarSenhaConfirma ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {erroSenha && <MensagemEstado tipo="erro">{erroSenha}</MensagemEstado>}
          {okSenha && <MensagemEstado tipo="sucesso">{okSenha}</MensagemEstado>}

          <button
            type="submit"
            disabled={trocando}
            className="w-full rounded-xl bg-[var(--cor-destaque)] px-4 py-2.5 font-bold text-white shadow-xs disabled:opacity-50 active:scale-95 transition cursor-pointer"
          >
            {trocando ? 'Alterando senha…' : 'Alterar Senha'}
          </button>
        </form>
      </section>

      {/* Logout */}
      <section className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={fazerLogout}
          className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
        >
          Sair da Conta
        </button>
      </section>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 px-2 py-2.5 text-center shadow-xs">
      <div className="text-xl sm:text-2xl font-extrabold text-[var(--cor-destaque)]">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
    </div>
  )
}
