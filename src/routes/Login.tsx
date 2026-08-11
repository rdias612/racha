import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessao } from "../context/SessaoContext";
import { MensagemEstado } from "../components/Estado";
import { listarUsernames } from "../lib/jogadores";

export function Login() {
  const navigate = useNavigate();
  const { setJogador } = useSessao();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [usernames, setUsernames] = useState<string[]>([]);
  const [carregandoUsernames, setCarregandoUsernames] = useState(true);
  const [erroUsernames, setErroUsernames] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    listarUsernames()
      .then(setUsernames)
      .catch(() => setErroUsernames("Não foi possível carregar os usuários."))
      .finally(() => setCarregandoUsernames(false));
  }, []);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { data, error } = await supabase.rpc("fazer_login", {
      p_username: username,
      p_senha: senha,
    });

    setCarregando(false);

    if (error) {
      setErro("Erro ao conectar. Tente novamente.");
      return;
    }

    if (!data || data.length === 0) {
      setErro("Usuário ou senha inválidos.");
      return;
    }

    setJogador(data[0]);
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-full flex items-center justify-center p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-100 mb-1">
          Racha Gragoata CBO
        </h1>
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 mb-8">
          Entre com seu usuário e senha
        </p>

        <form onSubmit={submeter} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
            >
              Usuário
            </label>
            <input
              id="username"
              type="text"
              list="lista-usernames"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={
                carregandoUsernames
                  ? "Carregando usuários..."
                  : "Selecione ou digite seu usuário"
              }
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[var(--cor-destaque)]"
              required
              disabled={carregandoUsernames || !!erroUsernames}
            />
            <datalist id="lista-usernames">
              {usernames.map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
          </div>

          <div>
            <label
              htmlFor="senha"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
            >
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[var(--cor-destaque)]"
              required
            />
          </div>

          {(erroUsernames || erro) && (
            <MensagemEstado>{erroUsernames || erro}</MensagemEstado>
          )}

          <button
            type="submit"
            disabled={
              carregando || carregandoUsernames || !!erroUsernames || !username
            }
            className="w-full rounded-lg bg-[var(--cor-destaque)] px-4 py-2 font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
