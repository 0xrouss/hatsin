"use client";

import { useQuery } from "@tanstack/react-query";
import { type Token } from "@/config/contracts";
import { getTokenPrice } from "@/services/coingecko";

/**
 * Hook to fetch and cache token price from CoinGecko
 * @param token - The token object (must have coingeckoId)
 * @param options - Query options
 */
export function useTokenPrice(
  token: Token | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  const enabled = options?.enabled ?? true;
  const shouldFetch = enabled && !!token?.coingeckoId;

  return useQuery({
    queryKey: ["tokenPrice", token?.coingeckoId],
    queryFn: () => {
      if (!token?.coingeckoId) {
        return null;
      }
      return getTokenPrice(token.coingeckoId);
    },
    enabled: shouldFetch,
    refetchInterval: options?.refetchInterval ?? 60000, // Default: refetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });
}

