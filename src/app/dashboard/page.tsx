"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/lib/auth/client";
import { useAppStore } from "@/lib/store";
import { TripsModal } from "@/components/trips-modal";

export default function Dashboard() {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const activeTripId = useAppStore((state) => state.activeTripId);
  const setActiveTripId = useAppStore((state) => state.setActiveTripId);

  useEffect(() => {
    if (!isPending && !data?.session) {
      router.push("/");
    }
  }, [isPending, data, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data?.session) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 font-sans">
      <main className="mx-auto max-w-5xl space-y-8">
        <div className="w-full">
          {activeTripId ? (
            <div className="space-y-4">
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Active Trip ID: {activeTripId}</p>
              <button
                onClick={() => setActiveTripId(null)}
                className="text-sm text-primary hover:underline"
              >
                Switch Trip
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <h2 className="text-2xl font-semibold">Welcome to Plantain!</h2>
              <p className="text-muted-foreground">Select a trip to get started with your plans.</p>
            </div>
          )}
        </div>
      </main>

      <TripsModal
        isOpen={!activeTripId}
        onSelect={(id) => setActiveTripId(id)}
      />
    </div>
  );
}
