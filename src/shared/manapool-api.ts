/**
 * Mana Pool pricing integration.
 *
 * Flow:
 * 1. Look up Scryfall ID via Scryfall API (using set/number or card name)
 * 2. Query Mana Pool's GET /products/singles?scryfall_ids=... (no auth required)
 * 3. Return price_cents and available_quantity
 *
 * API docs: https://manapool.com/api/docs/v1
 */

const MANAPOOL_API = "https://manapool.com/api/v1";
const SCRYFALL_API = "https://api.scryfall.com";

interface ManaPoolProduct {
  name: string;
  set_code: string;
  number: string;
  scryfall_id: string;
  available_quantity: number;
  price_cents: number | null;
  price_market: number | null;
  url: string;
}

interface ManaPoolResponse {
  meta: { as_of: string };
  data: ManaPoolProduct[];
}

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  prices?: {
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
  };
}

interface ScryfallLookup {
  id: string;
  scryfallPrice: number | null;
}

// Cache scryfall lookups (name/set/number -> id + scryfall price)
const scryfallCache = new Map<string, ScryfallLookup | null>();
// Cache price lookups (scryfall_id -> price data)
const priceCache = new Map<string, { price: number | null; available: boolean; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Extract the best available USD price from Scryfall's prices object.
 * Tries usd -> usd_foil -> usd_etched.
 */
function extractScryfallPrice(prices?: ScryfallCard["prices"]): number | null {
  if (!prices) return null;
  const raw = prices.usd ?? prices.usd_foil ?? prices.usd_etched;
  if (raw == null) return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Look up a card's Scryfall ID and price. Tries set/number first, falls back to name search.
 */
async function getScryfallData(
  name: string,
  set?: string,
  collectorNumber?: string
): Promise<ScryfallLookup | null> {
  const cacheKey = set && collectorNumber
    ? `${set.toLowerCase()}/${collectorNumber}`
    : `name:${name.toLowerCase().trim()}`;

  if (scryfallCache.has(cacheKey)) {
    return scryfallCache.get(cacheKey)!;
  }

  try {
    let url: string;
    if (set && collectorNumber) {
      url = `${SCRYFALL_API}/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(collectorNumber)}`;
    } else {
      url = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}`;
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      scryfallCache.set(cacheKey, null);
      return null;
    }

    const card: ScryfallCard = await resp.json();
    const result: ScryfallLookup = {
      id: card.id,
      scryfallPrice: extractScryfallPrice(card.prices),
    };
    scryfallCache.set(cacheKey, result);
    return result;
  } catch {
    scryfallCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Fetch prices from Mana Pool for a list of Scryfall IDs.
 * The GET /products/singles endpoint accepts up to 100 scryfall_ids and requires no auth.
 */
async function fetchManaPoolPrices(
  scryfallIds: string[]
): Promise<Map<string, { price: number | null; available: boolean }>> {
  const results = new Map<string, { price: number | null; available: boolean }>();

  // Batch into chunks of 100
  for (let i = 0; i < scryfallIds.length; i += 100) {
    const chunk = scryfallIds.slice(i, i + 100);
    const params = chunk.map((id) => `scryfall_ids=${encodeURIComponent(id)}`).join("&");

    try {
      const resp = await fetch(`${MANAPOOL_API}/products/singles?${params}`, {
        headers: { Accept: "application/json" },
      });

      if (!resp.ok) {
        console.warn(`Mana Pool API returned ${resp.status}`);
        continue;
      }

      const data: ManaPoolResponse = await resp.json();

      for (const product of data.data) {
        const price = product.price_cents != null ? product.price_cents / 100 : null;
        const available = product.available_quantity > 0;
        results.set(product.scryfall_id, { price, available });
      }
    } catch (err) {
      console.warn("Mana Pool API error:", err);
    }
  }

  return results;
}

/**
 * Main entry point: given a list of cards (id + name + optional set/number),
 * resolve Scryfall IDs and fetch Mana Pool pricing.
 * Returns a map keyed by card ID (not name) to handle cards with the same name.
 */
export async function fetchCardPrices(
  cards: { id: string; name: string; set?: string; collectorNumber?: string }[]
): Promise<Map<string, { price: number | null; available: boolean }>> {
  const results = new Map<string, { price: number | null; available: boolean }>();

  // Step 1: Resolve Scryfall IDs and prices (with rate limiting)
  const cardToScryfall = new Map<string, ScryfallLookup>(); // keyed by card.id

  for (const card of cards) {
    const cacheKey = card.set && card.collectorNumber
      ? `${card.set.toLowerCase()}/${card.collectorNumber}`
      : `name:${card.name.toLowerCase().trim()}`;

    // Check price cache first
    const cachedLookup = scryfallCache.get(cacheKey);
    if (cachedLookup) {
      const cachedPrice = priceCache.get(cachedLookup.id);
      if (cachedPrice && Date.now() - cachedPrice.fetchedAt < CACHE_TTL_MS) {
        results.set(card.id, { price: cachedPrice.price, available: cachedPrice.available });
        continue;
      }
    }

    const scryfallData = await getScryfallData(card.name, card.set, card.collectorNumber);
    if (scryfallData) {
      cardToScryfall.set(card.id, scryfallData);
    } else {
      results.set(card.id, { price: null, available: false });
    }

    // Small delay to be polite to Scryfall (they request 50-100ms between requests)
    await new Promise((r) => setTimeout(r, 75));
  }

  // Step 2: Batch fetch from Mana Pool
  const scryfallIds = [...new Set([...cardToScryfall.values()].map((s) => s.id))];
  if (scryfallIds.length > 0) {
    const manaPoolPrices = await fetchManaPoolPrices(scryfallIds);

    for (const [cardId, scryfall] of cardToScryfall) {
      const priceData = manaPoolPrices.get(scryfall.id);
      if (priceData && priceData.price != null) {
        results.set(cardId, priceData);
        priceCache.set(scryfall.id, { ...priceData, fetchedAt: Date.now() });
      } else {
        // Fall back to Scryfall price (usd -> usd_foil -> usd_etched)
        const fallback = { price: scryfall.scryfallPrice, available: false };
        results.set(cardId, fallback);
        priceCache.set(scryfall.id, { ...fallback, fetchedAt: Date.now() });
      }
    }
  }

  return results;
}
