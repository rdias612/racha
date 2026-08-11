import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React component tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-center">
          <h2 className="text-xl font-bold mb-2">Ops! Ocorreu um erro no aplicativo.</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 max-w-md">
            {this.state.error?.message || "Erro inesperado ao renderizar a tela."}
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="rounded-lg bg-[var(--cor-destaque)] px-4 py-2 text-sm font-medium text-white shadow hover:opacity-90 transition"
          >
            Voltar para o início
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
