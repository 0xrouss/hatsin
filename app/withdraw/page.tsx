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
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useDenPosition } from "@/hooks/useDenPosition";
import { BorrowerOpsAbi } from "@/ABIs/BorrowerOps";

export default function Withdraw() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [atiumAmount, setAtiumAmount] = useState("");
  const [debtMode, setDebtMode] = useState<"repay" | "mint">("repay");
  const [lastTransactionType, setLastTransactionType] = useState<
    "repay" | "mint" | "close" | null
  >(null);
  const prevChainIdRef = useRef<number>(chainId);

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

  // Get DEBT_GAS_COMPENSATION from BorrowerOperations
  const { data: debtGasCompensation } = useReadContract({
    address: borrowerOperationsAddress as `0x${string}` | undefined,
    abi: BorrowerOpsAbi,
    functionName: "DEBT_GAS_COMPENSATION",
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

  // Get user's ATIUM balance
  const {
    balance: atiumBalance,
    formattedBalance: formattedAtiumBalance,
    isLoading: isLoadingAtiumBalance,
  } = useTokenBalance(atiumToken);

  // Check ATIUM allowance for repaying debt
  const {
    allowance: atiumAllowance,
    isLoading: isLoadingAtiumAllowance,
    refetch: refetchAtiumAllowance,
  } = useTokenAllowance(
    atiumToken,
    borrowerOperationsAddress as `0x${string}` | undefined
  );

  // Calculate required ATIUM allowance for repayment
  const requiredAtiumAllowance = useMemo(() => {
    if (debtMode !== "repay" || !atiumAmount || parseFloat(atiumAmount) <= 0) {
      return BigInt(0);
    }
    return parseUnits(atiumAmount, 18); // ATIUM has 18 decimals
  }, [debtMode, atiumAmount]);

  // Check if ATIUM approval is needed for repaying debt
  const needsAtiumApproval = useMemo(() => {
    if (debtMode !== "repay") {
      return false;
    }
    if (!atiumAmount || parseFloat(atiumAmount) <= 0) {
      return false;
    }
    if (!atiumAllowance || atiumAllowance === null) {
      return true;
    }
    return atiumAllowance < requiredAtiumAllowance;
  }, [debtMode, atiumAmount, atiumAllowance, requiredAtiumAllowance]);

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
      refetchAtiumAllowance();
    }
  }, [isApprovalConfirmed, refetchAtiumAllowance]);

  // Refetch position after successful transaction
  useEffect(() => {
    if (isConfirmed) {
      refetchPosition();
      // Reset transaction type after a delay to allow message to be seen
      setTimeout(() => {
        setLastTransactionType(null);
      }, 5000);
    }
  }, [isConfirmed, refetchPosition]);

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

  // Calculate new debt after repay or mint
  const newDebt = useMemo(() => {
    if (!hasPosition || !atiumAmount || parseFloat(atiumAmount) <= 0) {
      return null;
    }

    const debtChange = parseUnits(atiumAmount, 18);
    if (debtMode === "repay") {
      // Repaying: new debt = existing debt - amount to repay
      const newDebtBigInt =
        existingDebt > debtChange ? existingDebt - debtChange : BigInt(0);
      return newDebtBigInt;
    } else {
      // Minting: new debt = existing debt + amount to mint
      return existingDebt + debtChange;
    }
  }, [hasPosition, atiumAmount, existingDebt, debtMode]);

  // Calculate required repayment to close position
  const requiredRepaymentToClose = useMemo(() => {
    if (!hasPosition || !existingDebt || !debtGasCompensation) {
      return null;
    }
    const gasComp = BigInt(debtGasCompensation as string);
    if (existingDebt <= gasComp) {
      return BigInt(0);
    }
    return existingDebt - gasComp;
  }, [hasPosition, existingDebt, debtGasCompensation]);

  // Calculate max repayable amount (user's balance - they can repay more than debt if they want)
  const maxRepayableAmount = useMemo(() => {
    if (!hasPosition || !atiumBalance) {
      return null;
    }
    // User can repay up to their balance (can be more than debt)
    return atiumBalance;
  }, [hasPosition, atiumBalance]);

  // Check if user is closing position (repaying all debt minus gas compensation)
  const isClosingPosition = useMemo(() => {
    if (
      !hasPosition ||
      debtMode !== "repay" ||
      !atiumAmount ||
      parseFloat(atiumAmount) <= 0 ||
      !existingDebt
    ) {
      return false;
    }

    const repaymentAmount = parseFloat(atiumAmount);
    const existingDebtFormatted = parseFloat(formatUnits(existingDebt, 18));

    // If repaying >= existing debt, position will definitely be closed
    if (repaymentAmount >= existingDebtFormatted) {
      return true;
    }

    // Otherwise, check if repaying >= required repayment to close (debt - gas compensation)
    if (!debtGasCompensation || !requiredRepaymentToClose) {
      return false;
    }

    const requiredRepaymentFormatted = parseFloat(
      formatUnits(requiredRepaymentToClose, 18)
    );

    // Position will be closed if user is repaying >= the required amount to close
    // (with small tolerance for floating point precision)
    return (
      Math.abs(repaymentAmount - requiredRepaymentFormatted) < 0.0001 ||
      repaymentAmount >= requiredRepaymentFormatted
    );
  }, [
    hasPosition,
    debtMode,
    atiumAmount,
    existingDebt,
    requiredRepaymentToClose,
    debtGasCompensation,
  ]);

  // Calculate new LTV ratio after debt change
  const newLtvRatio = useMemo(() => {
    if (
      !hasPosition ||
      !tokenPrice ||
      !newDebt ||
      existingCollateral === BigInt(0)
    ) {
      return null;
    }

    // Calculate existing collateral USD value
    const existingCollateralAmount = parseFloat(
      formatUnits(existingCollateral, selectedToken?.decimals || 18)
    );
    const existingCollateralUsd = existingCollateralAmount * (tokenPrice || 0);

    // Convert new debt to USD
    const newDebtAmount = parseFloat(formatUnits(newDebt, 18));

    if (existingCollateralUsd === 0) return null;

    return (newDebtAmount / existingCollateralUsd) * 100;
  }, [hasPosition, tokenPrice, existingCollateral, newDebt, selectedToken]);

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

    // Reset ATIUM amount when chain changes
    if (isChainChange) {
      setAtiumAmount("");
    }

    // Update the ref
    prevChainIdRef.current = chainId;
  }, [chainId]);

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

  const handleWithdraw = async () => {
    if (
      !selectedToken ||
      !atiumAmount ||
      parseFloat(atiumAmount) <= 0 ||
      !userAddress ||
      !borrowerOperationsAddress ||
      !denManagerAddress ||
      !hasPosition
    ) {
      return;
    }

    try {
      // Convert ATIUM amount to BigInt (ATIUM has 18 decimals)
      const debtChangeBigInt = parseUnits(atiumAmount, 18);

      // Max fee percentage: BigInt(1e17) = 10% (1e17 / 1e18 = 0.1 = 10%)
      const maxFeePercentage = BigInt(1e17);

      if (debtMode === "repay") {
        // Check if closing position (repaying max amount)
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
            value: BigInt(0), // No value needed
          });
        } else {
          // Partially repaying debt
          setLastTransactionType("repay");
          writeContract({
            address: borrowerOperationsAddress as `0x${string}`,
            abi: BorrowerOpsAbi,
            functionName: "adjustDen",
            args: [
              denManagerAddress as `0x${string}`, // denManager
              userAddress, // account
              maxFeePercentage, // _maxFeePercentage
              BigInt(0), // _collDeposit (0 - not changing collateral)
              BigInt(0), // _collWithdrawal (0 - not changing collateral)
              debtChangeBigInt, // _debtChange
              false, // _isDebtIncrease (false for repayment)
              zeroAddress, // _upperHint
              zeroAddress, // _lowerHint
            ],
            value: BigInt(0), // No value needed
          });
        }
      } else {
        // Minting more ATIUM
        setLastTransactionType("mint");
        writeContract({
          address: borrowerOperationsAddress as `0x${string}`,
          abi: BorrowerOpsAbi,
          functionName: "adjustDen",
          args: [
            denManagerAddress as `0x${string}`, // denManager
            userAddress, // account
            maxFeePercentage, // _maxFeePercentage
            BigInt(0), // _collDeposit (0 - not changing collateral)
            BigInt(0), // _collWithdrawal (0 - not changing collateral)
            debtChangeBigInt, // _debtChange
            true, // _isDebtIncrease (true for minting)
            zeroAddress, // _upperHint
            zeroAddress, // _lowerHint
          ],
          value: BigInt(0), // No value needed
        });
      }
    } catch (error) {
      console.error("Error adjusting debt:", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 mb-8 text-center">
          Withdraw
        </h1>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            {/* Token Selector - Always visible */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Collateral Token
              </label>
              <TokenSelector
                selectedToken={selectedToken}
                onTokenSelect={setSelectedToken}
              />
            </div>

            {/* Show message if no position for selected token */}
            {selectedToken && !hasPosition && !isLoadingPosition && (
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="text-center text-zinc-600 dark:text-zinc-400">
                  <p className="mb-2">
                    You don't have an open position for {selectedToken.symbol}.
                  </p>
                  <p className="text-sm">
                    Please select a collateral token with an existing position
                    to repay or mint ATIUM.
                  </p>
                </div>
              </div>
            )}

            {/* Show loading state while checking position */}
            {selectedToken && isLoadingPosition && (
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="text-center text-zinc-600 dark:text-zinc-400">
                  <p>Checking position...</p>
                </div>
              </div>
            )}

            {/* Debt Mode Selector */}
            {hasPosition && selectedToken && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Action
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDebtMode("repay")}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                      debtMode === "repay"
                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Repay ATIUM
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtMode("mint")}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                      debtMode === "mint"
                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Mint More ATIUM
                  </button>
                </div>
              </div>
            )}

            {/* ATIUM Amount Input */}
            {hasPosition && selectedToken && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {debtMode === "repay" ? "ATIUM to Repay" : "ATIUM to Mint"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={atiumAmount}
                    onChange={(e) => setAtiumAmount(e.target.value)}
                    placeholder="0.0"
                    min="0"
                    step="any"
                    className="w-full px-4 py-3 pr-20 text-lg font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {debtMode === "repay" &&
                      maxRepayableAmount !== null &&
                      !isLoadingAtiumBalance && (
                        <button
                          type="button"
                          onClick={() => {
                            if (maxRepayableAmount) {
                              setAtiumAmount(
                                formatUnits(maxRepayableAmount, 18)
                              );
                            }
                          }}
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                        >
                          MAX
                        </button>
                      )}
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      ATIUM
                    </span>
                  </div>
                </div>
                {debtMode === "repay" && (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {isLoadingAtiumBalance ? (
                      "Loading balance..."
                    ) : maxRepayableAmount !== null ? (
                      <>
                        Max: {formatUnits(maxRepayableAmount, 18)} ATIUM
                        {existingDebt && (
                          <>
                            <br />
                            <span className="text-zinc-400 dark:text-zinc-500">
                              Current debt: {formatUnits(existingDebt, 18)}{" "}
                              ATIUM
                            </span>
                          </>
                        )}
                        {requiredRepaymentToClose !== null &&
                          requiredRepaymentToClose > BigInt(0) && (
                            <>
                              <br />
                              <span className="text-green-600 dark:text-green-400">
                                To close:{" "}
                                {formatUnits(requiredRepaymentToClose, 18)}{" "}
                                ATIUM
                                {debtGasCompensation &&
                                typeof debtGasCompensation === "bigint" ? (
                                  <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                                    {" "}
                                    (Gas compensation:{" "}
                                    {formatUnits(debtGasCompensation, 18)}{" "}
                                    ATIUM)
                                  </span>
                                ) : null}
                              </span>
                            </>
                          )}
                      </>
                    ) : (
                      "Max: 0 ATIUM"
                    )}
                  </div>
                )}
              </div>
            )}

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
                    {atiumAmount &&
                      parseFloat(atiumAmount) > 0 &&
                      newDebt &&
                      newLtvRatio !== null && (
                        <>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-zinc-600 dark:text-zinc-400">
                              New Debt:
                            </span>
                            <span className="font-medium text-zinc-900 dark:text-zinc-50">
                              {formatUnits(newDebt, 18)} ATIUM
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-600 dark:text-zinc-400">
                              New LTV:
                            </span>
                            <span
                              className={`font-semibold ${
                                debtMode === "repay"
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {newLtvRatio.toFixed(2)}%
                            </span>
                          </div>
                        </>
                      )}
                  </div>
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
                {lastTransactionType === "repay"
                  ? "Transaction confirmed! Debt repaid successfully."
                  : lastTransactionType === "mint"
                  ? "Transaction confirmed! ATIUM minted successfully."
                  : lastTransactionType === "close"
                  ? "Transaction confirmed! Position closed successfully."
                  : "Transaction confirmed successfully."}
              </div>
            )}

            {/* Approval Button for ATIUM - Only show when repaying */}
            {needsAtiumApproval && debtMode === "repay" && (
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

            {/* Withdraw Button */}
            <button
              onClick={handleWithdraw}
              disabled={
                !selectedToken ||
                !atiumAmount ||
                parseFloat(atiumAmount) <= 0 ||
                !hasPosition ||
                (debtMode === "repay" &&
                  maxRepayableAmount !== null &&
                  parseFloat(atiumAmount) >
                    parseFloat(formatUnits(maxRepayableAmount, 18))) ||
                (debtMode === "mint" &&
                  existingDebt !== null &&
                  parseFloat(atiumAmount) <= 0) ||
                !userAddress ||
                !borrowerOperationsAddress ||
                !denManagerAddress ||
                (needsAtiumApproval && debtMode === "repay") ||
                isWriting ||
                isConfirming
              }
              className={`w-full py-3 px-4 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                debtMode === "repay"
                  ? "bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600"
                  : "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100"
              }`}
            >
              {isWriting || isConfirming
                ? "Processing..."
                : needsAtiumApproval && debtMode === "repay"
                ? "Approve ATIUM First"
                : isClosingPosition && debtMode === "repay"
                ? "Close Position"
                : debtMode === "repay"
                ? "Repay ATIUM"
                : "Mint More ATIUM"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
