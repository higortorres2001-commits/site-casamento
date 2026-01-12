/**
 * Centralized Messages System
 * 
 * Organizado por tipo de usuário:
 * - GUEST_MESSAGES: Para convidados (páginas públicas)
 * - ADMIN_MESSAGES: Para o casal (páginas privadas)
 * - AUTH_MESSAGES: Autenticação (compartilhado)
 * - VALIDATION_MESSAGES: Validações de formulários
 */

// ============================================================================
// GUEST MESSAGES - Para convidados em páginas públicas
// ============================================================================
export const GUEST_MESSAGES = {
    success: {
        GIFT_SENT: "Presente enviado com sucesso! 🎁",
        RESERVATION_CREATED: "Reserva confirmada!",
        PAYMENT_CONFIRMED: "Pagamento confirmado!",
        ORDER_CREATED: "Pedido criado! Aguardando confirmação.",
        RSVP_SENT: "Sua resposta foi enviada com sucesso!",
        MESSAGE_SENT: "Sua mensagem foi enviada!",
    },
    error: {
        GIFT_NOT_FOUND: "Presente não encontrado.",
        GIFT_UNAVAILABLE: "Este presente não está mais disponível.",
        LIST_NOT_FOUND: "Lista de presentes não encontrada.",
        PAYMENT_FAILED: "Não foi possível processar o pagamento. Tente novamente.",
        RESERVATION_FAILED: "Erro ao criar reserva. Tente novamente.",
        LOAD_GIFT_FAILED: "Erro ao carregar presente.",
        LOAD_LIST_FAILED: "Erro ao carregar lista de presentes.",
        RSVP_DUPLICATE: "Você já confirmou presença com este email!",
        RSVP_FAILED: "Erro ao enviar resposta. Tente novamente.",
        MESSAGE_FAILED: "Erro ao enviar mensagem. Tente novamente.",
        // Generic fallback - use quando não quiser expor detalhes técnicos
        GENERIC: "Ocorreu um erro. Por favor, tente novamente.",
    },
} as const;

// ============================================================================
// ADMIN MESSAGES - Para o casal/administradores
// ============================================================================
export const ADMIN_MESSAGES = {
    success: {
        // Gifts
        GIFT_CREATED: "Presente adicionado!",
        GIFT_UPDATED: "Presente atualizado!",
        GIFT_DELETED: "Presente excluído!",
        // Settings
        SETTINGS_SAVED: "Configurações salvas!",
        LIST_UPDATED: "Lista atualizada com sucesso!",
        LIST_CREATED: "Lista criada com sucesso!",
        // General
        LINK_COPIED: "Link copiado!",
        DATA_SAVED: "Dados salvos com sucesso!",
        // Guests
        GUEST_SAVED: "Convidado salvo com sucesso!",
        GUEST_DELETED: "Convidado removido!",
        ENVELOPE_SAVED: "Envelope salvo com sucesso!",
        ENVELOPE_UPDATED: "Envelope atualizado!",
        // Products (admin)
        PRODUCT_CREATED: "Produto criado com sucesso!",
        PRODUCT_UPDATED: "Detalhes do produto atualizados!",
        PRODUCT_DELETED: "Produto excluído com sucesso!",
        // Coupons
        COUPON_CREATED: "Cupom criado com sucesso!",
        COUPON_UPDATED: "Cupom atualizado com sucesso!",
        COUPON_DELETED: "Cupom excluído com sucesso!",
        COUPON_TOGGLED: (active: boolean) =>
            `Cupom ${active ? "ativado" : "desativado"} com sucesso!`,
        // Export
        EXPORT_SUCCESS: "Relatório exportado com sucesso!",
    },
    error: {
        LOAD_FAILED: "Erro ao carregar dados.",
        SAVE_FAILED: "Erro ao salvar.",
        DELETE_FAILED: "Erro ao excluir.",
        UPDATE_FAILED: "Erro ao atualizar.",
        UNAUTHORIZED: "Você não tem permissão para esta ação.",
        // Specific
        LOAD_LIST_FAILED: "Erro ao carregar lista.",
        LOAD_GIFTS_FAILED: "Erro ao carregar presentes.",
        LOAD_GUESTS_FAILED: "Erro ao carregar convidados.",
        SAVE_GIFT_FAILED: "Erro ao salvar presente.",
        DELETE_GIFT_FAILED: "Erro ao excluir presente.",
        // Products
        LOAD_PRODUCTS_FAILED: "Erro ao carregar produtos.",
        SAVE_PRODUCT_FAILED: "Erro ao salvar produto.",
        DELETE_PRODUCT_FAILED: "Erro ao excluir produto.",
        // Profile
        LOAD_PROFILE_FAILED: "Erro ao carregar seu perfil.",
    },
} as const;

