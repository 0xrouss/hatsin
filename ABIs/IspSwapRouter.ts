import { Abi } from "viem";

export const IspSwapRouterAbi: Abi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_liquidStabilityPool",
        type: "address",
        internalType: "address",
      },
      {
        name: "_liquidStabilityPoolGetters",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buildPreferredTokens",
    inputs: [{ name: "tokenOut", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "preferredUnderlyingTokens",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "liquidStabilityPool",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract ILiquidStabilityPool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "liquidStabilityPoolGetters",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract ILiquidStabilityPoolGetters",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nect",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "swap",
    inputs: [
      { name: "tokenIn", type: "address", internalType: "address" },
      { name: "tokenOut", type: "address", internalType: "address" },
      { name: "amountIn", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];
