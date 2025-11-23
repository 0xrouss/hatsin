import {
  zircuit,
  zircuitGarfieldTestnet,
  rootstock,
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
};

export type ProtocolContracts = {
  deposit?: `0x${string}`;
  denManager?: `0x${string}`;
  borrowerOperations?: `0x${string}`;
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
  // Zircuit Mainnet
  [zircuit.id]: {
    chainId: zircuit.id,
    tokens: [
      {
        address: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Native ETH
        ...NATIVE_TOKEN,
      },
      {
        address: "0x4200000000000000000000000000000000000006" as `0x${string}`,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        coingeckoId: "ethereum",
      },
      {
        address: "0x19df5689Cfce64bC2A55F7220B0Cd522659955EF" as `0x${string}`,
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        decimals: 8,
        coingeckoId: "bitcoin",
      },
      {
        address: "0x3b952c8C9C44e8Fe201e2b26F6B2200203214cfF" as `0x${string}`,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        coingeckoId: "usd-coin",
      },
    ],
    contracts: {
      deposit: undefined, // Add contract address when deployed
      withdraw: undefined,
      staking: undefined,
      vault: undefined,
      bridge: undefined,
      bridge2: undefined,
    },
  },

  // Zircuit Testnet
  [zircuitGarfieldTestnet.id]: {
    chainId: zircuitGarfieldTestnet.id,
    tokens: [
      {
        address: "0xeB1eF3Eff5c19EDb930D1aE9f013257fA76ef3d5" as `0x${string}`,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        coingeckoId: "ethereum",
      },
    ],
    contracts: {
      deposit: undefined,
      denManager: "0xfFb470E3daDCa347aCE34a19789a7f1588628Bd2",
      borrowerOperations: "0x39Cab8A36431293D477bCA7A457377446f3edd98",
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
        address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        ...NATIVE_TOKEN,
      },
      // Add chainlet-specific tokens
    ],
    contracts: {
      deposit: undefined,
      withdraw: undefined,
      staking: undefined,
      vault: undefined,
      bridge: undefined,
    },
  },

  // Rootstock Mainnet
  [rootstock.id]: {
    chainId: rootstock.id,
    tokens: [
      {
        address: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Native RBTC
        symbol: "RBTC",
        name: "Rootstock Bitcoin",
        decimals: 18,
        coingeckoId: "bitcoin",
      },
      {
        address: "0x3a15461d8ae0f0fb5fa2629e9da7d66a794a6e37" as `0x${string}`,
        symbol: "USDRIF",
        name: "RIF US Dollar",
        decimals: 18,
        coingeckoId: "rif-us-dollar",
      },
      // Add Rootstock tokens
      // {
      //   address: "0x..." as `0x${string}`,
      //   symbol: "USDT",
      //   name: "Tether USD",
      //   decimals: 6,
      // },
    ],
    contracts: {
      deposit: undefined,
      withdraw: undefined,
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
        address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        symbol: "tRBTC",
        name: "Test Rootstock Bitcoin",
        decimals: 18,
        coingeckoId: "bitcoin",
      },
      {
        address: "0x8dbf326e12a9ff37ed6ddf75ada548c2640a6482" as `0x${string}`,
        symbol: "USDRIF",
        name: "RIF US Dollar",
        decimals: 18,
        coingeckoId: "rif-us-dollar",
      },
      {
        address: "0x8dbf326e12a9ff37ed6ddf75ada548c2640a6483" as `0x${string}`,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        coingeckoId: "ethereum",
      },
      {
        address: "0x8dbf326e12a9ff37ed6ddf75ada548c2640a6484" as `0x${string}`,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        coingeckoId: "usd-coin",
      },
      //0x8dbf326e12a9ff37ed6ddf75ada548c2640a6482,
      // Add testnet tokens
    ],
    contracts: {
      deposit: undefined,
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
