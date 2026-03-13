/**
 * BotBox page-context bridge.
 *
 * This script runs in the MAIN world (same JS context as BotBox's own code)
 * so it can read the `currentPack` variable directly. It sends card data
 * to the ISOLATED world content script via window.postMessage.
 */

declare const currentPack: unknown[][] | undefined;

let lastPackLength = -1;

function sendPackData() {
  if (typeof currentPack === "undefined" || !Array.isArray(currentPack)) return;
  if (currentPack.length === lastPackLength) return;
  lastPackLength = currentPack.length;

  const cards = currentPack
    .map((c) => ({
      name: (c[4] as string) || "",
      set: (c[9] as string) || "",
      collectorNumber: c[10] != null ? String(c[10]) : "",
    }))
    .filter((c) => c.name.length > 0);

  window.postMessage({ type: "MANA_POOL_BOTBOX_PACK", cards }, "*");
}

// Poll periodically
setInterval(sendPackData, 800);

// Also fire on DOM changes in the pack area
const packArea = document.getElementById("packarea") || document.body;
new MutationObserver(() => {
  setTimeout(sendPackData, 200);
}).observe(packArea, { childList: true, subtree: true });
