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
        address: "0x4f8bc040b06b9bf3C3e5a1214c0112A9e3cd18dc" as `0x${string}`,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        coingeckoId: "ethereum",
        denManager: "0xCf5E2731D33649BACbD8893F84B682E0bCAcD950",
      },
    ],
    contracts: {
      deposit: undefined,
      borrowerOperations: "0x59f60DFF9523aE063d512d9ca44e0423aDAA6BD9",
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
