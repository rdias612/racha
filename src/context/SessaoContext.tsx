import {
  useEffect,
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { PosicaoId } from "../lib/times";
import { supabase } from "../lib/supabase";
import { isSuperAdmin } from "../lib/jogadores";

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
  const [jogador, setJogadorState] = useState<JogadorLogado | null>(() => {
    const cached = lerDoStorage();
    if (cached && isSuperAdmin(cached.username)) {
      return { ...cached, is_admin: true };
    }
    return cached;
  });

  const setJogador = useCallback((novoJogador: JogadorLogado | null) => {
    if (novoJogador) {
      if (isSuperAdmin(novoJogador.username)) {
        novoJogador = { ...novoJogador, is_admin: true };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(novoJogador));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setJogadorState(novoJogador);
  }, []);

  const logout = useCallback(() => {
    setJogador(null);
  }, [setJogador]);

  useEffect(() => {
    if (!jogador) return;

    let ativo = true;

    async function sincronizarJogador() {
      const { data, error } = await supabase
        .from("jogadores")
        .select("id, username, nome, posicao, is_admin, is_ativo, is_mensalista, posicao_b")
        .eq("username", jogador!.username)
        .maybeSingle();

      if (!ativo) return;

      if (error || !data) return;

      if (!data.is_ativo) {
        logout();
        return;
      }

      const jogadorAtualizado = data as JogadorLogado;
      if (isSuperAdmin(jogadorAtualizado.username)) {
        jogadorAtualizado.is_admin = true;
      }

      if (
        jogadorAtualizado.id !== jogador!.id ||
        jogadorAtualizado.is_admin !== jogador!.is_admin ||
        jogadorAtualizado.is_mensalista !== jogador!.is_mensalista ||
        jogadorAtualizado.nome !== jogador!.nome ||
        jogadorAtualizado.posicao !== jogador!.posicao ||
        jogadorAtualizado.posicao_b !== jogador!.posicao_b ||
        jogadorAtualizado.is_ativo !== jogador!.is_ativo
      ) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadorAtualizado));
        setJogadorState(jogadorAtualizado);
      }
    }

    sincronizarJogador();

    return () => {
      ativo = false;
    };
  }, [jogador?.username, logout]);

  const value = useMemo(
    () => ({ jogador, setJogador, logout }),
    [jogador, setJogador, logout]
  );

  return (
    <SessaoContext.Provider value={value}>
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
