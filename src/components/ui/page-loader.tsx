import React from "react";
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
    message?: string;
}

/**
 * Standardized full-page loading indicator.
 * Use this component consistently across all pages when loading data.
 */
const PageLoader: React.FC<PageLoaderProps> = ({ message = "Carregando..." }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                <p className="text-sm text-gray-500">{message}</p>
            </div>
        </div>
    );
};

export default PageLoader;
