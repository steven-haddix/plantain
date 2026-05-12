import { getTripInvitationPreview } from "@/lib/trip-invitations";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return Response.json({ status: "invalid" }, { status: 404 });
  }

  const preview = await getTripInvitationPreview(token);
  const statusCode = preview.status === "invalid" ? 404 : 200;

  return Response.json(preview, { status: statusCode });
}
