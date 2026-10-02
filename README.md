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

## Cloth micro-motion

The garment panels bend in the vertex shader (`components/three/fabric.ts`), so the fabric answers
the pointer: a soft dent and ripple where you touch it, cloth pulled along as you move, the garment
leaning away from your hand, gentle breathing while hovered, a twist travelling down it as it
swivels, the hem trailing when it slides along the rail, and a faint rustle in neighbours as the
pointer passes. Nothing moves at rest, and `prefers-reduced-motion` turns it off.

All amplitudes live in `FABRIC_DEFAULTS` (`lib/motion.ts`). Add `?tune` to the URL for a live
panel with sliders; **Copy settings** gives you the JSON to paste back into `FABRIC_DEFAULTS`.

## Standalone test page

```bash
npm run build:artifact   # → artifact/dist/index.html + garments/
```

Bundles the same React app with esbuild into one page (tuning panel on), for publishing as a
claude.ai Artifact or opening from any static host.

## Garments

The rack garments are the brand's photoreal ghost-mannequin mockups (`scripts/photos/ref-*.webp`),
cut out, cleaned up and recoloured by `scripts/make_photoreal.py`:

```bash
pip install pillow numpy
npm run garments
```

| # | Product | Source |
|---|---|---|
| 01 | The Liberty Tee — Bone | ref-14 front; back = ref-14 back with the real print from photo 2 |
| 02 | The New African Icon Tee — Black | ref-11 |
| 03, 06 | Restricted Eagle Tee — Azure / Onyx | ref-14 tee recoloured + the eagle from photo 4 |
| 05, 07, 10 | KINTA™ Logo Tee — Forest / Sand / Slate | ref-14 tee recoloured, logo re-inked |
| 04, 08, 09 | Kinta. Hoodie — Sky / Peach / Navy | ref-12 (joggers cut off), recoloured |

Two mockup defects are corrected rather than copied: the hoodie chest read **"KIATA."** (replaced
with the KINTA wordmark), and the Liberty quote was garbled AI text (replaced with the print from
the real photo). Each garment also gets a body-volume map (`NN-vol.png`) that the vertex shader uses
to give the front and back panels depth, so a garment seen side-on reads as cloth with thickness.
Hangers are fitted per garment kind (`HANGER_PROFILE`) so they stay inside the shoulders.

Replace a mockup by dropping a new render in `scripts/photos/` and re-running the script.

## Where this differs from the brief

- **Textures are WebP** (with alpha), not PNG: about 2 MB for all thirty (front, back, volume).
- **w_front** grows with the garment (≥ 1.12 × its front width). These garments are wider than the
  reference's, and at 15 vw the neighbours covered the hovered piece.
- **Rest yaw is perspective-corrected** so garments left and right of centre show the same sliver.
- **Hoodie** is an extra garment kind (spec lists tee / long sleeve / crewneck); the line-up is tees and hoodies because those are the pieces with reference renders.
- **Fabric is MeshPhysicalMaterial with sheen** over the photographed albedo, and each garment has body volume.
- **Drag-to-turn in the product view** reveals the back panel (the Liberty print lives on the back of #01).
- With a 4.65 vw rest pitch the row can't also leave only 4.8 vw of empty rail at each end (the
  brief asks for both); the pitch wins, so on desktop the row sits mid-rail and the end-bunching
  logic only engages when a parted row reaches a bracket.
- **Garment panels are 32 × 40** segments (brief: 32 × 1) so the cloth shader can bend them vertically.
- **SEE AVAILABILITY / CONTACT** link to the Instagram profile (orders by DM). No prices are shown.
