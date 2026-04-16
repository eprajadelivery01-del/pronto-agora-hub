import React, { Component, ReactNode } from "react";

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
    
    // Forçar remoção do carregar se houver crash
    const splash = document.getElementById("splash-screen");
    if (splash) splash.remove();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", background: "#f8d7da", color: "#721c24", height: "100vh", overflow: "auto", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>A interface quebrou (React Crash)</h1>
          <p>Tire um print ou copie o texto abaixo e envie para a Bonasoft:</p>
          <pre style={{ background: "#fff", padding: "10px", marginTop: "10px", borderRadius: "5px", border: "1px solid red" }}>
            {this.state.error && this.state.error.toString()}
            {"\n\n"}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
