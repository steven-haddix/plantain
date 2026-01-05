CREATE TYPE "public"."itinerary_event_bucket" AS ENUM('morning', 'afternoon', 'evening', 'night', 'anytime');--> statement-breakpoint
CREATE TYPE "public"."itinerary_event_status" AS ENUM('proposed', 'confirmed', 'canceled');--> statement-breakpoint
CREATE TABLE "itinerary_events" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"place_id" text,
	"custom_title" text,
	"day_index" integer NOT NULL,
	"bucket" "itinerary_event_bucket" DEFAULT 'anytime' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"status" "itinerary_event_status" DEFAULT 'proposed' NOT NULL,
	"source_saved_location_id" text,
	"metadata" jsonb,
	CONSTRAINT "itinerary_events_place_or_custom" CHECK (("itinerary_events"."place_id" is not null and "itinerary_events"."custom_title" is null) or ("itinerary_events"."place_id" is null and "itinerary_events"."custom_title" is not null))
);
--> statement-breakpoint
ALTER TABLE "itinerary_events" ADD CONSTRAINT "itinerary_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_events" ADD CONSTRAINT "itinerary_events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_events" ADD CONSTRAINT "itinerary_events_source_saved_location_id_saved_locations_id_fk" FOREIGN KEY ("source_saved_location_id") REFERENCES "public"."saved_locations"("id") ON DELETE set null ON UPDATE no action;