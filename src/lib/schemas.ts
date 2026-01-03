import { sql } from "drizzle-orm";
import {
  check,
  customType,
  date,
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
    destinationBbox: geometryPolygon("destination_bbox"),
  },
  (table) => [
    check(
      "trips_destination_bbox_is_polygon",
      sql`ST_GeometryType(${table.destinationBbox}) = 'ST_Polygon'`,
    ),
    check(
      "trips_destination_bbox_srid",
      sql`ST_SRID(${table.destinationBbox}) = 4326`,
    ),
  ],
);

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    googlePlaceId: text("google_place_id").notNull(),
    location: geographyPoint("location").notNull(),
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

export type User = typeof users.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type Place = typeof places.$inferSelect;
export type SavedLocation = typeof savedLocations.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
