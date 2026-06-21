'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react';
import { useAppStore } from '@/store/app-store';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught rendering error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback onRetry={this.handleReset} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const handleGoToDashboard = () => {
    setCurrentView('dashboard');
    onRetry();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-eci-grey-light p-4">
      <Card className="max-w-lg w-full shadow-lg border-0">
        <CardContent className="flex flex-col items-center text-center p-8 md:p-10">
          {/* ECI Logo */}
          <div className="mb-6">
            <img
              src="/eci-logo.jpg"
              alt="ECI Logo"
              className="w-20 h-20 rounded-full object-contain"
            />
          </div>

          {/* Error icon */}
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>

          {/* Heading */}
          <h1 className="text-xl font-bold text-eci-blue mb-2">
            Something went wrong
          </h1>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
            We&apos;re having trouble loading this section. This may be a temporary connection issue.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              onClick={onRetry}
              className="flex-1 eci-btn-primary"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={handleGoToDashboard}
              className="flex-1"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
