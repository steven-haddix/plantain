import Outscraper from "outscraper";
import type {
  HotelSearchInputNormalized,
  HotelSearchProvider,
  HotelSearchProviderResult,
  HotelSearchWarning,
} from "@/lib/hotel-search/types";
import {
  buildGoogleHotelsSearchUrl,
  extractResultRows,
  inferResultSearchLocation,
  mapRawResultToHotel,
  pickErrorMessage,
} from "./utils";

const DEFAULT_GOOGLE_HOTELS_SEARCH_PATH = "/google-hotels-search";

const hasUnavailableEndpoint = (response: unknown): boolean => {
  if (!response || typeof response !== "object") {
    return false;
  }

  const payload = response as Record<string, unknown>;
  const errorMessage = String(payload.errorMessage ?? payload.message ?? "");
  return (
    Boolean(payload.error) &&
    /404|not found|unknown endpoint|unsupported/i.test(errorMessage)
  );
};

export class OutscraperGoogleHotelsProvider implements HotelSearchProvider {
  id = "google_hotels" as const;

  private client: Outscraper;
  private endpointPath: string;

  constructor(client?: Outscraper) {
    this.client =
      client ?? new Outscraper(process.env.OUTSCRAPER_API_KEY || "");
    this.endpointPath =
      process.env.OUTSCRAPER_GOOGLE_HOTELS_SEARCH_PATH ||
      DEFAULT_GOOGLE_HOTELS_SEARCH_PATH;
  }

  async search(
    input: HotelSearchInputNormalized,
  ): Promise<HotelSearchProviderResult> {
    const warnings: HotelSearchWarning[] = [];

    const endpointResults = await this.searchFromEndpoint(input, warnings);
    if (endpointResults.length > 0) {
      return {
        provider: this.id,
        results: endpointResults,
        warnings,
      };
    }

    const fallbackResults = await this.searchWithMapsFallback(input, warnings);

    return {
      provider: this.id,
      results: fallbackResults,
      warnings,
    };
  }

  private async searchFromEndpoint(
    input: HotelSearchInputNormalized,
    warnings: HotelSearchWarning[],
  ) {
    try {
      const queries = input.locations.map((location) =>
        buildGoogleHotelsSearchUrl({
          location,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
        }),
      );

      const response = await this.client.getAPIRequest(this.endpointPath, {
        query: queries,
        limit: input.limitPerProvider,
        language: input.language,
        region: input.region,
        async: false,
      });

      if (hasUnavailableEndpoint(response)) {
        warnings.push({
          provider: this.id,
          code: "provider_unavailable",
          message:
            "Google Hotels endpoint unavailable. Falling back to Google Maps hotels search.",
        });
        return [];
      }

      return extractResultRows(response).map((row, index) =>
        mapRawResultToHotel({
          provider: this.id,
          row,
          location: inferResultSearchLocation({
            row,
            locations: input.locations,
            fallbackLocation: input.locations[0] ?? "",
          }),
          index,
        }),
      );
    } catch (error) {
      warnings.push({
        provider: this.id,
        code: "provider_failed",
        message: `Google Hotels endpoint failed: ${pickErrorMessage(error)}. Falling back to Google Maps hotels search.`,
      });
      return [];
    }
  }

  private async searchWithMapsFallback(
    input: HotelSearchInputNormalized,
    warnings: HotelSearchWarning[],
  ) {
    try {
      const queries = input.locations.map(
        (location) =>
          input.guests
            ? `hotels for ${input.guests} people in ${location}`
            : `hotels in ${location}`,
      );
      const response = await this.client.googleMapsSearchV3(
        queries,
        input.limitPerProvider,
        input.language,
        input.region,
        0,
        false,
        null,
        false,
      );

      return extractResultRows(response).map((row, index) =>
        mapRawResultToHotel({
          provider: this.id,
          row,
          location: inferResultSearchLocation({
            row,
            locations: input.locations,
            fallbackLocation: input.locations[0] ?? "",
          }),
          index,
        }),
      );
    } catch (error) {
      warnings.push({
        provider: this.id,
        code: "provider_failed",
        message: `Google Maps fallback failed: ${pickErrorMessage(error)}`,
      });
      return [];
    }
  }
}
