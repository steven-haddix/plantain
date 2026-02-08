declare module "outscraper" {
  export interface OutscraperReviewsPerScore {
    [key: string]: number;
  }

  export interface OutscraperWorkingHours {
    [day: string]: string;
  }

  export interface OutscraperOtherHours {
    [category: string]: {
      [day: string]: string;
    };
  }

  export interface OutscraperAbout {
    [category: string]: {
      [item: string]: boolean | string;
    };
  }

  export interface OutscraperPlace {
    query?: string;
    name: string;
    place_id?: string;
    google_id?: string;
    full_address?: string;
    address?: string;
    borough?: string;
    street?: string;
    postal_code?: string;
    area_service?: boolean;
    country_code?: string;
    country?: string;
    city?: string;
    us_state?: string;
    state?: string;
    plus_code?: string | null;
    latitude?: number;
    longitude?: number;
    time_zone?: string;
    popular_times?: any;
    site?: string;
    phone?: string;
    type?: string;
    logo?: string;
    description?: string;
    located_in?: string | null;
    located_google_id?: string | null;
    category?: string;
    subtypes?: string;
    posts?: any;
    reviews_tags?: any;
    rating?: number;
    reviews?: number;
    photos_count?: number;
    cid?: string;
    reviews_link?: string;
    reviews_id?: string;
    photo?: string;
    street_view?: string;
    working_hours_old_format?: string;
    working_hours?: OutscraperWorkingHours;
    other_hours?: OutscraperOtherHours[];
    business_status?: string;
    about?: OutscraperAbout;
    range?: string;
    reviews_per_score?: OutscraperReviewsPerScore;
    reservation_links?: string[];
    booking_appointment_link?: string;
    menu_link?: string | null;
    order_links?: string[] | null;
    owner_id?: string;
    verified?: boolean;
    owner_title?: string;
    owner_link?: string;
    location_link?: string;
  }

  export interface OutscraperReview {
    google_id: string;
    author_name: string;
    author_link: string;
    author_id: string;
    author_image: string;
    published_at_date: string;
    published_at: string;
    rating: number;
    likes: number;
    language: string;
    language_detected: string;
    text: string;
    text_translated?: string;
    response_from_owner_text?: string;
    response_from_owner_text_translated?: string;
    response_from_owner_date?: string;
    response_from_owner_timestamp?: number;
    response_from_owner_ago?: string;
    review_id: string;
    review_link: string;
    review_timestamp: number;
    reviews_ago: string;
    place_id: string;
  }

  export interface OutscraperReviewsResponse {
    place_id: string;
    name: string;
    address: string;
    place_link: string;
    reviews: OutscraperReview[];
  }

  export interface OutscraperEmailsContact {
    domain: string;
    emails: string[];
    phones: string[];
    socials: {
      [platform: string]: string;
    };
    links: {
      [type: string]: string;
    };
  }

  export interface OutscraperOrganicResult {
    link: string;
    title: string;
    description: string;
  }

  export interface OutscraperAd {
    link: string;
    title: string;
    description: string;
  }

  export interface OutscraperShoppingResult {
    link: string;
    title: string;
    price: string;
    source: string;
  }

  export interface OutscraperRelatedQuestion {
    link: string;
    title: string;
    description: string;
  }

  export interface OutscraperWebSearchResponse {
    query: string;
    organic_results?: OutscraperOrganicResult[];
    ads?: OutscraperAd[];
    shopping_results?: OutscraperShoppingResult[];
    related_questions?: OutscraperRelatedQuestion[];
  }

  export interface OutscraperGeocodingResponse {
    query: string;
    latitude: number;
    longitude: number;
    country?: string;
    state?: string;
    city?: string;
    borough?: string;
    street?: string;
    postal_code?: string;
    time_zone?: string;
    street_view?: string;
    formatted_address?: string; // For reverse geocoding
    place_id?: string;
    address_components?: any[];
    types?: string[];
  }

  class Outscraper {
    constructor(apiKey: string);
    getAPIRequest(
      path: string,
      parameters: Record<string, unknown>,
    ): Promise<unknown>;
    postAPIRequest(
      path: string,
      parameters: Record<string, unknown>,
    ): Promise<unknown>;

    /**
     * Search in Google Search
     * @param queries Queries to search on Google
     * @param pagesPerQuery Limit of pages to return from one query (default: 1)
     * @param uule UULE parameter to encode a place or location
     * @param language Language code (default: 'en')
     * @param region Country code
     * @param tbs Date range of results (h, d, w, m, y)
     * @param skip Number of items to skip
     * @param enrichment Enrichment to apply to results
     * @param fields Fields to include in response
     * @param asyncRequest Whether to execute asynchronously (default: true)
     */
    googleSearch(
      queries: string | string[],
      pagesPerQuery?: number,
      uule?: string,
      language?: string,
      region?: string,
      tbs?: "h" | "d" | "w" | "m" | "y",
      skip?: number,
      enrichment?: string | string[],
      fields?: string,
      asyncRequest?: boolean,
    ): Promise<OutscraperWebSearchResponse[]>;

    /**
     * Search for businesses in Google Maps
     * @param queries Array of queries or place IDs to search
     * @param limit Maximum number of results per query
     * @param language Language code (default: 'en')
     * @param region Region code (default: 'us')
     * @param coordinates Optional coordinates to center the search
     * @param async Whether to execute the request asynchronously (default: false)
     */
    googleMapsSearch(
      queries: string[],
      limit?: number,
      language?: string,
      region?: string,
      coordinates?: string,
      async?: boolean,
    ): Promise<OutscraperPlace[][]>;

    /**
     * Advanced Google Maps search v3 with control over pagination and enrichment.
     * @param query Queries or place IDs to search (string or array of strings)
     * @param limit Maximum number of results per query (default: 20)
     * @param language Language code (default: 'en')
     * @param region Region code (default: null)
     * @param skip Number of results to skip (default: 0)
     * @param dropDuplicates Deduplicate organizations across queries (default: false)
     * @param enrichment Additional data enrichment options (string or array, default: null)
     * @param asyncRequest Whether to execute asynchronously on the Outscraper side (default: true)
     */
    googleMapsSearchV3(
      query: string | string[],
      limit?: number,
      language?: string,
      region?: string | null,
      skip?: number,
      dropDuplicates?: boolean,
      enrichment?: string | string[] | null,
      asyncRequest?: boolean,
    ): Promise<OutscraperPlace[][]>;

    /**
     * Get reviews for Google Maps places
     * @param placeIds Array of place IDs
     * @param reviewsLimit Maximum number of reviews to retrieve
     * @param language Language code (default: 'en')
     * @param sort Sort reviews by relevance, newest, or default
     * @param async Whether to execute the request asynchronously
     */
    googleMapsReviews(
      placeIds: string[],
      reviewsLimit?: number,
      language?: string,
      sort?: "relevance_desc" | "newest" | "default",
      async?: boolean,
    ): Promise<OutscraperReviewsResponse[]>;

    /**
     * Get emails and contacts from websites
     * @param domains Array of domains to search
     * @param async Whether to execute the request asynchronously
     */
    emailsAndContacts(
      domains: string[],
      async?: boolean,
    ): Promise<OutscraperEmailsContact[]>;

    /**
     * Geocoding
     * @param query Address to geocode
     * @param asyncRequest Whether to execute the request asynchronously
     */
    geocoding(
      query: string | string[],
      asyncRequest?: boolean,
    ): Promise<OutscraperGeocodingResponse[]>;

    /**
     * Reverse Geocoding
     * @param query Coordinates to reverse geocode (lat,lng)
     * @param asyncRequest Whether to execute the request asynchronously
     */
    reverseGeocoding(
      query: string | string[],
      asyncRequest?: boolean,
    ): Promise<OutscraperGeocodingResponse[]>;
  }

  export default Outscraper;
}
