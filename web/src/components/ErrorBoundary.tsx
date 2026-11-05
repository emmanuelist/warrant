import { Component, type ReactNode } from "react";

/** A render error would otherwise leave a blank page, with nothing saying the money isn't affected. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  override state = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override render() {
    if (this.state.message === null) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold text-iron">This page hit an error drawing itself.</h1>
        <p className="text-iron-2">
          What you hold isn't on this page. Collateral and positions stay on chain, and every refusal and payout rule still applies. Reload to try
          again.
        </p>
        <p className="break-words text-meta text-iron-2">{this.state.message}</p>
        <button type="button" className="self-start font-medium text-iron underline underline-offset-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
