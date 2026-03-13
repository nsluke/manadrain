import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";

const watch = process.argv.includes("--watch");

const commonOptions = {
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: false,
  minify: false,
};

const entryPoints = [
  { in: "src/service-worker.ts", out: "service-worker" },
  { in: "src/popup/popup.ts", out: "popup/popup" },
  { in: "src/content-scripts/scryfall.ts", out: "content-scripts/scryfall" },
  { in: "src/content-scripts/edhrec.ts", out: "content-scripts/edhrec" },
  { in: "src/content-scripts/botbox.ts", out: "content-scripts/botbox" },
  { in: "src/content-scripts/botbox-bridge.ts", out: "content-scripts/botbox-bridge" },
];

async function build() {
  for (const entry of entryPoints) {
    const ctx = await esbuild.context({
      ...commonOptions,
      entryPoints: [entry.in],
      outfile: `dist/${entry.out}.js`,
    });
    if (watch) {
      await ctx.watch();
      console.log(`Watching ${entry.in}...`);
    } else {
      await ctx.rebuild();
      ctx.dispose();
    }
  }
  // Copy static assets
  mkdirSync("dist/popup", { recursive: true });
  mkdirSync("dist/icons", { recursive: true });
  cpSync("manifest.json", "dist/manifest.json");
  cpSync("src/popup/popup.html", "dist/popup/popup.html");
  cpSync("src/popup/popup.css", "dist/popup/popup.css");
  cpSync("icons", "dist/icons", { recursive: true });

  if (!watch) {
    console.log("Build complete.");
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
