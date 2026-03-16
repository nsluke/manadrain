import { initOverlay, addCardFromSite } from "./overlay";
import { markAdded, clearMark, isRecentlyAdded, CHECKMARK_DURATION } from "../shared/checkmark-state";

const SOURCE = "botbox.dev";
const BTN_ATTR = "data-mana-pool-btn";

function createAddButton(cardIndex: number, onClick: () => void): HTMLElement {
  const key = String(cardIndex);
  const isRecent = isRecentlyAdded(key);

  const btn = document.createElement("button");
  btn.textContent = isRecent ? "\u2713" : "+";
  btn.title = "Add to Mana Pool Shopping List";
  btn.setAttribute("style", `
    position: absolute;
    top: 4px;
    right: 4px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: ${isRecent ? "linear-gradient(180deg, #c9a84c, #9e7b2f)" : "linear-gradient(135deg, #b8942e, #d4af37)"};
    border: 2px solid ${isRecent ? "#d4af37" : "#c9a84c"};
    color: #1a1410;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-shadow: 0 2px 8px rgba(184, 148, 46, 0.4);
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
    markAdded(key);
    btn.textContent = "\u2713";
    btn.style.background = "linear-gradient(180deg, #c9a84c, #9e7b2f)";
    btn.style.borderColor = "#d4af37";
    setTimeout(() => {
      clearMark(key);
      btn.textContent = "+";
      btn.style.background = "linear-gradient(135deg, #b8942e, #d4af37)";
      btn.style.borderColor = "#c9a84c";
    }, CHECKMARK_DURATION);
  });
  return btn;
}

/**
 * Attach "+" buttons to card elements in the DOM.
 * Card data (name, set, collector number) is stamped as data attributes
 * by the MAIN-world bridge script reading from currentPack.
 */
function attachButtons() {
  const cardDivs = document.querySelectorAll<HTMLElement>('.card');

  for (let i = 0; i < cardDivs.length; i++) {
    const cardDiv = cardDivs[i];
    // Skip if our button is still present in the DOM
    if (cardDiv.querySelector(`[${BTN_ATTR}]`)) continue;

    const computed = window.getComputedStyle(cardDiv);
    if (computed.position === "static") {
      cardDiv.style.position = "relative";
    }

    // Read data attributes at click time — the bridge keeps them current
    const btn = createAddButton(i, () => {
      const name = cardDiv.getAttribute("data-mp-name");
      const set = cardDiv.getAttribute("data-mp-set") || undefined;
      const collectorNumber = cardDiv.getAttribute("data-mp-number") || undefined;
      if (!name) return;
      addCardFromSite(name, set, collectorNumber, SOURCE);
    });
    btn.setAttribute(BTN_ATTR, "true");
    cardDiv.appendChild(btn);
  }
}

// Initialize
initOverlay();
attachButtons();

// Watch for DOM changes (BotBox loads cards dynamically after pack opening)
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const observer = new MutationObserver((mutations) => {
  // Ignore mutations caused by our own buttons
  const isOurMutation = mutations.every((m) => {
    const target = m.target as HTMLElement;
    return target.hasAttribute?.(BTN_ATTR) || target.closest?.(`[${BTN_ATTR}]`);
  });
  if (isOurMutation) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(attachButtons, 50);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
