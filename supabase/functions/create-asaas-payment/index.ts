import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleUserManagement } from './_shared/user.service.ts';
import { validateRequestData, validateProducts, applyCoupon, createOrder } from './_shared/order.service.ts';
import { processPixPayment, processCreditCardPayment } from './_shared/asaas.service.ts';

// Resto do código permanece o mesmo