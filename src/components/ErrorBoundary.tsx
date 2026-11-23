import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F17] p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#111827] border border-rose-300 dark:border-rose-900/60 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Application Error
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  A data or rendering operation failed. Details are shown below for verification.
                </p>
                <pre className="mt-3 p-3 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-rose-700 dark:text-rose-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {this.state.message}
                </pre>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Recover View
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
