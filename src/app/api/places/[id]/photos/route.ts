import { neonAuth } from "@neondatabase/auth/next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { places } from "@/db/schema";
import { hotelSearchService } from "@/lib/hotel-search/service";
import { placesService } from "@/lib/places-search/service";

const normalizePhotoUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        const url =
          (item as { url?: unknown; image?: unknown; src?: unknown }).url ??
          (item as { image?: unknown }).image ??
          (item as { src?: unknown }).src;
        return typeof url === "string" ? url : undefined;
      }

      return undefined;
    })
    .filter((url): url is string => Boolean(url));
};

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
    if (hotelSearchService.isSyntheticHotelId(id)) {
      const cachedHotel = await hotelSearchService.getCachedHotelResult(id);
      if (cachedHotel?.imageUrls?.length) {
        return Response.json({
          photos: cachedHotel.imageUrls.map((url, index) => ({
            id: `photo-${index}`,
            url,
          })),
        });
      }

      if (cachedHotel?.imageUrl) {
        return Response.json({
          photos: [{ id: "main", url: cachedHotel.imageUrl }],
        });
      }

      const [storedPlace] = await db
        .select({ details: places.details })
        .from(places)
        .where(eq(places.googlePlaceId, id))
        .limit(1);

      const details = (storedPlace?.details ?? {}) as Record<string, unknown>;
      const normalizedPhotoUrls = normalizePhotoUrls(details.photos);
      const photos =
        normalizedPhotoUrls.length > 0
          ? normalizedPhotoUrls.map((url, index) => ({
              id: `photo-${index}`,
              url,
            }))
          : typeof details.imageUrl === "string"
            ? [{ id: "main", url: details.imageUrl }]
            : [];

      return Response.json({ photos });
    }

    const photos = await placesService.getPlacePhotos(id, 10);
    return Response.json({ photos });
  } catch (error) {
    console.error("Failed to fetch photos:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
