import { Resend } from 'resend';

// Função para obter a chave da API Resend
async function getResendApiKey(): Promise<string> {
  // Primeiro, tenta obter da variável de ambiente
  const envKey = import.meta.env.VITE_RESEND_API_KEY;
  if (envKey) return envKey;

  // Se não estiver no ambiente, tenta buscar do Supabase
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'RESEND_API_KEY')
      .single();

    if (error || !data) {
      console.error('Failed to retrieve Resend API key:', error);
      throw new Error('Resend API key not found');
    }

    return data.value;
  } catch (err) {
    console.error('Error fetching Resend API key:', err);
    throw err;
  }
}

// Função base para enviar e-mails
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  try {
    const apiKey = await getResendApiKey();
    const resend = new Resend(apiKey);

    const { to, subject, html, from = 'SemEstress <onboarding@resend.dev>' } = options;
    
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Email sending error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected email sending error:', error);
    return { success: false, error };
  }
}

// Resto do código mantido igual (templates e outras funções)
// ...