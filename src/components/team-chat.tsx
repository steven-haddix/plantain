"use client";

import { MessageSquare, Send, Users, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_HISTORY_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TeamChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string }>;
  createdAt: string | Date;
  threadId: string;
  clientMessageId?: string | null;
  author?: {
    id: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
};

type TeamChatMember = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

type CurrentUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const getMessageText = (message: TeamChatMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();

const upsertMessage = (
  current: TeamChatMessage[],
  incoming: TeamChatMessage,
) => {
  const existingIndex = current.findIndex(
    (message) =>
      message.id === incoming.id ||
      (incoming.clientMessageId &&
        message.clientMessageId === incoming.clientMessageId),
  );

  if (existingIndex === -1) {
    return [...current, incoming].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  const next = [...current];
  next[existingIndex] = incoming;
  return next;
};

export function TeamChat({
  tripId,
  tripTitle,
  currentUser,
  active,
}: {
  tripId: string;
  tripTitle?: string | null;
  currentUser: CurrentUser;
  active: boolean;
}) {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [members, setMembers] = useState<TeamChatMember[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState("");
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const memberPreview = useMemo(() => members.slice(0, 5), [members]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/chat/team/messages?limit=${CHAT_HISTORY_LIMIT}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load team chat.");
        }

        const data = (await response.json()) as {
          messages: TeamChatMessage[];
          hasMore: boolean;
          members?: TeamChatMember[];
        };

        if (cancelled) return;

        setMessages(data.messages ?? []);
        setHasMore(Boolean(data.hasMore));
        setMembers(data.members ?? []);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  });

  useEffect(() => {
    if (!active) {
      setConnectionState("disconnected");
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    let cancelled = false;

    const connect = async () => {
      setConnectionState("connecting");

      try {
        const tokenResponse = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/chat/team/socket-token`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        if (!tokenResponse.ok) {
          throw new Error("Failed to authorize socket.");
        }

        const { token } = (await tokenResponse.json()) as { token: string };

        if (cancelled) return;

        const socket = io({
          path: "/team-chat/socket",
          auth: { token },
          transports: ["websocket"],
        });

        socket.on("connect", () => {
          setConnectionState("connected");
        });

        socket.on("disconnect", () => {
          setConnectionState("disconnected");
        });

        socket.on("chat.message.created", (message: TeamChatMessage) => {
          setMessages((current) => upsertMessage(current, message));
        });

        socketRef.current = socket;
      } catch (error) {
        setConnectionState("disconnected");
        console.error(error);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [active, tripId]);

  const loadMore = async () => {
    const firstMessage = messages[0];
    if (!firstMessage || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/chat/team/messages?limit=${CHAT_HISTORY_LIMIT}&cursor=${encodeURIComponent(
          new Date(firstMessage.createdAt).toISOString(),
        )}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load older team messages.");
      }

      const data = (await response.json()) as {
        messages: TeamChatMessage[];
        hasMore: boolean;
      };

      setMessages((current) => [...(data.messages ?? []), ...current]);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: TeamChatMessage = {
      id: `temp-${clientMessageId}`,
      role: "user",
      parts: [{ type: "text", text: trimmed }],
      createdAt: new Date().toISOString(),
      threadId: "team",
      clientMessageId,
      author: {
        id: currentUser.id,
        name: currentUser.name ?? currentUser.email ?? "You",
        avatarUrl: currentUser.image ?? null,
      },
    };

    setMessages((current) => upsertMessage(current, optimisticMessage));
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/chat/team/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            text: trimmed,
            clientMessageId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to send message.");
      }

      const data = (await response.json()) as { message: TeamChatMessage };
      setMessages((current) => upsertMessage(current, data.message));
    } catch (error) {
      console.error(error);
      setMessages((current) =>
        current.filter(
          (message) => message.clientMessageId !== clientMessageId,
        ),
      );
      setInput(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Users className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Team Chat</h3>
              <p className="text-xs text-muted-foreground">
                {tripTitle ?? "Current Trip"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1 border-muted-foreground/20",
                connectionState === "connected" &&
                  "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
              )}
            >
              {connectionState === "connected" ? (
                <Wifi className="size-3" />
              ) : (
                <WifiOff className="size-3" />
              )}
              {connectionState === "connected" ? "Live" : "Offline"}
            </Badge>
            <Badge variant="secondary">{members.length} members</Badge>
          </div>
        </div>
        <div className="flex items-center -space-x-2">
          {memberPreview.map((member) => (
            <Avatar
              key={member.id}
              className="size-8 border-2 border-background shadow-sm"
            >
              <AvatarFallback className="text-[10px]">
                {(member.name ?? member.email ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading team chat...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Start the trip conversation
              </p>
              <p className="text-sm">
                Planning updates here are visible to everyone on the trip.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {hasMore ? (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading..." : "Load older messages"}
                </Button>
              </div>
            ) : null}
            {messages.map((message) => {
              const text = getMessageText(message);
              const isCurrentUser = message.author?.id === currentUser.id;

              return (
                <div
                  key={message.id}
                  className={cn("flex gap-3", isCurrentUser && "justify-end")}
                >
                  {!isCurrentUser ? (
                    <Avatar className="mt-1 size-8 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {(message.author?.name ?? message.author?.id ?? "?")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[80%] space-y-1",
                      isCurrentUser && "items-end text-right",
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {isCurrentUser
                        ? "You"
                        : (message.author?.name ??
                          message.author?.id ??
                          "Teammate")}
                      {" · "}
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl border bg-card px-3 py-2 text-sm shadow-sm",
                        isCurrentUser &&
                          "border-primary/20 bg-primary text-primary-foreground",
                      )}
                    >
                      {text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t bg-background/90 p-4">
        <div className="rounded-2xl border bg-card shadow-sm">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Share an update with the trip..."
            className="min-h-[88px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Shift + Enter</span>
              <span> for a new line</span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
