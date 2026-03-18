"use client";

import type { UIMessage } from "ai";
import { MessagesSquare, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { TeamChat } from "@/components/team-chat";
import { TravelAgent } from "@/components/travel-agent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TripLike = {
  id: string;
  title?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  partySize?: number | null;
  chatMessages?: UIMessage[];
  hasMoreMessages?: boolean;
};

type CurrentUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type ChatMode = "ai" | "team";

export function ChatRail({
  trip,
  currentUser,
  onTripChange,
}: {
  trip: TripLike;
  currentUser: CurrentUser;
  onTripChange?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChat = (searchParams.get("chat") as ChatMode | null) ?? "ai";

  const setChatMode = (mode: ChatMode) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("chat", mode);
    router.replace(`/dashboard?${next.toString()}`);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b bg-background/95 px-3 py-2">
        <div className="inline-flex rounded-2xl border bg-muted/40 p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-xl gap-1.5",
              activeChat === "ai" && "bg-background shadow-sm",
            )}
            onClick={() => setChatMode("ai")}
          >
            <Sparkles className="size-4" />
            AI
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-xl gap-1.5",
              activeChat === "team" && "bg-background shadow-sm",
            )}
            onClick={() => setChatMode("team")}
          >
            <MessagesSquare className="size-4" />
            Team
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {activeChat === "team" ? (
          <TeamChat
            tripId={trip.id}
            tripTitle={trip.title}
            currentUser={currentUser}
            active
          />
        ) : (
          <TravelAgent
            tripId={trip.id}
            trip={trip}
            onTripChange={onTripChange}
          />
        )}
      </div>
    </div>
  );
}
