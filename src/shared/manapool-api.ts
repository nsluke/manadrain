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
}

// Cache scryfall ID lookups (name/set/number -> scryfall_id)
const scryfallIdCache = new Map<string, string | null>();
// Cache price lookups (scryfall_id -> price data)
const priceCache = new Map<string, { price: number | null; available: boolean; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Look up a card's Scryfall ID. Tries set/number first, falls back to name search.
 */
async function getScryfallId(
  name: string,
  set?: string,
  collectorNumber?: string
): Promise<string | null> {
  const cacheKey = set && collectorNumber
    ? `${set.toLowerCase()}/${collectorNumber}`
    : `name:${name.toLowerCase().trim()}`;

  if (scryfallIdCache.has(cacheKey)) {
    return scryfallIdCache.get(cacheKey)!;
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
      scryfallIdCache.set(cacheKey, null);
      return null;
    }

    const card: ScryfallCard = await resp.json();
    scryfallIdCache.set(cacheKey, card.id);
    return card.id;
  } catch {
    scryfallIdCache.set(cacheKey, null);
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
 * Main entry point: given a list of cards (name + optional set/number),
 * resolve Scryfall IDs and fetch Mana Pool pricing.
 */
export async function fetchCardPrices(
  cards: { name: string; set?: string; collectorNumber?: string }[]
): Promise<Map<string, { price: number | null; available: boolean }>> {
  const results = new Map<string, { price: number | null; available: boolean }>();

  // Step 1: Resolve Scryfall IDs (with rate limiting — 100ms between requests)
  const cardToScryfallId = new Map<string, string>();

  for (const card of cards) {
    const cacheKey = card.set && card.collectorNumber
      ? `${card.set.toLowerCase()}/${card.collectorNumber}`
      : `name:${card.name.toLowerCase().trim()}`;

    // Check price cache first
    const cachedScryfallId = scryfallIdCache.get(cacheKey);
    if (cachedScryfallId) {
      const cachedPrice = priceCache.get(cachedScryfallId);
      if (cachedPrice && Date.now() - cachedPrice.fetchedAt < CACHE_TTL_MS) {
        results.set(card.name, { price: cachedPrice.price, available: cachedPrice.available });
        continue;
      }
    }

    const scryfallId = await getScryfallId(card.name, card.set, card.collectorNumber);
    if (scryfallId) {
      cardToScryfallId.set(card.name, scryfallId);
    } else {
      // Card not found on Scryfall
      results.set(card.name, { price: null, available: false });
    }

    // Small delay to be polite to Scryfall (they request 50-100ms between requests)
    await new Promise((r) => setTimeout(r, 75));
  }

  // Step 2: Batch fetch from Mana Pool
  const scryfallIds = [...new Set(cardToScryfallId.values())];
  if (scryfallIds.length > 0) {
    const manaPoolPrices = await fetchManaPoolPrices(scryfallIds);

    for (const [cardName, scryfallId] of cardToScryfallId) {
      const priceData = manaPoolPrices.get(scryfallId);
      if (priceData) {
        results.set(cardName, priceData);
        priceCache.set(scryfallId, { ...priceData, fetchedAt: Date.now() });
      } else {
        results.set(cardName, { price: null, available: false });
      }
    }
  }

  return results;
}
