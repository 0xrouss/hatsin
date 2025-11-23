"use client";

import { useMemo } from "react";
import { type Token } from "@/config/contracts";
import { useTokenBalance } from "./useTokenBalance";
import { useTokenPrice } from "./useTokenPrice";
import { calculateTokenValue } from "@/services/coingecko";

/**
 * Hook that combines token balance and price to calculate USD value
 * @param token - The token object
 * @param amount - Optional specific amount to calculate value for (overrides balance)
 */
export function useTokenValue(token: Token | null, amount?: string | number) {
  const {
    balance,
    formattedBalance,
    isLoading: isLoadingBalance,
  } = useTokenBalance(token);
  const { data: price, isLoading: isLoadingPrice } = useTokenPrice(token);

  const usdValue = useMemo(() => {
    if (!token || !price) {
      return 0;
    }

    // If amount is provided (even if empty string), use it; otherwise return 0
    if (amount !== undefined) {
      // Handle empty string or invalid amount
      if (amount === "" || amount === null) {
        return 0;
      }
      return calculateTokenValue(amount, price);
    }

    // If no amount provided, return 0 (don't use balance)
    return 0;
  }, [token, price, amount]);

  const formattedValue = useMemo(() => {
    if (usdValue === 0) {
      return "$0.00";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usdValue);
  }, [usdValue]);

  return {
    usdValue,
    formattedValue,
    price,
    isLoading: isLoadingBalance || isLoadingPrice,
    balance: formattedBalance,
  };
}
