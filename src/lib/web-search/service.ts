import { WEB_SEARCH_CACHE_TTL } from "@/lib/constants";
import { redisCacheService as redis } from "@/lib/redis";
import { OutscraperWebSearchProvider } from "./providers/outscraper/index";
import type {
    WebSearchOptions,
    WebSearchProvider,
    WebSearchResult,
} from "./types";

export class WebSearchService {
    private provider: WebSearchProvider;

    constructor(provider?: WebSearchProvider) {
        // Default to Outscraper
        this.provider = provider || new OutscraperWebSearchProvider();
    }

    /**
     * Search the web using the active provider
     */
    async search(
        query: string,
        options: WebSearchOptions = {},
    ): Promise<WebSearchResult[]> {
        const cacheKey = `web-search:v1:search:${query}:${JSON.stringify(options)}`;

        return redis.cacheWrapper(
            cacheKey,
            () => this.provider.search(query, options),
            WEB_SEARCH_CACHE_TTL,
        );
    }
}

export const webSearchService = new WebSearchService();
export * from "./types";
