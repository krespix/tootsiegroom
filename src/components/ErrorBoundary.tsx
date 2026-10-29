import { Component, type ReactNode } from "react";

/** Instead of a white screen, a crashed page offers a reload; the data itself is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <CrashScreen error={error} onHome={() => this.setState({ error: null })} />;
  }
}

export function CrashScreen({ error, onHome }: { error: unknown; onHome?: () => void }) {
  return (
    <div className="crash" role="alert">
      <div className="empty">
        <span>
          <b className="ink">Что-то пошло не так</b>
          <br />
          Данные на месте — просто перезагрузи страницу.
        </span>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Перезагрузить
          </button>
          {onHome && (
            <button
              className="btn"
              onClick={() => {
                window.location.hash = "#/";
                onHome();
              }}
            >
              На главную
            </button>
          )}
        </div>
        <details className="tiny" style={{ maxWidth: "100%", textAlign: "left" }}>
          <summary>Подробности для Феди</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{String((error as Error)?.stack ?? error)}</pre>
        </details>
      </div>
    </div>
  );
}
