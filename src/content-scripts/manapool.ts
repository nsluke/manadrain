import { initOverlay, addCardFromSite, getCards, removeCardById, onCardsUpdated } from "./overlay";
import { makeCardId } from "../shared/types";

const SOURCE = "manapool.com";
const PROCESSED_ATTR = "data-mana-pool-processed";
const BTN_ATTR = "data-mana-pool-btn";

function parseCardUrl(url: string): { set: string; collectorNumber: string; name: string } | null {
  const match = url.match(/\/card\/([a-z0-9]+)\/([^/]+)\/([^/?#]+)/i);
  if (!match) return null;
  return {
    set: match[1],
    collectorNumber: match[2],
    name: decodeURIComponent(match[3]).replace(/-/g, " "),
  };
}

function isCardInList(name: string, set?: string, collectorNumber?: string): boolean {
  const id = makeCardId(name, set, collectorNumber);
  return getCards().some((c) => c.id === id);
}

/**
 * Get the card name from the page. Tries:
 * 1. <title> tag (format: "Card Name - Set Name")
 * 2. <h1> element
 * 3. Card image alt text (format: "Card Name - Set Name - Finish")
 * 4. URL fallback
 */
function getCardName(fallback: string): string {
  const titleTag = document.querySelector("title");
  if (titleTag?.textContent) {
    const titleName = titleTag.textContent.split(" - ")[0]?.trim();
    if (titleName) return titleName;
  }

  const h1 = document.querySelector("h1");
  if (h1?.textContent?.trim()) {
    return h1.textContent.trim();
  }

  const img = document.querySelector<HTMLImageElement>('img[src*="images.manapool.com/products/mtg/cards/normal/"]');
  if (img?.alt) {
    const altName = img.alt.split(" - ")[0]?.trim();
    if (altName) return altName;
  }

  return fallback;
}

// -- Toggle button --

function setButtonState(btn: HTMLElement, selected: boolean) {
  btn.setAttribute("data-selected", String(selected));
  btn.textContent = selected ? "✓" : "+";
  btn.style.opacity = selected ? "1" : "0.6";
  if (selected) {
    btn.style.background = "linear-gradient(180deg, #c9a84c, #9e7b2f)";
    btn.style.borderColor = "#d4af37";
    btn.style.boxShadow = "0 2px 8px rgba(184, 148, 46, 0.5)";
    btn.style.color = "#1a1410";
  } else {
    btn.style.background = "linear-gradient(135deg, #b8942e, #d4af37)";
    btn.style.borderColor = "#c9a84c";
    btn.style.boxShadow = "0 2px 8px rgba(184, 148, 46, 0.4)";
    btn.style.color = "#1a1410";
  }
}

function createToggleButton(name: string, set?: string, collectorNumber?: string): HTMLElement {
  const selected = isCardInList(name, set, collectorNumber);

  const btn = document.createElement("button");
  btn.title = "Add to Mana Pool Shopping List";
  btn.setAttribute(BTN_ATTR, "true");
  btn.setAttribute("data-mp-name", name);
  if (set) btn.setAttribute("data-mp-set", set);
  if (collectorNumber) btn.setAttribute("data-mp-number", collectorNumber);
  btn.setAttribute("style", `
    position: absolute;
    top: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid;
    color: white;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: transform 0.12s, box-shadow 0.12s;
    padding: 0;
    font-family: -apple-system, system-ui, sans-serif;
  `);
  setButtonState(btn, selected);

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.15)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isSelected = btn.getAttribute("data-selected") === "true";
    if (isSelected) {
      removeCardById(makeCardId(name, set, collectorNumber));
      setButtonState(btn, false);
    } else {
      addCardFromSite(name, set, collectorNumber, SOURCE);
      setButtonState(btn, true);
    }
  });
  return btn;
}

// -- Card detail page --

function processCardPage() {
  const parsed = parseCardUrl(window.location.pathname);
  if (!parsed) return;

  const name = getCardName(parsed.name);

  // Target the image containers (div.image-container wraps the card img)
  const imageContainers = document.querySelectorAll<HTMLElement>("div.image-container");

  for (const container of imageContainers) {
    if (container.hasAttribute(PROCESSED_ATTR)) continue;

    // Only target the large desktop image, skip small thumbnails
    const img = container.querySelector<HTMLImageElement>("img");
    if (!img) continue;
    if (img.src && img.src.includes("/cards/small/")) continue;

    container.setAttribute(PROCESSED_ATTR, "true");

    const computed = window.getComputedStyle(container);
    if (computed.position === "static") {
      container.style.position = "relative";
    }

    container.appendChild(createToggleButton(name, parsed.set, parsed.collectorNumber));
  }

  // Fallback: if no image containers found, try any card image
  if (document.querySelectorAll(`[${PROCESSED_ATTR}]`).length === 0) {
    const cardImgs = document.querySelectorAll<HTMLImageElement>(
      'img[src*="images.manapool.com/products/mtg/cards/normal/"]'
    );
    for (const img of cardImgs) {
      const parent = img.parentElement;
      if (!parent || parent.hasAttribute(PROCESSED_ATTR)) continue;
      parent.setAttribute(PROCESSED_ATTR, "true");

      const computed = window.getComputedStyle(parent);
      if (computed.position === "static") {
        parent.style.position = "relative";
      }

      parent.appendChild(createToggleButton(name, parsed.set, parsed.collectorNumber));
    }
  }
}

