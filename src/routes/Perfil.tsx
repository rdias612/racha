import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../context/SessaoContext'
import { POSICOES } from '../lib/times'
import { Carregando, MensagemEstado } from '../components/Estado'
import { ativarPush, desativarPush, statusPush, type StatusPush } from '../lib/pwa'

interface Stats {
  jogador_id: number
  partidas: number
  gols: number
  assistencias: number
  gols_contra: number
  vitorias: number
}

export function Perfil() {
  const { jogador, logout } = useSessao()
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats | null>(null)
  const [carregandoStats, setCarregandoStats] = useState(true)

  // formulário de troca de senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [trocando, setTrocando] = useState(false)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [okSenha, setOkSenha] = useState<string | null>(null)
  const [pushStatus, setPushStatus] = useState<StatusPush>('desativado')
  const [carregandoPush, setCarregandoPush] = useState(true)
  const [alterandoPush, setAlterandoPush] = useState(false)
  const [erroPush, setErroPush] = useState<string | null>(null)

  useEffect(() => {
    async function carregarStats() {
      if (!jogador) return
      const { data, error } = await supabase
        .from('stats_jogador')
        .select('jogador_id, partidas, gols, assistencias, gols_contra, vitorias')
        .eq('jogador_id', jogador.id)
        .maybeSingle()
      if (!error) setStats(data)
      setCarregandoStats(false)
    }
    carregarStats()
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

    if (senhaNova.length < 3) {
      setErroSenha('A nova senha deve ter ao menos 3 caracteres.')
      return
    }
    if (senhaNova !== senhaConfirma) {
      setErroSenha('A confirmação não confere.')
      return
    }

    setTrocando(true)
    const { data, error } = await supabase.rpc('trocar_senha', {
      p_jogador_id: jogador!.id,
      p_senha_atual: senhaAtual,
      p_senha_nova: senhaNova,
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

    setOkSenha('Senha alterada com sucesso!')
    setSenhaAtual('')
    setSenhaNova('')
    setSenhaConfirma('')
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
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Perfil
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
            <span className="ml-2 text-[10px] uppercase bg-[var(--cor-destaque)] text-white px-1.5 py-0.5 rounded">
              Admin
            </span>
          )}
        </p>
      </section>

      {/* Stats */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
          Estatísticas
        </h3>
        {carregandoStats ? (
          <Carregando compacto>Carregando estatísticas</Carregando>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <StatBox label="Partidas" value={stats?.partidas ?? 0} />
            <StatBox label="Vitórias" value={stats?.vitorias ?? 0} />
            <StatBox label="Gols" value={stats?.gols ?? 0} />
            <StatBox label="Assists" value={stats?.assistencias ?? 0} />
            <StatBox label="Gols contra" value={stats?.gols_contra ?? 0} />
          </div>
        )}
      </section>

      {/* Notificações */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
          Notificações de votação
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
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
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 disabled:opacity-50"
          >
            {carregandoPush || alterandoPush
              ? 'Atualizando…'
              : pushStatus === 'ativado'
                ? 'Desativar notificações'
                : 'Ativar notificações'}
          </button>
        )}
      </section>

      {/* Trocar senha */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
          Alterar senha
        </h3>
        <form onSubmit={trocarSenha} className="space-y-3">
          <input
            type="password"
            placeholder="Senha atual"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            required
          />
          <input
            type="password"
            placeholder="Nova senha"
            autoComplete="new-password"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            required
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            value={senhaConfirma}
            onChange={(e) => setSenhaConfirma(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            required
          />
          {erroSenha && (
            <MensagemEstado>{erroSenha}</MensagemEstado>
          )}
          {okSenha && (
            <MensagemEstado tipo="sucesso">{okSenha}</MensagemEstado>
          )}
          <button
            type="submit"
            disabled={trocando}
            className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {trocando ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      </section>

      {/* Logout */}
      <section className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={fazerLogout}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-sm text-neutral-600 dark:text-neutral-400"
        >
          Sair
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
