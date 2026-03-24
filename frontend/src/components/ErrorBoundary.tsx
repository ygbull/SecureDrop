import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-error/20 bg-error/5 p-8 text-center animate-fadeInUp">
          <p className="text-error font-medium">Something broke</p>
          <p className="text-text-secondary text-sm mt-2">
            Try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 py-2 px-4 rounded-lg text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-all duration-200"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
