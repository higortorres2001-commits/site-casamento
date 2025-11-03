import { Resend } from 'resend';

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';
const resend = new Resend(RESEND_API_KEY);

// Função base para enviar e-mails
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  try {
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

// E-mail de pedido aprovado
export async function sendOrderApprovedEmail(options: {
  to: string;
  orderDetails: {
    orderId: string;
    totalPrice: number;
    products: string[];
  };
}) {
  const { to, orderDetails } = options;
  const content = `
    <h2>Pedido Aprovado!</h2>
    <p>Parabéns! Seu pedido foi aprovado com sucesso.</p>
    <ul>
      <li><strong>Número do Pedido:</strong> ${orderDetails.orderId}</li>
      <li><strong>Valor Total:</strong> R$ ${orderDetails.totalPrice.toFixed(2)}</li>
      <li><strong>Produtos:</strong> ${orderDetails.products.join(', ')}</li>
    </ul>
    <p>Você já pode acessar seus produtos em nossa plataforma.</p>
    <a href="${window.location.origin}/meus-produtos" style="display: inline-block; background-color: #f47373; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar Meus Produtos</a>
  `;

  return sendEmail({
    to,
    subject: 'Pedido Aprovado - SemEstress',
    html: emailTemplate(content)
  });
}

// E-mail de nova conta criada
export async function sendNewAccountEmail(options: {
  to: string;
  name: string;
  defaultPassword: string;
}) {
  const { to, name, defaultPassword } = options;
  const content = `
    <h2>Bem-vindo ao SemEstress, ${name}!</h2>
    <p>Sua conta foi criada com sucesso.</p>
    <div style="background-color: #f4f4f4; padding: 10px; border-radius: 5px;">
      <p><strong>Email de Acesso:</strong> ${to}</p>
      <p><strong>Senha Padrão:</strong> ${defaultPassword}</p>
    </div>
    <p>Por segurança, recomendamos que você altere sua senha após o primeiro login.</p>
    <a href="${window.location.origin}/login" style="display: inline-block; background-color: #f47373; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Fazer Login</a>
  `;

  return sendEmail({
    to,
    subject: 'Conta Criada - SemEstress',
    html: emailTemplate(content)
  });
}

// E-mail de redefinição de senha
export async function sendPasswordResetEmail(options: {
  to: string;
  resetLink: string;
}) {
  const { to, resetLink } = options;
  const content = `
    <h2>Redefinição de Senha</h2>
    <p>Você solicitou a redefinição de senha para sua conta SemEstress.</p>
    <p>Clique no botão abaixo para definir uma nova senha:</p>
    <a href="${resetLink}" style="display: inline-block; background-color: #f47373; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
    <p>Se você não solicitou esta redefinição, ignore este e-mail.</p>
    <p>O link expirará em 1 hora.</p>
  `;

  return sendEmail({
    to,
    subject: 'Redefinição de Senha - SemEstress',
    html: emailTemplate(content)
  });
}

// E-mail de senha alterada com sucesso
export async function sendPasswordChangedEmail(options: {
  to: string;
}) {
  const { to } = options;
  const content = `
    <h2>Senha Alterada</h2>
    <p>A senha da sua conta SemEstress foi alterada com sucesso.</p>
    <p>Se você não fez esta alteração, entre em contato conosco imediatamente.</p>
    <a href="${window.location.origin}/login" style="display: inline-block; background-color: #f47373; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Fazer Login</a>
  `;

  return sendEmail({
    to,
    subject: 'Senha Alterada - SemEstress',
    html: emailTemplate(content)
  });
}