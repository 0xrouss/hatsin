"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { networks } from "@/config";

export default function ChainSelector() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const currentChain = networks.find((chain) => chain.id === chainId);

  return (
    <select
      value={chainId}
      onChange={(e) => {
        const newChainId = Number(e.target.value);
        switchChain({ chainId: newChainId });
      }}
      className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
    >
      {networks.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
        </option>
      ))}
    </select>
  );
}

