import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface ValidateCouponInput {
  supabase: any;
  couponCode?: string | null;
  originalTotalPrice: number;
}

interface ValidateCouponOutput {
  coupon?: any;
  finalPrice: number;
  discountAmount: number;
}

export async function validateCoupon({
  supabase,
  couponCode,
  originalTotalPrice
}: ValidateCouponInput): Promise<ValidateCouponOutput> {
  console.log('🎫 validateCoupon - Starting validation', {
    couponCode,
    originalTotalPrice
  });

  // Se não há cupom, retorna preço original
  if (!couponCode || !couponCode.trim()) {
    console.log('📭 No coupon provided, returning original price');
    return {
      finalPrice: originalTotalPrice,
      discountAmount: 0
    };
  }

  // ETAPA 1: Buscar cupom no banco
  console.log('🔍 Fetching coupon from database:', couponCode.toUpperCase().trim());
  
  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .select('code, discount_type, value, active')
    .eq('code', couponCode.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (couponError || !coupon) {
    console.error('❌ Invalid or inactive coupon:', {
      couponCode: couponCode.toUpperCase().trim(),
      error: couponError?.message
    });
    
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'validateCoupon-fetch',
      message: 'Invalid or inactive coupon code',
      metadata: { 
        couponCode: couponCode.toUpperCase().trim(),
        error: couponError?.message,
        errorType: couponError?.name
      }
    });
    throw new Error('Invalid or inactive coupon code');
  }

  console.log('✅ Coupon found and validated:', {
    code: coupon.code,
    discount_type: coupon.discount_type,
    value: coupon.value
  });

  // ETAPA 2: Calcular desconto
  let finalPrice = originalTotalPrice;
  let discountAmount = 0;

  if (coupon.discount_type === 'percentage') {
    discountAmount = originalTotalPrice * (parseFloat(coupon.value) / 100);
    finalPrice = originalTotalPrice - discountAmount;
  } else if (coupon.discount_type === 'fixed') {
    discountAmount = parseFloat(coupon.value);
    finalPrice = Math.max(0, originalTotalPrice - discountAmount);
  }

  console.log('💰 Discount calculated:', {
    originalTotalPrice,
    discountType: coupon.discount_type,
    discountValue: coupon.value,
    discountAmount,
    finalPrice
  });

  await supabase.from('logs').insert({
    level: 'info',
    context: 'validateCoupon-success',
    message: 'Coupon applied successfully',
    metadata: { 
      couponCode: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.value,
      originalTotalPrice,
      discountAmount,
      finalPrice
    }
  });

  return {
    coupon,
    finalPrice,
    discountAmount
  };
}