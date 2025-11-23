"use client";

import { useState, useEffect } from "react";
import {
  useChainId,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import {
  getTokensForChain,
  type Token,
  getUsdcEquivalentToken,
} from "@/config/contracts";

// Simple mint ABI - matches the mint function in the test script
const mintAbi = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Mint amounts based on token type
const getMintAmount = (token: Token): string => {
  const symbol = token.symbol.toUpperCase();
  if (symbol === "WBTC" || symbol === "TRBTC") {
    return "10"; // 10 BTC
  } else if (symbol === "WETH") {
    return "1000"; // 1000 ETH
  } else if (symbol === "USDC" || symbol === "USDRIF") {
    return "100000"; // 100000 USDC/USDRIF
  }
  return "0";
};

export default function Mint() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const [mintingToken, setMintingToken] = useState<string | null>(null);

  // Get tokens for current chain
  const tokens = getTokensForChain(chainId);
  const usdcToken = getUsdcEquivalentToken(chainId);

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

  // Reset minting state after successful transaction
  useEffect(() => {
    if (isConfirmed) {
      setTimeout(() => {
        setMintingToken(null);
      }, 2000);
    }
  }, [isConfirmed]);

  const handleMint = async (token: Token) => {
    if (!userAddress) {
      return;
    }

    const amount = getMintAmount(token);
    if (amount === "0") {
      return;
    }

    try {
      setMintingToken(token.address);
      const amountInWei = parseUnits(amount, token.decimals);

      writeContract({
        address: token.address as `0x${string}`,
        abi: mintAbi,
        functionName: "mint",
        args: [userAddress, amountInWei],
      });
    } catch (error) {
      console.error("Error minting token:", error);
      setMintingToken(null);
    }
  };

  // Filter tokens to show only the 3 main tokens (WBTC, WETH, USDC/USDRIF)
  const mintableTokens = tokens.filter((token) => {
    const symbol = token.symbol.toUpperCase();
    return (
      symbol === "WBTC" ||
      symbol === "TRBTC" ||
      symbol === "WETH" ||
      symbol === "USDC" ||
      symbol === "USDRIF"
    );
  });

  if (tokens.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
        <div className="text-center">
          <div className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Mint Tokens
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
            No tokens available on this chain.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 mb-8 text-center">
          Mint Tokens
        </h1>

        {!userAddress && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200 text-center">
            Please connect your wallet to mint tokens.
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            {mintableTokens.map((token) => {
              const amount = getMintAmount(token);
              const isMinting = mintingToken === token.address;
              const isProcessing = isMinting && (isWriting || isConfirming);

              return (
                <div
                  key={token.address}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {token.symbol}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        {token.name}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                        Amount: {amount} {token.symbol}
                      </div>
                    </div>
                    <button
                      onClick={() => handleMint(token)}
                      disabled={!userAddress || isProcessing}
                      className="px-6 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing
                        ? "Minting..."
                        : isMinting && isConfirmed
                        ? "Minted!"
                        : "Mint"}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Error Display */}
            {writeError && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                Error: {writeError.message}
              </div>
            )}

            {/* Success Display */}
            {isConfirmed && mintingToken && (
              <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                Tokens minted successfully!
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <div className="font-semibold mb-2">Mint Amounts:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>BTC tokens: 10</li>
              <li>ETH tokens: 1000</li>
              <li>USDC/USDRIF tokens: 100000</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
