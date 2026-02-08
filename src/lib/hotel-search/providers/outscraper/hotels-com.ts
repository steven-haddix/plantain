import Outscraper from "outscraper";
import type {
  HotelSearchInputNormalized,
  HotelSearchProvider,
  HotelSearchProviderResult,
} from "@/lib/hotel-search/types";
import {
  buildHotelsComSearchUrl,
  extractResultRows,
  inferResultSearchLocation,
  mapRawResultToHotel,
} from "./utils";

const DEFAULT_HOTELS_SEARCH_PATH = "/hotels-search";

export class OutscraperHotelsComProvider implements HotelSearchProvider {
  id = "hotels_com" as const;

  private client: Outscraper;
  private endpointPath: string;

  constructor(client?: Outscraper) {
    this.client =
      client ?? new Outscraper(process.env.OUTSCRAPER_API_KEY || "");
    this.endpointPath =
      process.env.OUTSCRAPER_HOTELS_SEARCH_PATH || DEFAULT_HOTELS_SEARCH_PATH;
  }

  async search(
    input: HotelSearchInputNormalized,
  ): Promise<HotelSearchProviderResult> {
    const queries = input.locations.map((location) =>
      buildHotelsComSearchUrl({
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
      currency: input.currency,
      region: input.region,
      async: false,
    });

    const results = extractResultRows(response).map((row, index) =>
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

    return {
      provider: this.id,
      results,
    };
  }
}
