import { Component, ComponentType, PropsWithChildren } from "react";
import { Brain, RotateCcw } from "lucide-react";

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, componentStack: string) => void;
}>;

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary for the web client.
 *
 * React error boundaries MUST be class components — `getDerivedStateFromError`
 * and `componentDidCatch` are not exposed to functional components. See:
 * https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 *
 * Behavior:
 * - Catches any render-phase exception below it and shows a calm, brand-
 *   consistent fallback instead of a white screen.
 * - Forwards the error and component stack to `onError` (we wire this to a
 *   POST to `/api/client-error` so production crashes surface in Datadog).
 * - Lets the user attempt recovery without losing the whole tab.
 *
 * Caveats (by design, matching React's behavior):
 * - Does NOT catch errors inside event handlers, promises, async code, or
 *   server-side rendering. Those still need explicit try/catch or unhandled
 *   rejection listeners.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    if (typeof this.props.onError === "function") {
      try {
        this.props.onError(error, info.componentStack);
      } catch {
        // Never let the error reporter itself crash the fallback.
      }
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const Fallback = this.props.FallbackComponent ?? DefaultErrorFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}

/**
 * Default fallback. Dark luxury aesthetic matched to the landing page so a
 * crash never breaks the brand impression — even on first paint.
 */
function DefaultErrorFallback({ resetError }: ErrorFallbackProps) {
  const handleReload = () => {
    // Reset boundary first (in case the cause was transient and the new
    // render succeeds without a full reload).
    resetError();
    // A real reload is the safest path for a corrupted client state — but
    // we only force it on the second tap.
    if (typeof window !== "undefined" && window.history.state?.__nq_retried) {
      window.location.reload();
    } else if (typeof window !== "undefined") {
      window.history.replaceState({ __nq_retried: true }, "");
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen flex items-center justify-center px-6 bg-[hsl(144,27%,6%)] text-[hsl(60,40%,98%)]"
    >
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(46,62%,52%)]/15 border border-[hsl(46,62%,52%)]/30 mb-6">
          <Brain className="w-8 h-8 text-[hsl(46,62%,62%)]" aria-hidden />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-4">
          A moment of stillness.
        </h1>
        <p className="text-white/65 font-light leading-relaxed mb-8">
          Something briefly fell out of rhythm. Your data is safe — let's reset
          and continue.
        </p>
        <button
          onClick={handleReload}
          className="inline-flex items-center gap-2 bg-[hsl(46,62%,62%)] hover:bg-[hsl(46,62%,70%)] text-[hsl(144,27%,8%)] font-medium px-6 py-3 rounded-full transition-colors"
        >
          <RotateCcw className="w-4 h-4" aria-hidden />
          Try again
        </button>
        <p className="mt-10 text-xs tracking-[0.2em] uppercase text-white/30 font-light">
          If this keeps happening, email support@neuroquestzen.pro
        </p>
      </div>
    </div>
  );
}
