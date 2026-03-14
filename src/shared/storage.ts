import { CardEntry, StorageData, makeCardId } from "./types";

const STORAGE_KEY = "manaPoolShoppingList";
const DEBOUNCE_MS = 300;

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingData: StorageData | null = null;

function defaultData(): StorageData {
  return { cards: [], overlayExpanded: false };
}

export async function loadCards(): Promise<StorageData> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StorageData | undefined) ?? defaultData();
}

function debouncedWrite(data: StorageData): Promise<void> {
  pendingData = data;
  return new Promise((resolve) => {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(async () => {
      if (pendingData) {
        await chrome.storage.sync.set({ [STORAGE_KEY]: pendingData });
        pendingData = null;
      }
      resolve();
    }, DEBOUNCE_MS);
  });
}

async function saveCards(data: StorageData): Promise<void> {
  await debouncedWrite(data);
}

export async function addCard(
  card: Omit<CardEntry, "id" | "quantity" | "addedAt">
): Promise<CardEntry[]> {
  const data = await loadCards();
  const id = makeCardId(card.name, card.set, card.collectorNumber);
  const existing = data.cards.find((c) => c.id === id);

  if (existing) {
    existing.quantity += 1;
  } else {
    data.cards.push({
      ...card,
      id,
      quantity: 1,
      addedAt: Date.now(),
    });
  }

  await saveCards(data);
  return data.cards;
}

export async function removeCard(id: string): Promise<CardEntry[]> {
  const data = await loadCards();
  data.cards = data.cards.filter((c) => c.id !== id);
  await saveCards(data);
  return data.cards;
}

export async function updateQuantity(
  id: string,
  quantity: number
): Promise<CardEntry[]> {
  const data = await loadCards();
  const card = data.cards.find((c) => c.id === id);
  if (card) {
    if (quantity <= 0) {
      data.cards = data.cards.filter((c) => c.id !== id);
    } else {
      card.quantity = quantity;
    }
  }
  await saveCards(data);
  return data.cards;
}

export async function clearCards(): Promise<CardEntry[]> {
  const data = defaultData();
  await chrome.storage.sync.set({ [STORAGE_KEY]: data });
  return data.cards;
}

export async function setOverlayExpanded(expanded: boolean): Promise<void> {
  const data = await loadCards();
  data.overlayExpanded = expanded;
  await chrome.storage.sync.set({ [STORAGE_KEY]: data });
}

export async function exportData(): Promise<string> {
  const data = await loadCards();
  return JSON.stringify(data.cards, null, 2);
}

export async function importData(json: string): Promise<CardEntry[]> {
  const cards: CardEntry[] = JSON.parse(json);
  const data = await loadCards();
  data.cards = cards;
  await chrome.storage.sync.set({ [STORAGE_KEY]: data });
  return data.cards;
}

export async function updateCardPrices(
  updates: { id: string; price: number | null; available: boolean }[]
): Promise<CardEntry[]> {
  const data = await loadCards();
  for (const update of updates) {
    const card = data.cards.find((c) => c.id === update.id);
    if (card) {
      card.manaPoolPrice = update.price;
      card.manaPoolAvailable = update.available;
    }
  }
  await chrome.storage.sync.set({ [STORAGE_KEY]: data });
  return data.cards;
}
