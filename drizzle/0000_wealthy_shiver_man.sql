CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "postgis";
--> statement-breakpoint
CREATE TYPE "public"."saved_location_status" AS ENUM('interested', 'visited');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"google_place_id" text NOT NULL,
	"location" "geography" NOT NULL,
	"details" jsonb,
	"summary_embedding" vector(1536),
	CONSTRAINT "places_location_is_point" CHECK (ST_GeometryType("places"."location"::geometry) = 'ST_Point'),
	CONSTRAINT "places_location_srid" CHECK (ST_SRID("places"."location"::geometry) = 4326)
);
--> statement-breakpoint
CREATE TABLE "saved_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"place_id" text NOT NULL,
	"status" "saved_location_status" NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"start_date" date,
	"end_date" date,
	"destination_bbox" geometry,
	CONSTRAINT "trips_destination_bbox_is_polygon" CHECK (ST_GeometryType("trips"."destination_bbox") = 'ST_Polygon'),
	CONSTRAINT "trips_destination_bbox_srid" CHECK (ST_SRID("trips"."destination_bbox") = 4326)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"avatar_url" text
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "places_google_place_id_unique" ON "places" USING btree ("google_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_locations_trip_place_unique" ON "saved_locations" USING btree ("trip_id","place_id");