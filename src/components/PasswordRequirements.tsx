"use client";

import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  password: string;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => {
  const hasMinLength = password.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  const renderRequirement = (met: boolean, text: string) => (
    <div className="flex items-center space-x-2 text-sm">
      {met ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={cn(
        met ? 'text-green-700' : 'text-red-700',
        'font-medium'
      )}>
        {text}
      </span>
    </div>
  );

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Requisitos da Senha:</h4>
      {renderRequirement(hasMinLength, 'Mínimo de 6 caracteres')}
      {renderRequirement(hasLetter, 'Pelo menos uma letra')}
      {renderRequirement(hasDigit, 'Pelo menos um número')}
    </div>
  );
};

export default PasswordRequirements;