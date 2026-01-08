import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";

// Config: Max concurrent requests to avoid banning/timeouts
const CONCURRENT_LIMIT = 5;

type ScrapedPage = {
    url: string;
    title: string;
    content: string; // The primary text context
    error?: string;
};

/**
 * Simple single-page scraper for tools
 */
export async function scrapeUrl(url: string): Promise<{ title: string; content: string; error?: string }> {
    try {
        const normalizedUrl = new URL(url).href; // Validate URL

        const response = await fetch(normalizedUrl, {
            headers: { "User-Agent": "Bot/1.0 (Next.js Crawler)" },
            next: { revalidate: 3600 },
        });

        if (!response.ok) {
            return { title: "Error", content: "", error: `Status ${response.status}` };
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("text/html")) {
            return { title: "Error", content: "", error: "Not an HTML page" };
        }

        const html = await response.text();
        const dom = new JSDOM(html, { url: normalizedUrl });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        return {
            title: article?.title || "No Title",
            content: article?.textContent?.trim().replace(/\s+/g, " ") || "",
        };

    } catch (error: any) {
        console.error(`Failed to scrape ${url}:`, error);
        return {
            title: "Error",
            content: "",
            error: error.message || "Unknown error",
        };
    }
}

/**
 * Recursive crawler function with concurrency control
 */
export async function crawl(
    currentUrl: string,
    baseUrl: string,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>,
    results: ScrapedPage[],
) {
    // Normalize URL to prevent duplicates (e.g., removing trailing slashes)
    let normalizedUrl: string;
    try {
        normalizedUrl = new URL(currentUrl).href;
    } catch {
        return;
    }

    if (visited.has(normalizedUrl) || currentDepth > maxDepth) {
        return;
    }

    visited.add(normalizedUrl);
    console.log(`Crawling (Depth ${currentDepth}): ${normalizedUrl}`);

    try {
        // 1. Fetch Page
        const response = await fetch(normalizedUrl, {
            headers: { "User-Agent": "Bot/1.0 (Next.js Crawler)" },
            next: { revalidate: 3600 }, // Optional: Cache results for an hour
        });

        if (
            !response.ok ||
            !response.headers.get("content-type")?.includes("text/html")
        ) {
            return;
        }

        const html = await response.text();

        // 2. Extract Primary Text (Readability)
        // We use JSDOM to create a virtual DOM for Readability to parse
        const dom = new JSDOM(html, { url: normalizedUrl });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (article) {
            results.push({
                url: normalizedUrl,
                title: article.title || "No Title",
                content: article?.textContent?.trim().replace(/\s+/g, " ") || "", // Clean up whitespace
            });
        }

        // 3. Find Links for Recursion (Cheerio)
        if (currentDepth < maxDepth) {
            const $ = cheerio.load(html);
            const links: string[] = [];

            $("a").each((_, element) => {
                const href = $(element).attr("href");
                if (href) {
                    try {
                        // Resolve relative URLs to absolute
                        const absoluteUrl = new URL(href, normalizedUrl);

                        // Check if same domain
                        if (absoluteUrl.hostname === new URL(baseUrl).hostname) {
                            links.push(absoluteUrl.href);
                        }
                    } catch (e) {
                        // Ignore invalid URLs
                    }
                }
            });

            // 4. Process links concurrently (with simple chunking)
            // For a truly robust queue, use 'p-limit', but this is "simple & fast"
            const uniqueLinks = [...new Set(links)];

            // Process in chunks to respect concurrency limit
            for (let i = 0; i < uniqueLinks.length; i += CONCURRENT_LIMIT) {
                const chunk = uniqueLinks.slice(i, i + CONCURRENT_LIMIT);
                await Promise.all(
                    chunk.map((link) =>
                        crawl(link, baseUrl, currentDepth + 1, maxDepth, visited, results),
                    ),
                );
            }
        }
    } catch (error) {
        console.error(`Failed to crawl ${currentUrl}:`, error);
        results.push({
            url: currentUrl,
            title: "Error",
            content: "",
            error: "Failed to fetch",
        });
    }
}

