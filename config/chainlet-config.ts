import { defineChain } from "viem";

// Chainlet Information
export const CHAINLET_ID = "hatsin_2763818285453000-1";
export const CHAINLET_CHAIN_ID = 2763818285453000;
export const CHAINLET_RPC_URL =
  "https://hatsin-2763818285453000-1.jsonrpc.sagarpc.io";
export const CHAINLET_WS_URL =
  "https://hatsin-2763818285453000-1.ws.sagarpc.io";
export const CHAINLET_EXPLORER_URL =
  "https://hatsin-2763818285453000-1.sagaexplorer.io";

// Genesis account (has 1,000,000 ETH for testing)
export const GENESIS_ACCOUNT =
  "0x3CdeDD8D288eD07BACE7fD3f12D0057AF55a07c6" as const;

export const hatsinChainlet = defineChain({
  id: CHAINLET_CHAIN_ID,
  name: "Hatsin",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [CHAINLET_RPC_URL],
      webSocket: [CHAINLET_WS_URL],
    },
    public: {
      http: [CHAINLET_RPC_URL],
      webSocket: [CHAINLET_WS_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Saga Explorer",
      url: CHAINLET_EXPLORER_URL,
    },
  },
  testnet: true,
});

export default hatsinChainlet;
