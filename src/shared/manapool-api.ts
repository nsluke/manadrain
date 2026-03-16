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

interface ManaPoolVariant {
  finish_id: string; // "NF" | "FO" | "ET"
  condition_id: string; // "NM" | "LP" | "MP" | "HP" | "DMG"
  low_price: number;
  available_quantity: number;
}

interface ManaPoolProduct {
  name: string;
  set_code: string;
  number: string;
  scryfall_id: string;
  available_quantity: number;
  price_cents: number | null;
  price_cents_foil: number | null;
  price_cents_etched: number | null;
  price_market: number | null;
  price_market_foil: number | null;
  url: string;
  variants?: ManaPoolVariant[];
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
  scryfallFoilPrice: number | null;
}

// Cache scryfall lookups (name/set/number -> id + scryfall prices)
const scryfallCache = new Map<string, ScryfallLookup | null>();
// Cache price lookups (scryfall_id:foil/nonfoil -> price data)
const priceCache = new Map<string, { price: number | null; available: boolean; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function parsePrice(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract the best available USD price from Scryfall's prices object.
 * If foil is requested, tries usd_foil -> usd_etched -> usd.
 * Otherwise tries usd -> usd_foil -> usd_etched.
 */
function extractScryfallPrice(prices?: ScryfallCard["prices"], foil?: boolean): number | null {
  if (!prices) return null;
  if (foil) {
    return parsePrice(prices.usd_foil) ?? parsePrice(prices.usd_etched) ?? parsePrice(prices.usd);
  }
  return parsePrice(prices.usd) ?? parsePrice(prices.usd_foil) ?? parsePrice(prices.usd_etched);
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
      scryfallPrice: extractScryfallPrice(card.prices, false),
      scryfallFoilPrice: extractScryfallPrice(card.prices, true),
    };
    scryfallCache.set(cacheKey, result);
    return result;
  } catch {
    scryfallCache.set(cacheKey, null);
    return null;
  }
}

interface ManaPoolPriceData {
  price: number | null;
  foilPrice: number | null;
  etchedPrice: number | null;
  available: boolean;
  foilAvailable: boolean;
  etchedAvailable: boolean;
  foilOnly: boolean;
}

/**
 * Compute price and availability from variants for a given finish.
 * Returns the lowest price among available NM/LP variants, and total available qty.
 */
function computeFromVariants(
  variants: ManaPoolVariant[],
  finishId: string
): { price: number | null; available: boolean } {
  const matching = variants.filter(
    (v) => v.finish_id === finishId && v.available_quantity > 0 && v.low_price > 0
  );
  if (matching.length === 0) return { price: null, available: false };
  const lowest = Math.min(...matching.map((v) => v.low_price));
  const totalQty = matching.reduce((sum, v) => sum + v.available_quantity, 0);
  return { price: lowest / 100, available: totalQty > 0 };
}

/**
 * Fetch prices from Mana Pool for a list of Scryfall IDs.
 * The GET /products/singles endpoint accepts up to 100 scryfall_ids and requires no auth.
 */
