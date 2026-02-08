ALTER TABLE "trips" ADD COLUMN "party_size" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_party_size_range" CHECK ("trips"."party_size" is null or ("trips"."party_size" >= 1 and "trips"."party_size" <= 100));
