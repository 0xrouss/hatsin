"use client";

import PositionsDashboard from "@/components/PositionsDashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full py-24 px-4 sm:px-6 lg:px-8">
        <PositionsDashboard />
      </main>
    </div>
  );
}
