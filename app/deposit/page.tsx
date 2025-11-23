"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  useChainId,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, zeroAddress } from "viem";
import TokenSelector from "@/components/TokenSelector";
import {
  type Token,
  getTokensForChain,
  getContractsForChain,
  isNativeToken,
} from "@/config/contracts";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenValue } from "@/hooks/useTokenValue";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { BorrowerOpsAbi } from "@/ABIs/BorrowerOps";

export default function Deposit() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");
  const [atiumAmount, setAtiumAmount] = useState("");
  const [ltvRatio, setLtvRatio] = useState(50); // LTV ratio in percentage (0-1000)
  const prevChainIdRef = useRef<number>(chainId);
  const isUpdatingFromSlider = useRef(false);
  const isUpdatingFromInput = useRef(false);

  // Get contract addresses
  const contracts = getContractsForChain(chainId);
  const borrowerOperationsAddress = contracts.borrowerOperations;
  // denManager is now per-token, not per-chain
  const denManagerAddress = selectedToken?.denManager;

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

  // Check token allowance for ERC20 tokens
  const {
    allowance,
    isLoading: isLoadingAllowance,
    refetch: refetchAllowance,
  } = useTokenAllowance(
    selectedToken,
    borrowerOperationsAddress as `0x${string}` | undefined
  );

  // Calculate required allowance
  const requiredAllowance = useMemo(() => {
    if (
      !selectedToken ||
      !amount ||
      parseFloat(amount) <= 0 ||
      isNativeToken(selectedToken.address)
    ) {
      return BigInt(0);
    }
    return parseUnits(amount, selectedToken.decimals);
  }, [selectedToken, amount]);

  // Check if approval is needed
  const needsApproval = useMemo(() => {
    if (!selectedToken || isNativeToken(selectedToken.address)) {
      return false;
    }
    if (!allowance || allowance === null) {
      return true;
    }
    return allowance < requiredAllowance;
  }, [selectedToken, allowance, requiredAllowance]);

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
      refetchAllowance();
    }
  }, [isApprovalConfirmed, refetchAllowance]);

  // Get token balance
  const {
    formattedBalance,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useTokenBalance(selectedToken);

  // Get token USD value (for input amount)
  const {
    formattedValue: usdValue,
    usdValue: collateralUsdValue,
    isLoading: isLoadingValue,
  } = useTokenValue(selectedToken, amount || undefined);

  // Calculate ATIUM amount based on collateral USD value and LTV ratio
  const calculatedAtiumAmount = useMemo(() => {
    if (!collateralUsdValue || collateralUsdValue <= 0) {
      return 0;
    }
    const atiumValue = (collateralUsdValue * ltvRatio) / 100;
    return atiumValue; // ATIUM is 1:1 with USD
  }, [collateralUsdValue, ltvRatio]);

  // Calculate LTV ratio based on ATIUM amount input
  const calculatedLtvRatio = useMemo(() => {
    if (
      !collateralUsdValue ||
      !atiumAmount ||
      collateralUsdValue <= 0 ||
      parseFloat(atiumAmount) <= 0
    ) {
      return ltvRatio;
    }
    const atiumValue = parseFloat(atiumAmount);
    if (collateralUsdValue === 0) return 0;
    return Math.min(1000, Math.max(0, (atiumValue / collateralUsdValue) * 100));
  }, [collateralUsdValue, atiumAmount, ltvRatio]);

  // Reset flags after updates
  useEffect(() => {
    if (isUpdatingFromSlider.current) {
      const timer = setTimeout(() => {
        isUpdatingFromSlider.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [ltvRatio]);

  useEffect(() => {
    if (isUpdatingFromInput.current) {
      const timer = setTimeout(() => {
        isUpdatingFromInput.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [atiumAmount]);

  // Clear ATIUM amount when collateral value becomes zero
  useEffect(() => {
    if (
      (!collateralUsdValue || collateralUsdValue === 0) &&
      atiumAmount &&
      !isUpdatingFromInput.current
    ) {
      setAtiumAmount("");
    }
  }, [collateralUsdValue, atiumAmount]);

  // Initialize or update token selection when chain changes
  useEffect(() => {
    const tokens = getTokensForChain(chainId);

    if (tokens.length === 0) {
      setSelectedToken(null);
      return;
    }

    // Check if this is a chain change or initial load
    const isChainChange = prevChainIdRef.current !== chainId;

    setSelectedToken((currentToken) => {
      // On chain change, try to find a matching token
      if (isChainChange && currentToken) {
        // First, try to find token with same address
        const sameAddressToken = tokens.find(
          (token) =>
            token.address.toLowerCase() === currentToken.address.toLowerCase()
        );

        if (sameAddressToken) {
          return sameAddressToken;
        }

        // If not found, try to find token with same symbol
        const sameSymbolToken = tokens.find(
          (token) => token.symbol === currentToken.symbol
        );

        if (sameSymbolToken) {
          return sameSymbolToken;
        }
      }

      // If no current token or no match found, select the first token
      if (!currentToken || isChainChange) {
        return tokens[0];
      }

      // Validate current token still exists on this chain
      const tokenExists = tokens.some(
        (token) =>
          token.address.toLowerCase() === currentToken.address.toLowerCase()
      );

      return tokenExists ? currentToken : tokens[0];
    });

    // Reset amount and ATIUM amount when chain changes
    if (isChainChange) {
      setAmount("");
      setAtiumAmount("");
      setLtvRatio(50);
      // Refetch balance for the new chain
      refetchBalance();
    }

    // Update the ref
    prevChainIdRef.current = chainId;
  }, [chainId, refetchBalance]);

  const handleApprove = async () => {
    if (
      !selectedToken ||
      !borrowerOperationsAddress ||
      isNativeToken(selectedToken.address)
    ) {
      return;
    }

    try {
      // Approve with a large amount (max uint256) to avoid needing multiple approvals
      const maxApproval = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      writeApprove({
        address: selectedToken.address as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "approve",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "approve",
        args: [borrowerOperationsAddress as `0x${string}`, maxApproval],
      });
    } catch (error) {
      console.error("Error approving token:", error);
    }
  };

  const handleDeposit = async () => {
    if (
      !selectedToken ||
      !amount ||
      parseFloat(amount) <= 0 ||
      !atiumAmount ||
      parseFloat(atiumAmount) <= 0 ||
      !userAddress ||
      !borrowerOperationsAddress ||
      !denManagerAddress
    ) {
      return;
    }

    try {
      // Convert amounts to BigInt with proper decimals
      const collateralAmountBigInt = parseUnits(amount, selectedToken.decimals);

      // ATIUM has 18 decimals (standard for stablecoins)
      const debtAmountBigInt = parseUnits(atiumAmount, 18);

      // Max fee percentage: BigInt(1e17) = 10% (1e17 / 1e18 = 0.1 = 10%)
      const maxFeePercentage = BigInt(1e17);

      // Call openDen function
      writeContract({
        address: borrowerOperationsAddress as `0x${string}`,
        abi: BorrowerOpsAbi,
        functionName: "openDen",
        args: [
          denManagerAddress as `0x${string}`, // denManager
          userAddress, // account
          maxFeePercentage, // _maxFeePercentage
          collateralAmountBigInt, // _collateralAmount
          debtAmountBigInt, // _debtAmount
          zeroAddress, // _upperHint
          zeroAddress, // _lowerHint
        ],
        value: isNativeToken(selectedToken.address)
          ? collateralAmountBigInt
          : BigInt(0),
      });
    } catch (error) {
      console.error("Error opening den:", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 mb-8 text-center">
          Deposit
        </h1>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            {/* Token Selector */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Collateral Token
              </label>
              <TokenSelector
                selectedToken={selectedToken}
                onTokenSelect={setSelectedToken}
              />
            </div>

            {/* Collateral Amount Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Collateral Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="any"
                  className="w-full px-4 py-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                />
                {selectedToken && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedToken.symbol}
                  </div>
                )}
              </div>
            </div>

            {/* LTV Ratio Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Loan-to-Value Ratio
                </label>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {ltvRatio}%
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={ltvRatio}
                  onChange={(e) => {
                    const newRatio = Number(e.target.value);
                    setLtvRatio(newRatio);
                    isUpdatingFromSlider.current = true;
                    // Immediately update ATIUM amount when slider changes
                    if (collateralUsdValue && collateralUsdValue > 0) {
                      const newAtiumAmount = (
                        (collateralUsdValue * newRatio) /
                        100
                      ).toFixed(2);
                      setAtiumAmount(newAtiumAmount);
                    }
                  }}
                  className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:dark:bg-zinc-50 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-50 [&::-webkit-slider-thumb]:dark:border-zinc-900 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-zinc-900 [&::-moz-range-thumb]:dark:bg-zinc-50 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-50 [&::-moz-range-thumb]:dark:border-zinc-900 [&::-moz-range-thumb]:border-none relative z-10"
                />
                <div
                  className="absolute top-0 left-0 h-2 rounded-lg pointer-events-none z-0 bg-zinc-900 dark:bg-zinc-50"
                  style={{
                    width: `${Math.min(100, (ltvRatio / 1000) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span>0%</span>
                <span>1000%</span>
              </div>
            </div>

            {/* ATIUM Amount Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                ATIUM to Mint
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={atiumAmount}
                  onChange={(e) => {
                    const newAtiumAmount = e.target.value;
                    setAtiumAmount(newAtiumAmount);
                    isUpdatingFromInput.current = true;
                    // Immediately update slider when ATIUM amount changes
                    if (
                      collateralUsdValue &&
                      collateralUsdValue > 0 &&
                      newAtiumAmount
                    ) {
                      const atiumValue = parseFloat(newAtiumAmount);
                      if (!isNaN(atiumValue) && atiumValue > 0) {
                        const newRatio = Math.min(
                          1000,
                          Math.max(0, (atiumValue / collateralUsdValue) * 100)
                        );
                        setLtvRatio(Math.round(newRatio));
                      }
                    }
                  }}
                  placeholder="0.0"
                  min="0"
                  step="any"
                  className="w-full px-4 py-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400">
                  ATIUM
                </div>
              </div>
            </div>

            {/* Balance and Value Display */}
            {selectedToken && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Available:
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {isLoadingBalance ? (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        Loading...
                      </span>
                    ) : (
                      `${formattedBalance} ${selectedToken.symbol}`
                    )}
                  </span>
                </div>
                <div className="text-zinc-400 dark:text-zinc-500">
                  {isLoadingValue ? (
                    <span className="text-zinc-400 dark:text-zinc-500">
                      Loading...
                    </span>
                  ) : (
                    usdValue
                  )}
                </div>
              </div>
            )}

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

            {/* Error Display */}
            {writeError && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                Error: {writeError.message}
              </div>
            )}

            {/* Success Display */}
            {isConfirmed && (
              <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                Transaction confirmed! Den opened successfully.
              </div>
            )}

            {/* Approval Button */}
            {needsApproval &&
              !isNativeToken(selectedToken?.address || "0x") && (
                <button
                  onClick={handleApprove}
                  disabled={
                    !selectedToken ||
                    !borrowerOperationsAddress ||
                    isApproving ||
                    isConfirmingApproval
                  }
                  className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApproving || isConfirmingApproval
                    ? "Approving..."
                    : `Approve ${selectedToken?.symbol || "Token"}`}
                </button>
              )}

            {/* Deposit Button */}
            <button
              onClick={handleDeposit}
              disabled={
                !selectedToken ||
                !amount ||
                parseFloat(amount) <= 0 ||
                !atiumAmount ||
                parseFloat(atiumAmount) <= 0 ||
                !userAddress ||
                !borrowerOperationsAddress ||
                !denManagerAddress ||
                needsApproval ||
                isWriting ||
                isConfirming
              }
              className="w-full py-3 px-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWriting || isConfirming
                ? "Processing..."
                : needsApproval
                ? "Approve Token First"
                : "Deposit & Mint ATIUM"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
