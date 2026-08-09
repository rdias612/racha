import { useSessao } from '../context/SessaoContext'

export function Perfil() {
  const { jogador } = useSessao()

  if (!jogador) return null

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        Perfil
      </h2>
      <dl className="text-sm space-y-1 text-neutral-700 dark:text-neutral-300">
        <dt className="inline font-medium">Nome: </dt>
        <dd className="inline">{jogador.nome}</dd>
        <br />
        <dt className="inline font-medium">Usuário: </dt>
        <dd className="inline">{jogador.username}</dd>
        <br />
        <dt className="inline font-medium">Posição: </dt>
        <dd className="inline">{jogador.posicao}</dd>
        <br />
        <dt className="inline font-medium">Admin: </dt>
        <dd className="inline">{jogador.is_admin ? 'Sim' : 'Não'}</dd>
      </dl>
      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
        Stats e troca de senha virão na Etapa 7.
      </p>
    </div>
  )
}
