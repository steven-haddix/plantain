import { getRequestAuthSession } from "@/lib/auth";
import {
  revokeTripInvitation,
  TripInvitationError,
} from "@/lib/trip-invitations";

export async function DELETE(
  req: Request,
  {
    params,
  }: { params: Promise<{ tripId: string; inviteId: string }> },
) {
  const session = await getRequestAuthSession(req);
  const user = session?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { tripId, inviteId } = await params;
  if (!tripId || !inviteId) {
    return new Response("Missing invitation parameters", { status: 400 });
  }

  try {
    await revokeTripInvitation({
      tripId,
      inviteId,
      revokedByUserId: user.id,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof TripInvitationError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({ error: "Trip not found" }, { status: 404 });
  }
}