// ============================================================================
// AUTH MESSAGES - Autenticação (compartilhado)
// ============================================================================
export const AUTH_MESSAGES = {
    success: {
        LOGIN: "Login realizado com sucesso!",
        LOGOUT: "Você foi desconectado.",
        PASSWORD_RESET: "Senha redefinida com sucesso!",
        PASSWORD_UPDATED: "Senha atualizada com sucesso! Você será redirecionado.",
        REGISTER: "Cadastro concluído com sucesso!",
        REGISTER_STEP1: "Dados pessoais salvos! Complete seu endereço.",
        PASSWORD_RESET_EMAIL: "Link de recuperação enviado para seu email!",
    },
    error: {
        LOGIN_FAILED: "Email ou senha incorretos.",
        SESSION_EXPIRED: "Sua sessão expirou. Faça login novamente.",
        NOT_LOGGED_IN: "Você precisa estar logado para realizar esta ação.",
        PASSWORD_UPDATE_FAILED: "Erro ao atualizar a senha.",
        REGISTER_FAILED: "Erro ao criar conta.",
        PROFILE_SAVE_FAILED: "Erro ao salvar dados do perfil.",
        PASSWORD_RESET_FAILED: "Erro ao solicitar redefinição de senha.",
    },
} as const;

// ============================================================================
// VALIDATION MESSAGES - Validações de formulários
// ============================================================================
export const VALIDATION_MESSAGES = {
    REQUIRED_FIELDS: "Por favor, preencha todos os campos obrigatórios.",
    INVALID_EMAIL: "Por favor, insira um email válido.",
    INVALID_CPF: "CPF inválido.",
    INVALID_PHONE: "Telefone inválido.",
    PASSWORDS_MISMATCH: "As senhas não coincidem.",
    MIN_GUESTS: "Adicione pelo menos um convidado com nome.",
    GROUP_NAME_REQUIRED: "Nome do grupo é obrigatório.",
    CARD_FIELDS_REQUIRED: "Por favor, preencha todos os campos do cartão.",
} as const;

// ============================================================================
// UI MESSAGES - Mensagens inline em componentes (não toast)
// ============================================================================
export const UI_MESSAGES = {
    loading: {
        GIFT_LIST: "Carregando lista de presentes...",
        GIFT: "Carregando presente...",
        DATA: "Carregando...",
    },
    emptyState: {
        NO_GIFTS_YET: "O casal ainda está montando a lista. Volte em breve!",
        NO_GIFTS_CATEGORY: "Nenhum presente encontrado nesta categoria.",
        NO_ACTIVITY: "Nenhuma atividade ainda.",
        SHARE_TO_START: "Compartilhe sua lista para começar!",
    },
    rsvp: {
        TITLE: "Confirme sua Presença"
    },
    notFound: {
        LIST_TITLE: "Lista não encontrada",
        LIST_DESCRIPTION: "Esta lista de presentes não existe ou não está disponível publicamente.",
        GIFT_TITLE: "Presente não encontrado.",
        BACK_HOME: "Voltar ao início",
    },
} as const;

// ============================================================================
// Helper Types
// ============================================================================
export type GuestErrorKey = keyof typeof GUEST_MESSAGES.error;
export type GuestSuccessKey = keyof typeof GUEST_MESSAGES.success;
export type AdminErrorKey = keyof typeof ADMIN_MESSAGES.error;
export type AdminSuccessKey = keyof typeof ADMIN_MESSAGES.success;
export type AuthErrorKey = keyof typeof AUTH_MESSAGES.error;
export type AuthSuccessKey = keyof typeof AUTH_MESSAGES.success;

