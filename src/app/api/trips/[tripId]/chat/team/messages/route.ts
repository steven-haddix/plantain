import { z } from "zod";
import { getRequestAuthSession } from "@/lib/auth";
import { publishTeamChatEvent } from "@/lib/chat/realtime";
import {
  createTeamMessage,
  getOrCreateTeamThread,
  listMessages,
} from "@/lib/chat/service";
import { CHAT_HISTORY_LIMIT } from "@/lib/constants";
import { assertTripMemberAccess, listTripMembers } from "@/lib/trip-access";

const postSchema = z.object({
  text: z.string().min(1),
  clientMessageId: z.string().optional(),
});

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

  try {
    await assertTripMemberAccess(tripId, user.id);
  } catch {
    return new Response("Trip not found", { status: 404 });
  }

  const thread = await getOrCreateTeamThread(tripId, user.id);
  const url = new URL(req.url);
  const limitParam = Number(
    url.searchParams.get("limit") ?? CHAT_HISTORY_LIMIT,
  );
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 50)
      : CHAT_HISTORY_LIMIT;

  const history = await listMessages(thread.id, limit, cursor);
  const members = cursor ? undefined : await listTripMembers(tripId);

  return Response.json({
    ...history,
    members,
  });
}

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

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid message payload." },
      { status: 400 },
    );
  }

  const message = await createTeamMessage({
    tripId,
    userId: user.id,
    text: parsed.data.text,
    clientMessageId: parsed.data.clientMessageId,
  });

  await publishTeamChatEvent({
    tripId,
    event: "chat.message.created",
    data: message,
  });

  return Response.json({ message });
}
