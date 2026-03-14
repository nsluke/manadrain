/**
 * BotBox page-context bridge.
 *
 * Runs in the MAIN world (same JS context as BotBox's own code)
 * so it can read `currentPack`. Stamps card data as data attributes
 * directly on `.card` DOM elements so the ISOLATED-world content script
 * can read them at click time.
 */

declare const currentPack: unknown[][] | undefined;

function stampCardData() {
  if (typeof currentPack === "undefined" || !Array.isArray(currentPack)) return;

  const cardDivs = document.querySelectorAll<HTMLElement>(".card");

  for (let i = 0; i < cardDivs.length && i < currentPack.length; i++) {
    const c = currentPack[i];
    const div = cardDivs[i];
    const name = (c[4] as string) || "";
    const set = (c[9] as string) || "";
    const collectorNumber = c[10] != null ? String(c[10]) : "";

    if (name) {
      div.setAttribute("data-mp-name", name);
      div.setAttribute("data-mp-set", set);
      div.setAttribute("data-mp-number", collectorNumber);
    }
  }
}

// Poll periodically (BotBox updates currentPack when new packs open)
setInterval(stampCardData, 500);

// Also fire on DOM changes in the pack area
const packArea = document.getElementById("packarea") || document.body;
new MutationObserver(() => {
  setTimeout(stampCardData, 100);
}).observe(packArea, { childList: true, subtree: true });
