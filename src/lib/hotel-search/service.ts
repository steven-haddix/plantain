import { HOTEL_SEARCH_CACHE_TTL } from "@/lib/constants";
import { geocodingService } from "@/lib/geocoding/service";
import { redisCacheService as redis } from "@/lib/redis";
import { OutscraperAirbnbProvider } from "./providers/outscraper/airbnb";
import { OutscraperGoogleHotelsProvider } from "./providers/outscraper/google-hotels";
import { OutscraperHotelsComProvider } from "./providers/outscraper/hotels-com";
import type {
  HotelProviderId,
  HotelResult,
  HotelSearchInput,
  HotelSearchInputNormalized,
  HotelSearchProvider,
  HotelSearchResponse,
  HotelSearchWarning,
} from "./types";

const DEFAULT_PROVIDER_ORDER: HotelProviderId[] = [
  "google_hotels",
  "hotels_com",
  "airbnb",
];

const MAX_LOCATIONS_PER_SEARCH = 5;
const MAX_LIMIT_PER_PROVIDER = 20;
const CITY_SCOPE_RADIUS_METERS = 120_000;
const REGION_SCOPE_RADIUS_METERS = 450_000;
const COUNTRY_SCOPE_RADIUS_METERS = 1_800_000;
const DEFAULT_SCOPE_RADIUS_METERS = 250_000;

const PROVIDER_RELIABILITY: Record<HotelProviderId, number> = {
  google_hotels: 3,
  hotels_com: 2,
  airbnb: 1,
};

const PRECISION_RANK: Record<HotelResult["locationPrecision"], number> = {
  exact: 3,
  geocoded: 2,
  centroid: 1,
  unknown: 0,
};

const normalizeLocation = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const normalizeText = (value?: string) =>
  (value || "").trim().toLowerCase().replace(/\s+/g, " ");

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
};

const isHotelSyntheticId = (id: string) =>
  /^(airbnb|hotels_com|google_hotels):/i.test(id);

const haversineDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;

  const deltaLat = toRad(lat2 - lat1);
  const deltaLng = toRad(lng2 - lng1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const compareHotels = (left: HotelResult, right: HotelResult) => {
  const precisionDelta =
    PRECISION_RANK[right.locationPrecision] -
    PRECISION_RANK[left.locationPrecision];
  if (precisionDelta !== 0) return precisionDelta;

  const ratingDelta = (right.rating ?? 0) - (left.rating ?? 0);
  if (ratingDelta !== 0) return ratingDelta;

  const reviewsDelta = (right.reviewsCount ?? 0) - (left.reviewsCount ?? 0);
  if (reviewsDelta !== 0) return reviewsDelta;

  const providerDelta =
    PROVIDER_RELIABILITY[right.provider] - PROVIDER_RELIABILITY[left.provider];
  if (providerDelta !== 0) return providerDelta;

  const priceDelta =
    Number(Boolean(right.priceText)) - Number(Boolean(left.priceText));
  if (priceDelta !== 0) return priceDelta;

  return left.name.localeCompare(right.name);
};

const areLikelyDuplicates = (left: HotelResult, right: HotelResult) => {
  if (normalizeText(left.name) !== normalizeText(right.name)) {
    return false;
  }

  if (
    left.latitude !== undefined &&
    left.longitude !== undefined &&
    right.latitude !== undefined &&
    right.longitude !== undefined
  ) {
    return (
      haversineDistanceMeters(
        left.latitude,
        left.longitude,
        right.latitude,
        right.longitude,
      ) <= 700
    );
  }

  const leftAddress = normalizeText(left.address);
  const rightAddress = normalizeText(right.address);

  return leftAddress.length > 0 && leftAddress === rightAddress;
};

const uniq = <T>(items: T[]) => Array.from(new Set(items));

type CacheAdapter = Pick<typeof redis, "getJson" | "setJson">;

type GeocodingAdapter = {
  geocode: (query: string) => Promise<
    Array<{
      latitude: number;
      longitude: number;
      city?: string;
      state?: string;
      country?: string;
      formattedAddress?: string;
    }>
  >;
};

export class HotelSearchService {
  private providers: Record<HotelProviderId, HotelSearchProvider>;
  private cache: CacheAdapter;
  private geocoder: GeocodingAdapter;

  constructor(
    providers?: Partial<Record<HotelProviderId, HotelSearchProvider>>,
    dependencies?: {
      cache?: CacheAdapter;
      geocoder?: GeocodingAdapter;
    },
  ) {
    this.providers = {
      airbnb: providers?.airbnb ?? new OutscraperAirbnbProvider(),
      hotels_com: providers?.hotels_com ?? new OutscraperHotelsComProvider(),
      google_hotels:
        providers?.google_hotels ?? new OutscraperGoogleHotelsProvider(),
    };
    this.cache = dependencies?.cache ?? redis;
    this.geocoder = dependencies?.geocoder ?? geocodingService;
  }

  async searchHotels(input: HotelSearchInput): Promise<HotelSearchResponse> {
    const normalized = this.normalizeInput(input);
    const cacheKey = this.createSearchCacheKey(normalized);

    const cached = await this.cache.getJson<HotelSearchResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const fresh = await this.searchHotelsUncached(normalized);
    await this.cache.setJson(cacheKey, fresh, HOTEL_SEARCH_CACHE_TTL);
    await Promise.all(
      fresh.results.map((result) => this.cacheHotelResult(result)),
    );

    return fresh;
  }

  async getCachedHotelResult(canonicalId: string): Promise<HotelResult | null> {
    if (!isHotelSyntheticId(canonicalId)) {
      return null;
    }

    const cached = await this.cache.getJson<HotelResult>(
      this.createResultCacheKey(canonicalId),
    );

    if (
      !cached ||
      typeof cached !== "object" ||
      typeof cached.canonicalId !== "string" ||
      typeof cached.provider !== "string"
    ) {
      return null;
    }

    return cached;
  }

  isSyntheticHotelId(id: string) {
    return isHotelSyntheticId(id);
  }

  private async searchHotelsUncached(
    input: HotelSearchInputNormalized,
  ): Promise<HotelSearchResponse> {
    const warnings: HotelSearchWarning[] = [];

    const providerCalls = input.providers.map(async (providerId) => {
      const provider = this.providers[providerId];
      if (!provider) {
        throw new Error(`Unsupported provider: ${providerId}`);
      }

      return provider.search(input);
    });

    const settledResults = await Promise.allSettled(providerCalls);

    const providerResults: HotelResult[] = [];

    settledResults.forEach((result, index) => {
      const provider = input.providers[index];

      if (result.status === "fulfilled") {
        providerResults.push(...result.value.results);
        if (result.value.warnings?.length) {
          warnings.push(...result.value.warnings);
        }
        return;
      }

      warnings.push({
        provider,
        code: "provider_failed",
        message: `Provider ${provider} failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      });
    });

    const enriched = await this.enrichLocations(
      providerResults,
      input.locations,
    );
    const { results: inAreaResults, filteredOutCount } =
      await this.filterOutOfAreaResults(enriched, input.locations);
    const ranked = this.rankAndDedupe(inAreaResults);

    const unmappableCount = ranked.filter(
      (result) => result.locationPrecision === "unknown",
    ).length;

    if (unmappableCount > 0) {
      warnings.push({
        code: "unmappable",
        message: `${unmappableCount} hotel result(s) could not be mapped precisely.`,
      });
    }

    if (filteredOutCount > 0) {
      warnings.push({
        code: "out_of_area_filtered",
        message: `${filteredOutCount} hotel result(s) were filtered out because they were outside the requested search area.`,
      });
    }

    return {
      results: ranked,
      warnings,
    };
  }

  private normalizeInput(input: HotelSearchInput): HotelSearchInputNormalized {
    const rawLocations = Array.isArray(input.locations)
      ? input.locations
      : [input.locations];

    const normalizedLocations = uniq(
      rawLocations
        .map((location) => location.trim())
        .filter((location) => location.length > 0),
    ).slice(0, MAX_LOCATIONS_PER_SEARCH);

    if (normalizedLocations.length === 0) {
      throw new Error("At least one location is required.");
    }

    const normalizedProviders = uniq(
      (input.providers?.length
        ? input.providers
        : DEFAULT_PROVIDER_ORDER
      ).filter(
        (provider): provider is HotelProviderId => provider in this.providers,
      ),
    );

    if (normalizedProviders.length === 0) {
      throw new Error("At least one valid hotel provider must be selected.");
    }

    const limitPerProvider = Math.max(
      1,
      Math.min(input.limitPerProvider ?? 10, MAX_LIMIT_PER_PROVIDER),
    );

    if (input.checkIn && !isValidDate(input.checkIn)) {
      throw new Error("checkIn must be a valid date in YYYY-MM-DD format.");
    }

    if (input.checkOut && !isValidDate(input.checkOut)) {
      throw new Error("checkOut must be a valid date in YYYY-MM-DD format.");
    }

    if (
      (input.checkIn && !input.checkOut) ||
      (!input.checkIn && input.checkOut)
    ) {
      throw new Error("Both checkIn and checkOut must be provided together.");
    }

    if (input.checkIn && input.checkOut && input.checkIn >= input.checkOut) {
      throw new Error("checkOut must be later than checkIn.");
    }

    if (
      input.guests !== undefined &&
      (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > 100)
    ) {
      throw new Error("guests must be an integer between 1 and 100.");
    }

    return {
      locations: normalizedLocations,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      providers: normalizedProviders,
      limitPerProvider,
      currency: input.currency || "USD",
      language: input.language || "en",
      region: input.region || "us",
    };
  }

  private createSearchCacheKey(input: HotelSearchInputNormalized) {
    return `hotel-search:v1:search:${JSON.stringify(input)}`;
  }

  private createResultCacheKey(canonicalId: string) {
    return `hotel-search:v1:result:${canonicalId}`;
  }

  private async cacheHotelResult(result: HotelResult) {
    await this.cache.setJson(
      this.createResultCacheKey(result.canonicalId),
      result,
      HOTEL_SEARCH_CACHE_TTL,
    );
  }

  private async enrichLocations(results: HotelResult[], locations: string[]) {
    const areaLookup = new Map<
      string,
      { latitude: number; longitude: number } | null
    >();

    const resolveArea = async (location: string) => {
      const key = normalizeLocation(location);
      if (areaLookup.has(key)) {
        return areaLookup.get(key) ?? null;
      }

      const matches = await this.geocoder.geocode(location);
      const first = matches[0];

      const centroid = first
        ? {
            latitude: first.latitude,
            longitude: first.longitude,
          }
        : null;

      areaLookup.set(key, centroid);
      return centroid;
    };

    const enriched = await Promise.all(
      results.map(async (result) => {
        if (result.latitude !== undefined && result.longitude !== undefined) {
          return {
            ...result,
            locationPrecision: "exact" as const,
          };
        }

        const listingQuery = [result.name, result.address]
          .filter(Boolean)
          .join(", ");
        if (listingQuery.length > 0) {
          const listingMatches = await this.geocoder.geocode(listingQuery);
          const firstMatch = listingMatches[0];

          if (firstMatch) {
            return {
              ...result,
              latitude: firstMatch.latitude,
              longitude: firstMatch.longitude,
              locationPrecision: "geocoded" as const,
            };
          }
        }

        const providerLocation =
          typeof result.metadata?.searchLocation === "string"
            ? result.metadata.searchLocation
            : undefined;

        const fallbackLocation = providerLocation ?? locations[0];
        if (fallbackLocation) {
          const centroid = await resolveArea(fallbackLocation);
          if (centroid) {
            return {
              ...result,
              latitude: centroid.latitude,
              longitude: centroid.longitude,
              locationPrecision: "centroid" as const,
            };
          }
        }

        return {
          ...result,
          locationPrecision: "unknown" as const,
        };
      }),
    );

    return enriched;
  }

  private getScopeRadiusMeters(area: {
    city?: string;
    state?: string;
    country?: string;
    formattedAddress?: string;
  }) {
    if (typeof area.city === "string" && area.city.trim().length > 0) {
      return CITY_SCOPE_RADIUS_METERS;
    }

    if (typeof area.state === "string" && area.state.trim().length > 0) {
      return REGION_SCOPE_RADIUS_METERS;
    }

    if (typeof area.country === "string" && area.country.trim().length > 0) {
      return COUNTRY_SCOPE_RADIUS_METERS;
    }

    if (
      typeof area.formattedAddress === "string" &&
      area.formattedAddress.includes(",")
    ) {
      return REGION_SCOPE_RADIUS_METERS;
    }

    return DEFAULT_SCOPE_RADIUS_METERS;
  }

  private async filterOutOfAreaResults(
    results: HotelResult[],
    inputLocations: string[],
  ) {
    const areaLookup = new Map<
      string,
      {
        latitude: number;
        longitude: number;
        city?: string;
        state?: string;
        country?: string;
        formattedAddress?: string;
      } | null
    >();

    const resolveArea = async (location: string) => {
      const key = normalizeLocation(location);
      if (areaLookup.has(key)) {
        return areaLookup.get(key) ?? null;
      }

      const matches = await this.geocoder.geocode(location);
      const area = matches[0] ?? null;
      areaLookup.set(key, area);
      return area;
    };

    const kept: HotelResult[] = [];
    let filteredOutCount = 0;

    for (const result of results) {
      if (result.latitude === undefined || result.longitude === undefined) {
        kept.push(result);
        continue;
      }

      const searchLocation =
        typeof result.metadata?.searchLocation === "string"
          ? result.metadata.searchLocation
          : inputLocations[0];

      if (!searchLocation) {
        kept.push(result);
        continue;
      }

      const area = await resolveArea(searchLocation);
      if (!area) {
        kept.push(result);
        continue;
      }

      const distanceMeters = haversineDistanceMeters(
        result.latitude,
        result.longitude,
        area.latitude,
        area.longitude,
      );

      const scopeRadiusMeters = this.getScopeRadiusMeters(area);
      if (distanceMeters > scopeRadiusMeters) {
        filteredOutCount += 1;
        continue;
      }

      kept.push(result);
    }

    return { results: kept, filteredOutCount };
  }

  private rankAndDedupe(results: HotelResult[]) {
    const sorted = [...results].sort(compareHotels);

    const deduped: HotelResult[] = [];

    for (const candidate of sorted) {
      const hasDuplicate = deduped.some((existing) =>
        areLikelyDuplicates(existing, candidate),
      );

      if (!hasDuplicate) {
        deduped.push(candidate);
      }
    }

    return deduped;
  }
}

export const hotelSearchService = new HotelSearchService();

export * from "./types";
