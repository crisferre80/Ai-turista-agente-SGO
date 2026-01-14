import * as cheerio from 'cheerio';

export interface Attraction {
    name: string;
    description: string;
    imageUrl?: string;
    location?: string;
    url: string;
}

/**
 * Scrapes tourism data from a given URL.
 * Currently configured for generic parsing, specific rules to be added for turismosantiago.gob.ar
 */
export async function scrapeTourismSite(url: string): Promise<Attraction[]> {
    console.log(`Scraping ${url}...`);
    try {
        // In a real generic scraper, we might use a headless browser or proxy if needed.
        // For now, we use simple fetch + cheerio.
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);

        const html = await response.text();
        const $ = cheerio.load(html);
        const attractions: Attraction[] = [];

        // Placeholder logic: Finding elements that look like article cards
        // This needs to be refined based on the actual target website's DOM structure
        $('article, .card, .attraction').each((_, element) => {
            const name = $(element).find('h1, h2, h3').first().text().trim();
            const description = $(element).find('p').first().text().trim();
            const img = $(element).find('img').attr('src');

            if (name && description) {
                attractions.push({
                    name,
                    description,
                    imageUrl: img,
                    url
                });
            }
        });

        // Debug: If no generic matches, return a mock for testing
        if (attractions.length === 0) {
            console.log("No attractions found with generic selectors. Returning mock data.");
        }

        return attractions;
    } catch (error) {
        console.error("Scraping failed:", error);
        return [];
    }
}
