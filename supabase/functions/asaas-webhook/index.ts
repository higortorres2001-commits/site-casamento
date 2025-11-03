// ... (código anterior mantido)

// 8. Send "Acesso Liberado" email with login details
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
if (RESEND_API_KEY && profile.email && profile.cpf) {
  // Gerar a senha padrão para incluir no email
  const defaultPassword = generateDefaultPassword(profile.cpf);
  
  const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app') || 'YOUR_APP_URL';
  const loginUrl = `${appUrl}/login`;
  
  try {
    const { data, error } = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'SemEstress <onboarding@resend.dev>',
        to: profile.email,
        subject: "Seu acesso foi liberado!",
        html: `
          <h1>Acesso Liberado!</h1>
          <p>Parabéns! Seu pagamento foi confirmado.</p>
          <p>Seus dados de acesso:</p>
          <ul>
            <li>Login: ${loginUrl}</li>
            <li>Email: ${profile.email}</li>
            <li>Senha: ${defaultPassword}</li>
          </ul>
        `
      }),
    });

    if (!data) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook',
        message: 'Error sending access liberation email via Resend',
        metadata: { userId, orderId, asaasPaymentId, email: profile.email, error }
      });
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'asaas-webhook',
        message: `Access liberation email sent to ${profile.email}`,
        metadata: { userId, orderId, asaasPaymentId, email: profile.email }
      });
    }
  } catch (emailError: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'asaas-webhook',
      message: `Error sending email: ${emailError.message}`,
      metadata: { userId, orderId, asaasPaymentId, email: profile.email }
    });
  }
}