import { neonAuth } from "@neondatabase/auth/next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips } from "@/db/schema";
import type {
  ItineraryEventBucket,
  ItineraryEventStatus,
} from "@/lib/trips/service";
import { tripService } from "@/lib/trips/service";

function isBucket(value: string): value is ItineraryEventBucket {
  return (
    value === "morning" ||
    value === "afternoon" ||
    value === "evening" ||
    value === "night" ||
    value === "anytime"
  );
}

function isStatus(value: string): value is ItineraryEventStatus {
  return value === "proposed" || value === "confirmed" || value === "canceled";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { user } = await neonAuth();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { tripId } = await params;
  if (!tripId) {
    return new Response("Missing trip id", { status: 400 });
  }

  const [trip] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.ownerId, user.id)));

  if (!trip) {
    return new Response("Trip not found", { status: 404 });
  }

  const url = new URL(req.url);
  const dayIndexParam = url.searchParams.get("dayIndex");
  const bucketParam = url.searchParams.get("bucket") ?? undefined;
  const statusParam = url.searchParams.get("status") ?? undefined;

  const dayIndexRaw =
    dayIndexParam === null ? undefined : Number(dayIndexParam);
  const dayIndex =
    dayIndexRaw === undefined ||
    !Number.isFinite(dayIndexRaw) ||
    dayIndexRaw < 0
      ? undefined
      : Math.floor(dayIndexRaw);

  const bucket = bucketParam && isBucket(bucketParam) ? bucketParam : undefined;
  const status = statusParam && isStatus(statusParam) ? statusParam : undefined;

  const events = await tripService.listItineraryEvents(tripId, {
    dayIndex,
    bucket,
    status,
  });

  return Response.json({ events });
}
