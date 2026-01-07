"use server";

import { neonAuth } from "@neondatabase/auth/next/server";
import { db } from "@/db";
import { trips, chatThreads, chatMessages, savedLocations, places } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { CHAT_HISTORY_LIMIT } from "@/lib/constants";

export async function getTrips() {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    return await db
        .select()
        .from(trips)
        .where(eq(trips.ownerId, user.id));
}

export async function createTrip(title: string, startDate?: Date, endDate?: Date) {
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

export async function updateTrip(id: string, updates: { title?: string; startDate?: Date | null; endDate?: Date | null }) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    const [updatedTrip] = await db
        .update(trips)
        .set({
            title: updates.title,
            startDate: updates.startDate ? updates.startDate.toISOString() : updates.startDate === null ? null : undefined,
            endDate: updates.endDate ? updates.endDate.toISOString() : updates.endDate === null ? null : undefined,
        })
        .where(
            and(
                eq(trips.id, id),
                eq(trips.ownerId, user.id)
            )
        )
        .returning();

    revalidatePath("/dashboard");
    return updatedTrip;
}

export async function getChatMessages(tripId: string, limit: number = CHAT_HISTORY_LIMIT, cursor?: string) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    // Fetch the thread first to ensure it belongs to the user
    const [thread] = await db
        .select()
        .from(chatThreads)
        .where(and(eq(chatThreads.tripId, tripId), eq(chatThreads.userId, user.id)));

    if (!thread) return { messages: [], hasMore: false };

    // Fetch messages for this thread
    const conditions = [eq(chatMessages.threadId, thread.id)];
    if (cursor) {
        conditions.push(sql`${chatMessages.createdAt} < ${new Date(cursor).toISOString()}`);
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
        .where(and(eq(chatThreads.tripId, tripId), eq(chatThreads.userId, user.id)));

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
            }
        })
        .from(savedLocations)
        .innerJoin(places, eq(savedLocations.placeId, places.id))
        .where(eq(savedLocations.tripId, tripId));

    return saved.map(item => ({
        ...item,
        place: {
            ...item.place,
            // Parse point coordinates if needed, but for now passing the raw object might be fine
            // or we might need to extract lat/lng from the geography point if possible in code
            // Actually Drizzle geo types might return a string or object.
            // Let's assume we might need to parse it client side or it's handled.
            // But looking at schema, it's a custom type. 
            // Often it's better to select ST_X and ST_Y if we need coords.
            // Let's adjust the query to get lat/lng explicitly to be safe for the map.
        }
    }));
}
