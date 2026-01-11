import { toast } from "sonner";

/**
 * Exibe mensagem de sucesso
 */
export const showSuccess = (message: string) => {
  toast.success(message);
};

/**
 * Exibe mensagem de erro para o usuário
 * 
 * @param message - Mensagem amigável para exibir ao usuário
 * @param technicalError - Erro técnico para log no console (não exibido ao usuário)
 */
export const showError = (message: string, technicalError?: unknown) => {
  // Log técnico para debugging (só aparece no console)
  if (technicalError) {
    console.error("[Error]", message, technicalError);
  }
  toast.error(message);
};

/**
 * Helper para erros de API/banco que não devem vazar detalhes técnicos
 * 
 * Uso:
 * ```
 * showUserError(GUEST_MESSAGES.error.GENERIC, apiError);
 * ```
 * 
 * @param userMessage - Mensagem amigável para o usuário
 * @param error - Objeto de erro com detalhes técnicos (logado no console)
 */
export const showUserError = (
  userMessage: string,
  error?: { message?: string } | unknown
) => {
  const errorMessage = error && typeof error === 'object' && 'message' in error
    ? (error as { message: string }).message
    : String(error || 'Unknown error');

  console.error("[Technical Error]", errorMessage);
  toast.error(userMessage);
};

/**
 * Exibe toast de loading e retorna ID para dismiss posterior
 */
export const showLoading = (message: string) => {
  return toast.loading(message);
};

/**
 * Dispensa um toast específico pelo ID
 */
export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};
