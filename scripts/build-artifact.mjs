/** Bundle the real storefront and shopping screens into one offline HTML file. */
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "artifact", "dist");
mkdirSync(out, { recursive: true });

const assets = {};
for (const folder of ["garments", "product-photos"]) {
  for (const name of readdirSync(join(root, "public", folder))) {
    if (!/\.(?:webp|png)$/i.test(name)) continue;
    const type = name.endsWith(".webp") ? "image/webp" : "image/png";
    assets[`${folder}/${name}`] = `data:${type};base64,${readFileSync(join(root, "public", folder, name)).toString("base64")}`;
  }
}

const result = await build({
  entryPoints: [join(root, "artifact", "main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  outdir: out,
  legalComments: "inline",
  logLevel: "warning",
  tsconfig: join(root, "tsconfig.json"),
  alias: {
    "next/link": join(root, "artifact", "link-shim.tsx"),
    "next/navigation": join(root, "artifact", "navigation-shim.ts"),
    "next/image": join(root, "artifact", "image-shim.tsx"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_TUNE": '"0"',
    "process.env.NEXT_PUBLIC_ASSET_BASE": '"/"',
    "process.env.NEXT_PUBLIC_STANDALONE": '"1"',
  },
  banner: { js: 'var process=globalThis.process||{env:{NODE_ENV:"production"}};' },
});

const js = result.outputFiles.find((file) => file.path.endsWith(".js")).text;
const css = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "";
const globals = readFileSync(join(root, "app", "globals.css"), "utf8");
const safeJs = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
const assetJson = JSON.stringify(assets).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#eeefeb">
<title>Kinta &amp; Co. — The New African Icon</title>
<meta name="description" content="Explore Kinta & Co.'s interactive clothing rack, choose a color and size, and save your selection.">
<style>:root { color-scheme: light; }\n${globals}\n${css}</style>
</head>
<body>
<div id="root"></div>
<noscript>This interactive storefront requires JavaScript. Contact @kinta.and.co on Instagram for product enquiries.</noscript>
<script>window.__KINTA_ARTIFACT_ASSETS__=${assetJson};</script>
<script>${safeJs}</script>
</body>
</html>
`;
for (const name of ["index.html", "kinta-website.html"]) writeFileSync(join(out, name), html);
console.log(`Built artifact/dist/kinta-website.html: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, ${Object.keys(assets).length} embedded images; no server required.`);
