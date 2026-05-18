import { getRequestAuthSession } from "@/lib/auth";
import { assertTripMemberAccess, listTripMembers } from "@/lib/trip-access";
import {
  createTripInviteShareUrl,
  listPendingTripInvitations,
} from "@/lib/trip-invitations";

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
    const trip = await assertTripMemberAccess(tripId, user.id);
    const members = await listTripMembers(tripId);
    const origin = new URL(req.url).origin;

    const pendingInvites =
      trip.membershipRole === "owner"
        ? (await listPendingTripInvitations(tripId)).map((invite) => ({
            id: invite.id,
            email: invite.email,
            status: invite.status,
            role: invite.role,
            createdAt: invite.createdAt,
            shareUrl: createTripInviteShareUrl(invite.token, origin),
          }))
        : undefined;

    return Response.json({
      currentUserRole: trip.membershipRole,
      members,
      pendingInvites,
    });
  } catch {
    return new Response("Trip not found", { status: 404 });
  }
}
