-- Convert itinerary_events.sort_order from integer to text using fractional-indexing keys.
-- Existing ordering within (trip_id, day_index, bucket) is preserved by ranking rows and
-- assigning the same key sequence that fractional-indexing's generateNKeysBetween(null, null, n)
-- would produce: a0..az, b00..bzz, c000..czzz, etc.

ALTER TABLE "itinerary_events" ADD COLUMN "sort_order_new" text;--> statement-breakpoint

-- Inline base62 fractional-indexing key generator. Kept local to this migration via pg_temp
-- so it disappears with the session.
CREATE OR REPLACE FUNCTION pg_temp.fi_key(rk integer) RETURNS text AS $$
DECLARE
  chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  remaining integer := rk;
  width integer := 1;
  span integer;
  out text := '';
  i integer;
  digit integer;
BEGIN
  LOOP
    span := (62 ^ width)::integer;
    EXIT WHEN remaining < span;
    remaining := remaining - span;
    width := width + 1;
  END LOOP;

  FOR i IN REVERSE width - 1 .. 0 LOOP
    digit := remaining / (62 ^ i)::integer;
    out := out || substr(chars, digit + 1, 1);
    remaining := remaining - digit * (62 ^ i)::integer;
  END LOOP;

  RETURN chr(96 + width) || out;
END;
$$ LANGUAGE plpgsql IMMUTABLE;--> statement-breakpoint

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY trip_id, day_index, bucket
      ORDER BY sort_order, id
    ) - 1 AS rk
  FROM "itinerary_events"
)
UPDATE "itinerary_events" e
SET "sort_order_new" = pg_temp.fi_key(r.rk::integer)
FROM ranked r
WHERE e.id = r.id;--> statement-breakpoint

ALTER TABLE "itinerary_events" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "itinerary_events" RENAME COLUMN "sort_order_new" TO "sort_order";--> statement-breakpoint
ALTER TABLE "itinerary_events" ALTER COLUMN "sort_order" SET NOT NULL;
