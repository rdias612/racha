import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../hooks/useAdmin";
import { POSICOES, POSICOES_B, type PosicaoId } from "../lib/times";
import { MensagemEstado } from "../components/Estado";
import { User, Shield, Star, Copy, Check, ArrowLeft, UserPlus } from "lucide-react";

export function NovoJogador() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [nome, setNome] = useState("");
  const [posicao, setPosicao] = useState<PosicaoId>("meia");
  const [posicaoB, setPosicaoB] = useState<PosicaoId>("meia");
  const [isMensalista, setIsMensalista] = useState(false);
  const [isAdminNovo, setIsAdminNovo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (!isAdmin) return <Navigate to="/" replace />;

  function copiarSenhaPadrao() {
    navigator.clipboard.writeText("123");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);

    if (!username.trim() || !nome.trim()) {
      setErro("Preencha o usuário e o nome para cadastrar.");
      return;
    }

    setCriando(true);
    const { data, error } = await supabase.rpc("criar_jogador", {
      p_username: username.trim(),
      p_nome: nome.trim(),
      p_posicao: posicao,
      p_is_admin: isAdminNovo,
      p_posicao_b: posicao === "goleiro" ? null : posicaoB,
      p_is_mensalista: isMensalista,
    });
    setCriando(false);

    if (error) {
      if (error.code === "23505") {
        setErro(`Já existe um jogador cadastrado com o usuário "${username.trim()}".`);
      } else {
        setErro("Erro ao criar jogador: " + error.message);
      }
      return;
    }
    if (data === null) {
      setErro("Não foi possível criar o jogador.");
      return;
    }

    setOk(`Jogador "${nome.trim()}" criado com sucesso! Senha padrão: 123`);
    setUsername("");
    setNome("");
    setPosicao("meia");
    setPosicaoB("meia");
    setIsMensalista(false);
    setIsAdminNovo(false);
  }

  return (
    <div className="px-3 py-4 pb-24 sm:px-4 max-w-2xl mx-auto space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar
      </button>

      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-green-600 dark:text-green-500" />
          Novo jogador
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Cadastre e configure todas as informações do atleta em uma só tela.
        </p>
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {ok && <MensagemEstado tipo="sucesso">{ok}</MensagemEstado>}

      <form onSubmit={criar} className="space-y-4">
        {/* Seção 1: Identificação */}
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-4 space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            <User className="w-4 h-4 text-green-600 dark:text-green-500" />
            Identificação
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Usuário (login) *
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="ex: joaosilva"
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                required
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Nome (exibido) *
              </span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoCapitalize="words"
                placeholder="ex: João Silva"
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                required
              />
            </label>
          </div>
        </div>

        {/* Seção 2: Posições em Campo */}
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-4 space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            <Star className="w-4 h-4 text-green-600 dark:text-green-500" />
            Posições em Campo
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Posição principal
              </span>
              <select
                value={posicao}
                onChange={(e) => setPosicao(e.target.value as PosicaoId)}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-green-500 outline-none transition"
              >
                {(Object.keys(POSICOES) as PosicaoId[]).map((p) => (
                  <option key={p} value={p}>
                    {POSICOES[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Posição secundária{posicao === "goleiro" ? " (não aplicável)" : ""}
              </span>
              <select
                value={posicaoB}
                onChange={(e) => setPosicaoB(e.target.value as PosicaoId)}
                disabled={posicao === "goleiro"}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50 transition"
              >
                {(Object.keys(POSICOES_B) as (keyof typeof POSICOES_B)[]).map((p) => (
                  <option key={p} value={p}>
                    {POSICOES_B[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Seção 3: Configurações & Permissões */}
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-500" />
            Configurações & Permissões
          </div>

          <label className="flex items-start gap-3 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-800/30 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 cursor-pointer transition">
            <input
              type="checkbox"
              checked={isMensalista}
              onChange={(e) => setIsMensalista(e.target.checked)}
              className="accent-green-600 w-4 h-4 rounded mt-0.5"
            />
            <div className="text-xs">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                É Mensalista
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                Tem vaga garantida na confirmação das partidas e contribuição mensal.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-800/30 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 cursor-pointer transition">
            <input
              type="checkbox"
              checked={isAdminNovo}
              onChange={(e) => setIsAdminNovo(e.target.checked)}
              className="accent-green-600 w-4 h-4 rounded mt-0.5"
            />
            <div className="text-xs">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                É Administrador
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                Pode criar, editar partidas, lançar eventos e gerenciar o racha.
              </span>
            </div>
          </label>
        </div>

        {/* Seção 4: Senha Padrão */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div>
            <span className="font-semibold block">Senha inicial padrão:</span>
            <span className="text-amber-700 dark:text-amber-400">
              O jogador utilizará a senha <code className="font-bold bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.5 rounded font-mono text-amber-950 dark:text-amber-100">123</code> no primeiro acesso.
            </span>
          </div>
          <button
            type="button"
            onClick={copiarSenhaPadrao}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-200/80 dark:bg-amber-900/50 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-medium transition shrink-0"
          >
            {copiado ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Botão de Submissão */}
        <button
          type="submit"
          disabled={criando}
          className="w-full rounded-xl bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 px-4 py-3 font-semibold text-white disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 text-sm"
        >
          {criando ? (
            "Criando jogador..."
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Criar Jogador</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
