"use server";

import { neonAuth } from "@neondatabase/auth/next/server";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

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
