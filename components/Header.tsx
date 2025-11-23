import Link from "next/link";
import ConnectButton from "./ConnectButton";
import ChainSelector from "./ChainSelector";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-black/95 backdrop-blur-sm z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between relative">
        <Link
          href="/"
          className="text-xl font-semibold text-black dark:text-zinc-50 cursor-pointer focus:outline-none"
        >
          Hatsin
        </Link>
        <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-16">
          <Link
            href="/deposit"
            className="text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            Deposit
          </Link>
          <Link
            href="/withdraw"
            className="text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            Withdraw
          </Link>
          <Link
            href="/staking"
            className="text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            Staking
          </Link>
          <Link
            href="/swap"
            className="text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            Swap
          </Link>
          <Link
            href="/mint"
            className="text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            Mint
          </Link>
        </nav>
        <div className="flex items-center gap-4 relative z-10">
          <ChainSelector />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
