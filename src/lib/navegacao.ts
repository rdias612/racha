import type { NavigateFunction } from "react-router-dom";

/**
 * Helper de navegação com fallback para deep-links e notificações push.
 * Se o usuário entrou direto na tela (ex: via push) e o histórico está vazio,
 * redireciona com segurança para a rota de fallback em vez de travar ou fechar o app.
 */
export function voltar(navigate: NavigateFunction, fallback: string = "/") {
  if (typeof window !== "undefined" && window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
    navigate(-1);
  } else {
    navigate(fallback);
  }
}
