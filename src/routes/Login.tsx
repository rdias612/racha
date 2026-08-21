import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessao } from "../context/SessaoContext";
import { MensagemEstado } from "../components/Estado";
import { listarUsernames } from "../lib/jogadores";
import { Logo } from "../components/Logo";

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
  const [aberto, setAberto] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);

  const usernamesFiltrados = usernames.filter(
    (nome) =>
      !username || nome.toLowerCase().includes(username.toLowerCase()),
  );
  const indiceAtivo = usernamesFiltrados.indexOf(username);

  useEffect(() => {
    listarUsernames()
      .then(setUsernames)
      .catch(() => setErroUsernames("Não foi possível carregar os usuários."))
      .finally(() => setCarregandoUsernames(false));
  }, []);

  function selecionar(nome: string) {
    setUsername(nome);
    setAberto(false);
    refInput.current?.focus();
  }

  // Espera o clique em um item acontecer antes de fechar pelo blur do input.
  function fecharComAtraso() {
    setTimeout(() => setAberto(false), 120);
  }

  function navegarTeclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
        return;
      }
      const atual = usernamesFiltrados.indexOf(username);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const proximo = Math.min(
        usernamesFiltrados.length - 1,
        Math.max(0, atual + delta),
      );
      if (usernamesFiltrados[proximo]) setUsername(usernamesFiltrados[proximo]);
    } else if (e.key === "Enter" || e.key === "Escape") {
      setAberto(false);
    }
  }

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
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-2">
          <Logo size="lg" />
        </div>
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 mb-6">
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
            <div className="relative">
              <input
                id="username"
                type="text"
                role="combobox"
                aria-expanded={aberto}
                aria-controls="lista-usernames"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder={
                  carregandoUsernames
                    ? "Carregando usuários..."
                    : "Selecione ou digite seu usuário"
                }
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setAberto(true);
                }}
                onFocus={() => setAberto(true)}
                onBlur={fecharComAtraso}
                onKeyDown={navegarTeclado}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 pr-10 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-destaque"
                required
                disabled={carregandoUsernames || !!erroUsernames}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label="Ver usuários"
                onClick={() => {
                  if (username) setUsername("");
                  setAberto((a) => !a);
                  refInput.current?.focus();
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                <svg
                  className={`w-5 h-5 transition-transform ${aberto ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {aberto && usernamesFiltrados.length > 0 && (
                <ul
                  id="lista-usernames"
                  role="listbox"
                  className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg"
                >
                  {usernamesFiltrados.map((nome, i) => (
                    <li key={nome} role="option" aria-selected={nome === username}>
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selecionar(nome)}
                        className={`w-full text-left px-3 py-2 text-neutral-900 dark:text-neutral-100 ${
                          i === indiceAtivo
                            ? "bg-neutral-100 dark:bg-neutral-800"
                            : ""
                        } ${nome === username ? "font-medium" : ""}`}
                      >
                        {nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-destaque"
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
            className="w-full rounded-lg bg-destaque px-4 py-2 font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
