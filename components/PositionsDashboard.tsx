"use client";

import React from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { getTokensForChain, type Token } from "@/config/contracts";
import { useDenPosition } from "@/hooks/useDenPosition";
import { DenManagerAbi } from "@/ABIs/DenManager";

function PositionCard({ token }: { token: Token }) {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();

  const {
    hasPosition,
    collateral,
    debt,
    formattedCollateral,
    formattedDebt,
    isLoading,
  } = useDenPosition(token.denManager as `0x${string}` | undefined);

  // Get MCR
  const { data: mcr } = useReadContract({
    address: token.denManager as `0x${string}` | undefined,
    abi: DenManagerAbi,
    functionName: "MCR",
    chainId: chainId,
    query: {
      enabled: !!token.denManager && hasPosition,
    },
  });

  // Get ICR - need to fetch price from DenManager first
  const { data: denPrice } = useReadContract({
    address: token.denManager as `0x${string}` | undefined,
    abi: DenManagerAbi,
    functionName: "fetchPrice",
    chainId: chainId,
    query: {
      enabled: !!token.denManager && hasPosition && !!userAddress,
    },
  });

  // Get ICR using the price from DenManager
  const { data: icr } = useReadContract({
    address: token.denManager as `0x${string}` | undefined,
    abi: DenManagerAbi,
    functionName: "getCurrentICR",
    args:
      userAddress && denPrice !== undefined
        ? [userAddress, denPrice as bigint]
        : undefined,
    chainId: chainId,
    query: {
      enabled: !!token.denManager && !!userAddress && hasPosition && denPrice !== undefined,
    },
  });

  // Calculate ICR percentage
  const icrPercent =
    icr !== undefined && icr !== null
      ? Number(formatUnits(icr as bigint, 18)) * 100
      : null;

  // Calculate MCR percentage
  const mcrPercent =
    mcr !== undefined && mcr !== null
      ? Number(formatUnits(mcr as bigint, 18)) * 100
      : null;

  // Determine health status
  const isHealthy =
    icrPercent !== null && mcrPercent !== null
      ? icrPercent >= mcrPercent
      : null;

  // Don't render if no position
  if (!hasPosition || (collateral === BigInt(0) && debt === BigInt(0))) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  const healthColor =
    isHealthy === null
      ? "text-zinc-500 dark:text-zinc-400"
      : isHealthy
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  const healthBg =
    isHealthy === null
      ? "bg-zinc-100 dark:bg-zinc-800"
      : isHealthy
      ? "bg-green-50 dark:bg-green-900/20"
      : "bg-red-50 dark:bg-red-900/20";

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-black dark:text-zinc-50">
          {token.symbol}
        </h3>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${healthBg} ${healthColor}`}>
          {isHealthy === null
            ? "Unknown"
            : isHealthy
            ? "Healthy"
            : "At Risk"}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Collateral</span>
          <span className="text-base font-semibold text-black dark:text-zinc-50">
            {formattedCollateral} {token.symbol}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Debt</span>
          <span className="text-base font-semibold text-black dark:text-zinc-50">
            {formattedDebt} ATIUM
          </span>
        </div>

        {icrPercent !== null && (
          <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">ICR</span>
            <span className="text-base font-semibold text-black dark:text-zinc-50">
              {icrPercent.toFixed(2)}%
            </span>
          </div>
        )}

        {mcrPercent !== null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">MCR</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {mcrPercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PositionsDashboard() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const tokens = getTokensForChain(chainId);

  // Filter tokens that have denManager addresses
  const tokensWithDenManager = tokens.filter(
    (token) => token.denManager !== undefined
  );

  // Get all position cards (components will filter themselves if no position)
  const positionCards = tokensWithDenManager.map((token) => (
    <PositionCard key={token.address} token={token} />
  ));

  if (!userAddress) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-sm text-center">
          <p className="text-zinc-600 dark:text-zinc-400">
            Please connect your wallet to view your positions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-6">
        Your Positions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {positionCards}
      </div>
    </div>
  );
}

