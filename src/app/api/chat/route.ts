import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { neonAuth } from "@neondatabase/auth/next/server";
import {
    createAgentUIStreamResponse,
    createIdGenerator,
    ToolLoopAgent,
    tool,
} from "ai";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import {
    chatMessages,
    chatThreads,
    places,
    savedLocations,
    trips,
} from "@/db/schema";
import { placesService } from "@/lib/places-search/service";
import { webSearchService } from "@/lib/web-search/service";

export const maxDuration = 60;
// Force rebuild: 2026-01-03

export async function POST(req: Request) {
    const { user } = await neonAuth();

    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const { id: threadId, currentTrip } = body ?? {};
        const messages = Array.isArray(body?.messages) ? body.messages : undefined;

        if (!threadId || !currentTrip) {
            return new Response("Missing trip context", { status: 400 });
        }

        if (!messages) {
            return new Response("Missing chat messages", { status: 400 });
        }

        // Fetch trip context first to verify existence and ownership
        const [trip] = await db
            .select()
            .from(trips)
            .where(and(eq(trips.id, currentTrip.id), eq(trips.ownerId, user.id)));

        if (!trip) {
            return new Response("Trip not found", { status: 404 });
        }

        // Fetch thread or create if it doesn't exist
        let [thread] = await db
            .select()
            .from(chatThreads)
            .where(eq(chatThreads.id, threadId));

        if (!thread) {
            [thread] = await db
                .insert(chatThreads)
                .values({
                    id: threadId,
                    tripId: trip.id,
                    userId: user.id,
                    title: `Chat about ${trip.title || "Trip"}`,
                })
                .returning();
        }

        // Fetch saved locations context
        const savedLocationsResult = await db
            .select({
                id: savedLocations.id,
                status: savedLocations.status,
                note: savedLocations.note,
                placeName: places.details,
            })
            .from(savedLocations)
            .innerJoin(places, eq(savedLocations.placeId, places.id))
            .where(eq(savedLocations.tripId, trip.id));

        const savedLocationsContext =
            savedLocationsResult.length > 0
                ? savedLocationsResult
                    .map((loc) => {
                        const name = (loc.placeName as any)?.name || "Unknown Place";
                        const note = loc.note ? `\nNote: ${loc.note}` : "";
                        return `- [ID: ${loc.id}] ${name} (${loc.status})${note}`;
                    })
                    .join("\n")
                : "No locations saved yet.";

        const systemPrompt = `
You are an expert travel agent and local guide. You are helping a user plan and manage their trip.

**Trip Context:**
- **Title:** ${trip.title || "Untitled Trip"}
- **Dates:** ${trip.startDate ? new Date(trip.startDate).toLocaleDateString() : "Not set"} to ${trip.endDate ? new Date(trip.endDate).toLocaleDateString() : "Not set"}

**Saved Locations:**
${savedLocationsContext}

**Your Goal:**
Help the user with their travel planning. You can:
1. Suggest interesting places to visit based on their trip.
2. Help organize their itinerary.
3. Update trip details (like the title or dates) if they ask.
4. Manage saved locations: add new ones from search results, update notes/status of existing ones, or remove them.

**Tone:**
Professional, enthusiastic, helpful, and concise.
`;

        const agent = new ToolLoopAgent({
            model: "google/gemini-3-flash",
            instructions: systemPrompt,
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingLevel: "medium",
                        includeThoughts: true,
                    },
                } satisfies GoogleGenerativeAIProviderOptions,
            },
            experimental_telemetry: { isEnabled: true },
            tools: {
                updateTripDetails: tool({
                    description: "Update the trip title or dates.",
                    inputSchema: z.object({
                        title: z.string().optional(),
                        startDate: z.string().optional().describe("ISO date string"),
                        endDate: z.string().optional().describe("ISO date string"),
                    }),
                    execute: async (updates) => {
                        await db.update(trips).set(updates).where(eq(trips.id, trip.id));
                        return { output: "Trip updated successfully." };
                    },
                }),
                searchPlaces: tool({
                    description:
                        "Search for places (restaurants, hotels, attractions, etc.)",
                    inputSchema: z.object({
                        query: z
                            .string()
                            .describe("The search query (e.g., 'best Italian restaurants')"),
                        location: z
                            .string()
                            .optional()
                            .describe("The location to search in (e.g., 'Brooklyn, NY')"),
                        limit: z
                            .number()
                            .optional()
                            .default(10)
                            .describe("Maximum number of results to return"),
                    }),
                    execute: async ({ query, location, limit }) => {
                        const results = await placesService.searchPlaces(
                            query,
                            location,
                            limit,
                        );
                        return {
                            places: results.map((p) => ({
                                id: p.googlePlaceId,
                                name: p.name,
                                address: p.address,
                                rating: p.rating,
                                reviewsCount: p.reviewsCount,
                                category: p.category,
                                latitude: p.latitude,
                                longitude: p.longitude,
                            })),
                        };
                    },
                }),
                webSearch: tool({
                    description:
                        "Search the web for general information, travel tips, or news.",
                    inputSchema: z.object({
                        query: z.string().describe("The search query"),
                    }),
                    execute: async ({ query }) => {
                        const results = await webSearchService.search(query);
                        // Flatten and simplify the results for the LLM
                        const organicResults = results.flatMap((r) =>
                            r.organicResults.map((o) => ({
                                title: o.title,
                                link: o.link,
                                description: o.description,
                            })),
                        );
                        return { results: organicResults.slice(0, 5) };
                    },
                }),
                createSavedLocation: tool({
                    description: "Add a location to the trip's saved list.",
                    inputSchema: z.object({
                        googlePlaceId: z.string(),
                        name: z.string(),
                        latitude: z.number(),
                        longitude: z.number(),
                        address: z.string().optional(),
                        note: z.string().optional(),
                        status: z.enum(["interested", "visited"]).default("interested"),
                    }),
                    execute: async (input) => {
                        // 1. Upsert place
                        let [place] = await db
                            .select()
                            .from(places)
                            .where(eq(places.googlePlaceId, input.googlePlaceId));

                        if (!place) {
                            const placeId = nanoid();
                            [place] = await db
                                .insert(places)
                                .values({
                                    id: placeId,
                                    googlePlaceId: input.googlePlaceId,
                                    location: sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`,
                                    details: {
                                        name: input.name,
                                        formatted_address: input.address,
                                    },
                                })
                                .returning();
                        }

                        // 2. Add to saved locations
                        await db.insert(savedLocations).values({
                            id: nanoid(),
                            tripId: trip.id,
                            placeId: place.id,
                            status: input.status,
                            note: input.note,
                        });

                        return { output: `Saved ${input.name} to your trip.` };
                    },
                }),
                updateSavedLocation: tool({
                    description: "Update a saved location's note or status.",
                    inputSchema: z.object({
                        id: z.string().describe("The ID of the saved location (from context)"),
                        note: z.string().optional(),
                        status: z.enum(["interested", "visited"]).optional(),
                    }),
                    execute: async ({ id, ...updates }) => {
                        await db
                            .update(savedLocations)
                            .set(updates)
                            .where(and(eq(savedLocations.id, id), eq(savedLocations.tripId, trip.id)));
                        return { output: "Location updated." };
                    },
                }),
                deleteSavedLocation: tool({
                    description: "Remove a location from the trip's saved list.",
                    inputSchema: z.object({
                        id: z.string().describe("The ID of the saved location (from context)"),
                    }),
                    execute: async ({ id }) => {
                        await db
                            .delete(savedLocations)
                            .where(and(eq(savedLocations.id, id), eq(savedLocations.tripId, trip.id)));
                        return { output: "Location removed." };
                    },
                }),
            },
        });

        return createAgentUIStreamResponse({
            agent,
            uiMessages: messages,
            generateMessageId: createIdGenerator({
                prefix: "msg",
                size: 16,
            }),
            onFinish: async ({ messages: responseMessages }) => {
                try {
                    const lastUserMessage = messages[messages.length - 1];
                    const assistantMessages = responseMessages;

                    const messagesToSave = [
                        {
                            id: nanoid(),
                            threadId: threadId,
                            role: lastUserMessage.role,
                            content: lastUserMessage.parts as any,
                        },
                        ...assistantMessages.map((m) => ({
                            id: nanoid(),
                            threadId: threadId,
                            role: m.role,
                            content: m.parts as any,
                        })),
                    ];

                    await db.insert(chatMessages).values(messagesToSave);
                } catch (error) {
                    console.error("Failed to save chat messages:", error);
                }
            },
        });
    } catch (error) {
        console.error("Travel agent chat error:", error);
        return new Response("Failed to process chat", { status: 500 });
    }
}
