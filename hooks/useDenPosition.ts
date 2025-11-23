"use client";

import { useAccount, useReadContract, useChainId } from "wagmi";
import { DenManagerAbi } from "@/ABIs/DenManager";
import { formatUnits } from "viem";

/**
 * Hook to check if user has an open den and get position details
 * @param denManagerAddress - The DenManager contract address
 */
export function useDenPosition(denManagerAddress: `0x${string}` | undefined) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  const { data, isLoading, refetch } = useReadContract({
    address: denManagerAddress,
    abi: DenManagerAbi,
    functionName: "getDenCollAndDebt",
    args: userAddress ? [userAddress] : undefined,
    chainId: chainId,
    query: {
      enabled: !!userAddress && !!denManagerAddress,
    },
  });

  if (!userAddress || !denManagerAddress) {
    return {
      hasPosition: false,
      collateral: BigInt(0),
      debt: BigInt(0),
      formattedCollateral: "0",
      formattedDebt: "0",
      isLoading: false,
      refetch: async () => ({}),
    };
  }

  const result = data as [bigint, bigint] | undefined;
  const collateral = result?.[0] ?? BigInt(0);
  const debt = result?.[1] ?? BigInt(0);
  const hasPosition = collateral > BigInt(0) || debt > BigInt(0);

  return {
    hasPosition,
    collateral,
    debt,
    formattedCollateral: formatUnits(collateral, 18), // Assuming 18 decimals for collateral
    formattedDebt: formatUnits(debt, 18), // ATIUM has 18 decimals
    isLoading,
    refetch,
  };
}
