import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Nombre del módulo (para logs y UI). */
    moduleName?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary genérico que captura errores de renderizado en React.
 * Evita que un fallo en un componente hijo crashee toda la aplicación.
 *
 * @example
 * ```tsx
 * <ErrorBoundary moduleName="Propuestas">
 *   <ProposalItemsBuilder />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error(
            `[ErrorBoundary${this.props.moduleName ? `: ${this.props.moduleName}` : ''}]`,
            error,
            errorInfo.componentStack
        );
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Algo salió mal{this.props.moduleName ? ` en ${this.props.moduleName}` : ''}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-md">
                        Ocurrió un error inesperado. Puedes intentar de nuevo o contactar soporte si el problema persiste.
                    </p>
                    {this.state.error && (
                        <details className="mb-4 text-left w-full max-w-md">
                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition-colors">
                                Detalles técnicos
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-red-600 overflow-auto max-h-32 border border-gray-100">
                                {this.state.error.message}
                            </pre>
                        </details>
                    )}
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent text-white px-5 py-2.5 rounded-xl transition-all text-sm font-medium shadow-lg shadow-novo-primary/30"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span>Intentar de Nuevo</span>
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
