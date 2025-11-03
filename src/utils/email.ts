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

// Template de e-mail padrão
export function emailTemplate(content: string) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #f4f4f4; padding: 20px; border-radius: 8px; }
        .header { background-color: #f47373; color: white; padding: 10px; text-align: center; }
        .content { background-color: white; padding: 20px; border-radius: 8px; }
        .footer { text-align: center; color: #777; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SemEstress</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} SemEstress. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
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
    
    console.log('Sending email:', { to, subject, from }); // Log detalhado

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Email sending error (Resend):', JSON.stringify(error, null, 2));
      return { success: false, error };
    }

    console.log('Email sent successfully:', data); // Log de sucesso
    return { success: true, data };
  } catch (error) {
    console.error('Unexpected email sending error:', error);
    return { success: false, error };
  }
}

// E-mail de redefinição de senha
export async function sendPasswordResetEmail(options: {
  to: string;
  resetLink: string;
}) {
  const { to, resetLink } = options;
  
  console.log('Preparing password reset email:', { to, resetLink }); // Log adicional

  const content = `
    <h2>Redefinição de Senha</h2>
    <p>Você solicitou a redefinição de senha para sua conta SemEstress.</p>
    <p>Clique no botão abaixo para definir uma nova senha:</p>
    <a href="${resetLink}" style="display: inline-block; background-color: #f47373; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
    <p>Se você não solicitou esta redefinição, ignore este e-mail.</p>
    <p>O link expirará em 1 hora.</p>
  `;

  // Adicionar validação de e-mail
  if (!to || !to.includes('@')) {
    console.error('Invalid email address:', to);
    return { 
      success: false, 
      error: { message: 'Invalid email address' } 
    };
  }

  return sendEmail({
    to,
    subject: 'Redefinição de Senha - SemEstress',
    html: emailTemplate(content),
    from: 'SemEstress <noreply@semestress.com.br>' // Domínio personalizado
  });
}

// Resto do código mantido igual...