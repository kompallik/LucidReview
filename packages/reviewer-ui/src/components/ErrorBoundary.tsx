import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center">
          <AlertTriangle size={28} className="mb-3 text-red-400" />
          <h3 className="text-sm font-semibold text-red-800">
            {this.props.fallbackTitle ?? 'Something went wrong'}
          </h3>
          <p className="mt-1 text-xs text-red-600 max-w-xs">
            {this.state.error?.message ?? 'An unexpected error occurred while rendering this section.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
