import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  createContext,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  aplicarSuperAdmin,
  COLUNAS_JOGADOR_LISTA,
  type JogadorLista,
} from '../lib/jogadores';

export type JogadorLogado = JogadorLista;

interface SessaoContextValue {
  jogador: JogadorLogado | null;
  setJogador: (jogador: JogadorLogado | null) => void;
  logout: () => void;
}

const STORAGE_KEY = 'racha_sessao';

const SessaoContext = createContext<SessaoContextValue | undefined>(undefined);

function lerDoStorage(): JogadorLogado | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JogadorLogado) : null;
  } catch {
    return null;
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [jogador, setJogadorState] = useState<JogadorLogado | null>(() => {
    const cached = lerDoStorage();
    return cached ? aplicarSuperAdmin(cached) : null;
  });

  useEffect(() => {
    if (!jogador) return;
    // Snapshot capturado antes do await: blinda contra o `jogador` mudar
    // enquanto a sincronização está em voo (resposta antiga sobrescrevendo
    // estado novo) e elimina os non-null assertions dentro da closure.
    const snapshot = jogador;
    let ativo = true;

    async function sincronizarJogador() {
      const { data, error } = await supabase
        .from('jogadores')
        .select(COLUNAS_JOGADOR_LISTA)
        .eq('id', snapshot.id)
        .maybeSingle();

      if (!ativo || error || !data || !data.is_ativo) return;

      const jogadorAtualizado = aplicarSuperAdmin(data as JogadorLogado);

      if (
        jogadorAtualizado.id !== snapshot.id ||
        jogadorAtualizado.username !== snapshot.username ||
        jogadorAtualizado.is_admin !== snapshot.is_admin ||
        jogadorAtualizado.is_mensalista !== snapshot.is_mensalista ||
        jogadorAtualizado.posicao !== snapshot.posicao
      ) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadorAtualizado));
        setJogadorState(jogadorAtualizado);
      }
    }

    sincronizarJogador();
    return () => {
      ativo = false;
    };
  }, [jogador]);

  // Referências estáveis: evitam que todo consumidor do contexto re-renderize
  // quando o Provider re-renderiza sem mudança de sessão.
  const setJogador = useCallback((novoJogador: JogadorLogado | null) => {
    if (novoJogador) {
      const jogadorTratado = aplicarSuperAdmin(novoJogador);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadorTratado));
      setJogadorState(jogadorTratado);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setJogadorState(null);
    }
  }, []);

  const logout = useCallback(() => setJogador(null), [setJogador]);

  const value = useMemo(() => ({ jogador, setJogador, logout }), [jogador, setJogador, logout]);

  return <SessaoContext.Provider value={value}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) {
    throw new Error('useSessao deve ser usado dentro de <SessaoProvider>');
  }
  return ctx;
}
