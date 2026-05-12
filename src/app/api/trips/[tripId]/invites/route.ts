import { z } from "zod";
import { getRequestAuthSession } from "@/lib/auth";
import {
  createTripInvitation,
  createTripInviteShareUrl,
  TripInvitationError,
} from "@/lib/trip-invitations";

const postSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(
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

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid invite payload." }, { status: 400 });
  }

  try {
    const invite = await createTripInvitation({
      tripId,
      invitedByUserId: user.id,
      invitedByEmail: user.email,
      email: parsed.data.email,
    });
    const shareUrl = createTripInviteShareUrl(
      invite.token,
      new URL(req.url).origin,
    );

    return Response.json({
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        role: invite.role,
        createdAt: invite.createdAt,
      },
      shareUrl,
    });
  } catch (error) {
    if (error instanceof TripInvitationError) {
      const status =
        error.code === "invalid_email"
          ? 400
          : error.code === "already_member"
            ? 409
            : 404;

      return Response.json({ error: error.message }, { status });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({ error: "Trip not found" }, { status: 404 });
  }
}
