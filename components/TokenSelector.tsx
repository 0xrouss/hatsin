"use client";

import { useChainId } from "wagmi";
import { getTokensForChain, type Token } from "@/config/contracts";
import { useState, useRef, useEffect } from "react";

interface TokenSelectorProps {
  selectedToken?: Token | null;
  onTokenSelect: (token: Token) => void;
  className?: string;
}

export default function TokenSelector({
  selectedToken,
  onTokenSelect,
  className = "",
}: TokenSelectorProps) {
  const chainId = useChainId();
  const tokens = getTokensForChain(chainId);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Validate that selected token exists on current chain
  const isValidToken = selectedToken
    ? tokens.some(
        (token) =>
          token.address.toLowerCase() === selectedToken.address.toLowerCase()
      )
    : false;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown when chain changes
  useEffect(() => {
    setIsOpen(false);
  }, [chainId]);

  const handleTokenSelect = (token: Token) => {
    onTokenSelect(token);
    setIsOpen(false);
  };

  const displayToken =
    (isValidToken ? selectedToken : null) ||
    (tokens.length > 0 ? tokens[0] : null);

  if (tokens.length === 0) {
    return (
      <div
        className={`px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg ${className}`}
      >
        No tokens available for this chain
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {displayToken?.logoURI ? (
            <img
              src={displayToken.logoURI}
              alt={displayToken.symbol}
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              {displayToken?.symbol.charAt(0) || "?"}
            </div>
          )}
          <span className="font-semibold">{displayToken?.symbol}</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {displayToken?.name}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {tokens.map((token) => (
            <button
              key={token.address}
              type="button"
              onClick={() => handleTokenSelect(token)}
              className={`w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center gap-3 ${
                isValidToken &&
                selectedToken?.address.toLowerCase() ===
                  token.address.toLowerCase()
                  ? "bg-zinc-100 dark:bg-zinc-900"
                  : ""
              }`}
            >
              {token.logoURI ? (
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  {token.symbol.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {token.symbol}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {token.name}
                </div>
              </div>
              {isValidToken &&
                selectedToken?.address.toLowerCase() ===
                  token.address.toLowerCase() && (
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
