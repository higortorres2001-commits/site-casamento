// Adicione este método dentro do componente Customers
const handleManualAccessGrant = async (customer: CustomerRow, productIds: string[]) => {
  if (!customer.id) return;

  try {
    // Buscar perfil atual
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('access')
      .eq('id', customer.id)
      .single();

    if (profileError) {
      showError("Erro ao buscar perfil do cliente: " + profileError.message);
      return;
    }

    // Mesclar IDs de produtos, removendo duplicatas
    const existingAccess = profile.access || [];
    const newAccess = [...new Set([...existingAccess, ...productIds])];

    // Atualizar perfil com novos acessos
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        access: newAccess,
        has_changed_password: false // Forçar troca de senha no primeiro acesso
      })
      .eq('id', customer.id);

    if (updateError) {
      showError("Erro ao liberar acesso: " + updateError.message);
      return;
    }

    // Log da ação
    await supabase.from('logs').insert({
      level: 'info',
      context: 'manual-access-grant',
      message: 'Admin manually granted access to products',
      metadata: { 
        adminId: user?.id, 
        userId: customer.id, 
        productIds 
      }
    });

    showSuccess(`Acesso liberado para ${customer.name || customer.email}`);
    
    // Atualizar lista de clientes
    fetchCustomers();
  } catch (error: any) {
    showError("Erro inesperado: " + error.message);
  }
};