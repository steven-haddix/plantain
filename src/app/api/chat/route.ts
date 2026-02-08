import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { neonAuth } from "@neondatabase/auth/next/server";
import {
  createAgentUIStreamResponse,
  createIdGenerator,
  generateText,
  ToolLoopAgent,
  tool,
} from "ai";
import { format, isValid, parseISO } from "date-fns";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import {
  hotelSearchService,
  type HotelProviderId,
} from "@/lib/hotel-search/service";
import { placesService } from "@/lib/places-search/service";
import { geocodingService } from "@/lib/geocoding/service";
import { tripService } from "@/lib/trips/service";
import { webSearchService } from "@/lib/web-search/service";
import { scrapeUrl } from "@/lib/web-scrape/cheerio-scraper";

import {
  chatMessages,
  chatThreads,
  places,
  savedLocations,
  trips,
} from "@/db/schema";

export const maxDuration = 60;
// Force rebuild: 2026-01-03

const formatTripDate = (value?: string | null) => {
  if (!value) return "Not set";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, "EEE, MMM d, yyyy");
};

const placeCategoryEnum = z.enum([
  "restaurant",
  "hotel",
  "attraction",
  "airport",
  "bar",
  "cafe",
  "park",
  "museum",
  "shopping",
  "transport",
  "activity",
  "other",
]);

const hotelProviderEnum = z.enum(["airbnb", "hotels_com", "google_hotels"]);

const isSyntheticHotelId = (id: string) =>
  /^(airbnb|hotels_com|google_hotels):/i.test(id);

