import { CardEntry, formatMassEntry } from "../shared/types";

let cards: CardEntry[] = [];

const cardList = document.getElementById("card-list")!;
const emptyState = document.getElementById("empty-state")!;
const cardCount = document.getElementById("card-count")!;
const toast = document.getElementById("toast")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;

function showToast(msg: string) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function render() {
  const totalQty = cards.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cards.reduce((s, c) => {
    if (c.manaPoolPrice != null) return s + c.manaPoolPrice * c.quantity;
    return s;
  }, 0);
  const priceStr = totalPrice > 0 ? ` | ~$${totalPrice.toFixed(2)}` : "";
  cardCount.textContent = `${totalQty} card${totalQty !== 1 ? "s" : ""}${priceStr}`;

  if (cards.length === 0) {
    emptyState.style.display = "block";
    // Clear any card items but keep empty state
    const items = cardList.querySelectorAll(".card-item");
    items.forEach((i) => i.remove());
    return;
  }

  emptyState.style.display = "none";

  // Remove existing card items
  const items = cardList.querySelectorAll(".card-item");
  items.forEach((i) => i.remove());

  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "card-item";
    div.innerHTML = `
      <div class="card-info">
        <div class="card-name">${escapeHtml(c.name)}</div>
        <div class="card-meta">${c.set ? c.set.toUpperCase() : ""}${c.collectorNumber ? " #" + c.collectorNumber : ""} &middot; ${escapeHtml(c.addedFrom)}</div>
        ${c.manaPoolPrice != null ? `<div class="card-price">$${(c.manaPoolPrice * c.quantity).toFixed(2)}${c.manaPoolAvailable ? "" : " · out of stock"}</div>` : c.manaPoolPrice === undefined ? `<div class="card-price loading">loading price…</div>` : `<div class="card-price">price unavailable</div>`}
      </div>
      <div class="qty-controls">
        <button class="qty-btn" data-action="dec" data-id="${c.id}">-</button>
        <span class="qty-value">${c.quantity}</span>
        <button class="qty-btn" data-action="inc" data-id="${c.id}">+</button>
      </div>
      <button class="delete-btn" data-action="delete" data-id="${c.id}">&times;</button>
    `;
    cardList.appendChild(div);
  }
}

// Event delegation for card actions
cardList.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest("[data-action]") as HTMLElement | null;
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id!;

  if (action === "inc") {
    const card = cards.find((c) => c.id === id);
    if (card) {
      chrome.runtime.sendMessage({ type: "UPDATE_QUANTITY", id, quantity: card.quantity + 1 });
    }
  } else if (action === "dec") {
    const card = cards.find((c) => c.id === id);
    if (card) {
      chrome.runtime.sendMessage({ type: "UPDATE_QUANTITY", id, quantity: card.quantity - 1 });
    }
  } else if (action === "delete") {
    chrome.runtime.sendMessage({ type: "REMOVE_CARD", id });
  }
});

document.getElementById("btn-copy")!.addEventListener("click", () => {
  const text = formatMassEntry(cards);
  navigator.clipboard.writeText(text).then(() => showToast("Copied!"));
});

document.getElementById("btn-open")!.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://manapool.com/add-deck" });
});

document.getElementById("btn-clear")!.addEventListener("click", () => {
  if (cards.length === 0) return;
  chrome.runtime.sendMessage({ type: "CLEAR_CARDS" });
});

document.getElementById("btn-export")!.addEventListener("click", () => {
  const json = JSON.stringify(cards, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mana-pool-list.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported!");
});

document.getElementById("btn-import")!.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported: CardEntry[] = JSON.parse(reader.result as string);
      if (!Array.isArray(imported)) throw new Error("Invalid format");
      // Send each card to service worker to merge
      for (const card of imported) {
        chrome.runtime.sendMessage({
          type: "ADD_CARD",
          card: {
            name: card.name,
            set: card.set,
            collectorNumber: card.collectorNumber,
            addedFrom: card.addedFrom || "import",
          },
        });
      }
      showToast(`Imported ${imported.length} cards!`);
    } catch {
      showToast("Invalid JSON file");
    }
  };
  reader.readAsText(file);
  fileInput.value = "";
});

// Load cards
chrome.runtime.sendMessage({ type: "GET_CARDS" }, (response) => {
  if (response?.cards) {
    cards = response.cards;
    render();
  }
});

// Listen for updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CARDS_UPDATED") {
    cards = msg.cards;
    render();
  }
});
