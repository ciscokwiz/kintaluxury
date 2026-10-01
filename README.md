# Kinta & Co. — 3D rack storefront

A single-page storefront for [@kinta.and.co](https://www.instagram.com/kinta.and.co/) built from the
"Batch Merch" rack brief: a pegboard wall, a chrome rail and ten garments on wooden hangers that
swivel to face you on hover while their neighbours slide apart. Click a garment for the frosted
product view (← / → or arrow keys, Esc to close).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint && npm run typecheck
```

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · three + @react-three/fiber + drei ·
zustand · gsap · CSS Modules · `next/font` (Inter, Lobster Two).

```
app/            layout (fonts, pegboard body), page, globals.css
components/     Header, Marquee, SeeAvailability, HoverLabel, ProductView
components/three/
  RackScene     rack canvas + the per-frame simulation (hover, swivel, rail layout, sway, label, parallax)
  DetailStage   second canvas above the veil: fly-in, prev/next fade, drag-to-turn
  Garment       curved front/back panels + hanger + hook (shared geometry)
  Hanger, Rail, StudioLights, physics, useRackLayout (vw/vh → world, rack layout)
lib/            products, store (zustand + mutable sim state), motion (every timing constant)
scripts/        make_garments.py + the source photos
public/garments NN-front.webp / NN-back.webp
```

## Garment mockups

`scripts/make_garments.py` cuts the prints out of the brand photos in `scripts/photos/`
(KINTA™ puff wordmark, "Liberty or Death" back print, "The New African Icon" print, the
"Restricted" diamond eagle) and composites them onto shaded ghost-mannequin silhouettes:

```bash
pip install pillow numpy
npm run garments
```

| # | Product | Source |
|---|---|---|
| 01 | The Liberty Tee — Bone (KINTA™ front, Liberty back print) | photos 1 + 2 |
| 02 | The New African Icon Tee — Black | photo 3 |
| 03 | Restricted Eagle Tee — Azure | photo 4 |
| 04 | Kinta. Track Hoodie — Sky | photo 5 |
| 05–10 | Logo Crewneck Forest, NAI Long Sleeve, Logo Tee Sand, Eagle Tee Onyx, Track Hoodie Navy, Logo Tee Slate | concept colourways of the same prints |

Edit names in `lib/products.ts`. Replace a mockup by dropping a real transparent cut-out at the
same path (1000 × 1200, shoulders at the top, ~40 px headroom).

## Where this differs from the brief

- **Textures are WebP** (with alpha), not PNG: 550 KB for all twenty instead of 27 MB.
- **w_front** grows with the garment (≥ 1.12 × its front width). These garments are wider than the
  reference's, and at 15 vw the neighbours covered the hovered piece.
- **Rest yaw is perspective-corrected** so garments left and right of centre show the same sliver.
- **Hoodie** is an extra garment kind (spec lists tee / long sleeve / crewneck).
- **Drag-to-turn in the product view** reveals the back panel (the Liberty print lives on the back of #01).
- With a 4.65 vw rest pitch the row can't also leave only 4.8 vw of empty rail at each end (the
  brief asks for both); the pitch wins, so on desktop the row sits mid-rail and the end-bunching
  logic only engages when a parted row reaches a bracket.
- **SEE AVAILABILITY / CONTACT** link to the Instagram profile (orders by DM). No prices are shown.
