"use client";

import React from 'react';
import { Link } from 'react-router-dom';

const CheckoutHeader = () => {
  return (
    <header className="bg-white shadow-sm py-4 px-4 md:px-8 sticky top-0 z-40 w-full h-16 flex items-center justify-center">
      <div className="max-w-6xl mx-auto flex justify-center items-center">
        <Link to="/" className="text-2xl font-bold text-gray-800">
          Seu Logo
        </Link>
        {/* Adicione um logo real aqui */}
      </div>
    </header>
  );
};

export default CheckoutHeader;