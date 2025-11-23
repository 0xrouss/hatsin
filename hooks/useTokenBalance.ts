"use client";

import { useAccount, useBalance, useReadContract, useChainId } from "wagmi";
import { type Token, isNativeToken } from "@/config/contracts";
import { formatTokenBalance } from "@/utils/balances";
import { erc20Abi } from "viem";

/**
 * Hook to read token balance (both native and ERC20)
 * Returns the balance in human-readable format and as BigInt
 */
export function useTokenBalance(token: Token | null) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  // For native tokens, use wagmi's useBalance hook
  const {
    data: nativeBalance,
    isLoading: isLoadingNative,
    refetch: refetchNative,
  } = useBalance({
    address: userAddress,
    chainId: chainId,
    query: {
      enabled: !!userAddress && !!token && isNativeToken(token.address),
    },
  });

  // For ERC20 tokens, use useReadContract
  const {
    data: erc20Balance,
    isLoading: isLoadingERC20,
    refetch: refetchERC20,
  } = useReadContract({
    address:
      token && !isNativeToken(token.address)
        ? (token.address as `0x${string}`)
        : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: chainId,
    query: {
      enabled: !!userAddress && !!token && !isNativeToken(token.address),
    },
  });

  if (!token || !userAddress) {
    return {
      balance: null,
      formattedBalance: "0",
      isLoading: false,
      refetch: async () => ({}),
    };
  }

  if (isNativeToken(token.address)) {
    const balance = nativeBalance?.value ?? BigInt(0);
    return {
      balance,
      formattedBalance: formatTokenBalance(balance, token.decimals),
      isLoading: isLoadingNative,
      refetch: refetchNative,
    };
  }

  const balance = (erc20Balance as bigint) ?? BigInt(0);
  return {
    balance,
    formattedBalance: formatTokenBalance(balance, token.decimals),
    isLoading: isLoadingERC20,
    refetch: refetchERC20,
  };
}
