"use server";

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { places, savedLocations, tripMembers, trips } from "@/db/schema";
import { requireServerAuthUser } from "@/lib/auth";
import {
  clearThreadMessages,
  getOrCreateAiThread,
  listMessages,
} from "@/lib/chat/service";
import { CHAT_HISTORY_LIMIT } from "@/lib/constants";
import type { PlaceDetails } from "@/lib/place-details";
import {
  assertTripMemberAccess,
  ensureOwnerTripMembership,
} from "@/lib/trip-access";

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

const normalizePartySizeInput = (
  value: number | null | undefined,
  options?: { allowNull?: boolean },
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return options?.allowNull ? null : undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("Party size must be an integer between 1 and 100.");
  }

  return value;
};

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
  const user = await requireServerAuthUser();

  const tripColumns = getTableColumns(trips);

  const tripsList = await db
    .select({
      ...tripColumns,
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
    .where(eq(tripMembers.userId, user.id));

  return tripsList.map((t) => ({
    ...t,
    destinationLocation: {
      latitude: t.destinationLatitude,
      longitude: t.destinationLongitude,
    } as { latitude: number; longitude: number } | null,
  }));
}

// ... imports including Geocoding service
import { geocodingService } from "@/lib/geocoding/service";

// ... existing code ...

export async function searchPlaces(query: string) {
  await requireServerAuthUser();

  // We accept both geocoding results and existing places for the dropdown if needed,
  // but for now, let's just use the geocoding service to find locations.
  return await geocodingService.geocode(query);
}

export async function createTrip(
  title: string,
  startDate?: Date,
  endDate?: Date,
  destination?: { latitude: number; longitude: number },
  partySize?: number | null,
) {
  const user = await requireServerAuthUser();

  const tripColumns = getTableColumns(trips);

  const [newTrip] = await db
    .insert(trips)
    .values({
      id: nanoid(),
      ownerId: user.id,
      title,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      partySize: normalizePartySizeInput(partySize) ?? null,
      destinationLocation: destination
        ? sql`ST_SetSRID(ST_MakePoint(${destination.longitude}, ${destination.latitude}), 4326)`
        : null,
    })
    .returning({
      ...tripColumns,
      destinationLatitude: sql<number | null>`CASE
      WHEN ${trips.destinationLocation} IS NULL THEN NULL
      ELSE ST_Y(${trips.destinationLocation}::geometry)
    END`.as("destination_latitude"),
      destinationLongitude: sql<number | null>`CASE
      WHEN ${trips.destinationLocation} IS NULL THEN NULL
      ELSE ST_X(${trips.destinationLocation}::geometry)
    END`.as("destination_longitude"),
    });

  await ensureOwnerTripMembership(newTrip.id, user.id);

  revalidatePath("/dashboard");
  return {
    ...newTrip,
    destinationLocation:
      newTrip.destinationLatitude && newTrip.destinationLongitude
        ? {
            latitude: newTrip.destinationLatitude,
            longitude: newTrip.destinationLongitude,
          }
        : null,
  };
}

export async function updateTrip(
  id: string,
  updates: {
    title?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    partySize?: number | null;
    destination?: { latitude: number; longitude: number } | null;
  },
) {
  const user = await requireServerAuthUser();
  await assertTripMemberAccess(id, user.id);

  const tripColumns = getTableColumns(trips);

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
      partySize: normalizePartySizeInput(updates.partySize, {
        allowNull: true,
      }),
      destinationLocation: updates.destination
        ? sql`ST_SetSRID(ST_MakePoint(${updates.destination.longitude}, ${updates.destination.latitude}), 4326)`
        : updates.destination === null
          ? null
          : undefined,
    })
    .where(eq(trips.id, id))
    .returning({
      ...tripColumns,
      destinationLatitude: sql<number | null>`CASE
      WHEN ${trips.destinationLocation} IS NULL THEN NULL
      ELSE ST_Y(${trips.destinationLocation}::geometry)
    END`.as("destination_latitude"),
      destinationLongitude: sql<number | null>`CASE
      WHEN ${trips.destinationLocation} IS NULL THEN NULL
      ELSE ST_X(${trips.destinationLocation}::geometry)
    END`.as("destination_longitude"),
    });

  revalidatePath("/dashboard");
  return {
    ...updatedTrip,
    destinationLocation:
      updatedTrip.destinationLatitude && updatedTrip.destinationLongitude
        ? {
            latitude: updatedTrip.destinationLatitude,
            longitude: updatedTrip.destinationLongitude,
          }
        : null,
  };
}

export async function getChatMessages(
  tripId: string,
  limit: number = CHAT_HISTORY_LIMIT,
  cursor?: string,
) {
  const user = await requireServerAuthUser();

  await assertTripMemberAccess(tripId, user.id);
  const thread = await getOrCreateAiThread(tripId, user.id);
  return listMessages(thread.id, limit, cursor);
}
export async function clearChatHistory(tripId: string) {
  const user = await requireServerAuthUser();

  await assertTripMemberAccess(tripId, user.id);
  const thread = await getOrCreateAiThread(tripId, user.id);
  await clearThreadMessages(thread.id);

  revalidatePath("/dashboard");
}

export async function getSavedLocations(tripId: string) {
  const user = await requireServerAuthUser();

  // Fetch saved locations with place details
  // We join savedLocations with places to get the details
  // And ensure the trip belongs to the owner or authorized user (implicit by tripId check later if we had shared trips, but for now simple check)

  // First verify trip access
  await assertTripMemberAccess(tripId, user.id);

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
  const user = await requireServerAuthUser();
  await assertTripMemberAccess(tripId, user.id);

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
