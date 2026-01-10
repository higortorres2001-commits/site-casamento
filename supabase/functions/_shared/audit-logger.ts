/**
 * AuditLogger - Sistema de Logging Auditável para Disputas e Chargebacks
 * 
 * Este logger adiciona campos forenses necessários para:
 * - Provas em chargebacks de cartão de crédito
 * - Disputas com clientes
 * - Compliance e auditoria
 */

/**
 * Interface para dados forenses
 */
export interface ForensicData {
    ip_address?: string;
    user_agent?: string;
    origin?: string;
}

/**
 * Interface para contexto de auditoria
 */
export interface AuditContext {
    correlation_id: string;
    user_id?: string;
    order_id?: string;
    payment_id?: string;
    customer_email?: string;
    forensic?: ForensicData;
}

/**
 * Interface para entrada de log de auditoria
 */
export interface AuditLogEntry {
    level: 'info' | 'warning' | 'error';
    context: string;
    message: string;
    metadata?: Record<string, any>;
    // Campos de auditoria
    correlation_id: string;
    user_id?: string;
    order_id?: string;
    payment_id?: string;
    customer_email?: string;
    ip_address?: string;
    user_agent?: string;
    log_hash?: string;
}

/**
 * Gera um UUID v4 para correlation_id
 */
export function generateCorrelationId(): string {
    return crypto.randomUUID();
}

/**
 * Gera hash SHA-256 para integridade do log
 */
