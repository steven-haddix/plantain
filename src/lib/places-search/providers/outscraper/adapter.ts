import type { OutscraperPlace, OutscraperReview } from "outscraper";
import type { Place, PlacePhoto, PlaceReview } from "../../types";

export function mapPlace(data: OutscraperPlace): Place {
    return {
        googlePlaceId: (data.place_id || data.google_id || data.cid) as string,
        name: data.name,
        address: data.full_address || data.address || "",
        city: data.city,
        state: data.state || data.us_state,
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        rating: data.rating,
        reviewsCount: data.reviews,
        priceLevel: data.range?.length || undefined,
        type: data.type,
        category: data.category,
        subtypes: data.subtypes?.split(",").map((s) => s.trim()),
        website: data.site,
        phone: data.phone,
        hours: data.working_hours,
        photos: data.photo
            ? [
                {
                    id: "main",
                    url: data.photo,
                    urlLarge: `${data.photo}=w2048-h2048-k-no`,
                },
            ]
            : [],
        details: {
            about: data.about,
            businessStatus: data.business_status,
            reservationLinks: data.reservation_links,
            menuLink: data.menu_link,
            orderLinks: data.order_links,
        },
    };
}

export function mapReview(data: OutscraperReview): PlaceReview {
    return {
        id: data.review_id,
        author: data.author_name,
        rating: data.rating,
        text: data.text,
        relativeTime: data.reviews_ago,
        timestamp: data.review_timestamp,
    };
}

export function mapPhoto(photo: any): PlacePhoto {
    return {
        id: photo.photo_id || `photo-${Math.random().toString(36).slice(2)}`,
        url: photo.photo_url,
        urlLarge: photo.photo_url_big || `${photo.photo_url}=w2048-h2048-k-no`,
    };
}

export function extractPlaces(response: any): OutscraperPlace[] {
    if (!Array.isArray(response) || response.length === 0) return [];

    if (Array.isArray(response[0])) {
        return response[0] as OutscraperPlace[];
    }

    return response as OutscraperPlace[];
}
