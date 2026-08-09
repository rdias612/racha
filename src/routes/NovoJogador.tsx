import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../hooks/useAdmin";
import { POSICOES, type PosicaoId } from "../lib/times";

export function NovoJogador() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [nome, setNome] = useState("");
  const [posicao, setPosicao] = useState<PosicaoId>("meia");
  const [isAdminNovo, setIsAdminNovo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);

    if (!username.trim() || !nome.trim()) {
      setErro("Preencha usuário e nome.");
      return;
    }

    setCriando(true);
    const { data, error } = await supabase.rpc("criar_jogador", {
      p_username: username.trim(),
      p_nome: nome.trim(),
      p_posicao: posicao,
      p_is_admin: isAdminNovo,
    });
    setCriando(false);

    if (error) {
      // username duplicado => erro de constraint
      if (error.code === "23505") {
        setErro(`Já existe um jogador com o usuário "${username.trim()}".`);
      } else {
        setErro("Erro: " + error.message);
      }
      return;
    }
    if (data === null) {
      setErro("Não foi possível criar o jogador.");
      return;
    }

    setOk(`${nome.trim()} criado! Senha padrão: 123`);
    setUsername("");
    setNome("");
    setPosicao("meia");
    setIsAdminNovo(false);
  }

  return (
    <div className="p-4 pb-20 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        ← voltar
      </button>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Novo jogador
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          O jogador entra com senha padrão{" "}
          <code className="font-mono">123</code> e pode trocar no perfil depois.
        </p>
      </div>

      <form onSubmit={criar} className="space-y-3">
        <label className="block">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            Usuário (login)
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            Nome (exibido)
          </span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            Posição
          </span>
          <select
            value={posicao}
            onChange={(e) => setPosicao(e.target.value as PosicaoId)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          >
            {(Object.keys(POSICOES) as PosicaoId[]).map((p) => (
              <option key={p} value={p}>
                {POSICOES[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={isAdminNovo}
            onChange={(e) => setIsAdminNovo(e.target.checked)}
            className="accent-[var(--cor-destaque)]"
          />
          É admin (pode criar/editar partidas)
        </label>

        {erro && (
          <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>
        )}
        {ok && (
          <p className="text-sm text-green-600 dark:text-green-400">{ok}</p>
        )}

        <button
          type="submit"
          disabled={criando}
          className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {criando ? "Criando…" : "Criar jogador"}
        </button>
      </form>
    </div>
  );
}