export async function generateLogHash(entry: Omit<AuditLogEntry, 'log_hash'>): Promise<string> {
    const content = JSON.stringify({
        level: entry.level,
        context: entry.context,
        message: entry.message,
        metadata: entry.metadata,
        correlation_id: entry.correlation_id,
        user_id: entry.user_id,
        order_id: entry.order_id,
        payment_id: entry.payment_id,
        customer_email: entry.customer_email,
        timestamp: new Date().toISOString()
    });

    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extrai dados forenses de uma requisição HTTP
 */
export function extractForensicData(req: Request): ForensicData {
    return {
        ip_address: req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        origin: req.headers.get('origin') || 'unknown'
    };
}

/**
 * Classe AuditLogger para logging auditável
 */
export class AuditLogger {
    private supabase: any;
    private baseContext: string;
    private auditContext: AuditContext;
    private forensicData: ForensicData;

    constructor(
        supabase: any,
        baseContext: string,
        options?: {
            correlationId?: string;
            userId?: string;
            orderId?: string;
            paymentId?: string;
            customerEmail?: string;
            forensicData?: ForensicData;
        }
    ) {
        this.supabase = supabase;
        this.baseContext = baseContext;
        this.auditContext = {
            correlation_id: options?.correlationId || generateCorrelationId(),
            user_id: options?.userId,
            order_id: options?.orderId,
            payment_id: options?.paymentId,
            customer_email: options?.customerEmail,
        };
        this.forensicData = options?.forensicData || {};
    }

    /**
     * Retorna o correlation_id atual
     */
    getCorrelationId(): string {
        return this.auditContext.correlation_id;
    }

    /**
     * Atualiza o contexto de auditoria
     */
    updateContext(updates: Partial<AuditContext>): void {
        this.auditContext = { ...this.auditContext, ...updates };
    }

    /**
     * Define o user_id
     */
    setUserId(userId: string): void {
        this.auditContext.user_id = userId;
    }

    /**
     * Define o order_id
     */
    setOrderId(orderId: string): void {
        this.auditContext.order_id = orderId;
    }

    /**
     * Define o payment_id
     */
    setPaymentId(paymentId: string): void {
        this.auditContext.payment_id = paymentId;
    }

    /**
     * Define o email do cliente
     */
    setCustomerEmail(email: string): void {
        this.auditContext.customer_email = email?.toLowerCase().trim();
    }

    /**
     * Cria entrada de log com todos os campos de auditoria
     */
    private async createLogEntry(
        level: 'info' | 'warning' | 'error',
        message: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        const entry: AuditLogEntry = {
            level,
            context: this.baseContext,
            message,
            metadata: {
                ...metadata,
                // Sempre incluir timestamp ISO para precisão
                _audit_timestamp: new Date().toISOString(),
                _audit_version: '1.0'
            },
            correlation_id: this.auditContext.correlation_id,
            user_id: this.auditContext.user_id,
            order_id: this.auditContext.order_id,
            payment_id: this.auditContext.payment_id,
            customer_email: this.auditContext.customer_email,
            ip_address: this.forensicData.ip_address,
            user_agent: this.forensicData.user_agent,
        };

        // Gerar hash de integridade
        const log_hash = await generateLogHash(entry);

        // Inserir no banco com todos os campos
        const { error } = await this.supabase.from('logs').insert({
            level: entry.level,
            context: entry.context,
            message: entry.message,
            metadata: {
                ...entry.metadata,
                // Campos de auditoria no metadata para compatibilidade
                _correlation_id: entry.correlation_id,
                _user_id: entry.user_id,
                _order_id: entry.order_id,
                _payment_id: entry.payment_id,
                _customer_email: entry.customer_email,
                _ip_address: entry.ip_address,
                _user_agent: entry.user_agent,
                _log_hash: log_hash,
                _forensic: {
                    ip: entry.ip_address,
                    ua: entry.user_agent,
                    origin: this.forensicData.origin
                }
            }
        });

        if (error) {
            console.error('[AuditLogger] Failed to write log:', error);
        }
    }

    /**
     * Log de informação
     */
    async info(message: string, metadata?: Record<string, any>): Promise<void> {
        await this.createLogEntry('info', message, metadata);
    }

    /**
     * Log de aviso
     */
    async warning(message: string, metadata?: Record<string, any>): Promise<void> {
        await this.createLogEntry('warning', message, metadata);
    }

    /**
     * Log de erro
     */
    async error(message: string, metadata?: Record<string, any>): Promise<void> {
        await this.createLogEntry('error', message, metadata);
    }

    /**
     * Log crítico - aguarda confirmação de escrita
     */
    async critical(message: string, metadata?: Record<string, any>): Promise<void> {
        const entry: AuditLogEntry = {
            level: 'error',
            context: this.baseContext,
            message: `CRITICAL: ${message}`,
            metadata: {
                ...metadata,
                CRITICAL: true,
                REQUIRES_IMMEDIATE_ACTION: true,
                _audit_timestamp: new Date().toISOString(),
                _audit_version: '1.0'
            },
            correlation_id: this.auditContext.correlation_id,
            user_id: this.auditContext.user_id,
            order_id: this.auditContext.order_id,
            payment_id: this.auditContext.payment_id,
            customer_email: this.auditContext.customer_email,
            ip_address: this.forensicData.ip_address,
            user_agent: this.forensicData.user_agent,
        };

        const log_hash = await generateLogHash(entry);

        // Usar await para garantir que log crítico seja salvo
        await this.supabase.from('logs').insert({
            level: entry.level,
            context: entry.context,
            message: entry.message,
            metadata: {
                ...entry.metadata,
                _correlation_id: entry.correlation_id,
                _user_id: entry.user_id,
                _order_id: entry.order_id,
                _payment_id: entry.payment_id,
                _customer_email: entry.customer_email,
                _ip_address: entry.ip_address,
                _user_agent: entry.user_agent,
                _log_hash: log_hash,
                _forensic: {
                    ip: entry.ip_address,
                    ua: entry.user_agent,
                    origin: this.forensicData.origin
                }
            }
        });
    }

    // ============================================
    // MÉTODOS ESPECIALIZADOS PARA AUDITORIA
    // ============================================

    /**
     * Log específico para início de checkout
     */
    async logCheckoutStarted(data: {
        productIds: string[];
        customerEmail: string;
        totalPrice: number;
        couponCode?: string;
    }): Promise<void> {
        this.setCustomerEmail(data.customerEmail);
        await this.info('Checkout iniciado pelo cliente', {
            event_type: 'CHECKOUT_STARTED',
            product_ids: data.productIds,
            total_price: data.totalPrice,
            coupon_code: data.couponCode || null,
            products_count: data.productIds.length
        });
    }

    /**
     * Log específico para pagamento criado
     */
    async logPaymentCreated(data: {
        paymentId: string;
        orderId: string;
        method: 'PIX' | 'CREDIT_CARD';
        amount: number;
        customerEmail: string;
    }): Promise<void> {
        this.setPaymentId(data.paymentId);
        this.setOrderId(data.orderId);
        this.setCustomerEmail(data.customerEmail);

        await this.info('Pagamento criado na gateway', {
            event_type: 'PAYMENT_CREATED',
            payment_id: data.paymentId,
            order_id: data.orderId,
            payment_method: data.method,
            amount: data.amount,
            amount_formatted: `R$ ${data.amount.toFixed(2)}`
        });
    }

    /**
     * Log específico para pagamento confirmado
     */
    async logPaymentConfirmed(data: {
        paymentId: string;
        orderId: string;
        method: 'PIX' | 'CREDIT_CARD';
        amount: number;
        customerEmail: string;
        gatewayResponse?: any;
    }): Promise<void> {
        this.setPaymentId(data.paymentId);
        this.setOrderId(data.orderId);
        this.setCustomerEmail(data.customerEmail);

        await this.info('PAGAMENTO CONFIRMADO - Transação concluída com sucesso', {
            event_type: 'PAYMENT_CONFIRMED',
            payment_id: data.paymentId,
            order_id: data.orderId,
            payment_method: data.method,
            amount: data.amount,
            amount_formatted: `R$ ${data.amount.toFixed(2)}`,
            gateway_response: data.gatewayResponse,
            // Timestamp explícito para disputas
            confirmed_at: new Date().toISOString()
        });
    }

    /**
     * Log específico para acesso liberado
     */
    async logAccessGranted(data: {
        userId: string;
        productIds: string[];
        orderId: string;
        customerEmail: string;
    }): Promise<void> {
        this.setUserId(data.userId);
        this.setOrderId(data.orderId);
        this.setCustomerEmail(data.customerEmail);

        await this.info('Acesso aos produtos liberado para o cliente', {
            event_type: 'ACCESS_GRANTED',
            user_id: data.userId,
            product_ids: data.productIds,
            products_count: data.productIds.length,
            granted_at: new Date().toISOString()
        });
    }

    /**
     * Log específico para email de acesso enviado
     */
    async logAccessEmailSent(data: {
        customerEmail: string;
        orderId: string;
        success: boolean;
        errorMessage?: string;
    }): Promise<void> {
        this.setOrderId(data.orderId);
        this.setCustomerEmail(data.customerEmail);

        if (data.success) {
            await this.info('Email de acesso enviado ao cliente', {
                event_type: 'ACCESS_EMAIL_SENT',
                recipient: data.customerEmail,
                sent_at: new Date().toISOString()
            });
        } else {
            await this.warning('Falha ao enviar email de acesso', {
                event_type: 'ACCESS_EMAIL_FAILED',
                recipient: data.customerEmail,
                error: data.errorMessage
            });
        }
    }

    /**
     * Log específico para webhook recebido
     */
    async logWebhookReceived(data: {
        event: string;
        paymentId: string;
        rawPayload?: any;
    }): Promise<void> {
        this.setPaymentId(data.paymentId);

        await this.info(`Webhook recebido: ${data.event}`, {
            event_type: 'WEBHOOK_RECEIVED',
            webhook_event: data.event,
            payment_id: data.paymentId,
            received_at: new Date().toISOString(),
            // Não logar payload completo por segurança, apenas eventos importantes
            payload_summary: data.rawPayload ? {
                event: data.rawPayload.event,
                payment_status: data.rawPayload.payment?.status
            } : null
        });
    }
}

/**
 * Cria uma instância de AuditLogger a partir de uma requisição HTTP
 */
export function createAuditLoggerFromRequest(
    supabase: any,
    context: string,
    req: Request,
    options?: {
        correlationId?: string;
        userId?: string;
        orderId?: string;
        paymentId?: string;
        customerEmail?: string;
    }
): AuditLogger {
    const forensicData = extractForensicData(req);

    return new AuditLogger(supabase, context, {
        ...options,
        forensicData
    });
}