export async function POST(req: Request) {
  const { user } = await neonAuth();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const { id: threadId, currentTrip } = body ?? {};
    const messages = Array.isArray(body?.messages) ? body.messages : undefined;

    if (!threadId || !currentTrip) {
      return new Response("Missing trip context", { status: 400 });
    }

    if (!messages) {
      return new Response("Missing chat messages", { status: 400 });
    }

    // Fetch trip context first to verify existence and ownership
    const [trip] = await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, currentTrip.id), eq(trips.ownerId, user.id)));

    if (!trip) {
      return new Response("Trip not found", { status: 404 });
    }

    // Fetch thread or create if it doesn't exist
    let [thread] = await db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.id, threadId));

    if (!thread) {
      [thread] = await db
        .insert(chatThreads)
        .values({
          id: threadId,
          tripId: trip.id,
          userId: user.id,
          title: `Chat about ${trip.title || "Trip"}`,
        })
        .returning();
    }

    // Fetch saved locations context
    const savedLocationsResult = await db
      .select({
        id: savedLocations.id,
        status: savedLocations.status,
        note: savedLocations.note,
        placeName: places.details,
      })
      .from(savedLocations)
      .innerJoin(places, eq(savedLocations.placeId, places.id))
      .where(eq(savedLocations.tripId, trip.id));

    const savedLocationsContext =
      savedLocationsResult.length > 0
        ? savedLocationsResult
            .map((loc) => {
              const name =
                (loc.placeName as { name?: string } | null)?.name ||
                "Unknown Place";
              const note = loc.note ? `\nNote: ${loc.note}` : "";
              return `- [ID: ${loc.id}] ${name} (${loc.status})${note}`;
            })
            .join("\n")
        : "No locations saved yet.";

    const itineraryEvents = await tripService.listItineraryEvents(trip.id);
    const itineraryContext =
      itineraryEvents.length > 0
        ? itineraryEvents
            .map((event) => {
              const title = event.placeName || event.customTitle || "Untitled";
              const optional = event.isOptional ? ", optional" : "";
              return `- [ID: ${event.id}] Day ${event.dayIndex + 1} · ${event.bucket} · ${title} (${event.status}${optional})`;
            })
            .join("\n")
        : "No itinerary items yet.";

    const resolveSyntheticHotelCoordinates = async (
      googlePlaceId: string,
      fallbackName: string,
      fallbackAddress: string,
    ) => {
      const cachedHotel =
        await hotelSearchService.getCachedHotelResult(googlePlaceId);
      if (!cachedHotel) {
        return {
          error:
            "I couldn't resolve this hotel ID from recent results. Please run hotel search again and pick a result from that list.",
        };
      }

      let latitude = cachedHotel.latitude;
      let longitude = cachedHotel.longitude;

      if (latitude === undefined || longitude === undefined) {
        const lookupQuery = [cachedHotel.name, cachedHotel.address]
          .filter(Boolean)
          .join(", ");

        if (lookupQuery.length > 0) {
          const geocoded = await geocodingService.geocode(lookupQuery);
          latitude = geocoded[0]?.latitude;
          longitude = geocoded[0]?.longitude;
        }
      }

      if (latitude === undefined || longitude === undefined) {
        const areaHint =
          typeof cachedHotel.metadata?.searchLocation === "string"
            ? cachedHotel.metadata.searchLocation
            : undefined;

        if (areaHint) {
          const areaGeocoded = await geocodingService.geocode(areaHint);
          latitude = areaGeocoded[0]?.latitude;
          longitude = areaGeocoded[0]?.longitude;
        }
      }

      if (latitude === undefined || longitude === undefined) {
        return {
          error:
            "This hotel result does not have reliable coordinates yet. Please run hotel search again and choose a mapped result.",
        };
      }

      return {
        latitude,
        longitude,
        details: {
          name: cachedHotel.name || fallbackName,
          formatted_address: cachedHotel.address || fallbackAddress,
          category: "hotel",
          source: cachedHotel.provider,
          priceText: cachedHotel.priceText,
          locationPrecision: cachedHotel.locationPrecision,
          imageUrl: cachedHotel.imageUrl,
          url: cachedHotel.url,
          metadata: cachedHotel.metadata,
        },
        category: "hotel" as const,
      };
    };

    const upsertPlaceByGooglePlaceId = async (
      googlePlaceId: string,
      category?: z.infer<typeof placeCategoryEnum>,
    ) => {
      let [place] = await db
        .select()
        .from(places)
        .where(eq(places.googlePlaceId, googlePlaceId));

      if (place) {
        return { place };
      }

      if (isSyntheticHotelId(googlePlaceId)) {
        const resolvedHotel = await resolveSyntheticHotelCoordinates(
          googlePlaceId,
          "Unknown Hotel",
          "",
        );

        if ("error" in resolvedHotel) {
          return { error: resolvedHotel.error };
        }

        const placeId = nanoid();
        [place] = await db
          .insert(places)
          .values({
            id: placeId,
            googlePlaceId,
            location: sql`ST_SetSRID(ST_MakePoint(${resolvedHotel.longitude}, ${resolvedHotel.latitude}), 4326)::geography`,
            category: category ?? resolvedHotel.category,
            details: resolvedHotel.details,
          })
          .onConflictDoUpdate({
            target: places.googlePlaceId,
            set: { googlePlaceId },
          })
          .returning();

        return { place };
      }

      try {
        const details = await placesService.getPlaceDetails(googlePlaceId);
        const name = details?.name || "Unknown Place";
        const lat = details?.latitude;
        const lng = details?.longitude;
        const address = details?.address || "";

        if (lat === undefined || lng === undefined) {
          return {
            error: "Failed to resolve place coordinates from Google Place ID.",
          };
        }

        const placeId = nanoid();
        [place] = await db
          .insert(places)
          .values({
            id: placeId,
            googlePlaceId,
            location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`,
            category,
            details: {
              name,
              formatted_address: address,
              ...details,
            },
          })
          .onConflictDoUpdate({
            target: places.googlePlaceId,
            set: { googlePlaceId },
          })
          .returning();

        return { place };
      } catch (error) {
        console.error("Failed to fetch/create place details:", error);
        return {
          error: "Failed to resolve place details from Google Place ID.",
        };
      }
    };

    const systemPrompt = `
You are an expert travel agent and local guide. You are helping a user plan and manage their trip.

**Trip Context:**
- **Title:** ${trip.title || "Untitled Trip"}
- **Dates:** ${formatTripDate(trip.startDate)} to ${formatTripDate(trip.endDate)}
- **Travelers:** ${trip.partySize ?? "Not set"}

**Day Numbering:**
Day 1 is the trip start date. Tools expect 1-based day numbers (Day 1, Day 2, ...).

**Place Categories:**
When creating saved locations or itinerary events, use one of these categories:
- restaurant, hotel, attraction, airport, bar, cafe, park, museum, shopping, transport, activity, other

**Saved Locations:**
${savedLocationsContext}

**Itinerary (Big Items):**
${itineraryContext}

**Your Goal:**
Help the user with their travel planning. You can:
1. Suggest interesting places to visit based on their trip.
2. Help organize their itinerary.
3. Update trip details (like the title or dates) if they ask.
4. Consider group size when recommending hotels, restaurants, and activities.
5. Manage saved locations: add new ones from search results, update notes/status of existing ones, or remove them.
6. Manage itinerary items: create, list, update, or remove itinerary events.

**Travel Tools:**
- Use the "Search Hotels" tool when the user asks about lodging or accommodations.
- Use the "Web Search" tool to search for information about a location.
- Use the "Scrape URL" tool to scrape a specific web page to extract information or read its content.
   - If search results are not helpful, use the "Scrape URL" tool to scrape the page.

**Tone:**
Professional, enthusiastic, helpful, and concise.
`;

    const agent = new ToolLoopAgent({
      model: "google/gemini-3-flash",
      instructions: systemPrompt,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: "medium",
            includeThoughts: true,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
      experimental_telemetry: { isEnabled: true },
      tools: {
        updateTripDetails: tool({
          description: "Update trip details like title, dates, or traveler count.",
          inputSchema: z.object({
            title: z.string().optional(),
            startDate: z.string().optional().describe("ISO date string"),
            endDate: z.string().optional().describe("ISO date string"),
            partySize: z
              .number()
              .int()
              .min(1)
              .max(100)
              .optional()
              .describe("Number of travelers for this trip"),
          }),
          execute: async (updates) => {
            await db.update(trips).set(updates).where(eq(trips.id, trip.id));
            return { output: "Trip updated successfully." };
          },
        }),
        searchPlaces: tool({
          description:
            "Search for places (restaurants, hotels, attractions, etc.)",
          inputSchema: z.object({
            query: z
              .string()
              .describe("The search query (e.g., 'best Italian restaurants')"),
            location: z
              .string()
              .optional()
              .describe("The location to search in (e.g., 'Brooklyn, NY')"),
            limit: z
              .number()
              .optional()
              .default(10)
              .describe("Maximum number of results to return"),
          }),
          execute: async ({ query, location, limit }) => {
            const results = await placesService.searchPlaces(
              query,
              location,
              limit,
            );
            return {
              places: results.map((p) => ({
                id: p.googlePlaceId,
                googlePlaceId: p.googlePlaceId,
                name: p.name,
                address: p.address,
                rating: p.rating,
                reviewsCount: p.reviewsCount,
                category: p.category,
                latitude: p.latitude,
                longitude: p.longitude,
                imageUrl: p.photos?.[0]?.url,
              })),
            };
          },
        }),
        searchHotels: tool({
          description:
            "Search hotels across Airbnb, Hotels.com, and Google Hotels (with fallback) for one or many locations.",
          inputSchema: z.object({
            locations: z.union([
              z.string().min(1).describe("Single location query"),
              z
                .array(z.string().min(1))
                .min(1)
                .max(5)
                .describe("Up to 5 locations"),
            ]),
            checkIn: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional()
              .describe("Check-in date in YYYY-MM-DD"),
            checkOut: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional()
              .describe("Check-out date in YYYY-MM-DD"),
            providers: z
              .array(hotelProviderEnum)
              .optional()
              .describe("Optional provider override"),
            guests: z
              .number()
              .int()
              .min(1)
              .max(100)
              .optional()
              .describe(
                "Traveler count. Defaults to the trip traveler count when available.",
              ),
            limitPerProvider: z
              .number()
              .int()
              .min(1)
              .max(20)
              .optional()
              .default(10)
              .describe("Max results to fetch per provider"),
            currency: z.string().optional().default("USD"),
            language: z.string().optional().default("en"),
            region: z.string().optional().default("us"),
          }),
          execute: async ({
            locations,
            checkIn,
            checkOut,
            providers,
            guests,
            limitPerProvider,
            currency,
            language,
            region,
          }) => {
            if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
              return {
                places: [],
                warnings: [
                  "Both check-in and check-out must be provided together.",
                ],
              };
            }

            const effectiveGuests =
              guests ??
              (typeof trip.partySize === "number" ? trip.partySize : undefined);

            let searchResponse;
            try {
              searchResponse = await hotelSearchService.searchHotels({
                locations,
                checkIn,
                checkOut,
                providers: providers as HotelProviderId[] | undefined,
                guests: effectiveGuests,
                limitPerProvider,
                currency,
                language,
                region,
              });
            } catch (error) {
              return {
                places: [],
                warnings: [
                  error instanceof Error ? error.message : String(error),
                ],
              };
            }

            const providerLabel: Record<HotelProviderId, string> = {
              airbnb: "Airbnb",
              hotels_com: "Hotels.com",
              google_hotels: "Google Hotels",
            };

            const places = searchResponse.results
              .filter(
                (result) =>
                  typeof result.latitude === "number" &&
                  typeof result.longitude === "number",
              )
              .map((result) => ({
                id: result.canonicalId,
                googlePlaceId: result.canonicalId,
                name: result.name,
                address: result.address,
                rating: result.rating,
                reviewsCount: result.reviewsCount,
                category: "hotel",
                latitude: result.latitude as number,
                longitude: result.longitude as number,
                imageUrl: result.imageUrl,
                source: providerLabel[result.provider],
                priceText: result.priceText,
                locationPrecision: result.locationPrecision,
              }));

            return {
              places,
              warnings: searchResponse.warnings.map((w) => w.message),
              unmappedCount: searchResponse.results.length - places.length,
            };
          },
        }),
        webSearch: tool({
          description:
            "Search the web for general information, travel tips, or news.",
          inputSchema: z.object({
            query: z.string().describe("The search query"),
          }),
          execute: async ({ query }) => {
            const results = await webSearchService.search(query);
            // Flatten and simplify the results for the LLM
            const organicResults = results.flatMap((r) =>
              r.organicResults.map((o) => ({
                title: o.title,
                link: o.link,
                description: o.description,
              })),
            );
            return { results: organicResults.slice(0, 5) };
          },
        }),
        scrapeUrl: tool({
          description:
            "Scrape a specific web page to extract information or read its content.",
          inputSchema: z.object({
            url: z.string().describe("The URL to scrape"),
            instruction: z
              .string()
              .optional()
              .describe(
                "Specific instructions on what to look for or extract (e.g., 'Find the vegetarian options')",
              ),
          }),
          execute: async ({ url, instruction }) => {
            const { title, content, error } = await scrapeUrl(url);

            if (error) {
              return { output: `Failed to load page: ${error}` };
            }

            if (instruction) {
              try {
                const { text } = await generateText({
                  model: "google/gemini-3-flash",
                  prompt: `
You are a helpful assistant.
Context: The user wants to find information on a webpage.
Instruction: ${instruction}
Webpage Title: ${title}
Webpage Content:
${content.slice(0, 20000)}

Please extract the requested information or answer the question based on the content above.
`,
                });
                return { output: text };
              } catch (err) {
                return {
                  output: `Loaded page "${title}" but failed to process instruction: ${err}`,
                };
              }
            }

            return {
              output: `Page: ${title}\nContent:\n${content.slice(0, 5000)}...`,
            };
          },
        }),
        createSavedLocation: tool({
          description: "Add a location to the trip's saved list.",
          inputSchema: z.object({
            googlePlaceId: z.string(),
            name: z.string(),
            latitude: z.number(),
            longitude: z.number(),
            address: z.string().optional(),
            note: z.string().optional(),
            status: z.enum(["interested", "visited"]).default("interested"),
            category: placeCategoryEnum.optional(),
          }),
          execute: async (input) => {
            // 1. Upsert place
            let [place] = await db
              .select()
              .from(places)
              .where(eq(places.googlePlaceId, input.googlePlaceId));

            if (!place) {
              const placeId = nanoid();
              [place] = await db
                .insert(places)
                .values({
                  id: placeId,
                  googlePlaceId: input.googlePlaceId,
                  location: sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`,
                  category: input.category,
                  details: {
                    name: input.name,
                    formatted_address: input.address,
                  },
                })
                .onConflictDoUpdate({
                  target: places.googlePlaceId,
                  set: { googlePlaceId: input.googlePlaceId },
                })
                .returning();
            }

            // 2. Add to saved locations
            await db.insert(savedLocations).values({
              id: nanoid(),
              tripId: trip.id,
              placeId: place.id,
              status: input.status,
              note: input.note,
            });

            return { output: `Saved ${input.name} to your trip.` };
          },
        }),
        updateSavedLocation: tool({
          description: "Update a saved location's note or status.",
          inputSchema: z.object({
            id: z
              .string()
              .describe("The ID of the saved location (from context)"),
            note: z.string().optional(),
            status: z.enum(["interested", "visited"]).optional(),
          }),
          execute: async ({ id, ...updates }) => {
            await db
              .update(savedLocations)
              .set(updates)
              .where(
                and(
                  eq(savedLocations.id, id),
                  eq(savedLocations.tripId, trip.id),
                ),
              );
            return { output: "Location updated." };
          },
        }),
        deleteSavedLocation: tool({
          description: "Remove a location from the trip's saved list.",
          inputSchema: z.object({
            id: z
              .string()
              .describe("The ID of the saved location (from context)"),
          }),
          execute: async ({ id }) => {
            await db
              .delete(savedLocations)
              .where(
                and(
                  eq(savedLocations.id, id),
                  eq(savedLocations.tripId, trip.id),
                ),
              );
            return { output: "Location removed." };
          },
        }),
        listItineraryEvents: tool({
          description:
            "List itinerary items for the trip, optionally filtered by day or bucket.",
          inputSchema: z.object({
            dayIndex: z.number().int().min(0).optional(),
            bucket: z
              .enum(["morning", "afternoon", "evening", "night", "anytime"])
              .optional(),
            status: z.enum(["proposed", "confirmed", "canceled"]).optional(),
          }),
          execute: async (filters) => {
            const events = await tripService.listItineraryEvents(
              trip.id,
              filters,
            );

            if (!events.length) {
              return { output: "No itinerary items found." };
            }

            const list = events
              .map((event) => {
                const title =
                  event.placeName || event.customTitle || "Untitled";
                const optional = event.isOptional ? ", optional" : "";
                return `- [ID: ${event.id}] Day ${event.dayIndex + 1} · ${event.bucket} · ${title} (${event.status}${optional})`;
              })
              .join("\n");

            return { output: list };
          },
        }),
        createItineraryEvent: tool({
          description:
            "Create an itinerary item for a specific day and bucket.",
          inputSchema: z
            .object({
              placeId: z.string().optional(),
              googlePlaceId: z
                .string()
                .optional()
                .describe("The Google Place ID of the location"),
              customTitle: z.string().optional(),
              category: placeCategoryEnum.optional(),
              day: z
                .number()
                .int()
                .min(1)
                .describe(
                  "The day number (1 for the 1st day, 2 for the 2nd day, etc.)",
                ),
              bucket: z
                .enum(["morning", "afternoon", "evening", "night", "anytime"])
                .optional(),
              sortOrder: z.number().optional(),
              isOptional: z.boolean().optional(),
              status: z.enum(["proposed", "confirmed", "canceled"]).optional(),
              sourceSavedLocationId: z.string().optional(),
              metadata: z.record(z.string(), z.unknown()).optional(),
            })
            .superRefine((data, ctx) => {
              if ((data.placeId || data.googlePlaceId) && data.customTitle) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    "Provide either placeId/googlePlaceId or customTitle, not both.",
                });
              }
              if (!data.placeId && !data.googlePlaceId && !data.customTitle) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    "Provide either placeId, googlePlaceId, or customTitle.",
                });
              }
            }),
          execute: async (input) => {
            let finalPlaceId = input.placeId;

            // If googlePlaceId is provided but no internal placeId, resolve it
            if (input.googlePlaceId && !finalPlaceId) {
              const resolved = await upsertPlaceByGooglePlaceId(
                input.googlePlaceId,
                input.category,
              );
              if (resolved.error) {
                return {
                  output: resolved.error,
                };
              }

              if (!resolved.place) {
                return {
                  output:
                    "Failed to resolve place details from Google Place ID.",
                };
              }

              finalPlaceId = resolved.place.id;
            }

            const event = await tripService.createItineraryEvent(trip.id, {
              ...input,
              placeId: finalPlaceId,
              dayIndex: input.day - 1,
              bucket: input.bucket ?? "anytime",
            });

            if (!event) {
              return { output: "Failed to create itinerary item." };
            }

            const label = input.customTitle
              ? input.customTitle
              : "the selected place";
            return {
              output: `Added ${label} to Day ${input.day} (${input.bucket ?? "anytime"}). [ID: ${event.id}]`,
            };
          },
        }),
        updateItineraryEvent: tool({
          description: "Update an existing itinerary item.",
          inputSchema: z
            .object({
              id: z.string().describe("The itinerary item ID (from context)"),
              placeId: z.string().nullable().optional(),
              googlePlaceId: z
                .string()
                .optional()
                .describe("The Google Place ID to update to"),
              customTitle: z.string().nullable().optional(),
              day: z
                .number()
                .int()
                .min(1)
                .optional()
                .describe("The day number (1 for the 1st day, etc.)"),
              bucket: z
                .enum(["morning", "afternoon", "evening", "night", "anytime"])
                .optional(),
              sortOrder: z.number().optional(),
              isOptional: z.boolean().optional(),
              status: z.enum(["proposed", "confirmed", "canceled"]).optional(),
              sourceSavedLocationId: z.string().nullable().optional(),
              metadata: z.record(z.string(), z.unknown()).nullable().optional(),
            })
            .superRefine((data, ctx) => {
              if ((data.placeId || data.googlePlaceId) && data.customTitle) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    "Provide either placeId/googlePlaceId or customTitle, not both.",
                });
              }
            }),
          execute: async ({ id, day, googlePlaceId, ...updates }) => {
            const updatesToApply: any = { ...updates };
            if (day !== undefined) {
              updatesToApply.dayIndex = day - 1;
            }

            // Resolve googlePlaceId if provided
            if (googlePlaceId) {
              const resolved = await upsertPlaceByGooglePlaceId(googlePlaceId);
              if (resolved.error) {
                return { output: resolved.error };
              }
              if (!resolved.place) {
                return {
                  output:
                    "Failed to resolve place details from Google Place ID.",
                };
              }
              updatesToApply.placeId = resolved.place.id;
            }

            if (Object.keys(updatesToApply).length === 0) {
              return { output: "No updates provided." };
            }

            const event = await tripService.updateItineraryEvent(
              trip.id,
              id,
              updatesToApply,
            );

            if (!event) {
              return { output: "Itinerary item not found." };
            }

            return { output: `Itinerary item updated. [ID: ${event.id}]` };
          },
        }),
        deleteItineraryEvent: tool({
          description: "Remove an itinerary item from the trip.",
          inputSchema: z.object({
            id: z.string().describe("The itinerary item ID (from context)"),
          }),
          execute: async ({ id }) => {
            const event = await tripService.deleteItineraryEvent(trip.id, id);
            if (!event) {
              return { output: "Itinerary item not found." };
            }
            return { output: `Itinerary item removed. [ID: ${event.id}]` };
          },
        }),
      },
    });

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      generateMessageId: createIdGenerator({
        prefix: "msg",
        size: 16,
      }),
      onFinish: async ({ messages: responseMessages }) => {
        try {
          const lastUserMessage = messages[messages.length - 1];
          const assistantMessages = responseMessages;

          const now = new Date();
          const messagesToSave = [
            {
              id: nanoid(),
              threadId: threadId,
              role: lastUserMessage.role,
              content: lastUserMessage.parts as unknown[],
              createdAt: now,
            },
            ...assistantMessages.map((m, index) => ({
              id: nanoid(),
              threadId: threadId,
              role: m.role,
              content: m.parts as unknown[],
              createdAt: new Date(now.getTime() + (index + 1) * 10), // Add 10ms offset per message
            })),
          ];

          await db.insert(chatMessages).values(messagesToSave);
        } catch (error) {
          console.error("Failed to save chat messages:", error);
        }
      },
    });
  } catch (error) {
    console.error("Travel agent chat error:", error);
    return new Response("Failed to process chat", { status: 500 });
  }
}
