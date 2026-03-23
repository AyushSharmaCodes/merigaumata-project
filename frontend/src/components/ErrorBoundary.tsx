import React, { ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/logger";
import { Translation } from "react-i18next";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error(`React Error: ${error.message}`, {
            component: "ErrorBoundary",
            action: "RENDER_ERROR",
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <Translation>
                    {(t) => (
                        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                            <div className="max-w-md w-full text-center">
                                <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('common.errorBoundary.title')}</h1>
                                <p className="text-gray-600 mb-6">
                                    {t('common.errorBoundary.desc')}
                                </p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
                                >
                                    {t('common.errorBoundary.retry')}
                                </button>
                            </div>
                        </div>
                    )}
                </Translation>
            );
        }

        return this.props.children;
    }
}
