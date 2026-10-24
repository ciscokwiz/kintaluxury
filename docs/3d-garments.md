# Reviewed garment assets

`public/models/kinta/` contains the reviewed Liberty tee and logo hoodie as
glTF 2.0 binaries. The catalogue matches the supplied collection sheet: seven
tees and three hoodies, across five design families. Artwork comes from the
original Kinta images, with Liberty's front and back preserved. Other backs
are plain because only fronts were supplied.

| Model | Rack/mobile triangles | Desktop detail triangles |
| --- | ---: | ---: |
| Tee | 11,604 | 32,600 |
| Hoodie | 15,708 | 38,080 |

The GLBs embed the neutral base materials, normal, roughness and ambient
occlusion maps. Meshopt compression is decoded by Three.js's bundled decoder.
Variant base-color maps are lossless WebP: 1K on the rack and mobile, 2K in
desktop detail. They replace only albedo, keeping the model's normal and AO UV
channels intact. Lighting is supplied by the studio scene.

`Cotton_Jersey` receives the printed map. Cotton interior, hood, hood lining,
and `Collar_Rib` receive the matching plain map, so changing color also changes
the collar, cuffs and lining. `Double_Stitch_Thread` is tinted to the fabric.
Drawstrings and metal eyelets retain their own materials.

`GarmentModel.tsx` clones materials and morph weights for each instance while
sharing cached geometry and textures. Cached source materials and geometry are
never disposed when a garment changes. The desktop detail mesh loads on
demand, with the rack mesh shown while loading. Mobile reuses the lighter
mesh and textures. Both levels use the same support origin, dimensions and UV
registration.

## Motion and hanging

The four morph controls are `SlideLeftLag`, `SlideRightLag`, `TurnClockwise`,
and `TurnCounterclockwise`. Three example animation clips are included in the
assets; the website directly drives the morphs using actual slide and turn
velocity, clamps weights to 0–1, and damps them to zero when motion stops.
There is no looping wind or breathing animation. Reduced-motion preferences
suppress deformation. The optional `?tune` panel adjusts the two movement gains.

Asset coordinates are metres. `MODEL_SHAPES` documents the bounding dimensions
and collar-to-hanger offsets. The outer group pivots at the rail hook. Tees
and hoodies have separately fitted hanger stems; the hood does not need to be
flattened to fit the tee's hanger. The close-up hides the hanger initially,
with Show/Hide hanger available in the overlay.

## Catalogue identity

Product IDs are independent of rack positions. Existing Onyx links and bags
retain ID `08`; Peach uses new ID `11`. The former long-sleeve placeholder
`06` is retired rather than reassigned to another item. Legacy crewneck and
long-sleeve routes resolve to their corrected tee designs. Price, stock and
Instagram enquiry behavior are unchanged.

Run `npm run test:rack` for catalogue, model packaging, layout, hook contact,
and motion/settling checks. `npm run garments` regenerates the separate 2D
product mockups; it does not regenerate the GLBs.
