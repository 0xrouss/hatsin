"use client";

import { useAccount, useReadContract, useChainId } from "wagmi";
import { type Token, isNativeToken } from "@/config/contracts";
import { erc20Abi } from "viem";

/**
 * Hook to check ERC20 token allowance
 * @param token - The token object
 * @param spender - The address that is allowed to spend tokens
 */
export function useTokenAllowance(
  token: Token | null,
  spender: `0x${string}` | undefined
) {
  const { address: owner } = useAccount();
  const chainId = useChainId();

  const {
    data: allowance,
    isLoading,
    refetch,
  } = useReadContract({
    address:
      token && !isNativeToken(token.address)
        ? (token.address as `0x${string}`)
        : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    chainId: chainId,
    query: {
      enabled: !!owner && !!spender && !!token && !isNativeToken(token.address),
    },
  });

  if (!token || !owner || !spender || isNativeToken(token.address)) {
    return {
      allowance: null,
      isLoading: false,
      refetch: async () => ({}),
    };
  }

  return {
    allowance: (allowance as bigint) ?? BigInt(0),
    isLoading,
    refetch,
  };
}
