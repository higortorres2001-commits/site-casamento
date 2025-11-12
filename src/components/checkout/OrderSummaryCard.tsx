"use client";

import React from "react";
import { Product, Coupon } from "@/types";
import OrderSummaryAccordion from "./OrderSummaryAccordion";

interface OrderSummaryCardProps {
  mainProduct: Product;
  selectedOrderBumpsDetails: Product[];
  originalTotalPrice: number;
  currentTotalPrice: number;
  appliedCoupon: Coupon | null;
  onCouponApplied: (coupon: Coupon | null) => void;
}

const OrderSummaryCard = ({
  mainProduct,
  selectedOrderBumpsDetails,
  originalTotalPrice,
  currentTotalPrice,
  appliedCoupon,
  onCouponApplied,
}: OrderSummaryCardProps) => {
  return (
    <OrderSummaryAccordion
      mainProduct={mainProduct}
      selectedOrderBumpsDetails={selectedOrderBumpsDetails}
      originalTotalPrice={originalTotalPrice}
      currentTotalPrice={currentTotalPrice}
      appliedCoupon={appliedCoupon}
      onCouponApplied={onCouponApplied}
    />
  );
};

export default OrderSummaryCard;