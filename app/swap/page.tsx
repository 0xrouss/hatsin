"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useChainId,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import {
  type Token,
  getTokensForChain,
  getContractsForChain,
  getUsdcEquivalentToken,
} from "@/config/contracts";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { BorrowerOpsAbi } from "@/ABIs/BorrowerOps";
import { IspSwapRouterAbi } from "@/ABIs/IspSwapRouter";
import { erc20Abi } from "viem";
import { rootstockTestnet } from "@reown/appkit/networks";

export default function Swap() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const [swapDirection, setSwapDirection] = useState<
    "usdcToAtium" | "atiumToUsdc"
  >("usdcToAtium");
  const [amount, setAmount] = useState("");

  // Get contract addresses
  const contracts = getContractsForChain(chainId);
  const swapRouterAddress = contracts.ispSwapRouter;
  const borrowerOperationsAddress = contracts.borrowerOperations;

  // Write contract hook
  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Get ATIUM token address from BorrowerOperations
  const { data: atiumTokenAddress } = useReadContract({
    address: borrowerOperationsAddress as `0x${string}` | undefined,
    abi: BorrowerOpsAbi,
    functionName: "debtToken",
    chainId: chainId,
    query: {
      enabled: !!borrowerOperationsAddress,
    },
  });

  // Get USDC-equivalent token from chain config (USDRIF on Rootstock testnet, USDC elsewhere)
  const usdcToken = useMemo(() => {
    return getUsdcEquivalentToken(chainId);
  }, [chainId]);

  // Create ATIUM token object
  const atiumToken = useMemo(() => {
    if (!atiumTokenAddress) return null;
    return {
      address: atiumTokenAddress as `0x${string}`,
      symbol: "ATIUM",
      name: "ATIUM",
      decimals: 18,
    } as Token;
  }, [atiumTokenAddress]);

  // Determine tokenIn and tokenOut based on swap direction
  const tokenIn = swapDirection === "usdcToAtium" ? usdcToken : atiumToken;
  const tokenOut = swapDirection === "usdcToAtium" ? atiumToken : usdcToken;

  // Get balances
  const {
    balance: usdcBalance,
    formattedBalance: formattedUsdcBalance,
    isLoading: isLoadingUsdcBalance,
    refetch: refetchUsdcBalance,
  } = useTokenBalance(usdcToken);

  const {
    balance: atiumBalance,
    formattedBalance: formattedAtiumBalance,
    isLoading: isLoadingAtiumBalance,
    refetch: refetchAtiumBalance,
  } = useTokenBalance(atiumToken);

  // Get balances for tokenIn
  const {
    balance: tokenInBalance,
    formattedBalance: formattedTokenInBalance,
    isLoading: isLoadingTokenInBalance,
    refetch: refetchTokenInBalance,
  } = useTokenBalance(tokenIn);

  // Check allowances
  const {
    allowance: tokenInAllowance,
    isLoading: isLoadingTokenInAllowance,
    refetch: refetchTokenInAllowance,
  } = useTokenAllowance(
    tokenIn,
    swapRouterAddress as `0x${string}` | undefined
  );

  // Calculate required allowance
  const requiredAllowance = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0 || !tokenIn) {
      return BigInt(0);
    }
    return parseUnits(amount, tokenIn.decimals);
  }, [amount, tokenIn]);

  // Check if approval is needed
  const needsApproval = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0 || !tokenIn) {
      return false;
    }
    if (!tokenInAllowance || tokenInAllowance === null) {
      return true;
    }
    return tokenInAllowance < requiredAllowance;
  }, [amount, tokenIn, tokenInAllowance, requiredAllowance]);

  // Approval transaction
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApproving,
    error: approveError,
  } = useWriteContract();

  const { isLoading: isConfirmingApproval, isSuccess: isApprovalConfirmed } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  // Refetch allowance after approval
  useEffect(() => {
    if (isApprovalConfirmed) {
      refetchTokenInAllowance();
    }
  }, [isApprovalConfirmed, refetchTokenInAllowance]);

  // Refetch balances after successful swap
  useEffect(() => {
    if (isConfirmed) {
      refetchUsdcBalance();
      refetchAtiumBalance();
      refetchTokenInBalance();
      // Reset amount after successful swap
      setTimeout(() => {
        setAmount("");
      }, 2000);
    }
  }, [
    isConfirmed,
    refetchUsdcBalance,
    refetchAtiumBalance,
    refetchTokenInBalance,
  ]);

  const handleApprove = async () => {
    if (!tokenIn || !swapRouterAddress) {
      return;
    }

    try {
      // Approve with max uint256 to avoid multiple approvals
      const maxApproval = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      writeApprove({
        address: tokenIn.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [swapRouterAddress as `0x${string}`, maxApproval],
      });
    } catch (error) {
      console.error("Error approving token:", error);
    }
  };

  const handleSwap = async () => {
    if (
      !tokenIn ||
      !tokenOut ||
      !amount ||
      parseFloat(amount) <= 0 ||
      !swapRouterAddress ||
      !userAddress
    ) {
      return;
    }

    try {
      const amountIn = parseUnits(amount, tokenIn.decimals);

      writeContract({
        address: swapRouterAddress as `0x${string}`,
        abi: IspSwapRouterAbi,
        functionName: "swap",
        args: [
          tokenIn.address as `0x${string}`, // tokenIn
          tokenOut.address as `0x${string}`, // tokenOut
          amountIn, // amountIn
        ],
        value: BigInt(0), // No value needed
      });
    } catch (error) {
      console.error("Error swapping tokens:", error);
    }
  };

  const handleMax = () => {
    if (tokenInBalance) {
      setAmount(formatUnits(tokenInBalance, tokenIn?.decimals || 18));
    }
  };

  const canSwap = useMemo(() => {
    return (
      tokenIn &&
      tokenOut &&
      amount &&
      parseFloat(amount) > 0 &&
      tokenInBalance !== null &&
      parseFloat(amount) <=
        parseFloat(formatUnits(tokenInBalance, tokenIn.decimals)) &&
      !needsApproval &&
      swapRouterAddress &&
      userAddress
    );
  }, [
    tokenIn,
    tokenOut,
    amount,
    tokenInBalance,
    needsApproval,
    swapRouterAddress,
    userAddress,
  ]);

  // Show error if swap router is not configured
  if (!swapRouterAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Swap
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
            Swap router is not configured for this chain.
          </div>
        </div>
      </div>
    );
  }

  // Show error if USDC-equivalent token is not available
  if (!usdcToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Swap
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
            {chainId === rootstockTestnet.id ? "USDRIF" : "USDC"} is not
            available on this chain.
          </div>
        </div>
      </div>
    );
  }

  // Show loading if ATIUM address is not loaded yet
  if (!atiumToken && borrowerOperationsAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Swap
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Loading ATIUM token address...
          </div>
        </div>
      </div>
    );
  }

  if (!atiumToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Swap
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
            BorrowerOperations contract is not configured for this chain.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 mb-8 text-center">
          Swap
        </h1>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            {/* Swap Direction Selector */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Swap Direction
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSwapDirection("usdcToAtium");
                    setAmount("");
                  }}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                    swapDirection === "usdcToAtium"
                      ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {usdcToken?.symbol || "USDC"} → ATIUM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwapDirection("atiumToUsdc");
                    setAmount("");
                  }}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                    swapDirection === "atiumToUsdc"
                      ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  ATIUM → {usdcToken?.symbol || "USDC"}
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Amount ({tokenIn?.symbol})
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="any"
                  className="w-full px-4 py-3 pr-24 text-lg font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {tokenInBalance !== null && !isLoadingTokenInBalance && (
                    <button
                      type="button"
                      onClick={handleMax}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                      MAX
                    </button>
                  )}
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {tokenIn?.symbol}
                  </span>
                </div>
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isLoadingTokenInBalance
                  ? "Loading balance..."
                  : tokenInBalance !== null
                  ? `Balance: ${formattedTokenInBalance} ${tokenIn?.symbol}`
                  : `Balance: 0 ${tokenIn?.symbol}`}
              </div>
            </div>

            {/* Swap Arrow */}
            <div className="flex items-center justify-center py-2">
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-zinc-600 dark:text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            </div>

            {/* Output Token Display */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                You will receive ({tokenOut?.symbol})
              </label>
              <div className="px-4 py-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">~</span>
                  <span>{tokenOut?.symbol}</span>
                </div>
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isLoadingAtiumBalance && tokenOut?.symbol === "ATIUM"
                  ? "Loading balance..."
                  : isLoadingUsdcBalance &&
                    tokenOut?.symbol === usdcToken?.symbol
                  ? "Loading balance..."
                  : tokenOut?.symbol === "ATIUM" && atiumBalance !== null
                  ? `Balance: ${formattedAtiumBalance} ATIUM`
                  : tokenOut?.symbol === usdcToken?.symbol &&
                    usdcBalance !== null
                  ? `Balance: ${formattedUsdcBalance} ${usdcToken?.symbol}`
                  : `Balance: 0 ${tokenOut?.symbol}`}
              </div>
            </div>

            {/* Approval Error Display */}
            {approveError && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                Approval Error: {approveError.message}
              </div>
            )}

            {/* Approval Success Display */}
            {isApprovalConfirmed && (
              <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                Token approved successfully!
              </div>
            )}

            {/* Swap Error Display */}
            {writeError && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                Swap Error: {writeError.message}
              </div>
            )}

            {/* Swap Success Display */}
            {isConfirmed && (
              <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                Swap completed successfully!
              </div>
            )}

            {/* Approval Button */}
            {needsApproval && (
              <button
                onClick={handleApprove}
                disabled={
                  !tokenIn ||
                  !swapRouterAddress ||
                  isApproving ||
                  isConfirmingApproval
                }
                className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving || isConfirmingApproval
                  ? "Approving..."
                  : `Approve ${tokenIn?.symbol}`}
              </button>
            )}

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={!canSwap || isWriting || isConfirming}
              className="w-full py-3 px-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWriting || isConfirming
                ? "Swapping..."
                : needsApproval
                ? `Approve ${tokenIn?.symbol} First`
                : "Swap"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
