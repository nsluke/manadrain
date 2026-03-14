export interface CardEntry {
  id: string;
  name: string;
  set?: string;
  collectorNumber?: string;
  quantity: number;
  addedFrom: string;
  addedAt: number;
  foil?: boolean;
  manaPoolPrice?: number | null;
  manaPoolAvailable?: boolean | null;
}

export interface StorageData {
  cards: CardEntry[];
  overlayExpanded: boolean;
}

export type MessageType =
  | { type: "ADD_CARD"; card: Omit<CardEntry, "id" | "quantity" | "addedAt"> }
  | { type: "REMOVE_CARD"; id: string }
  | { type: "UPDATE_QUANTITY"; id: string; quantity: number }
  | { type: "TOGGLE_FOIL"; id: string }
  | { type: "GET_CARDS" }
  | { type: "CLEAR_CARDS" }
  | { type: "CARDS_UPDATED"; cards: CardEntry[] }
  | { type: "SET_OVERLAY_EXPANDED"; expanded: boolean }
  | { type: "UPDATE_BADGE"; count: number }
  | { type: "REFRESH_PRICES" };

export function makeCardId(name: string, set?: string, collectorNumber?: string): string {
  const parts = [name.toLowerCase().trim()];
  if (set) parts.push(set.toLowerCase());
  if (collectorNumber) parts.push(collectorNumber);
  return parts.join("__");
}

export function formatMassEntry(cards: CardEntry[]): string {
  return cards
    .map((c) => {
      let line = `${c.quantity} ${c.name}`;
      if (c.set) line += ` [${c.set.toUpperCase()}]`;
      if (c.collectorNumber) line += ` ${c.collectorNumber}`;
      if (c.foil) line += ` *F*`;
      return line;
    })
    .join("\n");
}
