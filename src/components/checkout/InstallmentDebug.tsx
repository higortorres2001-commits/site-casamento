"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const InstallmentDebug = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testInstallments = async () => {
    setLoading(true);
    try {
      console.log('Testing installments calculation...');
      const { data, error } = await supabase.functions.invoke('calculate-installments', {
        body: { totalPrice: 100 }
      });
      
      console.log('Test result:', { data, error });
      setResult({ data, error: error?.message });
    } catch (err: any) {
      console.error('Test error:', err);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-md bg-gray-50 space-y-2">
      <h3 className="font-bold">Debug de Parcelas</h3>
      <Button onClick={testInstallments} disabled={loading}>
        {loading ? 'Testando...' : 'Testar Cálculo de Parcelas'}
      </Button>
      {result && (
        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default InstallmentDebug;