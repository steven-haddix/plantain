import Outscraper from "outscraper";
import type {
    WebSearchOptions,
    WebSearchProvider,
    WebSearchResult,
} from "../../types";
import * as adapter from "./adapter";

export class OutscraperWebSearchProvider implements WebSearchProvider {
    private client: Outscraper;

    constructor() {
        const apiKey = process.env.OUTSCRAPER_API_KEY || "";
        this.client = new Outscraper(apiKey);
    }

    async search(
        query: string,
        options: WebSearchOptions = {},
    ): Promise<WebSearchResult[]> {
        const response = await this.client.googleSearch(
            query,
            options.pagesPerQuery,
            options.uule,
            options.language,
            options.region,
            options.tbs as any,
            options.skip,
            undefined, // enrichment
            undefined, // fields
            false, // asyncRequest = false for real-time
        );

        return response.map(adapter.mapSearchResult);
    }
}
