/**
 * Bundles the storefront into one self-contained page for a claude.ai
 * Artifact (no Next server): artifact/dist/index.html + garments/*.webp.
 * The fabric tuning panel is switched on in this build.
 *
 *   node scripts/build-artifact.mjs
 */
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "artifact", "dist");
mkdirSync(join(out, "garments"), { recursive: true });

const result = await build({
  entryPoints: [join(root, "artifact", "main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  outdir: out,
  legalComments: "none",
  logLevel: "warning",
  tsconfig: join(root, "tsconfig.json"),
  alias: { "next/link": join(root, "artifact", "link-shim.tsx") },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_TUNE": '"1"',
    "process.env.NEXT_PUBLIC_ASSET_BASE": '""',
  },
  banner: { js: 'var process=globalThis.process||{env:{NODE_ENV:"production"}};' },
});

const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
const globals = readFileSync(join(root, "app", "globals.css"), "utf8");
// keep the inline script from closing itself early
const safeJs = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const html = `<title>Kinta &amp; Co. Rack</title>
<meta name="description" content="Kinta &amp; Co. 3D clothing rack with cloth micro-motion and a live tuning panel.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;1,400;1,500&family=Lobster+Two:ital,wght@1,700&display=swap">
<style>
/* One deliberate look: the light pegboard shop wall, in every viewer theme. */
:root { color-scheme: light; --font-inter: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; --font-script: "Lobster Two", "Brush Script MT", cursive; }
${globals}
${css}
</style>
<div id="root"></div>
<script>${safeJs}</script>
`;
writeFileSync(join(out, "index.html"), html);
for (const f of readdirSync(join(root, "public", "garments"))) copyFileSync(join(root, "public", "garments", f), join(out, "garments", f));
console.log(`artifact/dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
