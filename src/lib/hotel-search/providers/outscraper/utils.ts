import type {
  HotelLocationPrecision,
  HotelProviderId,
  HotelResult,
} from "@/lib/hotel-search/types";

const toObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
};

const pickString = (
  source: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const candidate = toStringValue(source[key]);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
};

const pickNumber = (
  source: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    const candidate = toNumber(source[key]);
    if (candidate !== undefined) {
      return candidate;
    }
  }
  return undefined;
};

const firstImageUrl = (source: Record<string, unknown>): string | undefined => {
  const direct = pickString(source, [
    "image",
    "image_url",
    "thumbnail",
    "thumbnail_url",
    "photo",
    "photo_url",
    "cover",
  ]);
  if (direct) {
    return direct;
  }

  const images = source.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      const image = toObject(item);
      if (!image) continue;

      const url = pickString(image, ["url", "image", "image_url", "src"]);
      if (url) {
        return url;
      }
    }
  }

  return undefined;
};

const IMAGE_KEY_PATTERN =
  /(image|images|photo|photos|picture|thumbnail|cover)/i;

const isLikelyImageUrl = (value: string) =>
  /^https?:\/\//i.test(value) &&
  (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(value) ||
    /(image|photo|picture|thumbnail|muscache|airbnbusercontent)/i.test(value));

const collectImageCandidates = (
  value: unknown,
  imageSet: Set<string>,
  keyHint?: string,
  depth = 0,
) => {
  if (depth > 4) {
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      isLikelyImageUrl(trimmed) &&
      (!keyHint || IMAGE_KEY_PATTERN.test(keyHint))
    ) {
      imageSet.add(trimmed);
      return;
    }

    if (!keyHint && isLikelyImageUrl(trimmed)) {
      imageSet.add(trimmed);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectImageCandidates(item, imageSet, keyHint, depth + 1);
    }
    return;
  }

  const obj = toObject(value);
  if (!obj) {
    return;
  }

  for (const [entryKey, entryValue] of Object.entries(obj)) {
    const normalizedEntryKey = entryKey.toLowerCase();
    const childHint =
      IMAGE_KEY_PATTERN.test(normalizedEntryKey) ||
      (keyHint ? IMAGE_KEY_PATTERN.test(keyHint) : false)
        ? keyHint || normalizedEntryKey
        : normalizedEntryKey;
    collectImageCandidates(entryValue, imageSet, childHint, depth + 1);
  }
};

const collectImageUrls = (source: Record<string, unknown>): string[] => {
  const imageSet = new Set<string>();

  const directImage = firstImageUrl(source);
  if (directImage) {
    imageSet.add(directImage);
  }

  const candidateKeys = [
    "images",
    "photos",
    "contextual_pictures",
    "picture_urls",
    "photo_urls",
    "gallery",
  ];

  for (const key of candidateKeys) {
    collectImageCandidates(source[key], imageSet, key);
  }

  return Array.from(imageSet);
};

const buildCanonicalId = (
  provider: HotelProviderId,
  source: Record<string, unknown>,
  fallbackSeed: string,
): string => {
  const externalId = pickString(source, [
    "id",
    "listing_id",
    "hotel_id",
    "property_id",
    "place_id",
    "google_id",
    "cid",
    "url",
    "link",
  ]);

  const safeExternalId = (externalId ?? fallbackSeed)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9:/._-]/g, "");

  return `${provider}:${safeExternalId || fallbackSeed}`;
};

