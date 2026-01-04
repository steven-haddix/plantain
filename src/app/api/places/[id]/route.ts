import { neonAuth } from "@neondatabase/auth/next/server";
import { placesService } from "@/lib/places-search/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await neonAuth();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return new Response("Missing place id", { status: 400 });
  }

  const place = await placesService.getPlaceDetails(id);
  return Response.json({ place });
}
