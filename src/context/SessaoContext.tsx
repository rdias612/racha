import {
  useEffect,
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { PosicaoId } from "../lib/times";
import { supabase } from "../lib/supabase";

export interface JogadorLogado {
  id: number;
  username: string;
  nome: string;
  posicao: PosicaoId;
  is_admin: boolean;
  is_ativo: boolean;
  is_mensalista: boolean;
  posicao_b: PosicaoId | null;
}

interface SessaoContextValue {
  jogador: JogadorLogado | null;
  setJogador: (jogador: JogadorLogado | null) => void;
  logout: () => void;
}

const STORAGE_KEY = "racha_sessao";

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
  const [jogador, setJogadorState] = useState<JogadorLogado | null>(
    lerDoStorage,
  );

  useEffect(() => {
    if (!jogador) return;

    async function sincronizarJogador() {
      const { data, error } = await supabase
        .from("jogadores")
        .select("id, username, nome, posicao, is_admin, is_ativo, is_mensalista, posicao_b")
        .eq("username", jogador!.username)
        .maybeSingle();

      if (error || !data || !data.is_ativo) return;

      const jogadorAtualizado = data as JogadorLogado;
      if (jogadorAtualizado.id !== jogador!.id) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadorAtualizado));
        setJogadorState(jogadorAtualizado);
      }
    }

    sincronizarJogador();
  }, [jogador]);

  const setJogador = (novoJogador: JogadorLogado | null) => {
    if (novoJogador) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(novoJogador));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setJogadorState(novoJogador);
  };

  const logout = () => setJogador(null);

  return (
    <SessaoContext.Provider value={{ jogador, setJogador, logout }}>
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) {
    throw new Error("useSessao deve ser usado dentro de <SessaoProvider>");
  }
  return ctx;
}
