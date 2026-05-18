import { z } from "zod";
import { getRequestAuthSession } from "@/lib/auth";
import { assertTripMemberAccess } from "@/lib/trip-access";
import { tripService } from "@/lib/trips/service";
import { isValidSortKey } from "@/lib/trips/sort-keys";

const bucketSchema = z.enum([
  "morning",
  "afternoon",
  "evening",
  "night",
  "anytime",
]);

const patchBodySchema = z
  .object({
    dayIndex: z.number().int().min(0).optional(),
    bucket: bucketSchema.optional(),
    sortOrder: z
      .string()
      .refine(isValidSortKey, { message: "Invalid sort key" })
      .optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: "At least one field is required",
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tripId: string; eventId: string }> },
) {
  const session = await getRequestAuthSession(req);
  const user = session?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { tripId, eventId } = await params;
  if (!tripId || !eventId) {
    return new Response("Missing identifier", { status: 400 });
  }

  try {
    await assertTripMemberAccess(tripId, user.id);
  } catch {
    return new Response("Trip not found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // TODO(realtime): emit `itinerary:event:moved` here once we wire socket.io for itinerary.
  const event = await tripService.updateItineraryEvent(
    tripId,
    eventId,
    parsed.data,
  );

  if (!event) return new Response("Event not found", { status: 404 });
  return Response.json({ event });
}