async function fetchManaPoolPrices(
  scryfallIds: string[]
): Promise<Map<string, ManaPoolPriceData>> {
  const results = new Map<string, ManaPoolPriceData>();

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
        // Try top-level prices first
        let price = product.price_cents != null ? product.price_cents / 100 : null;
        let foilPrice = product.price_cents_foil != null ? product.price_cents_foil / 100 : null;
        let etchedPrice = product.price_cents_etched != null ? product.price_cents_etched / 100 : null;

        let nonFoilAvailable = product.available_quantity > 0;
        let foilAvailable = false;
        let etchedAvailable = false;

        // Fall back to variants when top-level fields are empty
        if (product.variants && product.variants.length > 0) {
          const hasNonFoilVariants = product.variants.some((v) => v.finish_id === "NF");
          const hasFoilVariants = product.variants.some((v) => v.finish_id === "FO");
          const hasEtchedVariants = product.variants.some((v) => v.finish_id === "ET");

          if (price == null && hasNonFoilVariants) {
            const computed = computeFromVariants(product.variants, "NF");
            price = computed.price;
            nonFoilAvailable = computed.available;
          }
          if (foilPrice == null && hasFoilVariants) {
            const computed = computeFromVariants(product.variants, "FO");
            foilPrice = computed.price;
            foilAvailable = computed.available;
          }
          if (etchedPrice == null && hasEtchedVariants) {
            const computed = computeFromVariants(product.variants, "ET");
            etchedPrice = computed.price;
            etchedAvailable = computed.available;
          }

          // Also update non-foil availability from variants if top-level was 0
          if (!nonFoilAvailable && hasNonFoilVariants) {
            nonFoilAvailable = product.variants
              .filter((v) => v.finish_id === "NF")
              .some((v) => v.available_quantity > 0);
          }
        }

        const foilOnly = !hasAnyNonFoil(product);

        results.set(product.scryfall_id, {
          price,
          foilPrice,
          etchedPrice,
          available: nonFoilAvailable,
          foilAvailable,
          etchedAvailable,
          foilOnly,
        });
      }
    } catch (err) {
      console.warn("Mana Pool API error:", err);
    }
  }

  return results;
}

function hasAnyNonFoil(product: ManaPoolProduct): boolean {
  // If there's a non-foil price, it's not foil-only
  if (product.price_cents != null) return true;
  // Check variants for any non-foil finish
  if (product.variants) {
    return product.variants.some((v) => v.finish_id === "NF");
  }
  return true; // Default to assuming non-foil exists
}

/**
 * Main entry point: given a list of cards (id + name + optional set/number),
 * resolve Scryfall IDs and fetch Mana Pool pricing.
 * Returns a map keyed by card ID (not name) to handle cards with the same name.
 */
export interface PriceResult {
  price: number | null;
  available: boolean;
  foilOnly?: boolean;
}

export async function fetchCardPrices(
  cards: { id: string; name: string; set?: string; collectorNumber?: string; foil?: boolean }[]
): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();

  // Step 1: Resolve Scryfall IDs and prices (with rate limiting)
  const cardToScryfall = new Map<string, ScryfallLookup>();
  const cardFoilMap = new Map<string, boolean>();

  for (const card of cards) {
    const isFoil = card.foil ?? false;
    cardFoilMap.set(card.id, isFoil);
    const cacheKey = card.set && card.collectorNumber
      ? `${card.set.toLowerCase()}/${card.collectorNumber}`
      : `name:${card.name.toLowerCase().trim()}`;

    // Check price cache first (keyed by scryfall_id + foil status)
    const cachedLookup = scryfallCache.get(cacheKey);
    if (cachedLookup) {
      const priceCacheKey = `${cachedLookup.id}:${isFoil ? "foil" : "nonfoil"}`;
      const cachedPrice = priceCache.get(priceCacheKey);
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
      const isFoil = cardFoilMap.get(cardId) ?? false;
      const mpData = manaPoolPrices.get(scryfall.id);

      let price: number | null = null;
      let available = false;
      let foilOnly = false;

      if (mpData) {
        foilOnly = mpData.foilOnly;
        // Pick the right ManaPool price and availability based on foil status
        if (isFoil) {
          price = mpData.foilPrice ?? mpData.etchedPrice ?? mpData.price;
          available = mpData.foilAvailable || mpData.etchedAvailable || mpData.available;
        } else {
          price = mpData.price ?? mpData.foilPrice ?? mpData.etchedPrice;
          available = mpData.available || mpData.foilAvailable || mpData.etchedAvailable;
        }
      }

      // Fall back to Scryfall price if ManaPool has no price
      if (price == null) {
        price = isFoil
          ? (scryfall.scryfallFoilPrice ?? scryfall.scryfallPrice)
          : (scryfall.scryfallPrice ?? scryfall.scryfallFoilPrice);
      }

      const result: PriceResult = { price, available, foilOnly };
      results.set(cardId, result);
      const priceCacheKey = `${scryfall.id}:${isFoil ? "foil" : "nonfoil"}`;
      priceCache.set(priceCacheKey, { ...result, fetchedAt: Date.now() });
    }
  }

  return results;
}
