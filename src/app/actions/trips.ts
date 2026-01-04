"use server";

import { neonAuth } from "@neondatabase/auth/next/server";
import { db } from "@/db";
import { trips, chatThreads, chatMessages } from "@/db/schema";
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
