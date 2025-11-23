"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  useChainId,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits, zeroAddress } from "viem";
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
import { useDenPosition } from "@/hooks/useDenPosition";
import { BorrowerOpsAbi } from "@/ABIs/BorrowerOps";

export default function Deposit() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");
  const [atiumAmount, setAtiumAmount] = useState("");
  const [ltvRatio, setLtvRatio] = useState(50); // LTV ratio in percentage (0-1000)
  const [collateralMode, setCollateralMode] = useState<"add" | "remove">("add");
  const [lastTransactionType, setLastTransactionType] = useState<
    "open" | "add" | "remove" | "close" | null
  >(null);
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

  // Check if user has an existing den position
  const {
    hasPosition,
    collateral: existingCollateral,
    debt: existingDebt,
    isLoading: isLoadingPosition,
    refetch: refetchPosition,
  } = useDenPosition(denManagerAddress as `0x${string}` | undefined);

  // Get ATIUM (debt token) address from BorrowerOperations
  const { data: atiumTokenAddress } = useReadContract({
    address: borrowerOperationsAddress as `0x${string}` | undefined,
    abi: BorrowerOpsAbi,
    functionName: "debtToken",
    chainId: chainId,
    query: {
      enabled: !!borrowerOperationsAddress,
    },
  });

  // Create ATIUM token object for allowance check
  const atiumToken = useMemo(() => {
    if (!atiumTokenAddress) return null;
    return {
      address: atiumTokenAddress as `0x${string}`,
      symbol: "ATIUM",
      name: "ATIUM",
      decimals: 18,
    } as Token;
  }, [atiumTokenAddress]);

  // Check ATIUM allowance for closing position
  const {
    allowance: atiumAllowance,
    isLoading: isLoadingAtiumAllowance,
    refetch: refetchAtiumAllowance,
  } = useTokenAllowance(
    atiumToken,
    borrowerOperationsAddress as `0x${string}` | undefined
  );

  // Check token allowance for ERC20 tokens (collateral)
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

  // Check if approval is needed for collateral
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

  // Get token balance
  const {
    formattedBalance,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useTokenBalance(selectedToken);

  // Refetch allowance after approval
  useEffect(() => {
    if (isApprovalConfirmed) {
      refetchAllowance();
      refetchAtiumAllowance();
    }
  }, [isApprovalConfirmed, refetchAllowance, refetchAtiumAllowance]);

  // Refetch position after successful deposit
  useEffect(() => {
    if (isConfirmed) {
      refetchPosition();
      refetchBalance();
      // Reset transaction type after a delay to allow message to be seen
      setTimeout(() => {
        setLastTransactionType(null);
      }, 5000);
    }
  }, [isConfirmed, refetchPosition, refetchBalance]);

  // Get token USD value (for input amount)
  const {
    formattedValue: usdValue,
    usdValue: collateralUsdValue,
    isLoading: isLoadingValue,
  } = useTokenValue(selectedToken, amount || undefined);

  // Get token price for LTV calculations
  const { data: tokenPrice } = useTokenPrice(selectedToken);

  // Calculate current LTV ratio from existing position
  const currentLtvRatio = useMemo(() => {
    if (
      !hasPosition ||
      !tokenPrice ||
      existingCollateral === BigInt(0) ||
      existingDebt === BigInt(0)
    ) {
      return null;
    }

    // Convert existing collateral to USD value
    const existingCollateralAmount = parseFloat(
      formatUnits(existingCollateral, selectedToken?.decimals || 18)
    );
    const existingCollateralUsd = existingCollateralAmount * (tokenPrice || 0);

    // Convert existing debt to USD (ATIUM is 1:1 with USD, so debt in ATIUM = debt in USD)
    const existingDebtAmount = parseFloat(formatUnits(existingDebt, 18));

    if (existingCollateralUsd === 0) return null;

    return (existingDebtAmount / existingCollateralUsd) * 100;
  }, [
    hasPosition,
    tokenPrice,
    existingCollateral,
    existingDebt,
    selectedToken,
  ]);

  // Calculate new LTV ratio after adding or removing collateral
  const newLtvRatio = useMemo(() => {
    if (
      !hasPosition ||
      !tokenPrice ||
      !amount ||
      parseFloat(amount) <= 0 ||
      existingDebt === BigInt(0)
    ) {
      return null;
    }

    // Calculate existing collateral USD value
    const existingCollateralAmount = parseFloat(
      formatUnits(existingCollateral, selectedToken?.decimals || 18)
    );
    const existingCollateralUsd = existingCollateralAmount * (tokenPrice || 0);

    // Calculate new collateral USD value
    const newCollateralUsd = collateralUsdValue || 0;

    // Calculate total collateral based on mode
    const totalCollateralUsd =
      collateralMode === "add"
        ? existingCollateralUsd + newCollateralUsd
        : Math.max(0, existingCollateralUsd - newCollateralUsd);

    // Convert existing debt to USD
    const existingDebtAmount = parseFloat(formatUnits(existingDebt, 18));

    if (totalCollateralUsd === 0) return null;

    return (existingDebtAmount / totalCollateralUsd) * 100;
  }, [
    hasPosition,
    tokenPrice,
    existingCollateral,
    existingDebt,
    collateralUsdValue,
    amount,
    selectedToken,
    collateralMode,
  ]);

  // Check if user is closing position (removing max collateral)
  const isClosingPosition = useMemo(() => {
    if (
      !hasPosition ||
      collateralMode !== "remove" ||
      !selectedToken ||
      !amount ||
      parseFloat(amount) <= 0
    ) {
      return false;
    }

    const existingCollateralFormatted = formatUnits(
      existingCollateral,
      selectedToken.decimals
    );
    const amountToRemove = parseFloat(amount);
    const maxCollateral = parseFloat(existingCollateralFormatted);

    // Check if removing all collateral (with small tolerance for floating point)
    return (
      Math.abs(amountToRemove - maxCollateral) < 0.0001 ||
      amountToRemove >= maxCollateral
    );
  }, [hasPosition, collateralMode, selectedToken, amount, existingCollateral]);

  // Check if ATIUM approval is needed for closing position
  const needsAtiumApproval = useMemo(() => {
    if (!isClosingPosition || !existingDebt || existingDebt === BigInt(0)) {
      return false;
    }
    if (!atiumAllowance || atiumAllowance === null) {
      return true;
    }
    return atiumAllowance < existingDebt;
  }, [isClosingPosition, existingDebt, atiumAllowance]);

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

  const handleApproveAtium = async () => {
    if (!atiumToken || !borrowerOperationsAddress) {
      return;
    }

    try {
      // Approve with a large amount (max uint256) to avoid needing multiple approvals
      const maxApproval = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      writeApprove({
        address: atiumToken.address as `0x${string}`,
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
      console.error("Error approving ATIUM:", error);
    }
  };

  const handleDeposit = async () => {
    if (
      !selectedToken ||
      !amount ||
      parseFloat(amount) <= 0 ||
      !userAddress ||
      !borrowerOperationsAddress ||
      !denManagerAddress
    ) {
      return;
    }

    // For new positions, require ATIUM amount
    if (!hasPosition && (!atiumAmount || parseFloat(atiumAmount) <= 0)) {
      return;
    }

    try {
      // Convert amounts to BigInt with proper decimals
      const collateralAmountBigInt = parseUnits(amount, selectedToken.decimals);

      // Max fee percentage: BigInt(1e17) = 10% (1e17 / 1e18 = 0.1 = 10%)
      const maxFeePercentage = BigInt(1e17);

      if (hasPosition) {
        // User has existing position - use adjustDen to add or remove collateral
        if (collateralMode === "add") {
          // Adding collateral
          setLastTransactionType("add");
          writeContract({
            address: borrowerOperationsAddress as `0x${string}`,
            abi: BorrowerOpsAbi,
            functionName: "adjustDen",
            args: [
              denManagerAddress as `0x${string}`, // denManager
              userAddress, // account
              maxFeePercentage, // _maxFeePercentage
              collateralAmountBigInt, // _collDeposit
              BigInt(0), // _collWithdrawal (0 - only adding collateral)
              BigInt(0), // _debtChange (0 - not changing debt)
              false, // _isDebtIncrease (not applicable since debtChange is 0)
              zeroAddress, // _upperHint
              zeroAddress, // _lowerHint
            ],
            value: isNativeToken(selectedToken.address)
              ? collateralAmountBigInt
              : BigInt(0),
          });
        } else {
          // Removing collateral - check if removing max (closing position)
          const existingCollateralFormatted = formatUnits(
            existingCollateral,
            selectedToken.decimals
          );
          const amountToRemove = parseFloat(amount);
          const maxCollateral = parseFloat(existingCollateralFormatted);

          // Check if removing all collateral (with small tolerance for floating point)
          const isClosingPosition =
            Math.abs(amountToRemove - maxCollateral) < 0.0001 ||
            amountToRemove >= maxCollateral;

          if (isClosingPosition) {
            // Closing the position entirely
            setLastTransactionType("close");
            writeContract({
              address: borrowerOperationsAddress as `0x${string}`,
              abi: BorrowerOpsAbi,
              functionName: "closeDen",
              args: [
                denManagerAddress as `0x${string}`, // denManager
                userAddress, // account
              ],
              value: BigInt(0), // No value needed when closing
            });
          } else {
            // Removing partial collateral
            setLastTransactionType("remove");
            writeContract({
              address: borrowerOperationsAddress as `0x${string}`,
              abi: BorrowerOpsAbi,
              functionName: "adjustDen",
              args: [
                denManagerAddress as `0x${string}`, // denManager
                userAddress, // account
                maxFeePercentage, // _maxFeePercentage
                BigInt(0), // _collDeposit (0 - not adding collateral)
                collateralAmountBigInt, // _collWithdrawal
                BigInt(0), // _debtChange (0 - not changing debt)
                false, // _isDebtIncrease (not applicable since debtChange is 0)
                zeroAddress, // _upperHint
                zeroAddress, // _lowerHint
              ],
              value: BigInt(0), // No value needed when removing collateral
            });
          }
        }
      } else {
        // New position - use openDen
        setLastTransactionType("open");
        // ATIUM has 18 decimals (standard for stablecoins)
        const debtAmountBigInt = parseUnits(atiumAmount, 18);

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
      }
    } catch (error) {
      console.error("Error depositing:", error);
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

            {/* Collateral Mode Selector - Only show when user has a position */}
            {hasPosition && selectedToken && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Action
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCollateralMode("add")}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                      collateralMode === "add"
                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Add Collateral
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollateralMode("remove")}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                      collateralMode === "remove"
                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Remove Collateral
                  </button>
                </div>
              </div>
            )}

            {/* Collateral Amount Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {hasPosition
                  ? collateralMode === "add"
                    ? "Collateral to Add"
                    : "Collateral to Remove"
                  : "Collateral Amount"}
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
              {hasPosition && collateralMode === "remove" && selectedToken && (
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Max: {formatUnits(existingCollateral, selectedToken.decimals)}{" "}
                  {selectedToken.symbol}
                </div>
              )}
            </div>

            {/* Existing Position Info */}
            {hasPosition && selectedToken && (
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Existing Position
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Collateral:
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {isLoadingPosition ? (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          Loading...
                        </span>
                      ) : (
                        `${formatUnits(
                          existingCollateral,
                          selectedToken.decimals
                        )} ${selectedToken.symbol}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Debt:
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {isLoadingPosition ? (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          Loading...
                        </span>
                      ) : (
                        `${formatUnits(existingDebt, 18)} ATIUM`
                      )}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Current LTV:
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {currentLtvRatio !== null
                          ? `${currentLtvRatio.toFixed(2)}%`
                          : isLoadingPosition
                          ? "Loading..."
                          : "N/A"}
                      </span>
                    </div>
                    {amount &&
                      parseFloat(amount) > 0 &&
                      newLtvRatio !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600 dark:text-zinc-400">
                            New LTV:
                          </span>
                          <span
                            className={`font-semibold ${
                              collateralMode === "add"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {newLtvRatio.toFixed(2)}%
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* LTV Ratio Slider - Only show for new positions */}
            {!hasPosition && (
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
            )}

            {/* ATIUM Amount Input - Only show for new positions */}
            {!hasPosition && (
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
            )}

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
                {lastTransactionType === "open"
                  ? "Transaction confirmed! Den opened successfully."
                  : lastTransactionType === "add"
                  ? "Transaction confirmed! Collateral added successfully."
                  : lastTransactionType === "remove"
                  ? "Transaction confirmed! Collateral removed successfully."
                  : lastTransactionType === "close"
                  ? "Transaction confirmed! Position closed successfully."
                  : "Transaction confirmed successfully."}
              </div>
            )}

            {/* Approval Button for Collateral - Only show when adding collateral */}
            {needsApproval &&
              !isNativeToken(selectedToken?.address || "0x") &&
              (!hasPosition || collateralMode === "add") && (
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

            {/* Approval Button for ATIUM - Only show when closing position */}
            {needsAtiumApproval && isClosingPosition && (
              <button
                onClick={handleApproveAtium}
                disabled={
                  !atiumToken ||
                  !borrowerOperationsAddress ||
                  isApproving ||
                  isConfirmingApproval
                }
                className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving || isConfirmingApproval
                  ? "Approving..."
                  : "Approve ATIUM"}
              </button>
            )}

            {/* Deposit Button */}
            <button
              onClick={handleDeposit}
              disabled={
                !selectedToken ||
                !amount ||
                parseFloat(amount) <= 0 ||
                (!hasPosition &&
                  (!atiumAmount || parseFloat(atiumAmount) <= 0)) ||
                (hasPosition &&
                  collateralMode === "remove" &&
                  parseFloat(amount) >
                    parseFloat(
                      formatUnits(existingCollateral, selectedToken.decimals)
                    )) ||
                !userAddress ||
                !borrowerOperationsAddress ||
                !denManagerAddress ||
                (needsApproval && collateralMode === "add") ||
                isWriting ||
                isConfirming
              }
              className={`w-full py-3 px-4 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                hasPosition && collateralMode === "remove"
                  ? "bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600"
                  : "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100"
              }`}
            >
              {isWriting || isConfirming
                ? "Processing..."
                : needsApproval && collateralMode === "add"
                ? "Approve Token First"
                : needsAtiumApproval && isClosingPosition
                ? "Approve ATIUM First"
                : hasPosition
                ? collateralMode === "add"
                  ? "Add Collateral"
                  : isClosingPosition
                  ? "Close Position"
                  : "Remove Collateral"
                : "Deposit & Mint ATIUM"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
