"use client";

import React from "react";

interface BrandProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

const Brand: React.FC<BrandProps> = ({ size = "md", className, showText = true }) => {
  const sizes = {
    sm: { logo: "h-8" },
    md: { logo: "h-10" },
    lg: { logo: "h-16" },
    xl: { logo: "h-24" },
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <img
        src="/logo.png"
        alt="DuetLove"
        className={`${className ?? sizes[size].logo} object-contain`}
      />
    </div>
  );
};

export default Brand;