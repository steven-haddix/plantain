// @ts-nocheck
import { afterEach, describe, expect, test } from "bun:test";
import { OutscraperAirbnbProvider } from "../providers/outscraper/airbnb";
import { OutscraperGoogleHotelsProvider } from "../providers/outscraper/google-hotels";
import { OutscraperHotelsComProvider } from "../providers/outscraper/hotels-com";
import {
  inferResultSearchLocation,
  mapRawResultToHotel,
} from "../providers/outscraper/utils";

const baseInput = {
  locations: ["Lisbon, Portugal"],
  providers: ["airbnb", "hotels_com", "google_hotels"],
  guests: 4,
  limitPerProvider: 5,
  currency: "USD",
  language: "en",
  region: "us",
};

afterEach(() => {
  delete process.env.OUTSCRAPER_AIRBNB_SEARCH_PATH;
  delete process.env.OUTSCRAPER_HOTELS_SEARCH_PATH;
  delete process.env.OUTSCRAPER_GOOGLE_HOTELS_SEARCH_PATH;
});

describe("Outscraper hotel providers", () => {
  test("airbnb provider respects endpoint env override", async () => {
    process.env.OUTSCRAPER_AIRBNB_SEARCH_PATH = "/custom-airbnb-search";

    const calls: Array<{ path: string; params: Record<string, unknown> }> = [];
    const provider = new OutscraperAirbnbProvider({
      getAPIRequest: async (path: string, params: Record<string, unknown>) => {
        calls.push({ path, params });
        return { data: [] };
      },
    } as never);

    await provider.search(baseInput);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/custom-airbnb-search");
    expect(calls[0]?.params.async).toBe(false);
    expect((calls[0]?.params.query as string[])[0]).toContain("adults=4");
  });

  test("hotels.com provider respects endpoint env override", async () => {
    process.env.OUTSCRAPER_HOTELS_SEARCH_PATH = "/custom-hotels-search";

    const calls: Array<{ path: string; params: Record<string, unknown> }> = [];
    const provider = new OutscraperHotelsComProvider({
      getAPIRequest: async (path: string, params: Record<string, unknown>) => {
        calls.push({ path, params });
        return { data: [] };
      },
    } as never);

    await provider.search(baseInput);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/custom-hotels-search");
    expect(calls[0]?.params.async).toBe(false);
    expect((calls[0]?.params.query as string[])[0]).toContain("adults=4");
  });

  test("google provider falls back to maps when endpoint is unavailable", async () => {
    const provider = new OutscraperGoogleHotelsProvider({
      getAPIRequest: async () => ({
        error: true,
        errorMessage: "404 Not Found: endpoint missing",
      }),
      googleMapsSearchV3: async () => [
        [
          {
            place_id: "google-place-1",
            name: "Hotel Fallback",
            full_address: "Rua 1, Lisbon",
            latitude: 38.7223,
            longitude: -9.1393,
            rating: 4.6,
          },
        ],
      ],
    } as never);

    const response = await provider.search(baseInput);

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.name).toBe("Hotel Fallback");
    expect(
      response.warnings?.some(
        (warning) => warning.code === "provider_unavailable",
      ),
    ).toBe(true);
  });

  test("raw mapping creates canonical id and hotel category", () => {
    const mapped = mapRawResultToHotel({
      provider: "airbnb",
      row: {
        listing_id: "abc-123",
        name: "Canal Loft",
        latitude: 38.7,
        longitude: -9.1,
      },
      location: "Lisbon",
      index: 0,
    });

    expect(mapped.canonicalId).toBe("airbnb:abc-123");
    expect(mapped.category).toBe("hotel");
    expect(mapped.locationPrecision).toBe("exact");
  });

  test("infers search location from row query for batched searches", () => {
    const inferred = inferResultSearchLocation({
      row: {
        query:
          "https://www.airbnb.com/s/Los%20Angeles%2C%20California%2C%20United%20States/homes",
      },
      locations: ["New York City", "Los Angeles, California, United States"],
      fallbackLocation: "New York City",
    });

    expect(inferred).toBe("Los Angeles, California, United States");
  });

  test("extracts Airbnb contextual pictures into image fields", () => {
    const mapped = mapRawResultToHotel({
      provider: "airbnb",
      row: {
        listing_id: "photo-test-1",
        title: "Cabin listing",
        contextual_pictures: [
          {
            picture: {
              large: "https://a0.muscache.com/im/pictures/abc123.jpg",
            },
          },
        ],
      },
      location: "New York City",
      index: 0,
    });

    expect(mapped.imageUrl).toBe(
      "https://a0.muscache.com/im/pictures/abc123.jpg",
    );
    expect(mapped.imageUrls).toContain(
      "https://a0.muscache.com/im/pictures/abc123.jpg",
    );
  });
});
