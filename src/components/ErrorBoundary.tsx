import { Component, type ErrorInfo, type ReactNode } from 'react';

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
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-fundo text-giz text-center">
          <h2 className="text-xl font-display font-bold uppercase tracking-wider mb-2 text-giz">
            Ops! Ocorreu um erro no aplicativo.
          </h2>
          <p className="text-sm text-giz-fraco mb-4 max-w-md font-sans">
            {this.state.error?.message || 'Erro inesperado ao renderizar a tela.'}
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            className="min-h-[44px] inline-flex items-center justify-center rounded-[4px] bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px cursor-pointer"
          >
            Voltar para o início
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