// -- Browse / search results --

function processSearchResults() {
  const cardLinks = document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/card/"]'
  );

  for (const link of cardLinks) {
    const href = link.getAttribute("href") || "";
    const parsed = parseCardUrl(href);
    if (!parsed) continue;

    const img = link.querySelector("img");
    if (!img) continue;

    // Find the closest grid item or use the link itself
    const container = link.closest("li") || link;
    if (container.hasAttribute(PROCESSED_ATTR)) continue;
    container.setAttribute(PROCESSED_ATTR, "true");

    const el = container as HTMLElement;
    const computed = window.getComputedStyle(el);
    if (computed.position === "static") {
      el.style.position = "relative";
    }

    // Get card name from image alt (format: "Card Name - Set Name - Finish")
    const cardName = img.alt
      ? img.alt.split(" - ")[0].trim()
      : parsed.name;

    el.setAttribute("data-mp-name", cardName);
    el.setAttribute("data-mp-set", parsed.set);
    el.setAttribute("data-mp-number", parsed.collectorNumber);

    // Show button if already in list
    if (isCardInList(cardName, parsed.set, parsed.collectorNumber)) {
      el.appendChild(createToggleButton(cardName, parsed.set, parsed.collectorNumber));
    }

    // Show button on hover
    el.addEventListener("mouseenter", () => {
      if (!el.querySelector(`[${BTN_ATTR}]`)) {
        el.appendChild(createToggleButton(cardName, parsed.set, parsed.collectorNumber));
      }
    });

    // Hide button on mouse leave if not selected
    el.addEventListener("mouseleave", () => {
      const btn = el.querySelector(`[${BTN_ATTR}]`) as HTMLElement | null;
      if (btn && btn.getAttribute("data-selected") !== "true") {
        btn.remove();
      }
    });
  }
}

// -- Refresh button states --

function refreshButtonStates() {
  const allButtons = document.querySelectorAll<HTMLElement>(`[${BTN_ATTR}]`);
  for (const btn of allButtons) {
    const name = btn.getAttribute("data-mp-name") || "";
    const set = btn.getAttribute("data-mp-set") || undefined;
    const num = btn.getAttribute("data-mp-number") || undefined;
    const selected = isCardInList(name, set, num);
    setButtonState(btn, selected);

    const container = btn.closest(`[${PROCESSED_ATTR}]`) as HTMLElement | null;
    if (container && !selected && !container.matches(":hover")) {
      btn.remove();
    }
  }

  const allProcessed = document.querySelectorAll<HTMLElement>(`[${PROCESSED_ATTR}]`);
  for (const el of allProcessed) {
    if (el.querySelector(`[${BTN_ATTR}]`)) continue;
    const name = el.getAttribute("data-mp-name");
    const set = el.getAttribute("data-mp-set") || undefined;
    const num = el.getAttribute("data-mp-number") || undefined;
    if (name && isCardInList(name, set, num)) {
      el.appendChild(createToggleButton(name, set, num));
    }
  }
}

// -- Main --

let lastProcessedPath = "";

function processPage() {
  const path = window.location.pathname;

  // SvelteKit SPA: if the URL changed, clear processed markers so we re-process
  if (path !== lastProcessedPath) {
    const oldProcessed = document.querySelectorAll(`[${PROCESSED_ATTR}]`);
    for (const el of oldProcessed) {
      el.removeAttribute(PROCESSED_ATTR);
      const btn = el.querySelector(`[${BTN_ATTR}]`);
      if (btn) btn.remove();
    }
    lastProcessedPath = path;
  }

  if (path.match(/^\/card\/[^/]+\/[^/]+\//)) {
    processCardPage();
  }
  // Always run search results processing (card detail pages may have related printings)
  processSearchResults();
}

initOverlay();
processPage();

onCardsUpdated(refreshButtonStates);

const observer = new MutationObserver(() => {
  processPage();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
