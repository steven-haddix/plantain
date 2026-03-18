import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { tripMembers, trips, users } from "@/db/schema";

export async function assertTripMemberAccess(tripId: string, userId: string) {
  const [trip] = await db
    .select({
      ...getTableColumns(trips),
      membershipRole: tripMembers.role,
      destinationLatitude: sql<number | null>`CASE
        WHEN ${trips.destinationLocation} IS NULL THEN NULL
        ELSE ST_Y(${trips.destinationLocation}::geometry)
      END`.as("destination_latitude"),
      destinationLongitude: sql<number | null>`CASE
        WHEN ${trips.destinationLocation} IS NULL THEN NULL
        ELSE ST_X(${trips.destinationLocation}::geometry)
      END`.as("destination_longitude"),
    })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));

  if (!trip) {
    throw new Error("Trip not found");
  }

  return {
    ...trip,
    destinationLocation:
      trip.destinationLatitude !== null && trip.destinationLongitude !== null
        ? {
            latitude: trip.destinationLatitude,
            longitude: trip.destinationLongitude,
          }
        : null,
  };
}

export async function ensureOwnerTripMembership(
  tripId: string,
  userId: string,
) {
  await db
    .insert(tripMembers)
    .values({
      id: nanoid(),
      tripId,
      userId,
      role: "owner",
    })
    .onConflictDoNothing();
}

export async function listTripMembers(tripId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: tripMembers.role,
    })
    .from(tripMembers)
    .innerJoin(users, eq(tripMembers.userId, users.id))
    .where(eq(tripMembers.tripId, tripId));
}
