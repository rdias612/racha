import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-fundo text-giz text-center">
          <div className="w-full max-w-md rounded-[4px] border border-borda bg-superficie shadow-carimbo-preto p-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-perigo/15 text-perigo border border-perigo/30 text-[10px] font-mono uppercase tracking-widest mb-3">
              Falha de Execução
            </div>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider mb-2 text-giz">
              Ops! Ocorreu um erro no aplicativo.
            </h2>
            <p className="text-sm text-giz-fraco mb-6 max-w-sm mx-auto font-sans">
              {this.state.error?.message || 'Erro inesperado ao renderizar a tela.'}
            </p>
            <button
              type="button"
              onClick={() => (window.location.href = '/')}
              className="min-h-[44px] inline-flex items-center justify-center rounded-[4px] bg-destaque px-5 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 transition active:translate-y-px cursor-pointer"
            >
              Voltar para o início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
