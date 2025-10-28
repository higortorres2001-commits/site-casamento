"use client";

import React from 'react';
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Outlet />
    </div>
  );
};

export default PublicLayout;