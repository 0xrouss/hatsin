import { type Address, formatUnits, erc20Abi } from "viem";
import { type Token, isNativeToken } from "@/config/contracts";

/**
 * Format token balance from BigInt to human-readable string
 */
export function formatTokenBalance(balance: bigint, decimals: number): string {
  return formatUnits(balance, decimals);
}

/**
 * Parse token balance from string to BigInt
 */
export function parseTokenBalance(amount: string, decimals: number): bigint {
  // Remove any non-numeric characters except decimal point
  const cleanAmount = amount.replace(/[^\d.]/g, "");

  if (!cleanAmount || cleanAmount === ".") {
    return BigInt(0);
  }

  // Split by decimal point
  const parts = cleanAmount.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = parts[1] || "";

  // Pad or truncate decimal part to match token decimals
  let decimalPadded = decimalPart.slice(0, decimals).padEnd(decimals, "0");

  // Combine and convert to BigInt
  const fullAmount = integerPart + decimalPadded;
  return BigInt(fullAmount);
}

/**
 * Get ERC20 balance ABI for reading token balance
 */
export const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Get ERC20 decimals ABI for reading token decimals
 */
export const ERC20_DECIMALS_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Check if an address is a valid token address
 */
export function isValidTokenAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get the token address for balance reading
 * Returns the token address or undefined for native tokens
 */
export function getTokenAddressForBalance(token: Token): Address | undefined {
  if (isNativeToken(token.address)) {
    return undefined;
  }
  return token.address as Address;
}
