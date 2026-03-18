import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
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

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("sessions_token_unique").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

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

export const tripMemberRole = pgEnum("trip_member_role", ["owner", "member"]);

export const tripMembers = pgTable(
  "trip_members",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: tripMemberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("trip_members_trip_user_unique").on(table.tripId, table.userId),
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

export const chatThreadKind = pgEnum("chat_thread_kind", [
  "ai_dm",
  "team_room",
]);

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    kind: chatThreadKind("kind").notNull().default("ai_dm"),
    key: text("key").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("chat_threads_trip_key_unique").on(table.tripId, table.key),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: jsonb("content").$type<unknown[]>(), // AI-SDK message parts
    clientMessageId: text("client_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("chat_messages_thread_client_message_unique").on(
      table.threadId,
      table.clientMessageId,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type TripMember = typeof tripMembers.$inferSelect;
export type Place = typeof places.$inferSelect;
export type SavedLocation = typeof savedLocations.$inferSelect;
export type ItineraryEvent = typeof itineraryEvents.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
