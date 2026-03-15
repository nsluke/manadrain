import { initOverlay, addCardFromSite } from "./overlay";

const SOURCE = "botbox.dev";
const BTN_ATTR = "data-mana-pool-btn";

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
    background: linear-gradient(135deg, #b8942e, #d4af37);
    border: 2px solid #c9a84c;
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
    btn.textContent = "\u2713";
    btn.style.background = "linear-gradient(180deg, #c9a84c, #9e7b2f)";
    btn.style.borderColor = "#d4af37";
    setTimeout(() => {
      btn.textContent = "+";
      btn.style.background = "linear-gradient(135deg, #b8942e, #d4af37)";
      btn.style.borderColor = "#c9a84c";
    }, 800);
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

  for (const cardDiv of cardDivs) {
    // Skip if our button is still present in the DOM
    if (cardDiv.querySelector(`[${BTN_ATTR}]`)) continue;

    const computed = window.getComputedStyle(cardDiv);
    if (computed.position === "static") {
      cardDiv.style.position = "relative";
    }

    // Read data attributes at click time — the bridge keeps them current
    const btn = createAddButton(() => {
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
const observer = new MutationObserver(() => {
  attachButtons();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
