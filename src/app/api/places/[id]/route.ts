import { neonAuth } from "@neondatabase/auth/next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { places } from "@/db/schema";
import { hotelSearchService } from "@/lib/hotel-search/service";
import { placesService } from "@/lib/places-search/service";

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
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

  const cachedHotel = await hotelSearchService.getCachedHotelResult(id);
  if (cachedHotel) {
    return Response.json({
      place: {
        googlePlaceId: cachedHotel.canonicalId,
        name: cachedHotel.name,
        address: cachedHotel.address || "",
        category: cachedHotel.category,
        source: cachedHotel.provider,
        url: cachedHotel.url,
        priceText: cachedHotel.priceText,
        locationPrecision: cachedHotel.locationPrecision,
        rating: cachedHotel.rating,
        reviewsCount: cachedHotel.reviewsCount,
        latitude: cachedHotel.latitude,
        longitude: cachedHotel.longitude,
        photos:
          cachedHotel.imageUrls?.map((url, index) => ({
            id: `photo-${index}`,
            url,
          })) ??
          (cachedHotel.imageUrl
            ? [{ id: "main", url: cachedHotel.imageUrl }]
            : []),
        details: {
          source: cachedHotel.provider,
          priceText: cachedHotel.priceText,
          locationPrecision: cachedHotel.locationPrecision,
          url: cachedHotel.url,
          metadata: cachedHotel.metadata,
        },
      },
    });
  }

  const [storedPlace] = await db
    .select({
      googlePlaceId: places.googlePlaceId,
      category: places.category,
      details: places.details,
      latitude: sql<number | null>`ST_Y(${places.location}::geometry)`.as(
        "latitude",
      ),
      longitude: sql<number | null>`ST_X(${places.location}::geometry)`.as(
        "longitude",
      ),
    })
    .from(places)
    .where(eq(places.googlePlaceId, id))
    .limit(1);

  if (storedPlace) {
    const details = (storedPlace.details ?? {}) as Record<string, unknown>;
    const name =
      typeof details.name === "string" && details.name.length > 0
        ? details.name
        : "Unknown Place";

    const address =
      (typeof details.formatted_address === "string" &&
        details.formatted_address) ||
      (typeof details.address === "string" && details.address) ||
      "";

    return Response.json({
      place: {
        ...details,
        googlePlaceId: storedPlace.googlePlaceId,
        name,
        address,
        category:
          typeof details.category === "string"
            ? details.category
            : storedPlace.category,
        source: typeof details.source === "string" ? details.source : undefined,
        url: typeof details.url === "string" ? details.url : undefined,
        priceText:
          typeof details.priceText === "string" ? details.priceText : undefined,
        locationPrecision:
          typeof details.locationPrecision === "string"
            ? details.locationPrecision
            : undefined,
        rating: toNumber(details.rating),
        reviewsCount: toNumber(details.reviewsCount ?? details.reviews_count),
        latitude: storedPlace.latitude ?? toNumber(details.latitude),
        longitude: storedPlace.longitude ?? toNumber(details.longitude),
      },
    });
  }

  const place = await placesService.getPlaceDetails(id);
  return Response.json({ place });
}
