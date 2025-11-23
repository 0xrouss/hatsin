"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  useChainId,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import TokenSelector from "@/components/TokenSelector";
import {
  type Token,
  getTokensForChain,
  getContractsForChain,
  getUsdcEquivalentToken,
} from "@/config/contracts";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useTokenAllowance } from "@/hooks/useTokenAllowance";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { BorrowerOpsAbi } from "@/ABIs/BorrowerOps";
import { liquidStabilityPoolAbi } from "@/ABIs/liquidStabilityPool";
import { erc20Abi } from "viem";

export default function Staking() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const [action, setAction] = useState<"stake" | "unstake">("stake");
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");
  const prevChainIdRef = useRef<number>(chainId);

  // Get contract addresses
  const contracts = getContractsForChain(chainId);
  const liquidStabilityPoolAddress = contracts.liquidStabilityPool;
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

      // If no current token or no match found, prefer USDC, then ATIUM, then first token
      if (!currentToken || isChainChange) {
        if (usdcToken) return usdcToken;
        if (atiumToken) return atiumToken;
        return tokens[0];
      }

      // Validate current token still exists on this chain
      const tokenExists = tokens.some(
        (token) =>
          token.address.toLowerCase() === currentToken.address.toLowerCase()
      );

      return tokenExists ? currentToken : tokens[0];
    });

    // Reset amount when chain changes
    if (isChainChange) {
      setAmount("");
    }

    // Update the ref
    prevChainIdRef.current = chainId;
  }, [chainId, usdcToken, atiumToken]);

  // Get user's token balance (for staking)
  const {
    balance: tokenBalance,
    formattedBalance: formattedTokenBalance,
    isLoading: isLoadingTokenBalance,
    refetch: refetchTokenBalance,
  } = useTokenBalance(selectedToken);

  // Get user's staked balance (shares in liquidStabilityPool)
  const { data: stakedShares, refetch: refetchStakedShares } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: chainId,
    query: {
      enabled: !!liquidStabilityPoolAddress && !!userAddress,
    },
  });

  // Get total supply (total shares) from liquidStabilityPool
  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "totalSupply",
    chainId: chainId,
    query: {
      enabled: !!liquidStabilityPoolAddress,
    },
  });

  // Get total assets from liquidStabilityPool
  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "totalAssets",
    chainId: chainId,
    query: {
      enabled: !!liquidStabilityPoolAddress,
    },
  });

  // Convert staked shares to assets
  const { data: stakedAssets } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "convertToAssets",
    args: stakedShares ? [stakedShares as bigint] : undefined,
    chainId: chainId,
    query: {
      enabled:
        !!liquidStabilityPoolAddress &&
        !!stakedShares &&
        (stakedShares as bigint) > BigInt(0),
    },
  });

  // Get the asset token address (ATIUM) from liquidStabilityPool
  const { data: assetTokenAddress } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "asset",
    chainId: chainId,
    query: {
      enabled: !!liquidStabilityPoolAddress,
    },
  });

  // Preview shares for deposit
  // Note: previewDeposit expects assets in ATIUM (18 decimals)
  // For USDC-equivalent token, we need to convert to ATIUM value using the price feed
  // Also, previewDeposit may fail if pool state causes arithmetic errors (e.g., empty pool)
  const isStaking =
    action === "stake" &&
    selectedToken &&
    amount &&
    parseFloat(amount) > 0 &&
    !isNaN(parseFloat(amount));

  const isStakingAtium = isStaking && selectedToken?.symbol === "ATIUM";
  const isStakingUsdc =
    isStaking && selectedToken?.symbol === usdcToken?.symbol;

  // Get USDC-equivalent token price for conversion
  const { data: usdcPrice } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "getPrice",
    args: usdcToken ? [usdcToken.address as `0x${string}`] : undefined,
    chainId: chainId,
    query: {
      enabled: Boolean(
        liquidStabilityPoolAddress &&
          usdcToken &&
          isStakingUsdc &&
          amount &&
          parseFloat(amount) > 0
      ),
    },
  });

  // Convert USDC-equivalent token amount to ATIUM value (18 decimals)
  // Formula: tokenAmount * tokenPrice / 10^tokenDecimals
  const usdcAmountInAtium = useMemo(() => {
    if (!isStakingUsdc || !amount || !usdcPrice || !usdcToken) return null;
    try {
      const tokenAmount = parseUnits(amount, usdcToken.decimals); // Token decimals (USDC=6, USDRIF=18)
      const price = usdcPrice as bigint; // Price is in 18 decimals WAD format
      // Convert: (tokenAmount * price) / 10^tokenDecimals
      const atiumValue =
        (tokenAmount * price) / BigInt(10 ** usdcToken.decimals);
      return atiumValue;
    } catch (error) {
      console.error("Error converting token to ATIUM value:", error);
      return null;
    }
  }, [isStakingUsdc, amount, usdcPrice, usdcToken]);

  // Only enable preview if pool has some supply (to avoid arithmetic errors)
  const shouldPreviewDeposit = useMemo(() => {
    if (!isStaking) return false;
    if (
      totalSupply === null ||
      totalSupply === undefined ||
      (totalSupply as bigint) === BigInt(0)
    ) {
      return false;
    }
    // For USDC, also check if we have the converted amount
    if (isStakingUsdc) {
      return usdcAmountInAtium !== null && usdcAmountInAtium > BigInt(0);
    }
    return true;
  }, [isStaking, isStakingUsdc, totalSupply, usdcAmountInAtium]);

  const previewDepositArgs = useMemo(() => {
    if (!shouldPreviewDeposit) return undefined;
    try {
      if (isStakingAtium) {
        return [parseUnits(amount, 18)]; // ATIUM has 18 decimals
      } else if (isStakingUsdc && usdcAmountInAtium) {
        return [usdcAmountInAtium]; // Already in ATIUM value (18 decimals)
      }
      return undefined;
    } catch (error) {
      console.error("Error parsing amount for preview:", error);
      return undefined;
    }
  }, [
    shouldPreviewDeposit,
    isStakingAtium,
    isStakingUsdc,
    amount,
    usdcAmountInAtium,
  ]);

  const {
    data: previewShares,
    error: previewSharesError,
    isLoading: isLoadingPreviewShares,
  } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "previewDeposit",
    args: previewDepositArgs,
    chainId: chainId,
    query: {
      enabled:
        !!liquidStabilityPoolAddress &&
        !!shouldPreviewDeposit &&
        !!previewDepositArgs,
      retry: false, // Don't retry on error to avoid hanging
    },
  });

  // Check if we're loading USDC-equivalent token price
  const isLoadingUsdcPrice = useMemo(() => {
    return isStakingUsdc && usdcPrice === undefined;
  }, [isStakingUsdc, usdcPrice]);

  // Preview shares needed for withdrawal
  // Note: previewWithdraw expects assets in ATIUM (18 decimals), not selectedToken decimals
  const { data: previewSharesForWithdraw } = useReadContract({
    address: liquidStabilityPoolAddress as `0x${string}` | undefined,
    abi: liquidStabilityPoolAbi,
    functionName: "previewWithdraw",
    args:
      amount && selectedToken && parseFloat(amount) > 0
        ? [parseUnits(amount, 18)] // Assets are always in ATIUM (18 decimals)
        : undefined,
    chainId: chainId,
    query: {
      enabled:
        !!liquidStabilityPoolAddress &&
        !!amount &&
        !!selectedToken &&
        parseFloat(amount) > 0 &&
        action === "unstake",
    },
  });

  // Check token allowance for staking
  const {
    allowance: tokenAllowance,
    isLoading: isLoadingTokenAllowance,
    refetch: refetchTokenAllowance,
  } = useTokenAllowance(
    selectedToken,
    liquidStabilityPoolAddress as `0x${string}` | undefined
  );

  // Calculate required allowance
  const requiredAllowance = useMemo(() => {
    if (
      action !== "stake" ||
      !amount ||
      parseFloat(amount) <= 0 ||
      !selectedToken
    ) {
      return BigInt(0);
    }
    return parseUnits(amount, selectedToken.decimals);
  }, [action, amount, selectedToken]);

  // Check if approval is needed
  const needsApproval = useMemo(() => {
    if (action !== "stake") {
      return false;
    }
    if (!amount || parseFloat(amount) <= 0 || !selectedToken) {
      return false;
    }
    if (!tokenAllowance || tokenAllowance === null) {
      return true;
    }
    return tokenAllowance < requiredAllowance;
  }, [action, amount, selectedToken, tokenAllowance, requiredAllowance]);

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
      refetchTokenAllowance();
    }
  }, [isApprovalConfirmed, refetchTokenAllowance]);

  // Refetch balances after successful transaction
  useEffect(() => {
    if (isConfirmed) {
      refetchTokenBalance();
      refetchStakedShares();
      refetchTotalSupply();
      refetchTotalAssets();
      // Reset amount after successful transaction
      setTimeout(() => {
        setAmount("");
      }, 2000);
    }
  }, [
    isConfirmed,
    refetchTokenBalance,
    refetchStakedShares,
    refetchTotalSupply,
    refetchTotalAssets,
  ]);

  const handleApprove = async () => {
    if (!selectedToken || !liquidStabilityPoolAddress) {
      return;
    }

    try {
      // Approve with max uint256 to avoid multiple approvals
      const maxApproval = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      writeApprove({
        address: selectedToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [liquidStabilityPoolAddress as `0x${string}`, maxApproval],
      });
    } catch (error) {
      console.error("Error approving token:", error);
    }
  };

  const handleStake = async () => {
    if (
      !selectedToken ||
      !amount ||
      parseFloat(amount) <= 0 ||
      !userAddress ||
      !liquidStabilityPoolAddress
    ) {
      return;
    }

    try {
      const assets = parseUnits(amount, selectedToken.decimals);

      writeContract({
        address: liquidStabilityPoolAddress as `0x${string}`,
        abi: liquidStabilityPoolAbi,
        functionName: "deposit",
        args: [
          assets, // assets
          userAddress, // receiver
          selectedToken.address as `0x${string}`, // inputToken
        ],
        value: BigInt(0),
      });
    } catch (error) {
      console.error("Error staking:", error);
    }
  };

  const handleUnstake = async () => {
    if (
      !selectedToken ||
      !amount ||
      parseFloat(amount) <= 0 ||
      !userAddress ||
      !liquidStabilityPoolAddress
    ) {
      return;
    }

    try {
      // Withdraw expects assets in ATIUM (18 decimals), not selectedToken decimals
      const assets = parseUnits(amount, 18);

      writeContract({
        address: liquidStabilityPoolAddress as `0x${string}`,
        abi: liquidStabilityPoolAbi,
        functionName: "withdraw",
        args: [
          assets, // assets (in ATIUM, 18 decimals)
          userAddress, // receiver
          userAddress, // owner
        ],
        value: BigInt(0),
      });
    } catch (error) {
      console.error("Error unstaking:", error);
    }
  };

  const handleMax = () => {
    if (action === "stake" && tokenBalance) {
      // Use selectedToken decimals (USDC=6, USDRIF=18, ATIUM=18)
      setAmount(formatUnits(tokenBalance, selectedToken?.decimals || 18));
    } else if (
      action === "unstake" &&
      stakedAssets !== null &&
      stakedAssets !== undefined
    ) {
      // For unstaking, stakedAssets are in ATIUM (18 decimals)
      // The user will receive tokens based on the pool's composition
      setAmount(formatUnits(stakedAssets as bigint, 18));
    }
  };

  // Format staked balance
  const formattedStakedBalance = useMemo(() => {
    if (!stakedAssets) return "0";
    // The staked assets are in ATIUM (the pool's asset token)
    // We'll display it in terms of the selected token for simplicity
    // In reality, the user receives a mix of tokens when withdrawing
    return formatUnits(stakedAssets as bigint, 18); // ATIUM has 18 decimals
  }, [stakedAssets]);

  // Calculate user's percentage share of the pool
  const userSharePercentage = useMemo(() => {
    if (!stakedShares || !totalSupply || totalSupply === BigInt(0)) {
      return null;
    }
    const userShares = stakedShares as bigint;
    const totalShares = totalSupply as bigint;
    // Calculate percentage: (userShares / totalShares) * 100
    // Use BigInt arithmetic with precision
    const percentage = (Number(userShares) / Number(totalShares)) * 100;
    return percentage;
  }, [stakedShares, totalSupply]);

  // Calculate user's composition value (their percentage part of totalAssets)
  const userCompositionValue = useMemo(() => {
    if (!totalAssets || userSharePercentage === null) {
      return null;
    }
    const totalAssetsBigInt = totalAssets as bigint;
    // Calculate: (userSharePercentage / 100) * totalAssets
    const value = (userSharePercentage / 100) * Number(totalAssetsBigInt);
    return BigInt(Math.floor(value));
  }, [totalAssets, userSharePercentage]);

  // Check if USDC or ATIUM is available
  const availableTokens = useMemo(() => {
    const tokens: Token[] = [];
    if (usdcToken) tokens.push(usdcToken);
    if (atiumToken) tokens.push(atiumToken);
    return tokens;
  }, [usdcToken, atiumToken]);

  // Ensure selected token is one of the available tokens
  useEffect(() => {
    if (
      selectedToken &&
      !availableTokens.some(
        (token) =>
          token.address.toLowerCase() === selectedToken.address.toLowerCase()
      )
    ) {
      setSelectedToken(availableTokens[0] || null);
    }
  }, [selectedToken, availableTokens]);

  // Show error if liquidStabilityPool is not configured
  if (!liquidStabilityPoolAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Staking
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
            Liquid Stability Pool is not configured for this chain.
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
            Staking
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Loading ATIUM token address...
          </div>
        </div>
      </div>
    );
  }

  if (availableTokens.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Staking
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
            {usdcToken?.symbol || "USDC"} or ATIUM is not available on this
            chain.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 mb-8 text-center">
          Staking
        </h1>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            {/* Action Selector */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Action
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAction("stake");
                    setAmount("");
                  }}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                    action === "stake"
                      ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  Stake
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAction("unstake");
                    setAmount("");
                  }}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                    action === "unstake"
                      ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  Unstake
                </button>
              </div>
            </div>

            {/* Token Selector - Only show USDC-equivalent and ATIUM */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Token
              </label>
              <div className="flex gap-2">
                {usdcToken !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedToken(usdcToken)}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                      selectedToken?.address.toLowerCase() ===
                      usdcToken.address.toLowerCase()
                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {usdcToken?.symbol || "USDC"}
                  </button>
                )}
                {atiumToken !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedToken(atiumToken)}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-colors ${
                      selectedToken?.address.toLowerCase() ===
                      atiumToken.address.toLowerCase()
                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    ATIUM
                  </button>
                )}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {action === "stake" ? "Amount to Stake" : "Amount to Unstake"} (
                {selectedToken?.symbol})
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
                  {(action === "stake"
                    ? tokenBalance !== null
                    : stakedAssets !== null && stakedAssets !== undefined) && (
                    <button
                      type="button"
                      onClick={handleMax}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                      MAX
                    </button>
                  )}
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedToken?.symbol}
                  </span>
                </div>
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {action === "stake"
                  ? isLoadingTokenBalance
                    ? "Loading balance..."
                    : tokenBalance !== null
                    ? `Balance: ${formattedTokenBalance} ${selectedToken?.symbol}`
                    : `Balance: 0 ${selectedToken?.symbol}`
                  : `Staked: ${formattedStakedBalance} (in pool assets)`}
              </div>
            </div>

            {/* User Staking Position Info */}
            {stakedShares !== null &&
              stakedShares !== undefined &&
              (stakedShares as bigint) > BigInt(0) && (
                <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Your Staking Position
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Your Shares:
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {formatUnits(stakedShares as bigint, 18)}
                      </span>
                    </div>
                    {totalSupply !== null && totalSupply !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          Total Shares:
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatUnits(totalSupply as bigint, 18)}
                        </span>
                      </div>
                    )}
                    {userSharePercentage !== null && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          Your Share %:
                        </span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {userSharePercentage.toFixed(6)}%
                        </span>
                      </div>
                    )}
                    {totalAssets !== null && totalAssets !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          Total Pool Assets:
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatUnits(totalAssets as bigint, 18)} (in ATIUM)
                        </span>
                      </div>
                    )}
                    {userCompositionValue !== null && (
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600 dark:text-zinc-400">
                            Your Composition Value:
                          </span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {formatUnits(userCompositionValue, 18)} (in ATIUM)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Preview Info */}
            {amount && parseFloat(amount) > 0 && (
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Preview
                </div>
                {action === "stake" &&
                (selectedToken?.symbol === "ATIUM" ||
                  selectedToken?.symbol === usdcToken?.symbol) ? (
                  !shouldPreviewDeposit ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {isLoadingUsdcPrice &&
                      selectedToken?.symbol === usdcToken?.symbol
                        ? "Loading price..."
                        : "Preview unavailable. Pool may be empty or initializing. Shares will be calculated on deposit."}
                    </div>
                  ) : previewSharesError ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Preview unavailable. Shares will be calculated based on
                      current pool state when you deposit.
                    </div>
                  ) : isLoadingPreviewShares || isLoadingUsdcPrice ? (
                    <div className="text-sm text-zinc-500 dark:text-zinc-500">
                      Calculating...
                    </div>
                  ) : previewShares ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      You will receive:{" "}
                      {formatUnits(previewShares as bigint, 18)} shares
                      {selectedToken?.symbol === usdcToken?.symbol &&
                        usdcAmountInAtium && (
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            ({amount} {usdcToken?.symbol} ≈{" "}
                            {formatUnits(usdcAmountInAtium, 18)} ATIUM)
                          </span>
                        )}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500 dark:text-zinc-500">
                      Calculating...
                    </div>
                  )
                ) : action === "unstake" && previewSharesForWithdraw ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    You will redeem:{" "}
                    {formatUnits(previewSharesForWithdraw as bigint, 18)} shares
                  </div>
                ) : null}
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

            {/* Transaction Error Display */}
            {writeError && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                Error: {writeError.message}
              </div>
            )}

            {/* Transaction Success Display */}
            {isConfirmed && (
              <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                {action === "stake"
                  ? "Staking completed successfully!"
                  : "Unstaking completed successfully!"}
              </div>
            )}

            {/* Approval Button */}
            {needsApproval && action === "stake" && (
              <button
                onClick={handleApprove}
                disabled={
                  !selectedToken ||
                  !liquidStabilityPoolAddress ||
                  isApproving ||
                  isConfirmingApproval
                }
                className="w-full py-3 px-4 bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving || isConfirmingApproval
                  ? "Approving..."
                  : `Approve ${selectedToken?.symbol}`}
              </button>
            )}

            {/* Stake/Unstake Button */}
            <button
              onClick={action === "stake" ? handleStake : handleUnstake}
              disabled={
                !selectedToken ||
                !amount ||
                parseFloat(amount) <= 0 ||
                (action === "stake" &&
                  tokenBalance !== null &&
                  parseFloat(amount) >
                    parseFloat(
                      formatUnits(tokenBalance, selectedToken.decimals)
                    )) ||
                (action === "unstake" &&
                  stakedAssets !== null &&
                  stakedAssets !== undefined &&
                  parseFloat(amount) >
                    parseFloat(formatUnits(stakedAssets as bigint, 18))) ||
                !userAddress ||
                !liquidStabilityPoolAddress ||
                (needsApproval && action === "stake") ||
                isWriting ||
                isConfirming
              }
              className="w-full py-3 px-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWriting || isConfirming
                ? "Processing..."
                : needsApproval && action === "stake"
                ? `Approve ${selectedToken?.symbol} First`
                : action === "stake"
                ? "Stake"
                : "Unstake"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
