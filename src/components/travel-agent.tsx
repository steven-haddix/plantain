"use client";

import { useAppStore } from "@/lib/store";

import { useChat } from "@ai-sdk/react";
import {
    DefaultChatTransport,
    type ToolUIPart,
    type UIMessagePart,
} from "ai";
import posthog from "posthog-js";
import { Plane, Sparkles, MapPin, Calendar, Tent } from "lucide-react";
import { useMemo } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TravelAgentProps {
    tripId: string;
    trip: any;
    onTripChange?: () => void;
}

export function TravelAgent({
    tripId,
    trip,
    onTripChange,
}: TravelAgentProps) {
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
            }),
        [],
    );

    // We use the tripId as the threadId for now, but we could later support multiple threads
    const { messages, sendMessage, status, error, clearError, stop } = useChat({
        id: tripId,
        messages: trip?.chatMessages || [],
        transport,
        onError: (error) => {
            console.error("Chat error:", error);
            if (error.message.includes("404") || error.message.toLowerCase().includes("not found")) {
                useAppStore.getState().setActiveTrip(null);
            }
        },
        onFinish: ({ message }) => {
            const textContent = message.parts
                ? message.parts
                    .filter((part) => part.type === "text")
                    .map((part) => (part as any).text || "")
                    .join("")
                : "";

            posthog.capture("travel_chat_response_received", {
                trip_id: tripId,
                response_length: textContent.length,
                has_tools: message.parts?.some((p) => p.type.startsWith("tool-")),
            });

            const toolUsed = message.parts?.find((part) =>
                part.type.startsWith("tool-") &&
                [
                    "tool-updateTripDetails",
                    "tool-createSavedLocation",
                    "tool-updateSavedLocation",
                    "tool-deleteSavedLocation"
                ].includes(part.type)
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
        part: UIMessagePart<any, any>,
        index: number,
        messageId: string,
    ) => {
        const key = `${messageId}-part-${index}`;

        if (part.type === "text") {
            return <MessageResponse key={key}>{part.text}</MessageResponse>;
        }

        if (part.type.startsWith("tool-")) {
            const toolPart = part as ToolUIPart;
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
                                <Badge variant="secondary" className="border-muted-foreground/20">
                                    <Calendar className="mr-1 size-3" />
                                    {new Date(trip.startDate).toLocaleDateString()}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Conversation className="flex-1">
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
                            {messages.map((message) => {
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
