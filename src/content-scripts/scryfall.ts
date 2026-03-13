import { initOverlay, addCardFromSite } from "./overlay";

const SOURCE = "scryfall.com";
const PROCESSED_ATTR = "data-mana-pool-processed";

function parseCardUrl(url: string): { set: string; collectorNumber: string; name: string } | null {
  // Pattern: /card/{set}/{collectorNumber}/{name}
  const match = url.match(/\/card\/([a-z0-9]+)\/(\d+[a-z]?)\/([^/?#]+)/i);
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
    top: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6d28d9, #7c3aed);
    border: 2px solid #8b5cf6;
    color: white;
    font-size: 18px;
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
    btn.style.boxShadow = "0 4px 12px rgba(109, 40, 217, 0.7)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 2px 8px rgba(109, 40, 217, 0.5)";
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
    // Brief visual feedback
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

function processCardPage() {
  // Single card page: /card/{set}/{number}/{name}
  const parsed = parseCardUrl(window.location.pathname);
  if (!parsed) return;

  // Find the card image container to attach the button
  // Scryfall uses .card-image-front for the main card image
  const imageContainers = document.querySelectorAll<HTMLElement>(
    ".card-image-front, .card-image"
  );

  for (const container of imageContainers) {
    if (container.hasAttribute(PROCESSED_ATTR)) continue;
    container.setAttribute(PROCESSED_ATTR, "true");

    // Ensure the container is positioned for absolute child
    const computed = window.getComputedStyle(container);
    if (computed.position === "static") {
      container.style.position = "relative";
    }

    const btn = createAddButton(() => {
      // Try to get the canonical card name from the page
      const nameEl = document.querySelector(".card-text-card-name");
      const name = nameEl?.textContent?.trim() || parsed.name;
      addCardFromSite(name, parsed.set, parsed.collectorNumber, SOURCE);
    });
    container.appendChild(btn);
  }

  // Also add a button near the card title if no image container was found
  if (imageContainers.length === 0) {
    const titleEl = document.querySelector<HTMLElement>("h1");
    if (titleEl && !titleEl.hasAttribute(PROCESSED_ATTR)) {
      titleEl.setAttribute(PROCESSED_ATTR, "true");
      titleEl.style.position = "relative";
      titleEl.style.display = "inline-flex";
      titleEl.style.alignItems = "center";
      titleEl.style.gap = "8px";

      const btn = createAddButton(() => {
        const name = titleEl.textContent?.trim().replace(/\s*\{[^}]+\}/g, "") || parsed.name;
        addCardFromSite(name, parsed.set, parsed.collectorNumber, SOURCE);
      });
      btn.style.position = "relative";
      btn.style.top = "0";
      btn.style.right = "0";
      titleEl.appendChild(btn);
    }
  }
}

function processSearchResults() {
  // Search results: cards shown as grid items linking to /card/{set}/{number}/{name}
  // Scryfall uses various layouts: grid, list, full, checklist
  const cardLinks = document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/card/"]'
  );

  for (const link of cardLinks) {
    // Skip non-card links (like breadcrumbs, footer links, etc.)
    const href = link.getAttribute("href") || "";
    const parsed = parseCardUrl(href);
    if (!parsed) continue;

    // Find the closest card container - the link itself or a parent with an image
    const container = link.querySelector("img")
      ? link
      : link.closest(".card-grid-item, .card-grid-item-card") || link;

    if (container.hasAttribute(PROCESSED_ATTR)) continue;
    container.setAttribute(PROCESSED_ATTR, "true");

    const el = container as HTMLElement;
    const computed = window.getComputedStyle(el);
    if (computed.position === "static") {
      el.style.position = "relative";
    }

    // Try to extract a clean card name
    const img = link.querySelector("img");
    const altName = img?.alt || img?.title || "";

    const btn = createAddButton(() => {
      const name = altName || parsed.name;
      addCardFromSite(
        name.replace(/-/g, " "),
        parsed.set,
        parsed.collectorNumber,
        SOURCE
      );
    });
    el.appendChild(btn);
  }
}

function processPage() {
  const path = window.location.pathname;
  if (path.match(/^\/card\//)) {
    processCardPage();
  }
  // Always try search results — they appear on search pages, set pages, etc.
  processSearchResults();
}

// Initialize
initOverlay();
processPage();

// Re-process on DOM changes (Scryfall uses some dynamic loading)
const observer = new MutationObserver(() => {
  processPage();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
