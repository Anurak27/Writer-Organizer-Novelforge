'use client';
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary caught:', error, info.componentStack); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex-1 flex items-center justify-center bg-zinc-950 p-8">
          <div className="text-center max-w-md">
            <p className="text-red-400 text-lg font-medium mb-2">Something went wrong</p>
            <p className="text-zinc-500 text-sm mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-md">
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
