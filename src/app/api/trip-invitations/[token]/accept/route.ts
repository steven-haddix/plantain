import { getRequestAuthSession } from "@/lib/auth";
import {
  acceptTripInvitation,
  TripInvitationError,
} from "@/lib/trip-invitations";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getRequestAuthSession(req);
  const user = session?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { token } = await params;
  if (!token) {
    return Response.json({ error: "Invalid invitation token." }, { status: 400 });
  }

  try {
    const result = await acceptTripInvitation({
      token,
      userId: user.id,
      userEmail: user.email,
    });

    return Response.json({
      tripId: result.tripId,
      alreadyAccepted: result.alreadyAccepted,
      redirectUrl: `/dashboard?trip=${encodeURIComponent(result.tripId)}&chat=team&invite=accepted`,
    });
  } catch (error) {
    if (error instanceof TripInvitationError) {
      const status =
        error.code === "email_mismatch"
          ? 403
          : error.code === "invalid_email"
            ? 400
            : error.code === "revoked"
              ? 409
              : 404;

      return Response.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    return Response.json(
      { error: "Unable to accept invitation." },
      { status: 500 },
    );
  }
}
