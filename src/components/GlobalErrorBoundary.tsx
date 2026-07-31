import React, { Component, ReactNode } from "react";
import { reportErrorToTelegram } from "@/services/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Explicitly send crash to Telegram (bypassing console.error interceptors just in case)
    reportErrorToTelegram({
      error_message: `[REACT CRASH] ${error.message}`,
      stack_trace: `${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`,
      url: window.location.href,
      additional_info: {
        type: "GlobalErrorBoundary",
        componentStack: errorInfo.componentStack
      }
    }, "Painel Lojista");
    
    // Forçar remoção do carregar se houver crash
    const splash = document.getElementById("splash-screen");
    if (splash) splash.remove();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", background: "white", color: "#d32f2f", height: "100vh", width: "100vw", overflow: "auto", fontFamily: "sans-serif", zIndex: 999999, position: "fixed", top: 0, left: 0 }}>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "10px" }}>Ocorreu um Erro no Aplicativo</h1>
          <pre style={{ background: "#fff", padding: "10px", marginTop: "10px", borderRadius: "5px", border: "1px solid red", fontSize: "11px", whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
            {"\n\n"}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          
          <div style={{ padding: "14px", background: "#fff3cd", color: "#856404", borderRadius: "8px", border: "1px solid #ffeeba", fontWeight: "bold", margin: "16px 0", fontSize: "14px" }}>
            ⚠️ TIRE UM PRINT OU COPIE A TELA E ENVIE PARA A BONASOFT.
          </div>

          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: "10px", padding: "12px 24px", background: "black", color: "white", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", border: "none" }}
          >
            Limpar Dados e Reiniciar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
