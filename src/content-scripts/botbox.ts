import { initOverlay, addCardFromSite } from "./overlay";

const SOURCE = "botbox.dev";
const PROCESSED_ATTR = "data-mana-pool-processed";

/**
 * BotBox stores card data in a page-level JS variable `currentPack`.
 * Each card is an array: [4]=name, [9]=setCode, [10]=collectorNumber.
 *
 * A separate MAIN-world content script (botbox-bridge.ts) reads currentPack
 * and sends the data here via window.postMessage.
 */

interface BotBoxCard {
  name: string;
  set?: string;
  collectorNumber?: string;
}

// Card data received from the page context bridge
let packCards: BotBoxCard[] = [];

function createAddButton(onClick: () => void): HTMLElement {
  const btn = document.createElement("button");
  btn.textContent = "+";
  btn.title = "Add to Mana Pool Shopping List";
  btn.setAttribute("style", `
    position: absolute;
    top: 4px;
    right: 4px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6d28d9, #7c3aed);
    border: 2px solid #8b5cf6;
    color: white;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-shadow: 0 2px 8px rgba(109, 40, 217, 0.5);
    transition: transform 0.12s;
    padding: 0;
    font-family: -apple-system, system-ui, sans-serif;
  `);
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.15)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
    btn.textContent = "\u2713";
    btn.style.background = "#22c55e";
    btn.style.borderColor = "#16a34a";
    setTimeout(() => {
      btn.textContent = "+";
      btn.style.background = "linear-gradient(135deg, #6d28d9, #7c3aed)";
      btn.style.borderColor = "#8b5cf6";
    }, 800);
  });
  return btn;
}

/**
 * Listen for pack data from the MAIN-world bridge script.
 */
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "MANA_POOL_BOTBOX_PACK") return;

  packCards = event.data.cards as BotBoxCard[];
  attachButtons();
});

/**
 * Attach "+" buttons to card elements in the DOM,
 * using the card data we got from the page context.
 */
function attachButtons() {
  const cardDivs = document.querySelectorAll<HTMLElement>(
    '.card:not([data-mana-pool-processed])'
  );

  // Match DOM card elements to pack data by index.
  // BotBox renders cards in the same order as currentPack.
  const allCardDivs = document.querySelectorAll<HTMLElement>('.card');

  for (const cardDiv of cardDivs) {
    cardDiv.setAttribute(PROCESSED_ATTR, "true");

    // Figure out this card's position among all .card divs
    const idx = Array.from(allCardDivs).indexOf(cardDiv);
    const cardData = idx >= 0 && idx < packCards.length ? packCards[idx] : null;

    if (!cardData || !cardData.name) continue;

    const computed = window.getComputedStyle(cardDiv);
    if (computed.position === "static") {
      cardDiv.style.position = "relative";
    }

    const name = cardData.name;
    const set = cardData.set || undefined;
    const collectorNumber = cardData.collectorNumber || undefined;

    const btn = createAddButton(() => {
      addCardFromSite(name, set, collectorNumber, SOURCE);
    });
    cardDiv.appendChild(btn);
  }
}

// Initialize
initOverlay();

// Watch for DOM changes (BotBox loads cards dynamically after pack opening)
const observer = new MutationObserver(() => {
  if (packCards.length > 0) {
    attachButtons();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
