"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Brand from "../Brand";

interface CheckoutHeaderProps {
  backUrl?: string;
}

const CheckoutHeader = ({ backUrl }: CheckoutHeaderProps) => {
  return (
    <header className="bg-white shadow-sm py-4 px-4 md:px-8 sticky top-0 z-40 w-full h-16 flex items-center justify-between">
      <div className="flex items-center">
        <Link to="/" aria-label="Início">
          <Brand />
        </Link>
      </div>
      <div className="w-1/3 flex justify-end">
        {backUrl ? (
          <a href={backUrl}>
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </a>
        ) : null}
      </div>
    </header>
  );
};

export default CheckoutHeader;