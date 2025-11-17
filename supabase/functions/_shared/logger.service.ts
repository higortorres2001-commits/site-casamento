import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

type LogLevel = 'info' | 'warning' | 'error';

/**
 * Logger assíncrono que não bloqueia o fluxo principal
 */
export class Logger {
  private supabase: SupabaseClient;
  private context: string;

  constructor(supabase: SupabaseClient, context: string) {
    this.supabase = supabase;
    this.context = context;
  }

  private async log(level: LogLevel, message: string, metadata?: any): Promise<void> {
    // Fire and forget - não esperar o resultado
    this.supabase.from('logs').insert({
      level,
      context: this.context,
      message,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to write log:', error);
      }
    });
  }

  info(message: string, metadata?: any): void {
    this.log('info', message, metadata);
  }

  warning(message: string, metadata?: any): void {
    this.log('warning', message, metadata);
  }

  error(message: string, metadata?: any): void {
    this.log('error', message, metadata);
  }

  /**
   * Log crítico que DEVE ser gravado (aguarda resultado)
   */
  async critical(message: string, metadata?: any): Promise<void> {
    await this.supabase.from('logs').insert({
      level: 'error',
      context: this.context,
      message: `CRITICAL: ${message}`,
      metadata: {
        ...metadata,
        CRITICAL: true,
        REQUIRES_IMMEDIATE_ACTION: true,
        timestamp: new Date().toISOString()
      }
    });
  }
}