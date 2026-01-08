"use server";

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { neonAuth } from "@neondatabase/auth/next/server";
import { generateText, Output } from "ai";
import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
    chatMessages,
    chatThreads,
    places,
    savedLocations,
    trips,
} from "@/db/schema";
import { CHAT_HISTORY_LIMIT } from "@/lib/constants";
import type { PlaceDetails } from "@/lib/place-details";

const PLACE_CATEGORIES = [
    "restaurant",
    "hotel",
    "attraction",
    "airport",
    "bar",
    "cafe",
    "park",
    "museum",
    "shopping",
    "transport",
    "activity",
    "other",
] as const;

type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

const classifyPlaceCategory = async (
    placeData: PlaceDetails,
): Promise<PlaceCategory> => {
    const details = [
        placeData.name ? `Name: ${placeData.name}` : null,
        placeData.category ? `Category hint: ${placeData.category}` : null,
        placeData.address ? `Address: ${placeData.address}` : null,
    ]
        .filter(Boolean)
        .join("\n");

    try {
        const { output } = await generateText({
            model: "google/gemini-3-flash",
            output: Output.object({
                schema: z.object({
                    category: z.enum(PLACE_CATEGORIES),
                }),
            }),
            prompt: `Choose exactly one category for this place:
${details || "No additional info provided."}`,
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingLevel: "minimal",
                        includeThoughts: false,
                    },
                } satisfies GoogleGenerativeAIProviderOptions,
            },
        });
        return output.category;
    } catch (error) {
        console.error("Failed to classify place category:", error);
        return "other";
    }
};

export async function getTrips() {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    return await db.select().from(trips).where(eq(trips.ownerId, user.id));
}

export async function createTrip(
    title: string,
    startDate?: Date,
    endDate?: Date,
) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    const [newTrip] = await db
        .insert(trips)
        .values({
            id: nanoid(),
            ownerId: user.id,
            title,
            startDate: startDate ? startDate.toISOString() : null,
            endDate: endDate ? endDate.toISOString() : null,
        })
        .returning();

    revalidatePath("/dashboard");
    return newTrip;
}

export async function updateTrip(
    id: string,
    updates: { title?: string; startDate?: Date | null; endDate?: Date | null },
) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    const [updatedTrip] = await db
        .update(trips)
        .set({
            title: updates.title,
            startDate: updates.startDate
                ? updates.startDate.toISOString()
                : updates.startDate === null
                    ? null
                    : undefined,
            endDate: updates.endDate
                ? updates.endDate.toISOString()
                : updates.endDate === null
                    ? null
                    : undefined,
        })
        .where(and(eq(trips.id, id), eq(trips.ownerId, user.id)))
        .returning();

    revalidatePath("/dashboard");
    return updatedTrip;
}

export async function getChatMessages(
    tripId: string,
    limit: number = CHAT_HISTORY_LIMIT,
    cursor?: string,
) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    // Fetch the thread first to ensure it belongs to the user
    const [thread] = await db
        .select()
        .from(chatThreads)
        .where(
            and(eq(chatThreads.tripId, tripId), eq(chatThreads.userId, user.id)),
        );

    if (!thread) return { messages: [], hasMore: false };

    // Fetch messages for this thread
    const conditions = [eq(chatMessages.threadId, thread.id)];
    if (cursor) {
        conditions.push(
            sql`${chatMessages.createdAt} < ${new Date(cursor).toISOString()}`,
        );
    }

    const messages = await db
        .select()
        .from(chatMessages)
        .where(and(...conditions))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit + 1);

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // Return in reverse order (oldest first) for the UI
    return {
        messages: resultMessages.reverse().map((m) => ({
            id: m.id,
            role: m.role,
            parts: m.content as any[],
            createdAt: m.createdAt.toISOString(),
        })),
        hasMore,
    };
}
export async function clearChatHistory(tripId: string) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    // Fetch the thread first to ensure it belongs to the user
    const [thread] = await db
        .select()
        .from(chatThreads)
        .where(
            and(eq(chatThreads.tripId, tripId), eq(chatThreads.userId, user.id)),
        );

    if (!thread) return;

    // Delete all messages for this thread
    await db.delete(chatMessages).where(eq(chatMessages.threadId, thread.id));

    revalidatePath("/dashboard");
}

export async function getSavedLocations(tripId: string) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    // Fetch saved locations with place details
    // We join savedLocations with places to get the details
    // And ensure the trip belongs to the owner or authorized user (implicit by tripId check later if we had shared trips, but for now simple check)

    // First verify trip access
    const [trip] = await db
        .select()
        .from(trips)
        .where(and(eq(trips.id, tripId), eq(trips.ownerId, user.id)));

    if (!trip) return [];

    const saved = await db
        .select({
            id: savedLocations.id,
            tripId: savedLocations.tripId,
            placeId: savedLocations.placeId,
            status: savedLocations.status,
            note: savedLocations.note,
            place: {
                id: places.id,
                googlePlaceId: places.googlePlaceId,
                location: places.location,
                category: places.category,
                details: places.details,
            },
        })
        .from(savedLocations)
        .innerJoin(places, eq(savedLocations.placeId, places.id))
        .where(eq(savedLocations.tripId, tripId));

    return saved.map((item) => ({
        ...item,
        place: {
            ...item.place,
        },
    }));
}

export async function toggleSavedLocation(
    tripId: string,
    placeData: PlaceDetails,
) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    if (!placeData.googlePlaceId) throw new Error("Missing Google Place ID");

    // 1. Ensure place exists in database
    let [place] = await db
        .select()
        .from(places)
        .where(eq(places.googlePlaceId, placeData.googlePlaceId));

    if (!place) {
        // Create new place
        if (!placeData.latitude || !placeData.longitude) {
            throw new Error("Missing coordinates for new place");
        }

        const category = await classifyPlaceCategory(placeData);

        [place] = await db
            .insert(places)
            .values({
                id: nanoid(),
                googlePlaceId: placeData.googlePlaceId,
                location: sql`ST_SetSRID(ST_MakePoint(${placeData.longitude}, ${placeData.latitude}), 4326)`,
                category: category,
                details: placeData,
            })
            .onConflictDoUpdate({
                target: places.googlePlaceId,
                set: {
                    // Update details if they changed
                    details: placeData,
                },
            })
            .returning();
    }

    // 2. Check if already saved
    const [existing] = await db
        .select()
        .from(savedLocations)
        .where(
            and(
                eq(savedLocations.tripId, tripId),
                eq(savedLocations.placeId, place.id),
            ),
        );

    if (existing) {
        // Toggle OFF: Delete
        await db.delete(savedLocations).where(eq(savedLocations.id, existing.id));

        revalidatePath("/dashboard");
        return { saved: false };
    } else {
        // Toggle ON: Insert
        await db.insert(savedLocations).values({
            id: nanoid(),
            tripId,
            placeId: place.id,
            status: "interested",
        });

        revalidatePath("/dashboard");
        return { saved: true };
    }
}
