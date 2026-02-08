import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography";
  },
});

const geometryPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry";
  },
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
});

export const placeCategory = pgEnum("place_category", [
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
]);

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    partySize: integer("party_size"),
    destinationLocation: geographyPoint("destination_location"),
  },
  (table) => [
    check(
      "trips_destination_location_is_point",
      sql`ST_GeometryType(${table.destinationLocation}::geometry) = 'ST_Point'`,
    ),
    check(
      "trips_destination_location_srid",
      sql`ST_SRID(${table.destinationLocation}::geometry) = 4326`,
    ),
    check(
      "trips_party_size_range",
      sql`${table.partySize} is null or (${table.partySize} >= 1 and ${table.partySize} <= 100)`,
    ),
  ],
);

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    googlePlaceId: text("google_place_id").notNull(),
    location: geographyPoint("location").notNull(),
    category: placeCategory("category"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    summaryEmbedding: vector("summary_embedding", { dimensions: 1536 }),
  },
  (table) => [
    uniqueIndex("places_google_place_id_unique").on(table.googlePlaceId),
    check(
      "places_location_is_point",
      sql`ST_GeometryType(${table.location}::geometry) = 'ST_Point'`,
    ),
    check(
      "places_location_srid",
      sql`ST_SRID(${table.location}::geometry) = 4326`,
    ),
  ],
);

export const savedLocationStatus = pgEnum("saved_location_status", [
  "interested",
  "visited",
]);

export const savedLocations = pgTable(
  "saved_locations",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    status: savedLocationStatus("status").notNull(),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("saved_locations_trip_place_unique").on(
      table.tripId,
      table.placeId,
    ),
  ],
);

export const itineraryEventBucket = pgEnum("itinerary_event_bucket", [
  "morning",
  "afternoon",
  "evening",
  "night",
  "anytime",
]);

export const itineraryEventStatus = pgEnum("itinerary_event_status", [
  "proposed",
  "confirmed",
  "canceled",
]);

export const itineraryEvents = pgTable(
  "itinerary_events",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    placeId: text("place_id").references(() => places.id),
    customTitle: text("custom_title"),
    dayIndex: integer("day_index").notNull(),
    bucket: itineraryEventBucket("bucket").notNull().default("anytime"),
    sortOrder: integer("sort_order").notNull().default(0),
    isOptional: boolean("is_optional").notNull().default(false),
    status: itineraryEventStatus("status").notNull().default("proposed"),
    sourceSavedLocationId: text("source_saved_location_id").references(
      () => savedLocations.id,
      { onDelete: "set null" },
    ),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    check(
      "itinerary_events_place_or_custom",
      sql`(${table.placeId} is not null and ${table.customTitle} is null) or (${table.placeId} is null and ${table.customTitle} is not null)`,
    ),
  ],
);

export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey(),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => chatThreads.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: jsonb("content").$type<any[]>(), // AI-SDK message parts
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type User = typeof users.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type Place = typeof places.$inferSelect;
export type SavedLocation = typeof savedLocations.$inferSelect;
export type ItineraryEvent = typeof itineraryEvents.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
