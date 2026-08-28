import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../context/SessaoContext';
import { MensagemEstado } from '../components/Estado';
import { listarUsernames } from '../lib/jogadores';
import { type PosicaoId } from '../lib/times';
import { Logo } from '../components/Logo';
import { formatarMensagemErro } from '../lib/erros';

export function Login() {
  const navigate = useNavigate();
  const { setJogador } = useSessao();
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [usernames, setUsernames] = useState<string[]>([]);
  const [carregandoUsernames, setCarregandoUsernames] = useState(true);
  const [erroUsernames, setErroUsernames] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);
  const timerBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerBlurRef.current) {
        clearTimeout(timerBlurRef.current);
      }
    };
  }, []);

  const usernamesFiltrados = usernames.filter(
    (nome) => !username || nome.toLowerCase().includes(username.toLowerCase())
  );
  const indiceAtivo = usernamesFiltrados.indexOf(username);

  useEffect(() => {
    let ativo = true;
    listarUsernames()
      .then((nomes) => {
        if (ativo) setUsernames(nomes);
      })
      .catch((err) => {
        if (ativo)
          setErroUsernames(formatarMensagemErro(err, 'Não foi possível carregar os usuários.'));
      })
      .finally(() => {
        if (ativo) setCarregandoUsernames(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function selecionar(nome: string) {
    setUsername(nome);
    setAberto(false);
    refInput.current?.focus();
  }

  // Espera o clique em um item acontecer antes de fechar pelo blur do input.
  function fecharComAtraso() {
    if (timerBlurRef.current) {
      clearTimeout(timerBlurRef.current);
    }
    timerBlurRef.current = setTimeout(() => setAberto(false), 120);
  }

  function navegarTeclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
        return;
      }
      const atual = usernamesFiltrados.indexOf(username);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const proximo = Math.min(usernamesFiltrados.length - 1, Math.max(0, atual + delta));
      if (usernamesFiltrados[proximo]) setUsername(usernamesFiltrados[proximo]);
    } else if (e.key === 'Enter' || e.key === 'Escape') {
      setAberto(false);
    }
  }

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { data, error } = await supabase.rpc('fazer_login', {
      p_username: username.trim(),
      p_senha: senha,
    });

    setCarregando(false);

    if (error) {
      setErro(formatarMensagemErro(error, 'Não foi possível entrar. Tente novamente.'));
      return;
    }

    if (!data || data.length === 0) {
      setErro('Não bateu. Confere o usuário e a senha e tenta de novo.');
      return;
    }

    const ret = data[0];
    setJogador({
      ...ret,
      posicao: ret.posicao as PosicaoId,
      posicao_b: (ret.posicao_b as PosicaoId | null) ?? null,
    });
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-full flex items-center justify-center p-3 sm:p-4 bg-fundo text-giz">
      <div className="w-full max-w-sm rounded-[6px] border-2 border-borda bg-superficie p-6 shadow-carimbo-preto flex flex-col items-center">
        <div className="mb-2">
          <Logo size="lg" />
        </div>
        <p className="text-center text-xs font-mono text-giz-fraco mb-6">
          Acesso à súmula de quinta · CBO
        </p>

        <form onSubmit={submeter} className="w-full space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1"
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
                    ? 'Carregando convocados...'
                    : 'Selecione ou digite seu usuário'
                }
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setAberto(true);
                }}
                onFocus={() => setAberto(true)}
                onBlur={fecharComAtraso}
                onKeyDown={navegarTeclado}
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2.5 pr-10 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
                required
                disabled={carregandoUsernames || !!erroUsernames}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label="Ver usuários"
                onClick={() => {
                  if (username) setUsername('');
                  setAberto((a) => !a);
                  refInput.current?.focus();
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[2px] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-giz-fraco hover:text-giz cursor-pointer"
              >
                <svg
                  className={`w-4 h-4 text-destaque-texto transition-transform ${aberto ? 'rotate-180' : ''}`}
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
                  className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-[4px] border border-borda bg-superficie shadow-carimbo-preto p-1"
                >
                  {usernamesFiltrados.map((nome, i) => (
                    <li key={nome} role="option" aria-selected={nome === username}>
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selecionar(nome)}
                        className={`w-full min-h-[44px] flex items-center text-left px-3 py-2 text-sm rounded-[3px] transition cursor-pointer ${
                          i === indiceAtivo
                            ? 'bg-superficie-2 text-destaque-texto font-bold'
                            : 'text-giz hover:bg-superficie-2'
                        } ${nome === username ? 'font-bold text-destaque-texto' : ''}`}
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
              className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-1"
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
              className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2.5 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2 font-mono"
              required
            />
          </div>

          {(erroUsernames || erro) && <MensagemEstado>{erroUsernames || erro}</MensagemEstado>}

          <button
            type="submit"
            disabled={carregando || carregandoUsernames || !!erroUsernames || !username}
            className="w-full min-h-[44px] rounded-[4px] border border-destaque bg-destaque px-4 py-3 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50"
          >
            {carregando ? 'Acessando súmula…' : 'Entrar no Racha'}
          </button>
        </form>
      </div>
    </div>
  );
}
