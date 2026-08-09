import { useEffect, useState } from 'react'

export type Tema = 'light' | 'dark'

const STORAGE_KEY = 'racha_tema'

function lerTemaInicial(): Tema {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo === 'light' || salvo === 'dark') return salvo
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTemaInicial)

  useEffect(() => {
    const root = document.documentElement
    if (tema === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, tema)
  }, [tema])

  const alternar = () => setTema((t) => (t === 'dark' ? 'light' : 'dark'))

  return { tema, alternar }
}
