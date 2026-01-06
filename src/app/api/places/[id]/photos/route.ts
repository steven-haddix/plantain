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

    try {
        const photos = await placesService.getPlacePhotos(id, 10);
        return Response.json({ photos });
    } catch (error) {
        console.error("Failed to fetch photos:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
