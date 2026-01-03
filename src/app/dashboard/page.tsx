"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";

import { authClient } from "@/lib/auth/client";
import { useAppStore } from "@/lib/store";
import { TripsModal } from "@/components/trips-modal";

const LeafletMap = dynamic(() => import("@/components/map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted animate-pulse" />,
});

export default function Dashboard() {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const activeTrip = useAppStore((state) => state.activeTrip);
  const setActiveTrip = useAppStore((state) => state.setActiveTrip);

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
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-muted/20">
      {/* Map Background */}
      <LeafletMap />
    </div>
  );
}
