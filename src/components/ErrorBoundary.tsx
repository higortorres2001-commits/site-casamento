
import React from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
}

/**
 * A wrapper component that catches React errors and reports them to Sentry.
 * It also displays a user-friendly fallback UI instead of a white screen.
 */
class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        // Sentry captures this automatically via its integration, 
        // but we can add extra context if needed here.
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
                    <div className="max-w-md space-y-4">
                        <div className="text-4xl mb-2">🤕</div>
                        <h1 className="text-2xl font-bold text-gray-900">Ops! Algo deu errado.</h1>
                        <p className="text-gray-600">
                            Não se preocupe, nossa equipe já foi notificada.
                            Por favor, tente recarregar a página.
                        </p>
                        <Button
                            onClick={() => window.location.reload()}
                            className="bg-pink-500 hover:bg-pink-600 text-white"
                        >
                            Recarregar Página
                        </Button>
                    </div>
                </div>
            );
        }

        // Wrap children with Sentry's Error Boundary for automatic reporting
        return (
            <Sentry.ErrorBoundary fallback={null} showDialog={false}>
                {this.props.children}
            </Sentry.ErrorBoundary>
        );
    }
}

export default ErrorBoundary;
