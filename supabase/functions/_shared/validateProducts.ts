import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface ValidateProductsInput {
  supabase: any;
  productIds: string[];
}

interface ValidateProductsOutput {
  products: any[];
  totalPrice: number;
}

export async function validateProducts({
  supabase,
  productIds
}: ValidateProductsInput): Promise<ValidateProductsOutput> {
  const uniqueProductIds = [...new Set(productIds)];
  console.log('🔍 validateProducts - Starting validation', {
    originalProductIds: productIds,
    uniqueProductIds,
    requestedCount: uniqueProductIds.length
  });

  // ETAPA 1: Validar produtos no banco
  console.log('📦 Fetching products from database');
  
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, price, name, status')
    .in('id', uniqueProductIds);

  if (productsError || !products || products.length !== uniqueProductIds.length) {
    const foundIds = new Set(products?.map(p => p.id) || []);
    const missingIds = uniqueProductIds.filter(id => !foundIds.has(id));

    console.error('❌ Product validation failed:', {
      requestedIds: uniqueProductIds,
      foundIds: Array.from(foundIds),
      missingIds,
      error: productsError?.message,
      productsCount: products?.length || 0,
      requestedCount: uniqueProductIds.length
    });

    await supabase.from('logs').insert({
      level: 'error',
      context: 'validateProducts-fetch',
      message: 'Product validation failed',
      metadata: { 
        requestedIds: uniqueProductIds,
        foundIds: Array.from(foundIds),
        missingIds,
        error: productsError?.message,
        productsCount: products?.length || 0,
        requestedCount: uniqueProductIds.length
      }
    });
    throw new Error(`One or more products not found: ${missingIds.join(', ')}`);
  }

  console.log('✅ All products validated successfully', {
    validatedProducts: products.map(p => ({ id: p.id, name: p.name, price: p.price })),
    totalProducts: products.length
  });

  // ETAPA 2: Calcular preço total
  const totalPrice = products.reduce((sum, product) => sum + parseFloat(product.price), 0);

  console.log('💰 Total price calculated:', {
    totalPrice,
    productCount: products.length,
    averagePrice: totalPrice / products.length
  });

  return {
    products,
    totalPrice
  };
}