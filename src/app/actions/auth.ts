"use server";

import { neonAuth } from "@neondatabase/auth/next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function syncUser() {
    const { user } = await neonAuth();
    if (!user) return;

    await db
        .insert(users)
        .values({
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.image,
        })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                email: user.email,
                name: user.name,
                avatarUrl: user.image,
            },
        });
}
