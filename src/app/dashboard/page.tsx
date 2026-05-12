"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { getChatMessages, getTrips } from "@/app/actions/trips";
import { ChatRail } from "@/components/chat-rail";
import { MapRailTabs } from "@/components/map-rail-tabs";
import { PlaceDetailsPanel } from "@/components/place-details-panel";
import { TripsModal } from "@/components/trips-modal";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { authClient } from "@/lib/auth/client";
import {
  updateDashboardSearchParams,
  withDashboardTrip,
} from "@/lib/dashboard-url";
import { useAppStore } from "@/lib/store";

const LeafletMap = dynamic(() => import("@/components/map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted animate-pulse" />,
});

export default function Dashboard() {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTrip = useAppStore((state) => state.activeTrip);
  const setActiveTrip = useAppStore((state) => state.setActiveTrip);
  const selectedTripId = searchParams.get("trip");
  const inviteState = searchParams.get("invite");

  useEffect(() => {
    if (!isPending && !data) {
      router.push("/");
    }
  }, [isPending, data, router]);

  useEffect(() => {
    if (isPending || !data) {
      return;
    }

    let cancelled = false;

    const syncTripSelection = async () => {
      const trips = await getTrips();
      if (cancelled) return;

      const persistedTripId = useAppStore.getState().activeTrip?.id ?? null;
      const fallbackTripId =
        selectedTripId ??
        (persistedTripId && trips.some((trip) => trip.id === persistedTripId)
          ? persistedTripId
          : trips[0]?.id ?? null);

      if (!fallbackTripId) {
        setActiveTrip(null);
        return;
      }

      if (selectedTripId !== fallbackTripId) {
        router.replace(withDashboardTrip(searchParams, fallbackTripId));
        return;
      }

      const freshTrip = trips.find((trip) => trip.id === fallbackTripId);
      if (!freshTrip) {
        const nextTripId = trips[0]?.id ?? null;
        if (!nextTripId) {
          setActiveTrip(null);
          return;
        }

        router.replace(withDashboardTrip(searchParams, nextTripId));
        return;
      }

      const chatData = await getChatMessages(fallbackTripId);
      if (cancelled) return;

      const chatDataObj = chatData;
      const messages = Array.isArray(chatDataObj)
        ? chatDataObj
        : chatDataObj?.messages || [];
      const hasMore = Array.isArray(chatDataObj)
        ? false
        : !!chatDataObj?.hasMore;

      setActiveTrip({
        ...freshTrip,
        chatMessages: messages,
        hasMoreMessages: hasMore,
      });
    };

    void syncTripSelection().catch((error) => {
      console.error("Failed to sync trip data:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [data, isPending, router, searchParams, selectedTripId, setActiveTrip]);

  useEffect(() => {
    if (inviteState !== "accepted") {
      return;
    }

    toast.success("You joined the trip. Team chat is ready when you are.");
    router.replace(
      updateDashboardSearchParams(searchParams, (params) => {
        params.delete("invite");
      }),
    );
  }, [inviteState, router, searchParams]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-muted/20">
      <ResizablePanelGroup className="h-full w-full">
        <ResizablePanel defaultSize={70} minSize={30}>
          <div className="relative h-full w-full">
            {/* Map Background */}
            <LeafletMap />
            <PlaceDetailsPanel />
            {activeTrip ? (
              <MapRailTabs
                tripId={activeTrip.id}
                startDate={activeTrip.startDate}
                endDate={activeTrip.endDate}
              />
            ) : null}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={20} className="bg-background">
          {activeTrip ? (
            <ChatRail
              trip={activeTrip}
              currentUser={data.user}
              onTripChange={() => {
                // Refresh itinerary data
                mutate(
                  `/api/trips/${encodeURIComponent(activeTrip.id)}/itinerary`,
                );
                // Also refresh trip details/messages if needed
                getTrips().then((trips) => {
                  const fresh = trips.find((t) => t.id === activeTrip.id);
                  if (fresh)
                    useAppStore
                      .getState()
                      .setActiveTrip({ ...activeTrip, ...fresh });
                });
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
              <p>Select a trip to start chatting with your Travel Agent.</p>
              <TripsModal
                isOpen={true}
                onOpenChange={(open) => {
                  if (!open && !activeTrip) {
                    // Prevent closing if no active trip
                    return;
                  }
                }}
                selectedTripId={selectedTripId}
                onSelect={(trip) => {
                  setActiveTrip(trip);
                  router.replace(withDashboardTrip(searchParams, trip.id));
                }}
              />
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
