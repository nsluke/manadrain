import { initOverlay, addCardFromSite, getCards, removeCardById, onCardsUpdated } from "./overlay";
import { makeCardId } from "../shared/types";

const SOURCE = "scryfall.com";
const PROCESSED_ATTR = "data-mana-pool-processed";
const BTN_ATTR = "data-mana-pool-btn";

function parseCardUrl(url: string): { set: string; collectorNumber: string; name: string } | null {
  // Pattern: /card/{set}/{collectorNumber}/{name}
  // Collector numbers can include letters, ★, and other suffixes (e.g. "260★" for etched foils)
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
 * Extract the canonical card name from Scryfall's page.
 * Handles double-faced cards by joining face names with " // ".
 */
function getCardName(fallback: string): string {
  // 1. Scryfall's card-text elements (handles double-faced cards)
  const nameEls = document.querySelectorAll(".card-text-card-name");
  if (nameEls.length > 0) {
    const names = Array.from(nameEls)
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    if (names.length > 0) return names.join(" // ");
  }

  // 2. Page <title> — format: "Card Name · Set Name (SET) #123 · Scryfall ..."
  const titleTag = document.querySelector("title");
  if (titleTag?.textContent) {
    const titleName = titleTag.textContent.split(" · ")[0]?.trim();
    if (titleName) return titleName;
  }

  // 3. URL-derived name (lossy — missing punctuation)
  return fallback;
}

// -- Toggle button --

function setButtonState(btn: HTMLElement, selected: boolean) {
  btn.setAttribute("data-selected", String(selected));
  btn.textContent = selected ? "✓" : "+";
  btn.style.opacity = selected ? "1" : "0.6";
  if (selected) {
    btn.style.background = "#22c55e";
    btn.style.borderColor = "#16a34a";
    btn.style.boxShadow = "0 2px 8px rgba(34, 197, 94, 0.5)";
  } else {
    btn.style.background = "linear-gradient(135deg, #6d28d9, #7c3aed)";
    btn.style.borderColor = "#8b5cf6";
    btn.style.boxShadow = "0 2px 8px rgba(109, 40, 217, 0.5)";
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

  const imageContainers = document.querySelectorAll<HTMLElement>(
    ".card-image-front, .card-image"
  );

  for (const container of imageContainers) {
    if (container.hasAttribute(PROCESSED_ATTR)) continue;
    if (container.closest(".card-profile-prints, .prints, .reprint-list, .print-langs")) continue;
    container.setAttribute(PROCESSED_ATTR, "true");

    const computed = window.getComputedStyle(container);
    if (computed.position === "static") {
      container.style.position = "relative";
    }

    container.appendChild(createToggleButton(name, parsed.set, parsed.collectorNumber));
  }

  // Fallback: button near card title if no image container was found
  if (imageContainers.length === 0) {
    const titleEl = document.querySelector<HTMLElement>("h1");
    if (titleEl && !titleEl.hasAttribute(PROCESSED_ATTR)) {
      titleEl.setAttribute(PROCESSED_ATTR, "true");
      titleEl.style.position = "relative";
      titleEl.style.display = "inline-flex";
      titleEl.style.alignItems = "center";
      titleEl.style.gap = "8px";

      const btn = createToggleButton(name, parsed.set, parsed.collectorNumber);
      btn.style.position = "relative";
      btn.style.top = "0";
      btn.style.right = "0";
      titleEl.appendChild(btn);
    }
  }
}

// -- Search results page --

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

    const container = link.closest(".card-grid-item, .card-grid-item-card") || link;
    if (container.hasAttribute(PROCESSED_ATTR)) continue;
    container.setAttribute(PROCESSED_ATTR, "true");

    const el = container as HTMLElement;
    const computed = window.getComputedStyle(el);
    if (computed.position === "static") {
      el.style.position = "relative";
    }

    // Use Scryfall's invisible label (most reliable), then image alt, then URL slug
    const invisibleLabel = el.querySelector(".card-grid-item-invisible-label");
    const cardName = invisibleLabel?.textContent?.trim()
      || img.alt || img.title
      || parsed.name.replace(/-/g, " ");

    // Store card data on the element for refresh
    el.setAttribute("data-mp-name", cardName);
    el.setAttribute("data-mp-set", parsed.set);
    el.setAttribute("data-mp-number", parsed.collectorNumber);

    // If already in list, show selected button immediately
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

// -- Refresh button states when card list changes --

function refreshButtonStates() {
  const allButtons = document.querySelectorAll<HTMLElement>(`[${BTN_ATTR}]`);
  for (const btn of allButtons) {
    const name = btn.getAttribute("data-mp-name") || "";
    const set = btn.getAttribute("data-mp-set") || undefined;
    const num = btn.getAttribute("data-mp-number") || undefined;
    const selected = isCardInList(name, set, num);
    setButtonState(btn, selected);

    // On search pages, remove unselected buttons that aren't hovered
    const container = btn.closest(`[${PROCESSED_ATTR}]`) as HTMLElement | null;
    if (container && !selected && !container.matches(":hover")) {
      btn.remove();
    }
  }

  // Re-add buttons for cards that are now in the list but don't have a button
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

function processPage() {
  const path = window.location.pathname;
  if (path.match(/^\/card\//)) {
    processCardPage();
  } else {
    processSearchResults();
  }
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
