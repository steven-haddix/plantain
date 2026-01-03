"use server";

import { neonAuth } from "@neondatabase/auth/next/server";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
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

export async function createTrip(title: string) {
    const { user } = await neonAuth();
    if (!user) throw new Error("Unauthorized");

    const [newTrip] = await db
        .insert(trips)
        .values({
            id: nanoid(),
            ownerId: user.id,
            title,
        })
        .returning();

    revalidatePath("/dashboard");
    return newTrip;
}
