import {
  zircuitGarfieldTestnet,
  rootstockTestnet,
} from "@reown/appkit/networks";
import { hatsinChainlet } from "./chainlet-config";

// Type definitions
export type Token = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string; // CoinGecko ID for price fetching (e.g., "ethereum", "bitcoin")
  denManager?: `0x${string}`;
};

export type ProtocolContracts = {
  deposit?: `0x${string}`;
  borrowerOperations?: `0x${string}`;
  ispSwapRouter?: `0x${string}`;
  liquidStabilityPool?: `0x${string}`;
  withdraw?: `0x${string}`;
  staking?: `0x${string}`;
  vault?: `0x${string}`;
  bridge?: `0x${string}`;
  [key: string]: `0x${string}` | undefined;
};

export type ChainConfig = {
  chainId: number;
  tokens: Token[];
  contracts: ProtocolContracts;
};

// Native token placeholder (ETH, FLR, etc.)
const NATIVE_TOKEN: Omit<Token, "address"> = {
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  coingeckoId: "ethereum",
};

// Chain configurations
export const chainConfigs: Record<number, ChainConfig> = {
  // Zircuit Testnet
  [zircuitGarfieldTestnet.id]: {
    chainId: zircuitGarfieldTestnet.id,
    tokens: [
      {
        address: "0x1774a4Abd5363E5512697a1719A75a3E0b30373f" as `0x${string}`,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        coingeckoId: "ethereum",
        denManager: "0xcA386e4ba54C01B9d38c6989C9CAec3DfC614410",
      },
      {
        address: "0x987EF34474C0754883dCfAbB43eb5a3279786C31" as `0x${string}`,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        coingeckoId: "usd-coin",
        denManager:
          "0x1Df49269049dAab5797cE5178573340efc300D9c" as `0x${string}`,
      },
      {
        address: "0xFec3F6aEC39F70077154d0b012D645EFeF3d6390" as `0x${string}`,
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        decimals: 18,
        coingeckoId: "bitcoin",
        denManager:
          "0xC00db7E12c87Fc9A814E620EC40b41B3fa405142" as `0x${string}`,
      },
    ],
    contracts: {
      deposit: undefined,
      borrowerOperations: "0x1d0D2Ee02DC807e61983c661102E57f5ab896215",
      ispSwapRouter: "0xe915735eAF2a36002ad033a1d6fa818b219263D1",
      liquidStabilityPool: "0xeEB6c89390Fd0b03d11CCA2189a11F3648CE6283",
      withdraw: undefined,
      staking: undefined,
      vault: undefined,
      bridge: undefined,
    },
  },

  // Hatsin Chainlet
  [hatsinChainlet.id]: {
    chainId: hatsinChainlet.id,
    tokens: [
      {
        address: "0xCc11b4C90B4c7EB104825ae6a8d66B695a3E781a" as `0x${string}`,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        coingeckoId: "ethereum",
        denManager:
          "0xEd508a3d14e27C60c0d557e4142d12dC297cD2d3" as `0x${string}`,
      },
      {
        address: "0x7cF6d00DaA95134FF95cE5F47d5EB9069a514cA9" as `0x${string}`,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        coingeckoId: "usd-coin",
        denManager:
          "0x08547B0F5Cbeb58b1129c23d5DeaeFf4Ee5930cb" as `0x${string}`,
      },
      {
        address: "0xc3656c19265827FB71824DE03409e4B750fa925d" as `0x${string}`,
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        decimals: 18,
        coingeckoId: "bitcoin",
        denManager:
          "0x52d98E0d520f3aE8863fe2BdAEB6f8Cd1b5771eE" as `0x${string}`,
      },
    ],
    contracts: {
      deposit: undefined,
      withdraw: undefined,
      borrowerOperations: "0x02001D634A21C6898B8f6655bc619431Dc0AF6dE",
      ispSwapRouter: "0x3203c0eA537Ab0ada711202C3C578f1d68d1f141",
      liquidStabilityPool: "0x9841405F2C41Bb1d839bE9Ce67998FA80aa88052",
      staking: undefined,
      vault: undefined,
      bridge: undefined,
    },
  },

  // Rootstock Testnet
  [rootstockTestnet.id]: {
    chainId: rootstockTestnet.id,
    tokens: [
      {
        address: "0x7cF6d00DaA95134FF95cE5F47d5EB9069a514cA9" as `0x${string}`,
        symbol: "tRBTC",
        name: "Test Rootstock Bitcoin",
        decimals: 18,
        coingeckoId: "bitcoin",
        denManager:
          "0xE95b98cDBd20fF4aFcC92093220E096e474E0ce8" as `0x${string}`,
      },
      {
        address: "0x4342477a40F1B503A36DA395Eb88B9B3a3ab53D6" as `0x${string}`,
        symbol: "USDRIF",
        name: "RIF US Dollar",
        decimals: 18,
        coingeckoId: "rif-us-dollar",
        denManager:
          "0xEC60a49891027C13Ba44B3234dB9508437F0bD6a" as `0x${string}`,
      },
      {
        address: "0xc3656c19265827FB71824DE03409e4B750fa925d" as `0x${string}`,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        coingeckoId: "ethereum",
        denManager:
          "0x52d98E0d520f3aE8863fe2BdAEB6f8Cd1b5771eE" as `0x${string}`,
      },
    ],
    contracts: {
      deposit: undefined,
      borrowerOperations: "0x9841405F2C41Bb1d839bE9Ce67998FA80aa88052",
      ispSwapRouter: "0xc419c43303CC27D4D07E0993C44469494D75284e",
      liquidStabilityPool: "0xf34ec5de7f4B7D2D47D8463030592Df68A2Fd2Ec",
      withdraw: undefined,
      staking: undefined,
      vault: undefined,
      bridge: undefined,
    },
  },
};

// Helper functions
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return chainConfigs[chainId];
}

export function getTokensForChain(chainId: number): Token[] {
  return chainConfigs[chainId]?.tokens ?? [];
}

export function getContractsForChain(chainId: number): ProtocolContracts {
  return chainConfigs[chainId]?.contracts ?? {};
}

export function getTokenByAddress(
  chainId: number,
  address: `0x${string}`
): Token | undefined {
  const tokens = getTokensForChain(chainId);
  return tokens.find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
}

export function isNativeToken(address: `0x${string}`): boolean {
  return address === "0x0000000000000000000000000000000000000000";
}

/**
 * Get the USDC-equivalent token for a chain.
 * On Rootstock testnet, returns USDRIF. On other chains, returns USDC.
 * Returns null if neither token is available.
 */
export function getUsdcEquivalentToken(chainId: number): Token | null {
  const tokens = getTokensForChain(chainId);

  // On Rootstock testnet, return USDRIF
  if (chainId === rootstockTestnet.id) {
    return tokens.find((token) => token.symbol === "USDRIF") || null;
  }

  // On other chains, return USDC
  return tokens.find((token) => token.symbol === "USDC") || null;
}
