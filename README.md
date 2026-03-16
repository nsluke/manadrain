# ManaDrain

A Chrome extension that lets Magic: The Gathering players collect cards from popular MTG websites into a shopping list for [Mana Pool](https://manapool.com).

## Supported Sites

- **Scryfall** (scryfall.com) — Card detail pages and search results
- **EDHREC** (edhrec.com) — Commander recommendations and card pages
- **BotBox** (botbox.dev) — Pack simulator cards
- **Mana Pool** (manapool.com) — Card listings and browse pages

## Features

- **Toggle buttons** on card images across all supported sites — hover to show, click to add/remove
- **Floating overlay panel** with your shopping list, quantity controls, and running price total
- **Live pricing** from Mana Pool API with Scryfall fallback, including foil and etched variants
- **Foil support** — toggle foil per card, auto-detected for foil-only printings
- **Sorting** — by recently added, alphabetical, or price
- **Mass entry export** — copies your list in Mana Pool format and auto-pastes into manapool.com/add-deck
- **Card links** — click any card name to go directly to its Mana Pool listing
- **Card image tooltips** — hover over card names to preview the card
- **Persistent storage** via `chrome.storage.sync` across sessions
- **MTG-themed UI** — gold and mahogany design with Cinzel font

## Installation

### From Release (recommended)

1. Download `manadrain-1.0.zip` from the [latest release](https://github.com/nsluke/manadrain/releases/latest)
2. Unzip it to a folder on your computer
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked** and select the unzipped folder
6. Visit any supported site and start collecting cards

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/nsluke/manadrain.git
   cd manadrain
   ```
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked** and select the `dist/` folder

## Usage

1. Browse to any supported MTG site
2. Hover over a card image to see the **+** button
3. Click to add it to your list (click again to remove)
4. Click the floating **⬣** button (bottom-right) to expand your shopping list
5. Toggle foil, adjust quantities, sort your list
6. Click **Open Mana Pool** to send your list directly to the mass entry page

## Development

```bash
npm run build    # One-time production build
npm run watch    # Rebuild on file changes
npm test         # Run tests
```

After rebuilding, reload the extension in `chrome://extensions/`.

## Architecture

```
src/
  service-worker.ts          # Background: message routing, storage, badge, pricing
  content-scripts/
    overlay.ts               # Shadow DOM floating panel (shared across all sites)
    scryfall.ts              # Scryfall card detection + toggle buttons
    edhrec.ts                # EDHREC card detection
    botbox.ts                # BotBox card detection (ISOLATED world)
    botbox-bridge.ts         # BotBox data bridge (MAIN world)
    manapool.ts              # Mana Pool card detection + mass entry auto-paste
  shared/
    types.ts                 # CardEntry type, ID generation, mass entry formatting
    storage.ts               # chrome.storage.sync wrapper with debouncing
    manapool-api.ts          # Mana Pool + Scryfall pricing pipeline
    checkmark-state.ts       # Persistent button state for re-rendering sites
  popup/
    popup.html/ts/css        # Extension popup UI
```

## Tech Stack

- TypeScript
- Chrome Extension Manifest V3
- esbuild
- Vitest
- Vanilla DOM (no frameworks)
