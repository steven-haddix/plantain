export interface OrganicResult {
    link: string;
    title: string;
    description: string;
}

export interface AdResult {
    link: string;
    title: string;
    description: string;
}

export interface ShoppingResult {
    link: string;
    title: string;
    price: string;
    source: string;
}

export interface RelatedQuestion {
    link: string;
    title: string;
    description: string;
}

export interface WebSearchResult {
    query: string;
    organicResults: OrganicResult[];
    ads?: AdResult[];
    shoppingResults?: ShoppingResult[];
    relatedQuestions?: RelatedQuestion[];
}

export interface WebSearchOptions {
    limit?: number;
    pagesPerQuery?: number;
    uule?: string;
    language?: string;
    region?: string;
    tbs?: string;
    skip?: number;
}

export interface WebSearchProvider {
    search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
}
