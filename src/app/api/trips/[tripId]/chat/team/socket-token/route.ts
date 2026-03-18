import { getRequestAuthSession } from "@/lib/auth";
import { createTeamChatSocketToken } from "@/lib/chat/realtime";
import { assertTripMemberAccess } from "@/lib/trip-access";

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

  try {
    await assertTripMemberAccess(tripId, user.id);
  } catch {
    return new Response("Trip not found", { status: 404 });
  }

  return Response.json({
    token: createTeamChatSocketToken({
      tripId,
      userId: user.id,
    }),
  });
}
