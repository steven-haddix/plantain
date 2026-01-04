import type {
    OutscraperAd,
    OutscraperOrganicResult,
    OutscraperRelatedQuestion,
    OutscraperShoppingResult,
    OutscraperWebSearchResponse,
} from "outscraper";
import type {
    AdResult,
    OrganicResult,
    RelatedQuestion,
    ShoppingResult,
    WebSearchResult,
} from "../../types";

export function mapOrganicResult(raw: OutscraperOrganicResult): OrganicResult {
    return {
        link: raw.link,
        title: raw.title,
        description: raw.description,
    };
}

export function mapAdResult(raw: OutscraperAd): AdResult {
    return {
        link: raw.link,
        title: raw.title,
        description: raw.description,
    };
}

export function mapShoppingResult(
    raw: OutscraperShoppingResult,
): ShoppingResult {
    return {
        link: raw.link,
        title: raw.title,
        price: raw.price,
        source: raw.source,
    };
}

export function mapRelatedQuestion(
    raw: OutscraperRelatedQuestion,
): RelatedQuestion {
    return {
        link: raw.link,
        title: raw.title,
        description: raw.description,
    };
}

export function mapSearchResult(
    raw: OutscraperWebSearchResponse,
): WebSearchResult {
    return {
        query: raw.query,
        organicResults: (raw.organic_results || []).map(mapOrganicResult),
        ads: (raw.ads || []).map(mapAdResult),
        shoppingResults: (raw.shopping_results || []).map(mapShoppingResult),
        relatedQuestions: (raw.related_questions || []).map(mapRelatedQuestion),
    };
}
