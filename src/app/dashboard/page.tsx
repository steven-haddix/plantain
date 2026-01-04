"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getTrips, getChatMessages } from "@/app/actions/trips";
import { PlaceDetailsPanel } from "@/components/place-details-panel";
import { TravelAgent } from "@/components/travel-agent";
import { TripsModal } from "@/components/trips-modal";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { authClient } from "@/lib/auth/client";
import { useAppStore } from "@/lib/store";

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

  useEffect(() => {
    const tripId = activeTrip?.id;
    if (tripId && !isPending && data?.session) {
      Promise.all([getTrips(), getChatMessages(tripId)]).then(
        ([trips, chatData]) => {
          const chatDataObj = chatData as any;
          const messages = Array.isArray(chatDataObj) ? chatDataObj : (chatDataObj?.messages || []);
          const hasMore = Array.isArray(chatDataObj) ? false : !!chatDataObj?.hasMore;

          const freshTrip = (trips as any[]).find((t) => t.id === tripId);
          if (!freshTrip) {
            setActiveTrip(null);
          } else {
            // Check if data actually changed to avoid unnecessary updates
            const hasChanged =
              freshTrip.title !== activeTrip?.title ||
              freshTrip.startDate !== activeTrip?.startDate ||
              freshTrip.endDate !== activeTrip?.endDate ||
              JSON.stringify(messages) !== JSON.stringify(activeTrip?.chatMessages) ||
              hasMore !== activeTrip?.hasMoreMessages;

            if (hasChanged) {
              setActiveTrip({
                ...freshTrip,
                chatMessages: messages,
                hasMoreMessages: hasMore,
              });
            }
          }
        },
      ).catch(err => {
        console.error("Failed to sync trip data:", err);
      });
    }
    // Only run on trip change or session load
  }, [activeTrip?.id, isPending, data?.user?.id, setActiveTrip]);

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
      <ResizablePanelGroup className="h-full w-full">
        <ResizablePanel defaultSize={70} minSize={30}>
          <div className="relative h-full w-full">
            {/* Map Background */}
            <LeafletMap />
            <PlaceDetailsPanel />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={20} className="bg-background">
          {activeTrip ? (
            <TravelAgent
              tripId={activeTrip.id}
              trip={activeTrip}
              onTripChange={() => {
                // We might need to refresh trip data here
                // For now, let's assume the agent updates it and we just need a signal
                console.log("Trip updated by agent");
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
                onSelect={setActiveTrip}
              />
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
