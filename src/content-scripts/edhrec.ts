import { initOverlay, addCardFromSite } from "./overlay";

const SOURCE = "edhrec.com";
const PROCESSED_ATTR = "data-mana-pool-processed";

function cleanCardName(raw: string): string {
  // Remove things like mana symbols in brackets, trailing whitespace
  return raw.replace(/\s*\/\/.*$/, "").trim(); // Handle double-faced cards "Name // Name"
}

function extractCardNameFromUrl(href: string): string | null {
  // EDHREC card links: /cards/{card-name}
  const match = href.match(/\/cards\/([^/?#]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]).replace(/-/g, " ");
}

function extractFromScryfallLink(href: string): {
  name: string;
  set?: string;
  collectorNumber?: string;
} | null {
  // Some EDHREC elements link to Scryfall: /card/{set}/{number}/{name}
  const match = href.match(/scryfall\.com\/card\/([a-z0-9]+)\/(\d+[a-z]?)\/([^/?#]+)/i);
  if (!match) return null;
  return {
    set: match[1],
    collectorNumber: match[2],
    name: decodeURIComponent(match[3]).replace(/-/g, " "),
  };
}

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
    transition: transform 0.12s, box-shadow 0.12s;
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

function processCards() {
  // EDHREC shows cards in multiple formats:
  // 1. Card image links (hover to see card) — img elements inside anchors
  // 2. Card name text links to /cards/{name}
  // 3. Card panels/tiles with card images

  // Strategy 1: Find card images with card names in alt text
  const cardImages = document.querySelectorAll<HTMLImageElement>(
    'img[alt]:not([data-mana-pool-processed])'
  );

  for (const img of cardImages) {
    const alt = img.alt?.trim();
    if (!alt || alt.length < 2 || alt.length > 80) continue;

    // Filter: Must look like a card name (not site UI images)
    // EDHREC card images typically have Scryfall URLs or specific patterns
    const src = img.src || img.dataset.src || "";
    const isCardImage =
      src.includes("cards.scryfall.io") ||
      src.includes("img.scryfall.com") ||
      src.includes("c1.scryfall.com") ||
      img.closest('a[href*="/cards/"]') !== null;

    if (!isCardImage) continue;
    if (img.hasAttribute(PROCESSED_ATTR)) continue;
    img.setAttribute(PROCESSED_ATTR, "true");

    // Find or create a positioned container
    const container = img.closest("a, .card, .cardlink, [class*='card']") || img.parentElement;
    if (!container) continue;

    const el = container as HTMLElement;
    if (el.hasAttribute(PROCESSED_ATTR)) continue;
    el.setAttribute(PROCESSED_ATTR, "true");

    const computed = window.getComputedStyle(el);
    if (computed.position === "static") {
      el.style.position = "relative";
    }

    // Try to extract set info from any Scryfall link nearby
    const scryfallLink = el.querySelector<HTMLAnchorElement>('a[href*="scryfall.com/card/"]');
    const scryfallData = scryfallLink
      ? extractFromScryfallLink(scryfallLink.href)
      : null;

    const btn = createAddButton(() => {
      addCardFromSite(
        cleanCardName(scryfallData?.name || alt),
        scryfallData?.set,
        scryfallData?.collectorNumber,
        SOURCE
      );
    });
    el.appendChild(btn);
  }

  // Strategy 2: Find card name links to /cards/{name} that don't have images
  const cardLinks = document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/cards/"]:not([data-mana-pool-processed])'
  );

  for (const link of cardLinks) {
    if (link.hasAttribute(PROCESSED_ATTR)) continue;
    // Skip if this link already has a processed image child
    if (link.querySelector(`[${PROCESSED_ATTR}]`)) continue;

    const href = link.getAttribute("href") || "";
    const cardName = extractCardNameFromUrl(href);
    if (!cardName) continue;

    // Skip navigation links, sidebar links, etc.
    // Card links typically have short text matching the card name
    const linkText = link.textContent?.trim() || "";
    if (linkText.length < 2 || linkText.length > 80) continue;

    link.setAttribute(PROCESSED_ATTR, "true");

    // For text-only links, add an inline "+" button after the link
    const btn = document.createElement("button");
    btn.textContent = "+";
    btn.title = "Add to Mana Pool Shopping List";
    btn.setAttribute("style", `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      border: 1px solid #8b5cf6;
      color: white;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      margin-left: 4px;
      vertical-align: middle;
      line-height: 1;
      padding: 0;
      font-family: -apple-system, system-ui, sans-serif;
    `);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addCardFromSite(cleanCardName(cardName), undefined, undefined, SOURCE);
      btn.textContent = "\u2713";
      btn.style.background = "#22c55e";
      setTimeout(() => {
        btn.textContent = "+";
        btn.style.background = "linear-gradient(135deg, #6d28d9, #7c3aed)";
      }, 800);
    });
    link.parentElement?.insertBefore(btn, link.nextSibling);
  }
}

// Initialize
initOverlay();
processCards();

// Re-process on DOM changes (EDHREC loads content dynamically)
const observer = new MutationObserver(() => {
  processCards();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
