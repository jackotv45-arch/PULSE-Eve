import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; section: string };
type State = { error: Error | null };

/** Keeps a render failure in one admin panel from taking down the whole back-office. */
export class AdminSectionBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Admin] Erreur dans ${this.props.section}`, error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="adm-card" role="alert" style={{ marginTop: 0 }}>
        <div className="eyebrow green">{this.props.section}</div>
        <h3>Cette section n’a pas pu être chargée.</h3>
        <p className="muted">L’administration reste disponible. Réessayez cette section.</p>
        <button className="adm-btn" onClick={() => this.setState({ error: null })}>
          Réessayer la section
        </button>
      </div>
    );
  }
}
