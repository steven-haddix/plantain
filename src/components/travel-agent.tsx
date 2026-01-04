"use client";

import { useChat } from "@ai-sdk/react";
import {
    DefaultChatTransport,
    isTextUIPart,
    type ToolUIPart,
    type UIDataTypes,
    type UIMessage,
    type UIMessagePart,
    type UITools,
} from "ai";
import { Calendar, MapPin, Pin, Plane, Sparkles, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import type { StickToBottomContext } from "use-stick-to-bottom";
import { getChatMessages } from "@/app/actions/trips";
import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
    Message,
    MessageContent,
    MessageResponse,
} from "@/components/ai-elements/message";
import {
    PromptInput,
    PromptInputFooter,
    type PromptInputMessage,
    PromptInputSubmit,
    PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput,
} from "@/components/ai-elements/tool";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHAT_HISTORY_LIMIT } from "@/lib/constants";
import { type MapPlace, useMapStore } from "@/lib/map-store";
import { fetchPlaceDetails, placeDetailsUrl } from "@/lib/place-details";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type TripLike = {
    id: string;
    title?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    chatMessages?: UIMessage[];
    hasMoreMessages?: boolean;
};

interface TravelAgentProps {
    tripId: string;
    trip: TripLike;
    onTripChange?: () => void;
}

type SearchPlaceResult = MapPlace & { id?: string };

type SearchPlacesToolOutput = {
    places: SearchPlaceResult[];
};

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