export const extractResultRows = (
  response: unknown,
): Record<string, unknown>[] => {
  if (Array.isArray(response)) {
    if (response.length > 0 && Array.isArray(response[0])) {
      return (response as unknown[])
        .flatMap((item) => (Array.isArray(item) ? item : [item]))
        .map((item) => toObject(item))
        .filter((item): item is Record<string, unknown> => Boolean(item));
    }

    return response
      .map((item) => toObject(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  const root = toObject(response);
  if (!root) {
    return [];
  }

  const data = root.data;
  if (Array.isArray(data)) {
    return extractResultRows(data);
  }

  const results = root.results;
  if (Array.isArray(results)) {
    return extractResultRows(results);
  }

  return [root];
};

export const mapRawResultToHotel = (args: {
  provider: HotelProviderId;
  row: Record<string, unknown>;
  location: string;
  index: number;
  defaultPrecision?: HotelLocationPrecision;
}): HotelResult => {
  const { provider, row, location, index } = args;

  const name =
    pickString(row, [
      "name",
      "title",
      "listing_name",
      "hotel_name",
      "property_name",
    ]) ?? "Hotel result";

  const address = pickString(row, [
    "address",
    "full_address",
    "formatted_address",
    "location",
    "city",
    "area",
    "neighborhood",
  ]);

  const latitude = pickNumber(row, ["latitude", "lat", "y"]);
  const longitude = pickNumber(row, ["longitude", "lng", "lon", "x"]);
  const imageUrls = collectImageUrls(row);

  return {
    canonicalId: buildCanonicalId(provider, row, `${location}-${index}`),
    provider,
    name,
    address,
    latitude,
    longitude,
    rating: pickNumber(row, ["rating", "stars", "review_score"]),
    reviewsCount: pickNumber(row, [
      "reviews",
      "reviews_count",
      "review_count",
      "reviewsCount",
    ]),
    priceText: pickString(row, [
      "price",
      "price_text",
      "price_per_night",
      "display_price",
      "rate",
    ]),
    imageUrl: imageUrls[0],
    imageUrls,
    url: pickString(row, ["url", "link", "listing_url", "hotel_url"]),
    category: "hotel",
    locationPrecision:
      latitude !== undefined && longitude !== undefined
        ? "exact"
        : (args.defaultPrecision ?? "unknown"),
    metadata: {
      raw: row,
      searchLocation: location,
    },
  };
};

const normalizeMatchText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

export const inferResultSearchLocation = (args: {
  row: Record<string, unknown>;
  locations: string[];
  fallbackLocation: string;
}): string => {
  const { row, locations, fallbackLocation } = args;
  if (locations.length === 1) {
    return locations[0] || fallbackLocation;
  }

  const rawQuery = pickString(row, ["query", "search_query", "input", "url"]);
  const queryCandidates = [
    rawQuery,
    rawQuery ? decodeURIComponent(rawQuery) : undefined,
  ]
    .filter(Boolean)
    .map((value) => normalizeMatchText(value as string));

  const normalizedLocations = locations.map((location) => ({
    original: location,
    normalized: normalizeMatchText(location),
    encoded: encodeURIComponent(location).toLowerCase(),
  }));

  for (const queryText of queryCandidates) {
    for (const location of normalizedLocations) {
      if (
        queryText.includes(location.normalized) ||
        queryText.includes(location.encoded)
      ) {
        return location.original;
      }
    }
  }

  const cityHint = pickString(row, ["city", "location", "area"]);
  if (cityHint) {
    const normalizedCityHint = normalizeMatchText(cityHint);
    const cityMatch = normalizedLocations.find(
      (location) =>
        location.normalized.includes(normalizedCityHint) ||
        normalizedCityHint.includes(location.normalized),
    );
    if (cityMatch) {
      return cityMatch.original;
    }
  }

  return fallbackLocation;
};

export const buildAirbnbSearchUrl = (args: {
  location: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}): string => {
  const url = new URL(
    `https://www.airbnb.com/s/${encodeURIComponent(args.location)}/homes`,
  );

  if (args.checkIn) {
    url.searchParams.set("checkin", args.checkIn);
  }

  if (args.checkOut) {
    url.searchParams.set("checkout", args.checkOut);
  }

  if (typeof args.guests === "number" && args.guests > 0) {
    url.searchParams.set("adults", String(args.guests));
  }

  return url.toString();
};

export const buildHotelsComSearchUrl = (args: {
  location: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}): string => {
  const url = new URL("https://www.hotels.com/Hotel-Search");
  url.searchParams.set("destination", args.location);
  url.searchParams.set("sort", "RECOMMENDED");

  if (args.checkIn) {
    url.searchParams.set("startDate", args.checkIn);
  }

  if (args.checkOut) {
    url.searchParams.set("endDate", args.checkOut);
  }

  if (typeof args.guests === "number" && args.guests > 0) {
    url.searchParams.set("adults", String(args.guests));
  }

  return url.toString();
};

export const buildGoogleHotelsSearchUrl = (args: {
  location: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}): string => {
  const url = new URL("https://www.google.com/travel/hotels");
  url.searchParams.set("q", args.location);

  if (args.checkIn) {
    url.searchParams.set("checkin", args.checkIn);
  }

  if (args.checkOut) {
    url.searchParams.set("checkout", args.checkOut);
  }

  if (typeof args.guests === "number" && args.guests > 0) {
    url.searchParams.set("adults", String(args.guests));
  }

  return url.toString();
};

export const pickErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
};
