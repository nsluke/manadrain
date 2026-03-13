# Mana Pool Shopping List

A Chrome extension that lets Magic: The Gathering players collect cards from popular MTG websites into a shopping list, then bulk-add them to their [Mana Pool](https://manapool.com) cart via mass entry.

Built as a Mana Pool job application project.

## Supported Sites

- **Scryfall** (scryfall.com) - Card pages and search results
- **EDHREC** (edhrec.com) - Commander recommendations and card pages
- **BotBox** (botbox.dev) - Pack simulator cards

## Features

- **One-click card collection**: Purple "+" buttons appear on card images across supported sites
- **Floating overlay panel**: Bottom-right panel shows your shopping list with card counts, quantity controls, and running total
- **Mass entry export**: Copy your list in Mana Pool's mass entry format (`4 Lightning Bolt [STA] 42`) ready to paste into manapool.com/add-deck
- **Persistent storage**: List syncs across browser sessions via `chrome.storage.sync`
- **Card image preview**: Hover over card names in the overlay to see the card image
- **Import/Export**: Backup and restore your list as JSON
- **Extension popup**: Full list management from the toolbar icon

## Installation

1. Clone or download this repository
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right)
5. Click **Load unpacked** and select the `dist/` folder
6. Visit any supported site and start collecting cards

## Usage

1. Browse to a supported MTG site (e.g., scryfall.com)
2. Click the purple **+** button on any card to add it to your list
3. Click the floating **MP** button (bottom-right) to view your list
4. Adjust quantities with +/- buttons
5. Click **Copy for Mana Pool** to copy the list in mass entry format
6. Click **Open Mana Pool** to go to manapool.com/add-deck and paste your list

## Architecture

```
src/
  service-worker.ts          # Background: message routing, storage, badge
  popup/                     # Extension popup UI
    popup.html/ts/css
  content-scripts/           # Per-site card detection + shared overlay
    overlay.ts               # Shadow DOM floating panel (shared)
    scryfall.ts              # Scryfall card extraction
    edhrec.ts                # EDHREC card extraction
    botbox.ts                # BotBox card extraction
  shared/
    types.ts                 # CardEntry type, mass entry formatting
    storage.ts               # chrome.storage.sync wrapper with debouncing
```

Key design decisions:
- **Shadow DOM** for the overlay to avoid CSS conflicts with host sites
- **esbuild** for fast bundling (each content script is self-contained)
- **Debounced storage writes** to avoid excessive sync writes
- **MutationObserver** on each site to handle dynamically loaded content
- **Service worker** handles all storage operations; content scripts communicate via messages

## Development

```bash
npm run watch    # Rebuild on file changes
npm run build    # One-time production build
```

After rebuilding, reload the extension in `chrome://extensions/` to pick up changes.

## Future Work

- Direct Mana Pool API integration for live pricing and availability
- Direct cart integration via the Mana Pool API (instead of clipboard mass-entry workflow)
- Additional site support (Moxfield, Archidekt, MTGGoldfish)
- Card printing selector to choose specific printings
- Price alerts and availability notifications

## Tech Stack

- TypeScript
- Chrome Extension Manifest V3
- esbuild (bundler)
- Vanilla DOM (no frameworks)
