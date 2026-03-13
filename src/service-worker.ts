import { addCard, removeCard, updateQuantity, clearCards, loadCards, setOverlayExpanded, updateCardPrices } from "./shared/storage";
import { fetchCardPrices } from "./shared/manapool-api";

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "ADD_CARD":
      addCard(message.card).then((cards) => {
        broadcastCardsUpdate(cards);
        updateBadge(cards);
        sendResponse({ cards });
        // Fetch price for the new card in the background
        refreshPrices(cards);
      });
      return true;

    case "REMOVE_CARD":
      removeCard(message.id).then((cards) => {
        broadcastCardsUpdate(cards);
        updateBadge(cards);
        sendResponse({ cards });
      });
      return true;

    case "UPDATE_QUANTITY":
      updateQuantity(message.id, message.quantity).then((cards) => {
        broadcastCardsUpdate(cards);
        updateBadge(cards);
        sendResponse({ cards });
      });
      return true;

    case "CLEAR_CARDS":
      clearCards().then((cards) => {
        broadcastCardsUpdate(cards);
        updateBadge(cards);
        sendResponse({ cards });
      });
      return true;

    case "GET_CARDS":
      loadCards().then((data) => {
        sendResponse({ cards: data.cards, overlayExpanded: data.overlayExpanded });
      });
      return true;

    case "SET_OVERLAY_EXPANDED":
      setOverlayExpanded(message.expanded).then(() => {
        sendResponse({});
      });
      return true;

    case "UPDATE_BADGE":
      chrome.action.setBadgeText({ text: message.count > 0 ? String(message.count) : "" });
      chrome.action.setBadgeBackgroundColor({ color: "#6d28d9" });
      sendResponse({});
      return true;

    case "REFRESH_PRICES":
      loadCards().then((data) => {
        refreshPrices(data.cards).then(() => sendResponse({}));
      });
      return true;
  }
});

// Debounce price refreshes so we don't spam the API
let priceRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function refreshPrices(cards: import("./shared/types").CardEntry[]) {
  return new Promise<void>((resolve) => {
    if (priceRefreshTimer) clearTimeout(priceRefreshTimer);
    priceRefreshTimer = setTimeout(async () => {
      // Find cards missing prices
      const needsPricing = cards.filter((c) => c.manaPoolPrice === undefined);
      if (needsPricing.length === 0) {
        resolve();
        return;
      }

      const lookups = needsPricing.map((c) => ({
        name: c.name,
        set: c.set,
        collectorNumber: c.collectorNumber,
      }));
      const priceMap = await fetchCardPrices(lookups);

      if (priceMap.size === 0) {
        resolve();
        return;
      }

      // Build updates
      const updates: { name: string; price: number | null; available: boolean }[] = [];
      for (const [name, info] of priceMap) {
        updates.push({ name, price: info.price, available: info.available });
      }

      const updatedCards = await updateCardPrices(updates);
      broadcastCardsUpdate(updatedCards);
      resolve();
    }, 500);
  });
}

function broadcastCardsUpdate(cards: import("./shared/types").CardEntry[]) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "CARDS_UPDATED", cards }).catch(() => {});
      }
    }
  });
}

function updateBadge(cards: import("./shared/types").CardEntry[]) {
  const total = cards.reduce((s, c) => s + c.quantity, 0);
  chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#6d28d9" });
}

// Initialize badge on startup
chrome.runtime.onInstalled.addListener(() => {
  loadCards().then((data) => {
    updateBadge(data.cards);
    refreshPrices(data.cards);
  });
});

chrome.runtime.onStartup.addListener(() => {
  loadCards().then((data) => {
    updateBadge(data.cards);
    refreshPrices(data.cards);
  });
});