function SearchPlacesToolCard({
    toolKey,
    places,
    defaultOpen = false,
}: {
    toolKey: string;
    places: SearchPlaceResult[];
    defaultOpen?: boolean;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const applySearchResults = useMapStore((state) => state.applySearchResults);
    const pinActiveResearch = useMapStore((state) => state.pinActiveResearch);
    const clearResearch = useMapStore((state) => state.clearResearch);
    const selectPlace = useMapStore((state) => state.selectPlace);
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const normalizedPlaces = useMemo(
        () =>
            places.map((place, index) => ({
                ...place,
                googlePlaceId:
                    place.googlePlaceId || place.id || `place-${toolKey}-${index}`,
            })),
        [places, toolKey],
    );

    const didPrefetchRef = useRef(false);

    useEffect(() => {
        applySearchResults({
            toolKey,
            title: `Search results (${normalizedPlaces.length})`,
            places: normalizedPlaces,
        });
    }, [applySearchResults, toolKey, normalizedPlaces]);

    useEffect(() => {
        if (didPrefetchRef.current) return;
        didPrefetchRef.current = true;

        // Only prefetch if open by default (likely the latest search)
        if (!defaultOpen) return;

        const idsToPrefetch = normalizedPlaces
            .map((place) => place.googlePlaceId)
            .filter((id) => Boolean(id) && !id.startsWith("place-"))
            .slice(0, 10);

        const concurrency = 3;
        const queue = [...idsToPrefetch];

        const worker = async () => {
            while (queue.length > 0) {
                const id = queue.shift();
                if (!id) continue;

                const url = placeDetailsUrl(id);
                try {
                    await mutate(url, fetchPlaceDetails(url), {
                        populateCache: true,
                        revalidate: false,
                    });
                } catch {
                    // Best-effort prefetch; details panel will retry on demand.
                }
            }
        };

        for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
            void worker();
        }
    }, [normalizedPlaces, defaultOpen]);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="space-y-4 py-2"
        >
            <div className="flex items-center justify-between px-1">
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="group flex items-center gap-2 p-0 hover:bg-transparent hover:text-foreground"
                    >
                        {isOpen ? (
                            <ChevronDown className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                        ) : (
                            <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                        )}
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors group-hover:text-foreground">
                            Search Results ({normalizedPlaces.length})
                        </div>
                    </Button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={pinActiveResearch}
                        title="Pin to map"
                    >
                        <Pin className="size-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={clearResearch}
                        title="Clear results"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>
            <CollapsibleContent>
                <div className="grid gap-2">
                    {normalizedPlaces.slice(0, 8).map((place, index) => (
                        <button
                            key={`${place.googlePlaceId ?? "place"}-${index}`}
                            className="group flex items-start gap-3 rounded-xl border bg-card p-2 text-left transition-colors hover:bg-accent/50"
                            onClick={() => {
                                selectPlace(place.googlePlaceId);
                                const next = new URLSearchParams(searchParams.toString());
                                next.set("place", place.googlePlaceId);
                                router.replace(`/dashboard?${next.toString()}`);
                            }}
                        >
                            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {place.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={place.imageUrl}
                                        alt={place.name}
                                        loading="lazy"
                                        className="size-full object-cover transition-transform group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center">
                                        <MapPin className="size-6 text-muted-foreground/40" />
                                    </div>
                                )}
                            </div>
                            <div className="flex min-w-0 flex-col py-0.5">
                                <span className="truncate text-sm font-semibold text-foreground">
                                    {place.name}
                                </span>
                                <span className="line-clamp-2 text-xs text-muted-foreground">
                                    {place.address}
                                </span>
                                {place.rating && (
                                    <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
                                        <span>★</span>
                                        <span>{place.rating}</span>
                                        {place.reviewsCount && (
                                            <span className="text-muted-foreground/60">
                                                ({place.reviewsCount})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export function TravelAgent({ tripId, trip, onTripChange }: TravelAgentProps) {
    const stickToBottomRef = useRef<StickToBottomContext | null>(null);
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
            }),
        [],
    );

    // We use the tripId as the threadId for now, but we could later support multiple threads
    const {
        messages,
        setMessages,
        sendMessage,
        status,
        error,
        clearError,
        stop,
    } = useChat({
        id: tripId,
        messages: trip?.chatMessages || [],
        transport,
        onError: (error) => {
            console.error("Chat error:", error);
            if (
                error.message.includes("404") ||
                error.message.toLowerCase().includes("not found")
            ) {
                useAppStore.getState().setActiveTrip(null);
            }
        },
        onFinish: ({ message }) => {
            const textContent = message.parts
                ? message.parts
                    .filter(isTextUIPart)
                    .map((part) => part.text || "")
                    .join("")
                : "";

            posthog.capture("travel_chat_response_received", {
                trip_id: tripId,
                response_length: textContent.length,
                has_tools: message.parts?.some((p) => p.type.startsWith("tool-")),
            });

            const toolUsed = message.parts?.find(
                (part) =>
                    part.type.startsWith("tool-") &&
                    [
                        "tool-updateTripDetails",
                        "tool-createSavedLocation",
                        "tool-updateSavedLocation",
                        "tool-deleteSavedLocation",
                    ].includes(part.type),
            );

            if (toolUsed) {
                posthog.capture("travel_chat_tool_used", {
                    trip_id: tripId,
                    tool_name: toolUsed.type.replace("tool-", ""),
                });
                onTripChange?.();
            }
        },
    });

    const suggestions = useMemo(
        () => [
            "What are some must-visit spots here?",
            "Can you help me organize my itinerary?",
            "Are there any good local restaurants nearby?",
            "What's the best way to get around?",
        ],
        [],
    );

    const canSend = status === "ready" || status === "error";
    const isBusy = status === "submitted" || status === "streaming";

    const submitMessage = async ({
        text,
        files,
    }: {
        text: string;
        files?: PromptInputMessage["files"];
    }) => {
        const trimmed = text.trim();
        const hasFiles = Boolean(files?.length);
        if (!trimmed && !hasFiles) return;

        if (!canSend) return;
        if (status === "error") {
            clearError();
        }

        await sendMessage(
            trimmed
                ? { text: trimmed, files }
                : { files: files as PromptInputMessage["files"] },
            {
                body: {
                    currentTrip: trip,
                    userInput: trimmed || undefined,
                },
            },
        );

        posthog.capture("travel_chat_message_sent", {
            trip_id: tripId,
            message_length: trimmed.length,
            has_files: hasFiles,
        });
    };

    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isLoadingMoreRef = useRef(false);
    const messagesRef = useRef<UIMessage[]>(messages);
    const hasMoreRef = useRef(Boolean(trip?.hasMoreMessages));
    const prependMessages = useAppStore((state) => state.prependMessages);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        hasMoreRef.current = Boolean(trip?.hasMoreMessages);
    }, [trip?.hasMoreMessages]);

    const loadMore = useCallback(async () => {
        if (isLoadingMoreRef.current) return;
        if (!hasMoreRef.current || !messagesRef.current.length) return;

        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        try {
            const firstMessage = messagesRef.current[0];
            const cursor = (firstMessage as any).createdAt;

            if (!cursor) {
                console.warn("First message has no createdAt, cannot load more");
                return;
            }

            const { messages: moreMessages, hasMore } = await getChatMessages(
                tripId,
                CHAT_HISTORY_LIMIT,
                cursor,
            );

            // Sync with useChat state
            setMessages((current) => [...moreMessages, ...current] as any);

            // Sync with global store
            prependMessages(tripId, moreMessages, hasMore);
            hasMoreRef.current = hasMore;
        } catch (error) {
            console.error("Failed to load more messages:", error);
        } finally {
            isLoadingMoreRef.current = false;
            setIsLoadingMore(false);
        }
    }, [tripId, prependMessages, setMessages]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const root = stickToBottomRef.current?.scrollRef?.current ?? null;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { root, threshold: 0.1 },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadMore]);

    const handleSubmit = async ({ text, files }: PromptInputMessage) => {
        if (isBusy) {
            stop();
            return;
        }
        await submitMessage({ text, files });
    };

    const handleSuggestion = async (suggestion: string) => {
        if (!canSend) return;
        await submitMessage({ text: suggestion });
    };

    const renderPart = (
        part: UIMessagePart<UIDataTypes, UITools>,
        index: number,
        messageId: string,
    ) => {
        const key = `${messageId}-part-${index}`;

        if (part.type === "text") {
            return <MessageResponse key={key}>{part.text}</MessageResponse>;
        }

        if (part.type === "tool-searchPlaces") {
            const toolPart = part as ToolUIPart;
            const toolKey = `${messageId}:${index}`;
            const output = toolPart.output as SearchPlacesToolOutput | undefined;
            const places = output?.places;

            if (!places?.length) return null;

            const isLastMessage =
                messages.length > 0 && messages[messages.length - 1].id === messageId;

            return (
                <div key={key} className="pt-2">
                    <SearchPlacesToolCard
                        toolKey={toolKey}
                        places={places}
                        defaultOpen={isLastMessage}
                    />
                </div>
            );
        }

        if (part.type.startsWith("tool-")) {
            const toolPart = part as ToolUIPart<UITools>;
            const outputNode =
                toolPart.state === "output-available" && toolPart.output ? (
                    typeof toolPart.output === "string" ? (
                        <MessageResponse>{toolPart.output}</MessageResponse>
                    ) : (
                        toolPart.output
                    )
                ) : null;

            return (
                <div key={key} className="pt-2">
                    <Tool defaultOpen={false}>
                        <ToolHeader type={toolPart.type} state={toolPart.state} />
                        <ToolContent>
                            {toolPart.input ? <ToolInput input={toolPart.input} /> : null}
                            <ToolOutput
                                output={outputNode as ToolUIPart["output"]}
                                errorText={toolPart.errorText}
                            />
                        </ToolContent>
                    </Tool>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Plane className="size-5" />
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-sm font-semibold">Travel Agent</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="max-w-[180px] truncate">
                                {trip?.title ?? "Current Trip"}
                            </span>
                            {trip?.startDate && (
                                <Badge
                                    variant="secondary"
                                    className="border-muted-foreground/20"
                                >
                                    <Calendar className="mr-1 size-3" />
                                    {new Date(trip.startDate).toLocaleDateString()}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Conversation className="flex-1" contextRef={stickToBottomRef}>
                <ConversationContent className="pb-10">
                    {messages.length === 0 ? (
                        <ConversationEmptyState
                            title="Plan your journey"
                            description="Ask about destinations, local tips, or itinerary changes."
                            icon={<MapPin className="size-5" />}
                        >
                            <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
                                <Message from="assistant">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Avatar className="size-6">
                                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                                <Sparkles className="size-3" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Agent
                                        </span>
                                    </div>
                                    <MessageContent className="rounded-xl border bg-card text-card-foreground shadow-sm p-4">
                                        <MessageResponse>
                                            {`Hi! I'm your travel agent for ${trip?.title ?? "your trip"}. I can help you find the best spots, organize your days, or update your trip info. What's on your mind?`}
                                        </MessageResponse>
                                    </MessageContent>
                                </Message>
                                <Suggestions>
                                    {suggestions.map((suggestion) => (
                                        <Suggestion
                                            key={suggestion}
                                            suggestion={suggestion}
                                            onClick={handleSuggestion}
                                            disabled={!canSend}
                                        />
                                    ))}
                                </Suggestions>
                            </div>
                        </ConversationEmptyState>
                    ) : (
                        <>
                            <div
                                ref={sentinelRef}
                                className="h-4 flex items-center justify-center"
                            >
                                {isLoadingMore && (
                                    <Loader size={16} className="text-muted-foreground" />
                                )}
                            </div>
                            {Array.isArray(messages) &&
                                messages.map((message) => {
                                    const hasToolParts = message.parts?.some((part) =>
                                        part.type.startsWith("tool-"),
                                    );
                                    return (
                                        <Message
                                            key={message.id}
                                            from={message.role === "user" ? "user" : "assistant"}
                                        >
                                            {message.role !== "user" && (
                                                <div className="flex items-center gap-2 mb-0.5 px-1">
                                                    <Avatar className="size-6">
                                                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                                            <Sparkles className="size-3" />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        Agent
                                                    </span>
                                                </div>
                                            )}
                                            <MessageContent
                                                className={cn(
                                                    hasToolParts && "w-full",
                                                    message.role !== "user" &&
                                                    "rounded-xl border bg-card text-card-foreground shadow-sm p-4",
                                                )}
                                            >
                                                {message.parts?.map((part, index) =>
                                                    renderPart(part, index, message.id),
                                                )}
                                            </MessageContent>
                                        </Message>
                                    );
                                })}
                            {isBusy && (
                                <Message from="assistant">
                                    <div className="flex items-center gap-2 mb-0.5 px-1">
                                        <Avatar className="size-6">
                                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                                <Sparkles className="size-3" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Agent
                                        </span>
                                    </div>
                                    <MessageContent className="flex flex-row items-center gap-2 text-xs text-muted-foreground rounded-xl border bg-card shadow-sm p-4">
                                        <Loader size={14} />
                                        <span>Agent is brainstorming...</span>
                                    </MessageContent>
                                </Message>
                            )}
                        </>
                    )}

                    {error && (
                        <Alert variant="destructive" className="mx-auto max-w-md">
                            <AlertTitle>Connection issue</AlertTitle>
                            <AlertDescription>
                                <p>
                                    {error.message ||
                                        "Something went wrong while getting a travel tip."}
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={clearError}
                                >
                                    Dismiss
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <div className="border-t bg-background/90 p-4">
                <PromptInput
                    onSubmit={handleSubmit}
                    className="rounded-xl border bg-card shadow-sm"
                    globalDrop={false}
                >
                    <PromptInputTextarea
                        placeholder="Ask for recommendations or itinerary help..."
                        className="min-h-[56px]"
                    />
                    <PromptInputFooter className="border-t bg-muted/30">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Shift + Enter</span>
                            <span>for a new line</span>
                        </div>
                        <PromptInputSubmit status={status} disabled={!canSend && !isBusy} />
                    </PromptInputFooter>
                </PromptInput>
            </div>
        </div>
    );
}
