import { getRequestAuthSession } from "@/lib/auth";
import { assertTripMemberAccess } from "@/lib/trip-access";
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
  const session = await getRequestAuthSession(req);
  const user = session?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { tripId } = await params;
  if (!tripId) {
    return new Response("Missing trip id", { status: 400 });
  }

  try {
    await assertTripMemberAccess(tripId, user.id);
  } catch {
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
