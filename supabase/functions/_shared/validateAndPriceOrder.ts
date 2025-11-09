import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface ValidateAndPriceOrderInput {
  supabase: any;
  productIds: string[];
  coupon_code?: string | null;
}

interface ValidateAndPriceOrderOutput {
  validatedProducts: any[];
  totalPrice: number;
  originalPrice: number;
  discountAmount: number;
  coupon?: any;
}

export async function validateAndPriceOrder({
  supabase,
  productIds,
  coupon_code
}: ValidateAndPriceOrderInput): Promise<ValidateAndPriceOrderOutput> {
  console.log('🔍 validateAndPriceOrder - Starting validation', {
    productIds,
    coupon_code
  });

  // ETAPA 1: Validar produtos no banco
  console.log('📦 Fetching products from database');
  
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, price, name, status')
    .in('id', productIds);

  if (productsError || !products || products.length !== productIds.length) {
    const foundIds = new Set(products?.map(p => p.id) || []);
    const missingIds = productIds.filter(id => !foundIds.has(id));

    console.error('❌ Product validation failed:', {
      requestedIds: productIds,
      foundIds: Array.from(foundIds),
      missingIds,
      error: productsError?.message
    });

    await supabase.from('logs').insert({
      level: 'error',
      context: 'validateAndPriceOrder-fetch',
      message: 'Product validation failed',
      metadata: { 
        requestedIds: productIds,
        foundIds: Array.from(foundIds),
        missingIds,
        error: productsError?.message,
        productsCount: products?.length || 0,
        requestedCount: productIds.length
      }
    });
    throw new Error(`One or more products not found: ${missingIds.join(', ')}`);
  }

  console.log('✅ All products validated successfully', {
    validatedProducts: products.map(p => ({ id: p.id, name: p.name, price: p.price })),
    totalProducts: products.length
  });

  // ETAPA 2: Calcular preço base
  const originalPrice = products.reduce((sum, product) => sum + parseFloat(product.price), 0);
  let totalPrice = originalPrice;
  let discountAmount = 0;
  let coupon = null;

  console.log('💰 Base price calculated:', {
    originalPrice,
    productCount: products.length,
    averagePrice: originalPrice / products.length
  });

  // ETAPA 3: Validar e aplicar cupom (se houver)
  if (coupon_code && coupon_code.trim()) {
    console.log('🎫 Validating coupon:', coupon_code.toUpperCase().trim());
    
    const { data: couponData, error: couponError } = await supabase
      .from('coupons')
      .select('code, discount_type, value, active')
      .eq('code', coupon_code.toUpperCase().trim())
      .eq('active', true)
      .single();

    if (couponError || !couponData) {
      console.error('❌ Invalid or inactive coupon:', {
        couponCode: coupon_code.toUpperCase().trim(),
        error: couponError?.message
      });
      
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'validateAndPriceOrder-coupon',
        message: 'Invalid or inactive coupon code',
        metadata: { 
          couponCode: coupon_code.toUpperCase().trim(),
          error: couponError?.message,
          errorType: couponError?.name
        }
      });
      // Não falhar completamente - continuar sem cupom
    } else {
      console.log('✅ Coupon found and validated:', {
        code: couponData.code,
        discount_type: couponData.discount_type,
        value: couponData.value
      });

      // ETAPA 4: Aplicar desconto
      if (couponData.discount_type === 'percentage') {
        discountAmount = originalPrice * (parseFloat(couponData.value) / 100);
        totalPrice = originalPrice - discountAmount;
      } else if (couponData.discount_type === 'fixed') {
        discountAmount = parseFloat(couponData.value);
        totalPrice = Math.max(0, originalPrice - discountAmount);
      }

      coupon = couponData;

      console.log('💰 Discount applied:', {
        originalTotalPrice,
        discountType: couponData.discount_type,
        discountValue: couponData.value,
        discountAmount,
        finalPrice: totalPrice
      });

      await supabase.from('logs').insert({
        level: 'info',
        context: 'validateAndPriceOrder-success',
        message: 'Coupon applied successfully',
        metadata: { 
          couponCode: couponData.code,
          discount_type: couponData.discount_type,
          discount_value: couponData.value,
          originalTotalPrice,
          discountAmount,
          finalPrice: totalPrice
        }
      });
    }
  }

  console.log('✅ validateAndPriceOrder completed:', {
    validatedProducts: products,
    originalPrice,
    totalPrice,
    discountAmount,
    hasCoupon: !!coupon
  });

  return {
    validatedProducts: products,
    totalPrice,
    originalPrice,
    discountAmount,
    coupon
  };
}