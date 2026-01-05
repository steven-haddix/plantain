import { and, asc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { itineraryEvents, places } from "@/db/schema";

export type ItineraryEventBucket =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "anytime";

export type ItineraryEventStatus = "proposed" | "confirmed" | "canceled";

export type ItineraryEventCreateInput = {
  placeId?: string | null;
  customTitle?: string | null;
  dayIndex: number;
  bucket?: ItineraryEventBucket;
  sortOrder?: number;
  isOptional?: boolean;
  status?: ItineraryEventStatus;
  sourceSavedLocationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ItineraryEventUpdateInput = Partial<
  Omit<ItineraryEventCreateInput, "dayIndex"> & { dayIndex: number }
>;

export type ItineraryEventListFilters = {
  dayIndex?: number;
  bucket?: ItineraryEventBucket;
  status?: ItineraryEventStatus;
};

export type ItineraryEventListItem = {
  id: string;
  tripId: string;
  placeId: string | null;
  placeGooglePlaceId: string | null;
  customTitle: string | null;
  dayIndex: number;
  bucket: ItineraryEventBucket;
  sortOrder: number;
  isOptional: boolean;
  status: ItineraryEventStatus;
  sourceSavedLocationId: string | null;
  metadata: Record<string, unknown> | null;
  placeName: string | null;
  placeAddress: string | null;
  placeLatitude: number | null;
  placeLongitude: number | null;
};

const normalizeCustomTitle = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizePlaceId = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export class TripService {
  async listItineraryEvents(
    tripId: string,
    filters: ItineraryEventListFilters = {},
  ): Promise<ItineraryEventListItem[]> {
    const conditions = [eq(itineraryEvents.tripId, tripId)];
    if (filters.dayIndex !== undefined) {
      conditions.push(eq(itineraryEvents.dayIndex, filters.dayIndex));
    }
    if (filters.bucket) {
      conditions.push(eq(itineraryEvents.bucket, filters.bucket));
    }
    if (filters.status) {
      conditions.push(eq(itineraryEvents.status, filters.status));
    }

    const rows = await db
      .select({
        id: itineraryEvents.id,
        tripId: itineraryEvents.tripId,
        placeId: itineraryEvents.placeId,
        placeGooglePlaceId: places.googlePlaceId,
        customTitle: itineraryEvents.customTitle,
        dayIndex: itineraryEvents.dayIndex,
        bucket: itineraryEvents.bucket,
        sortOrder: itineraryEvents.sortOrder,
        isOptional: itineraryEvents.isOptional,
        status: itineraryEvents.status,
        sourceSavedLocationId: itineraryEvents.sourceSavedLocationId,
        metadata: itineraryEvents.metadata,
        placeDetails: places.details,
        placeLatitude: sql<number | null>`ST_Y(${places.location}::geometry)`.as(
          "place_latitude",
        ),
        placeLongitude: sql<number | null>`ST_X(${places.location}::geometry)`.as(
          "place_longitude",
        ),
      })
      .from(itineraryEvents)
      .leftJoin(places, eq(itineraryEvents.placeId, places.id))
      .where(and(...conditions))
      .orderBy(
        asc(itineraryEvents.dayIndex),
        asc(itineraryEvents.bucket),
        asc(itineraryEvents.sortOrder),
      );

    return rows.map((row) => {
      const placeDetails = row.placeDetails as {
        name?: string;
        formatted_address?: string;
        address?: string;
      } | null;

      return {
        id: row.id,
        tripId: row.tripId,
        placeId: row.placeId,
        placeGooglePlaceId: row.placeGooglePlaceId ?? null,
        customTitle: row.customTitle,
        dayIndex: row.dayIndex,
        bucket: row.bucket,
        sortOrder: row.sortOrder,
        isOptional: row.isOptional,
        status: row.status,
        sourceSavedLocationId: row.sourceSavedLocationId,
        metadata: row.metadata ?? null,
        placeName: placeDetails?.name ?? null,
        placeAddress:
          placeDetails?.formatted_address ?? placeDetails?.address ?? null,
        placeLatitude: row.placeLatitude ?? null,
        placeLongitude: row.placeLongitude ?? null,
      };
    });
  }

  async createItineraryEvent(tripId: string, input: ItineraryEventCreateInput) {
    const placeId = normalizePlaceId(input.placeId) ?? null;
    const customTitle = normalizeCustomTitle(input.customTitle) ?? null;

    if (placeId && customTitle) {
      throw new Error("Provide either placeId or customTitle, not both.");
    }
    if (!placeId && !customTitle) {
      throw new Error("Provide either placeId or customTitle.");
    }

    const [event] = await db
      .insert(itineraryEvents)
      .values({
        id: nanoid(),
        tripId,
        placeId,
        customTitle,
        dayIndex: input.dayIndex,
        bucket: input.bucket ?? "anytime",
        sortOrder: input.sortOrder ?? 0,
        isOptional: input.isOptional ?? false,
        status: input.status ?? "proposed",
        sourceSavedLocationId: input.sourceSavedLocationId ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();

    return event ?? null;
  }

  async updateItineraryEvent(
    tripId: string,
    id: string,
    updates: ItineraryEventUpdateInput,
  ) {
    const [current] = await db
      .select({
        placeId: itineraryEvents.placeId,
        customTitle: itineraryEvents.customTitle,
      })
      .from(itineraryEvents)
      .where(
        and(eq(itineraryEvents.id, id), eq(itineraryEvents.tripId, tripId)),
      );

    if (!current) return null;

    const placeId =
      normalizePlaceId(updates.placeId) ??
      (updates.placeId === undefined ? current.placeId : null);
    const customTitle =
      normalizeCustomTitle(updates.customTitle) ??
      (updates.customTitle === undefined ? current.customTitle : null);

    if (placeId && customTitle) {
      throw new Error("Provide either placeId or customTitle, not both.");
    }
    if (!placeId && !customTitle) {
      throw new Error("Provide either placeId or customTitle.");
    }

    const values: Record<string, unknown> = {
      ...updates,
    };

    if (updates.placeId !== undefined) values.placeId = placeId;
    if (updates.customTitle !== undefined) values.customTitle = customTitle;
    if (updates.sourceSavedLocationId !== undefined) {
      values.sourceSavedLocationId = updates.sourceSavedLocationId ?? null;
    }
    if (updates.metadata !== undefined) {
      values.metadata = updates.metadata ?? null;
    }

    const [event] = await db
      .update(itineraryEvents)
      .set(values)
      .where(
        and(eq(itineraryEvents.id, id), eq(itineraryEvents.tripId, tripId)),
      )
      .returning();

    return event ?? null;
  }

  async deleteItineraryEvent(tripId: string, id: string) {
    const [event] = await db
      .delete(itineraryEvents)
      .where(
        and(eq(itineraryEvents.id, id), eq(itineraryEvents.tripId, tripId)),
      )
      .returning();

    return event ?? null;
  }
}

export const tripService = new TripService();
