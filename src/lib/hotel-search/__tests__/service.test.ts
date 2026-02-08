// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { HotelSearchService } from "../service";

const createFakeCache = () => {
  const store: Record<string, unknown> = {};
  return {
    store,
    getJson: async <T>(key: string): Promise<T | null> =>
      (store[key] as T | undefined) ?? null,
    setJson: async (key: string, value: unknown) => {
      store[key] = value;
    },
  };
};

const createProvider = (
  id: string,
  resultFactory: (locations: string[]) => unknown[],
) => ({
  id,
  async search(input: { locations: string[] }) {
    return {
      provider: id,
      results: resultFactory(input.locations),
    };
  },
});

describe("HotelSearchService", () => {
  test("caps locations to five and caches result ids", async () => {
    const cache = createFakeCache();
    let receivedLocations: string[] = [];

    const provider = createProvider("airbnb", (locations) => {
      receivedLocations = locations;
      return [
        {
          canonicalId: "airbnb:alpha",
          provider: "airbnb",
          name: "Alpha Hotel",
          latitude: 1,
          longitude: 1,
          category: "hotel",
          locationPrecision: "exact",
        },
      ];
    });

    const service = new HotelSearchService(
      {
        airbnb: provider,
        hotels_com: provider,
        google_hotels: provider,
      },
      {
        cache,
        geocoder: {
          geocode: async () => [],
        },
      },
    );

    const response = await service.searchHotels({
      locations: ["A", "B", "C", "D", "E", "F"],
      providers: ["airbnb"],
      limitPerProvider: 3,
    });

    expect(receivedLocations).toHaveLength(5);
    expect(response.results).toHaveLength(1);

    const cachedKeys = Object.keys(cache.store).filter((key) =>
      key.startsWith("hotel-search:v1:result:"),
    );
    expect(cachedKeys).toContain("hotel-search:v1:result:airbnb:alpha");
  });

  test("geocodes missing coordinates and falls back to centroid", async () => {
    const cache = createFakeCache();

    const provider = createProvider("hotels_com", () => [
      {
        canonicalId: "hotels_com:no-coords",
        provider: "hotels_com",
        name: "No Coords Hotel",
        address: "Rua Augusta, Lisbon",
        category: "hotel",
        locationPrecision: "unknown",
      },
    ]);

    const service = new HotelSearchService(
      {
        airbnb: provider,
        hotels_com: provider,
        google_hotels: provider,
      },
      {
        cache,
        geocoder: {
          geocode: async (query: string) => {
            if (query.includes("No Coords Hotel")) {
              return [];
            }

            return [{ latitude: 38.7223, longitude: -9.1393 }];
          },
        },
      },
    );

    const response = await service.searchHotels({
      locations: "Lisbon",
      providers: ["hotels_com"],
    });

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.locationPrecision).toBe("centroid");
    expect(response.results[0]?.latitude).toBe(38.7223);
  });

  test("dedupes by name + proximity and prefers higher-ranked result", async () => {
    const cache = createFakeCache();

    const provider = createProvider("google_hotels", () => [
      {
        canonicalId: "google_hotels:first",
        provider: "google_hotels",
        name: "River Stay",
        address: "A",
        latitude: 38.7223,
        longitude: -9.1393,
        rating: 4.8,
        reviewsCount: 500,
        category: "hotel",
        locationPrecision: "exact",
      },
      {
        canonicalId: "google_hotels:second",
        provider: "google_hotels",
        name: "River Stay",
        address: "A",
        latitude: 38.72231,
        longitude: -9.13931,
        rating: 4.2,
        reviewsCount: 100,
        category: "hotel",
        locationPrecision: "exact",
      },
    ]);

    const service = new HotelSearchService(
      {
        airbnb: provider,
        hotels_com: provider,
        google_hotels: provider,
      },
      {
        cache,
        geocoder: {
          geocode: async () => [],
        },
      },
    );

    const response = await service.searchHotels({
      locations: "Lisbon",
      providers: ["google_hotels"],
    });

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.canonicalId).toBe("google_hotels:first");
  });

  test("filters listings that are far outside the searched city", async () => {
    const cache = createFakeCache();

    const provider = createProvider("airbnb", () => [
      {
        canonicalId: "airbnb:far-away",
        provider: "airbnb",
        name: "Cabin in Sevierville, Tennessee",
        latitude: 35.8015,
        longitude: -83.5901,
        category: "hotel",
        locationPrecision: "exact",
        metadata: {
          searchLocation: "New York City",
        },
      },
    ]);

    const service = new HotelSearchService(
      {
        airbnb: provider,
        hotels_com: provider,
        google_hotels: provider,
      },
      {
        cache,
        geocoder: {
          geocode: async (query: string) => {
            if (query === "New York City") {
              return [
                {
                  latitude: 40.7128,
                  longitude: -74.006,
                  city: "New York",
                  state: "New York",
                  country: "United States",
                },
              ];
            }

            return [];
          },
        },
      },
    );

    const response = await service.searchHotels({
      locations: "New York City",
      providers: ["airbnb"],
    });

    expect(response.results).toHaveLength(0);
    expect(
      response.warnings.some(
        (warning) => warning.code === "out_of_area_filtered",
      ),
    ).toBe(true);
  });

  test("validates guests range", async () => {
    const cache = createFakeCache();
    const provider = createProvider("airbnb", () => []);

    const service = new HotelSearchService(
      {
        airbnb: provider,
        hotels_com: provider,
        google_hotels: provider,
      },
      {
        cache,
        geocoder: {
          geocode: async () => [],
        },
      },
    );

    await expect(
      service.searchHotels({
        locations: "Lisbon",
        providers: ["airbnb"],
        guests: 0,
      }),
    ).rejects.toThrow("guests must be an integer between 1 and 100.");
  });
});
