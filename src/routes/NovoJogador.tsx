import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../hooks/useAdmin";
import { POSICOES, POSICOES_B, type PosicaoId } from "../lib/times";
import { MensagemEstado } from "../components/Estado";

export function NovoJogador() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState("");
  const [nome, setNome] = useState("");
  const [posicao, setPosicao] = useState<PosicaoId>("meia");
  const [posicaoB, setPosicaoB] = useState<PosicaoId>("meia");
  const [isAdminNovo, setIsAdminNovo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (!isAdmin) return <Navigate to="/" replace />;

  function avancarParaPasso2() {
    setErro(null);
    if (!username.trim() || !nome.trim()) {
      setErro("Preencha usuário e nome para prosseguir.");
      return;
    }
    setStep(2);
  }

  function avancarParaPasso3() {
    setStep(3);
  }

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
      setErro("Preencha usuário e nome.");
      return;
    }

    setCriando(true);
    const { data, error } = await supabase.rpc("criar_jogador", {
      p_username: username.trim(),
      p_nome: nome.trim(),
      p_posicao: posicao,
      p_is_admin: isAdminNovo,
      p_posicao_b: posicao === "goleiro" ? null : posicaoB,
    });
    setCriando(false);

    if (error) {
      if (error.code === "23505") {
        setErro(`Já existe um jogador com o usuário "${username.trim()}".`);
        setStep(1);
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
    setPosicaoB("meia");
    setIsAdminNovo(false);
    setStep(1);
  }

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4">
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
          Passo {step} de 3 —{" "}
          {step === 1
            ? "Identificação"
            : step === 2
            ? "Posições & Permissões"
            : "Revisão & Confirmação"}
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="flex items-center gap-1.5 w-full">
        <div
          className={`h-1.5 flex-1 rounded-full transition-all ${
            step >= 1 ? "bg-green-600 dark:bg-green-500" : "bg-neutral-200 dark:bg-neutral-800"
          }`}
        />
        <div
          className={`h-1.5 flex-1 rounded-full transition-all ${
            step >= 2 ? "bg-green-600 dark:bg-green-500" : "bg-neutral-200 dark:bg-neutral-800"
          }`}
        />
        <div
          className={`h-1.5 flex-1 rounded-full transition-all ${
            step >= 3 ? "bg-green-600 dark:bg-green-500" : "bg-neutral-200 dark:bg-neutral-800"
          }`}
        />
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {ok && <MensagemEstado tipo="sucesso">{ok}</MensagemEstado>}

      <form onSubmit={criar} className="space-y-4">
        {/* Step 1: Identificação */}
        {step === 1 && (
          <div className="space-y-3">
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
                placeholder="ex: joaosilva"
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
                autoCapitalize="words"
                placeholder="ex: João Silva"
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                required
              />
            </label>

            <button
              type="button"
              onClick={avancarParaPasso2}
              className="w-full rounded-lg bg-green-600 hover:bg-green-700 dark:bg-green-600 px-4 py-2.5 font-medium text-white transition"
            >
              Próximo: Posições →
            </button>
          </div>
        )}

        {/* Step 2: Posições & Permissões */}
        {step === 2 && (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Posição principal
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

            <label className="block">
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Posição secundária{posicao === "goleiro" ? " (goleiro não tem)" : ""}
              </span>
              <select
                value={posicaoB}
                onChange={(e) => setPosicaoB(e.target.value as PosicaoId)}
                disabled={posicao === "goleiro"}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
              >
                {(Object.keys(POSICOES_B) as (keyof typeof POSICOES_B)[]).map((p) => (
                  <option key={p} value={p}>
                    {POSICOES_B[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 pt-1">
              <input
                type="checkbox"
                checked={isAdminNovo}
                onChange={(e) => setIsAdminNovo(e.target.checked)}
                className="accent-green-600 w-4 h-4 rounded"
              />
              É administrador (pode criar/editar partidas)
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 font-medium text-neutral-700 dark:text-neutral-300"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={avancarParaPasso3}
                className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 dark:bg-green-600 px-4 py-2.5 font-medium text-white transition"
              >
                Revisar →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Resumo & Confirmação */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <span className="text-neutral-500 dark:text-neutral-400">Usuário:</span>
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">{username}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <span className="text-neutral-500 dark:text-neutral-400">Nome:</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{nome}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <span className="text-neutral-500 dark:text-neutral-400">Posição:</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {POSICOES[posicao]}
                  {posicao !== "goleiro" && ` / ${POSICOES_B[posicaoB as keyof typeof POSICOES_B]}`}
                </span>
              </div>
              <div className="flex justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <span className="text-neutral-500 dark:text-neutral-400">Permissão:</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {isAdminNovo ? "Administrador" : "Jogador comum"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <div>
                  <span className="text-neutral-500 dark:text-neutral-400 block text-xs">Senha padrão:</span>
                  <code className="font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">123</code>
                </div>
                <button
                  type="button"
                  onClick={copiarSenhaPadrao}
                  className="text-xs px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition"
                >
                  {copiado ? "Copiado! ✓" : "Copiar senha"}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 font-medium text-neutral-700 dark:text-neutral-300"
              >
                ← Voltar
              </button>
              <button
                type="submit"
                disabled={criando}
                className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 dark:bg-green-600 px-4 py-2.5 font-medium text-white disabled:opacity-50 transition"
              >
                {criando ? "Criando…" : "Confirmar & Criar"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
