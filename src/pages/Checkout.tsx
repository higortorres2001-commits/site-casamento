// Ref para garantir que o evento InitiateCheckout seja rastreado apenas uma vez
const hasTrackedInitiateCheckout = useRef(false);

// Effect para rastrear o evento InitiateCheckout, garantindo que seja disparado apenas uma vez
useEffect(() => {
  if (!hasTrackedInitiateCheckout.current && !isLoading && mainProduct && currentTotalPrice > 0 && userProfile && process.env.NODE_ENV === 'production') {
    const productIds = [mainProduct.id, ...selectedOrderBumps];
    const numItems = productIds.length;
    const firstName = userProfile.name?.split(' ')[0] || null;
    const lastName = userProfile.name?.split(' ').slice(1).join(' ') || null;

    trackInitiateCheckout(
      currentTotalPrice,
      'BRL',
      productIds,
      numItems,
      {
        email: userProfile.email,
        phone: userProfile.whatsapp,
        firstName: firstName,
        lastName: lastName,
      }
    );
    hasTrackedInitiateCheckout.current = true; // Marca como rastreado para não disparar novamente
  }
}, [isLoading, mainProduct, currentTotalPrice, selectedOrderBumps, userProfile]);