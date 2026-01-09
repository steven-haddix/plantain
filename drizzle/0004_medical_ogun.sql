ALTER TABLE "trips" RENAME COLUMN "destination_bbox" TO "destination_location";--> statement-breakpoint
ALTER TABLE "trips" DROP CONSTRAINT "trips_destination_bbox_is_polygon";--> statement-breakpoint
ALTER TABLE "trips" DROP CONSTRAINT "trips_destination_bbox_srid";--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_location_is_point" CHECK (ST_GeometryType("trips"."destination_location"::geometry) = 'ST_Point');--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_location_srid" CHECK (ST_SRID("trips"."destination_location"::geometry) = 4326);