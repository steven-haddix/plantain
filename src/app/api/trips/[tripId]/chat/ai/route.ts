import { handleAiChatPost, maxDuration } from "@/app/api/chat/route";

export { maxDuration };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  return handleAiChatPost(req, tripId);
}
