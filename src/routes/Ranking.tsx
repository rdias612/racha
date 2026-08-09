import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface LinhaRanking {
  jogador_id: number
  nome: string
  pontos: number
  vitorias: number
  empates: number
  derrotas: number
  partidas: number
  gols: number
  assistencias: number
}

export function Ranking() {
  const [linhas, setLinhas] = useState<LinhaRanking[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      // A ordenação de desempate (5 níveis) é feita aqui, pois views não
      // garantem ordem: pontos, vitórias, partidas, gols, assists, nome.
      const { data, error } = await supabase
        .from('ranking')
        .select(
          'jogador_id, nome, pontos, vitorias, empates, derrotas, partidas, gols, assistencias',
        )
        .order('pontos', { ascending: false })
        .order('vitorias', { ascending: false })
        .order('partidas', { ascending: false })
        .order('gols', { ascending: false })
        .order('assistencias', { ascending: false })
        .order('nome', { ascending: true })

      if (error) {
        setErro(error.message)
      } else {
        setLinhas(data ?? [])
      }
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando)
    return <div className="p-4 text-sm text-neutral-500">Carregando ranking…</div>
  if (erro) return <div className="p-4 text-sm text-red-600">{erro}</div>

  return (
    <div className="p-4 pb-20 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
        Ranking
      </h2>

      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma partida publicada ainda. O ranking aparece quando houver
          partidas.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
              <tr>
                <th className="px-2 py-2 text-left font-medium w-8">#</th>
                <th className="px-2 py-2 text-left font-medium">Nome</th>
                <th className="px-2 py-2 text-right font-medium" title="Pontos">Pts</th>
                <th className="px-2 py-2 text-right font-medium" title="Vitórias">V</th>
                <th className="px-2 py-2 text-right font-medium" title="Partidas">J</th>
                <th className="px-2 py-2 text-right font-medium" title="Gols">G</th>
                <th className="px-2 py-2 text-right font-medium" title="Assistências">A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {linhas.map((l, i) => {
                const primeiro = i === 0
                return (
                  <tr
                    key={l.jogador_id}
                    className={
                      primeiro
                        ? 'bg-[var(--cor-destaque)]/10'
                        : 'bg-white dark:bg-neutral-950'
                    }
                  >
                    <td className="px-2 py-2 text-neutral-500 dark:text-neutral-400">
                      {primeiro ? '🏆' : i + 1}
                    </td>
                    <td className="px-2 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                      {l.nome}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-[var(--cor-destaque)]">
                      {l.pontos}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l.vitorias}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l.partidas}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l.gols}
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {l.assistencias}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
        Pts = pontos (3 vitória, 1 empate) · V = vitórias · J = jogos · G = gols ·
        A = assistências.
        <br />
        Desempate: pts → vitórias → jogos → gols → assistências → nome.
      </p>
    </div>
  )
}
