import { CardEntry, formatMassEntry } from "../shared/types";

const OVERLAY_ID = "mana-pool-shopping-overlay";
const SCRYFALL_IMG = "https://api.scryfall.com/cards/named?exact=";

let overlayRoot: ShadowRoot | null = null;
let expanded = false;
let cards: CardEntry[] = [];

function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #e0e0e0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .overlay-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .fab {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      border: 2px solid #8b5cf6;
      color: white;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(109, 40, 217, 0.4);
      transition: transform 0.15s, box-shadow 0.15s;
      position: relative;
    }
    .fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(109, 40, 217, 0.55);
    }
    .fab .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 700;
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
    }

    .panel {
      display: none;
      width: 360px;
      max-height: 480px;
      background: #1e1b2e;
      border: 1px solid #3b3556;
      border-radius: 12px;
      margin-bottom: 10px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      flex-direction: column;
      overflow: hidden;
    }
    .panel.open { display: flex; }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #2a2640;
      border-bottom: 1px solid #3b3556;
    }
    .panel-header h3 {
      font-size: 15px;
      font-weight: 700;
      color: #c4b5fd;
    }
    .panel-header .total {
      font-size: 12px;
      color: #a78bfa;
    }

    .card-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }
    .card-list::-webkit-scrollbar { width: 6px; }
    .card-list::-webkit-scrollbar-track { background: transparent; }
    .card-list::-webkit-scrollbar-thumb { background: #4c4470; border-radius: 3px; }

    .card-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      transition: background 0.1s;
      position: relative;
    }
    .card-item:hover { background: #2a2640; }

    .card-info {
      flex: 1;
      min-width: 0;
    }
    .card-name {
      font-size: 13px;
      font-weight: 600;
      color: #e0e0e0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: default;
    }
    .card-meta {
      font-size: 11px;
      color: #8b82a8;
      margin-top: 2px;
    }
    .card-price {
      font-size: 11px;
      color: #a78bfa;
      margin-top: 1px;
    }
    .card-price.loading {
      color: #6b6188;
      font-style: italic;
    }

    .qty-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .qty-btn {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: 1px solid #4c4470;
      background: #2a2640;
      color: #c4b5fd;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s;
    }
    .qty-btn:hover { background: #3b3556; }
    .qty-value {
      font-size: 13px;
      font-weight: 600;
      color: #e0e0e0;
      min-width: 20px;
      text-align: center;
    }

    .delete-btn {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #6b6188;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.1s, background 0.1s;
    }
    .delete-btn:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

    .panel-actions {
      padding: 10px 16px;
      background: #2a2640;
      border-top: 1px solid #3b3556;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .btn-row {
      display: flex;
      gap: 6px;
    }
    .action-btn {
      flex: 1;
      padding: 8px 12px;
      border-radius: 8px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .action-btn:hover { opacity: 0.85; }
    .btn-primary {
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      color: white;
    }
    .btn-secondary {
      background: #3b3556;
      color: #c4b5fd;
    }
    .btn-danger {
      background: transparent;
      color: #6b6188;
      border: 1px solid #3b3556;
    }
    .btn-danger:hover { color: #ef4444; border-color: #ef4444; }

    .empty-state {
      padding: 32px 16px;
      text-align: center;
      color: #6b6188;
      font-size: 13px;
    }
    .empty-state .icon { font-size: 32px; margin-bottom: 8px; }

    .card-tooltip {
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      display: none;
    }
    .card-tooltip img {
      display: block;
      width: 240px;
      height: auto;
      border-radius: 12px;
    }

    .toast {
      position: fixed;
      bottom: 84px;
      right: 20px;
      background: #22c55e;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 2147483647;
    }
    .toast.show { opacity: 1; }
  `;
}

function buildHTML(): string {
  return `
    <style>${getStyles()}</style>
    <div class="overlay-container">
      <div class="panel" id="panel">
        <div class="panel-header">
          <h3>Mana Pool List</h3>
          <span class="total" id="total-info"></span>
        </div>
        <div class="card-list" id="card-list"></div>
        <div class="panel-actions">
          <div class="btn-row">
            <button class="action-btn btn-primary" id="btn-copy">Copy for Mana Pool</button>
            <button class="action-btn btn-secondary" id="btn-open">Open Mana Pool</button>
          </div>
          <div class="btn-row">
            <button class="action-btn btn-danger" id="btn-clear">Clear List</button>
          </div>
        </div>
      </div>
      <button class="fab" id="fab">
        <span id="fab-icon">MP</span>
        <span class="badge" id="fab-badge" style="display:none">0</span>
      </button>
    </div>
    <div class="card-tooltip" id="tooltip">
      <img id="tooltip-img" src="" alt="" />
    </div>
    <div class="toast" id="toast"></div>
  `;
}

function showToast(message: string) {
  if (!overlayRoot) return;
  const toast = overlayRoot.getElementById("toast")!;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function renderCardList() {
  if (!overlayRoot) return;
  const list = overlayRoot.getElementById("card-list")!;
  const totalInfo = overlayRoot.getElementById("total-info")!;
  const badge = overlayRoot.getElementById("fab-badge")!;

  const totalQty = cards.reduce((s, c) => s + c.quantity, 0);
  badge.textContent = String(totalQty);
  badge.style.display = totalQty > 0 ? "flex" : "none";

  // Update extension badge via service worker
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", count: totalQty }).catch(() => {});

  const totalPrice = cards.reduce((s, c) => {
    if (c.manaPoolPrice != null) return s + c.manaPoolPrice * c.quantity;
    return s;
  }, 0);
  const priceStr = totalPrice > 0 ? ` | ~$${totalPrice.toFixed(2)}` : "";
  totalInfo.textContent = `${totalQty} card${totalQty !== 1 ? "s" : ""}${priceStr}`;

  if (cards.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">&#x1F0CF;</div>No cards yet.<br>Click + on any card to add it.</div>`;
    return;
  }

  list.innerHTML = cards
    .map(
      (c) => `
    <div class="card-item" data-id="${c.id}" data-name="${encodeURIComponent(c.name)}">
      <div class="card-info">
        <div class="card-name" data-tooltip-name="${encodeURIComponent(c.name)}">${escapeHtml(c.name)}</div>
        <div class="card-meta">${c.set ? c.set.toUpperCase() : ""}${c.collectorNumber ? " #" + c.collectorNumber : ""} &middot; ${c.addedFrom}</div>
        ${c.manaPoolPrice != null ? `<div class="card-price">$${(c.manaPoolPrice * c.quantity).toFixed(2)}${c.manaPoolAvailable ? "" : " · out of stock"}</div>` : c.manaPoolPrice === undefined ? `<div class="card-price loading">loading price…</div>` : `<div class="card-price">price unavailable</div>`}
      </div>
      <div class="qty-controls">
        <button class="qty-btn" data-action="dec" data-id="${c.id}">-</button>
        <span class="qty-value">${c.quantity}</span>
        <button class="qty-btn" data-action="inc" data-id="${c.id}">+</button>
      </div>
      <button class="delete-btn" data-action="delete" data-id="${c.id}">&times;</button>
    </div>`
    )
    .join("");
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function setupEvents() {
  if (!overlayRoot) return;

  const fab = overlayRoot.getElementById("fab")!;
  const panel = overlayRoot.getElementById("panel")!;
  const tooltip = overlayRoot.getElementById("tooltip")!;
  const tooltipImg = overlayRoot.getElementById("tooltip-img") as HTMLImageElement;

  fab.addEventListener("click", () => {
    expanded = !expanded;
    panel.classList.toggle("open", expanded);
    chrome.runtime.sendMessage({ type: "SET_OVERLAY_EXPANDED", expanded }).catch(() => {});
  });

  // Card list interactions (delegated)
  overlayRoot.getElementById("card-list")!.addEventListener("click", (e) => {
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

  // Tooltip on hover
  overlayRoot.getElementById("card-list")!.addEventListener("mouseover", (e) => {
    const target = e.target as HTMLElement;
    const nameEl = target.closest(".card-name") as HTMLElement | null;
    if (!nameEl) return;
    const name = decodeURIComponent(nameEl.dataset.tooltipName || "");
    if (!name) return;
    tooltipImg.src = `${SCRYFALL_IMG}${encodeURIComponent(name)}&format=image&version=normal`;
    tooltip.style.display = "block";
  });

  overlayRoot.getElementById("card-list")!.addEventListener("mousemove", (e) => {
    const mouseEvent = e as MouseEvent;
    tooltip.style.left = `${mouseEvent.clientX - 260}px`;
    tooltip.style.top = `${Math.max(10, mouseEvent.clientY - 170)}px`;
  });

  overlayRoot.getElementById("card-list")!.addEventListener("mouseout", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".card-name")) {
      tooltip.style.display = "none";
    }
  });

  // Action buttons
  overlayRoot.getElementById("btn-copy")!.addEventListener("click", () => {
    const text = formatMassEntry(cards);
    navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!"));
  });

  overlayRoot.getElementById("btn-open")!.addEventListener("click", () => {
    window.open("https://manapool.com/add-deck", "_blank");
  });

  overlayRoot.getElementById("btn-clear")!.addEventListener("click", () => {
    if (cards.length === 0) return;
    chrome.runtime.sendMessage({ type: "CLEAR_CARDS" });
  });
}

export function initOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;

  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  document.body.appendChild(host);

  overlayRoot = host.attachShadow({ mode: "closed" });
  overlayRoot.innerHTML = buildHTML();

  setupEvents();

  // Load initial state
  chrome.runtime.sendMessage({ type: "GET_CARDS" }, (response) => {
    if (response?.cards) {
      cards = response.cards;
      renderCardList();
    }
    if (response?.overlayExpanded) {
      expanded = true;
      overlayRoot?.getElementById("panel")?.classList.add("open");
    }
  });

  // Listen for card updates from service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "CARDS_UPDATED") {
      cards = msg.cards;
      renderCardList();
    }
  });
}

export function addCardFromSite(
  name: string,
  set?: string,
  collectorNumber?: string,
  source?: string
) {
  chrome.runtime.sendMessage(
    {
      type: "ADD_CARD",
      card: {
        name,
        set,
        collectorNumber,
        addedFrom: source || window.location.hostname,
      },
    },
    () => showToast(`Added: ${name}`)
  );
}
