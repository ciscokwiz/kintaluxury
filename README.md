# Kinta & Co. — the interactive rack

A full-screen clothing showroom and product enquiry flow for
[@kinta.and.co](https://www.instagram.com/kinta.and.co/).

## Development

Node 24 and npm 11 were used for validation.

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:rack
npm run build
npm start
```

Fonts use the system sans-serif and serif stacks, so development and production
builds do not need Google Fonts access. No API credentials or backend services
are required for the current enquiry workflow.

## Showroom

The plain studio wall, chrome rail, wooden hangers, lime announcement strip,
and black typography frame seven hanging designs, with ten selectable colorways.
Hover a garment to swivel it forward and move its neighbors apart. Click to
open the product view; on touch, tap once to turn and again to open.
Narrow screens support dragging the rack horizontally.

The product view has Front/Back buttons, drag-to-turn, hanging color tags,
previous/next design navigation, and a link to the selected product and color.
Changing color updates that design's garment on the rack and is remembered
when the product view closes or you navigate between designs.
The ticker stays visible. Keyboard users can Tab through the garments, press
Enter to open, use arrow keys to navigate, and Escape to close. Reduced-motion
preferences are respected.

The garments preserve the original Kinta front/back artwork on shaped surfaces,
with closed sleeve/hem edges, raised collar seams, subtle woven shading, and
different cuts and thickness for tees, long sleeves, crewnecks, and hoodies.
Visible wooden shoulders support the necklines. Movement emphasizes damped
turning and sliding; there is no hover enlargement, lift, ripple or idle billowing.
The rail stays fixed while the hangers move. These are rendered mockups rather
than clothing scans. Soft wall shadows add depth. Original
brand photos are available in the product gallery for the first four colorways.

## Products and bag

`/products/[slug]?color=ID` opens a product page with its color choices,
front/back mockups, original photos where provided, size selection, and quantity.
`/cart` holds a browser-local selection that can be edited or removed and
restores on reload. Matching product/color/size selections merge, up to ten
pieces per line.

The bag prepares an enquiry that the customer can copy and send to Kinta on
Instagram. It does not process payments, reserve stock, or submit an order.
Prices are intentionally `null` and display **Price on request**. To publish
prices, supply the real NGN selling prices in `lib/products.ts`. A payment
provider and server-side price, stock, and order validation are still needed
before enabling online checkout. Size options do not assert stock availability.

## Main files

```text
app/                         showroom, product and cart routes
components/ProductView*      product overlay and color/view controls
components/three/            rail, garment geometry, lighting, cloth simulation
components/shop/             product pages, bag, shared shopping styles
lib/products.ts              catalog, colors, grouped designs and pricing
lib/cart.ts                  validated browser-local bag
lib/store.ts                 showroom state and mutable animation state
lib/motion.ts                timing, springs and fabric parameters
lib/garment-fit.ts           garment cuts, fabric weight and edge thickness
tests/rack.test.ts           layout, garment geometry, color state and motion checks
public/garments/             transparent garment front/back mockups
public/product-photos/       unchanged original brand photos
```

Add `?tune` to the showroom URL for the cloth tuning panel. Copy settings from
the panel into `FABRIC_DEFAULTS` in `lib/motion.ts` to retain adjustments.

## Optional asset workflows

```bash
npm run build:artifact
```

This creates `artifact/dist/kinta-website.html` (also `index.html`): one
self-contained HTML file with all 25 images, JavaScript, and styles embedded.
Open that file directly in a WebGL-capable browser; no development server or
Internet connection is needed to explore the rack, product pages, photos, and
bag. Navigation uses hash routes so reload and browser back/forward work from
disk or any static host. Instagram enquiries still need Internet access.
The tuning panel is off by default; add `?tune` before the hash to enable it.
Bag persistence depends on the browser allowing local storage for local files.

```bash
pip install pillow numpy
npm run garments
```

The garment generator extracts brand artwork from `scripts/photos/` and
recreates `public/garments/`. This rewrites tracked mockups. The original photos
and this procedural generator remain available for future asset work.
