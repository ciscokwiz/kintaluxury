"""
Photoreal garment textures for the rack, built from the brand's ghost-mannequin
mockups (scripts/photos/ref-11..14.webp).

  ref-11  "The New African Icon" tee, black          -> #02 front
  ref-12  Kinta hoodie (peach), with joggers         -> #04 / #08 / #09 (recoloured)
  ref-14  KINTA(TM) tee front + Liberty back          -> #01 and every recoloured tee
  photo 2 the real Liberty back print (correct text) -> replaces the mockup's garbled one
  photo 4 Restricted diamond eagle                   -> #03 / #06

Two defects in the mockups are corrected, not copied:
  * the hoodie chest reads "KIATA." -> replaced with the KINTA wordmark
  * the Liberty quote is garbled AI text -> replaced with the print from the real photo

Outputs, per product NN (1000 x 1200, transparent):
  public/garments/NN-front.webp, NN-back.webp   albedo with baked studio shading
  public/garments/NN-vol.png                    body volume (0 at the silhouette, 1 inside),
                                                used by the vertex shader to give the panels depth
  lib/garmentManifest.json                      hem position per product

    python3 scripts/make_photoreal.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "photos")
OUT = os.path.join(ROOT, "public", "garments")
DEBUG = os.environ.get("GARMENT_DEBUG")
W, H = 1000, 1200

# ------------------------------------------------------------------ utils


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32) / 255


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def box(a, r):
    """Box blur (separable, cumulative sums), edge-clamped. Works on 2D or HxWxC."""
    r = int(max(1, r))
    out = a.astype(np.float32)
    for axis in (0, 1):
        pad = [(0, 0)] * out.ndim
        pad[axis] = (r + 1, r)
        p = np.pad(out, pad, mode="edge")
        c = np.cumsum(p, axis=axis)
        n = out.shape[axis]
        hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
        lo = np.take(c, np.arange(0, n), axis=axis)
        out = (hi - lo) / (2 * r + 1)
    return out


def gblur(a, r):
    """~Gaussian blur of radius r (three box passes)."""
    k = max(1, int(round(r / 1.73)))
    return box(box(box(a, k), k), k)


def to_img(a, alpha=None):
    rgb = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    if alpha is None:
        return Image.fromarray(rgb, "RGB")
    al = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, al]), "RGBA")


def mask_img(m):
    return Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8), "L").copy()


def dilate(m, px):
    im = mask_img(m)
    for _ in range(px):
        im = im.filter(ImageFilter.MaxFilter(3))
    return np.asarray(im).astype(np.float32) / 255


def erode(m, px):
    im = mask_img(m)
    for _ in range(px):
        im = im.filter(ImageFilter.MinFilter(3))
    return np.asarray(im).astype(np.float32) / 255


def matte(a, tol):
    """Background = pixels near the border colour that connect to the border."""
    border = np.concatenate([a[:6].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = np.sqrt(((a - bg) ** 2).sum(-1)) * 255
    m = mask_img((d < tol).astype(np.float32))
    h, w = a.shape[:2]
    for c in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2)]:
        if m.getpixel(c) == 255:
            ImageDraw.floodfill(m, c, 128)
    fg = (np.asarray(m) != 128).astype(np.float32)
    # drop tiny islands / fill pinholes
    fg = erode(dilate(fg, 2), 2)
    fg = dilate(erode(fg, 1), 1)
    return fg


def soft(alpha):
    """Anti-aliased edge, pulled in a pixel so no background fringe survives."""
    return np.clip(gblur(erode(alpha, 1), 1.2) * 1.08, 0, 1)


def inpaint(a, hole, texture_from=(0, 0)):
    """Fill `hole` (bool-ish mask) from its surroundings, then restore the knit texture."""
    hole = hole > 0.5
    known = (~hole).astype(np.float32)
    fill = a.copy()
    for r in (96, 48, 24, 12, 6, 3):
        num = gblur(fill * known[..., None], r)
        den = gblur(known, r)[..., None]
        est = num / np.maximum(den, 1e-4)
        upd = hole & (den[..., 0] > 0.02)
        fill[upd] = est[upd]
        known = np.maximum(known, upd.astype(np.float32) * 0.5)
    # fabric grain borrowed from a nearby patch
    hp = a - gblur(a, 3)
    dy, dx = texture_from
    hp_s = np.roll(np.roll(hp, dy, 0), dx, 1)
    fill[hole] = fill[hole] + hp_s[hole]
    return fill


def patch_fill(a, hole, shift, exclude=None):
    """Fill `hole` with real fabric copied from `shift` (dy, dx) away, brightness-matched to the
    surroundings (the low-frequency difference is diffused in from the hole's border)."""
    hole = hole > 0.5
    ex = np.zeros(hole.shape, bool) if exclude is None else exclude > 0.5
    dy, dx = shift
    shifted = np.roll(np.roll(a, dy, 0), dx, 1)
    ex_src = np.roll(np.roll(ex, dy, 0), dx, 1)
    known = ((~hole) & (~ex)).astype(np.float32)
    ring = known * (dilate(hole.astype(np.float32), 8) > 0.5)
    diff = (a - shifted) * ring[..., None]
    den = gblur(ring, 10)[..., None]
    corr = np.clip(gblur(diff, 10) / np.maximum(den, 1e-4), -0.05, 0.05) * (den > 0.02)
    out = a.copy()
    fill = shifted + corr
    smooth = inpaint(a, hole.astype(np.float32) * 1.0, texture_from=(0, 0)) if ex_src[hole].any() else fill
    use = hole & ~ex_src
    out[use] = fill[use]
    rest = hole & ex_src
    out[rest] = smooth[rest]
    return out


def mirror_x(a, cx):
    """Mirror an array about column cx."""
    w = a.shape[1]
    xs = np.clip(np.round(2 * cx - np.arange(w)).astype(int), 0, w - 1)
    return a[:, xs]


def collar_center(alpha, x0, x1):
    cols = alpha[:, x0:x1]
    rows = np.where(cols.max(1) > 0.5)[0]
    top = rows[0]
    band = cols[top + 25 : top + 60]
    xs = np.where(band.max(0) > 0.5)[0]
    # the neck opening: centre of the first band's extent is biased; use the band's mean
    return x0 + (xs.min() + xs.max()) / 2, top


def normalise(rgb, alpha, top_px, hem_px, width_hint=None, top_target=40, hem_target=1080):
    """Scale + place the garment so its top sits at `top_target` and hem at `hem_target`."""
    ys, xs = np.where(alpha > 0.5)
    x0, x1 = xs.min(), xs.max()
    s = (hem_target - top_target) / (hem_px - top_px)
    cx = (x0 + x1) / 2 if width_hint is None else width_hint
    im = to_img(rgb, np.clip(gblur(alpha, 0.8), 0, 1))
    nw, nh = int(round(im.width * s)), int(round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ox = int(round(W / 2 - cx * s))
    oy = int(round(top_target - top_px * s))
    canvas.paste(im, (ox, oy), im)
    arr = np.asarray(canvas).astype(np.float32) / 255
    return arr[..., :3], arr[..., 3], (s, ox, oy)


def warp(mask, xf):
    """Apply a normalise() transform to a 2D source mask."""
    s, ox, oy = xf
    im = mask_img(mask)
    im = im.resize((int(round(im.width * s)), int(round(im.height * s))), Image.BILINEAR)
    canvas = Image.new("L", (W, H), 0)
    canvas.paste(im, (ox, oy))
    return np.asarray(canvas).astype(np.float32) / 255


def unpremultiply_edges(rgb, alpha):
    """Extend colour beyond the silhouette so filtering never pulls in black."""
    inside = alpha > 0.6
    fill = rgb.copy()
    known = inside.astype(np.float32)
    for r in (2, 4, 8, 16, 32):
        num = gblur(fill * known[..., None], r)
        den = gblur(known, r)[..., None]
        upd = (~inside) & (den[..., 0] > 0.01) & (known < 0.5)
        est = num / np.maximum(den, 1e-4)
        fill[upd] = est[upd]
        known = np.maximum(known, upd.astype(np.float32))
    return np.where(inside[..., None], rgb, fill)


# --------------------------------------------------------------- sources


def tee_from_ref14():
    a = load("ref-14.webp")
    fg = matte(a, 7)
    # search windows that hold only one tee's collar each
    cf, top_f = collar_center(fg, 120, 470)
    cb, top_b = collar_center(fg, 620, 920)

    xx = np.arange(a.shape[1])[None, :].astype(np.float32)
    band = 200  # around the centre line both tees are fully visible (logo, print)

    # front: its left half is never occluded -> the right sleeve/side is its mirror
    left = fg.copy()
    left[:, int(cf) + 2 :] = 0
    front_a = np.maximum(left, mirror_x(left, cf))
    keep = smoothstep(cf + band + 12, cf + band - 12, xx)[..., None]  # 1 = original pixels
    front_rgb = a * keep + mirror_x(a, cf) * (1 - keep)

    # back: right half never occluded; the hidden left sleeve is rebuilt from its mirror
    right = fg.copy()
    right[:, : int(cb) - 1] = 0
    back_a = np.maximum(right, mirror_x(right, cb))
    # the mockup's back print (with garbled text) is erased here; the real one goes back on later
    yy = np.arange(a.shape[0])[:, None].astype(np.float32)
    rect = ((xx >= 552) & (xx <= 890) & (yy >= 254) & (yy <= 712)).astype(np.float32)
    hole = rect * (fg > 0.5)
    a_back = inpaint(a, hole, texture_from=(0, 0))
    knit = a - gblur(a, 3)
    patch = knit[722:812, 640:860]
    tiled = np.tile(patch, (int(np.ceil(a.shape[0] / patch.shape[0])), int(np.ceil(a.shape[1] / patch.shape[1])), 1))
    tiled = tiled[: a.shape[0], : a.shape[1]]
    a_back = np.where(hole[..., None] > 0.5, gblur(a_back, 8) + tiled, a_back)
    keep_b = smoothstep(cb - band - 12, cb - band + 12, xx)[..., None]
    back_rgb = a_back * keep_b + mirror_x(a_back, cb) * (1 - keep_b)

    hem_f = np.where(front_a.max(1) > 0.5)[0].max()
    hem_b = np.where(back_a.max(1) > 0.5)[0].max()
    return front_rgb, front_a, (cf, top_f, hem_f), back_rgb, back_a, (cb, top_b, hem_b)


def nai_from_ref11():
    a = load("ref-11.webp")
    fg = matte(a, 12)
    cx, top = collar_center(fg, 0, a.shape[1])
    hem = np.where(fg.max(1) > 0.5)[0].max()
    return a, fg, (cx, top, hem)


def hoodie_from_ref12():
    a = load("ref-12.webp")
    fg = matte(a, 18)
    # cut the joggers off below the hem band (the cuffs hang lower, outside it)
    yy, xx = np.mgrid[0 : a.shape[0], 0 : a.shape[1]]
    hem_line = 887 - (xx - 300) * 0.02
    joggers = (xx > 268) & (xx < 742) & (yy > hem_line)
    fg = fg * (~joggers)
    fg = dilate(erode(fg, 2), 2)
    rows = np.where(fg.max(1) > 0.5)[0]
    top = rows[0]
    xs = np.where(fg[top : top + 40].max(0) > 0.5)[0]
    cx = (xs.min() + xs.max()) / 2
    bottom = np.where(fg.max(1) > 0.5)[0].max()
    return a, fg, (cx, top, bottom)


# ----------------------------------------------------------------- prints


def liberty_print():
    """Authentic back print from photo 2 (correct text), as a multiply layer."""
    im = Image.open(os.path.join(SRC, "2.png")).convert("RGB").crop((108, 98, 403, 508))
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    p = np.asarray(im).astype(np.float32) / 255
    bg = gblur(p, 60)
    bg = np.maximum(bg, np.percentile(p, 92, axis=(0, 1)) * 0.92)
    f = np.clip(p / np.maximum(bg, 1e-3), 0, 1)
    f = np.clip((f - 0.06) / 0.86, 0, 1) ** 1.15
    hh, ww = f.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww]
    edge = np.minimum.reduce([xx, ww - 1 - xx, yy, hh - 1 - yy]).astype(np.float32)
    feather = smoothstep(0, 18, edge)[..., None]
    return 1 - (1 - f) * feather


def eagle_print():
    im = Image.open(os.path.join(SRC, "4.png")).convert("RGB").crop((182, 160, 402, 436))
    im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
    p = np.asarray(im).astype(np.float32)
    blueness = p[..., 2] - p[..., 0]
    alpha = 1 - smoothstep(55, 125, blueness)
    hh, ww = alpha.shape
    yy, xx = np.mgrid[0:hh, 0:ww]
    edge = np.minimum.reduce([xx, ww - 1 - xx, yy, hh - 1 - yy]).astype(np.float32)
    alpha *= smoothstep(0, 10, edge)
    rgb = p.copy()
    rgb[..., 2] = np.minimum(rgb[..., 2], np.maximum(rgb[..., 0], rgb[..., 1]) + 12)
    return rgb / 255, alpha


def resize_arr(arr, w):
    h = int(round(arr.shape[0] * w / arr.shape[1]))
    if arr.ndim == 2:
        return np.asarray(mask_img(arr).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    return np.asarray(to_img(arr).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255


def place(layer, cx, top):
    """Put a (h, w[, c]) layer onto a W x H canvas, centred on cx."""
    out = np.zeros((H, W) + layer.shape[2:], np.float32)
    x0 = int(round(cx - layer.shape[1] / 2))
    out[top : top + layer.shape[0], x0 : x0 + layer.shape[1]] = layer
    return out


# ---------------------------------------------------------------- recolour


def shading(rgb, alpha, protect=None):
    L = lum(rgb)
    sel = alpha > 0.9
    if protect is not None:
        sel &= protect < 0.5
    base = np.median(L[sel])
    return L / base


def recolour(rgb, alpha, colour, protect=None, S=None):
    c = np.array(colour, np.float32) / 255
    if S is None:
        S = shading(rgb, alpha, protect)
    dark = 1 - lum(c[None, None, :])[0, 0]
    gain = 1 + 0.9 * dark  # dark cloth needs more fold contrast to read
    S2 = 1 + (S - 1) * gain
    out = c[None, None, :] * S2[..., None] + (0.22 * dark) * (S2 - 1)[..., None]
    if protect is not None:
        out = np.where(protect[..., None] > 0.5, rgb, out)
    return np.clip(out, 0, 1), S


# ------------------------------------------------------------------ volume


def volume_map(alpha, depth_px=110, size=(250, 300)):
    """Distance from the silhouette, shaped like a rounded body (0 at the edge, 1 inside)."""
    small = np.asarray(mask_img(alpha).resize(size, Image.BILINEAR)).astype(np.float32) / 255
    m = (small > 0.5).astype(np.float32)
    steps = int(depth_px * size[0] / W) + 1
    d = np.zeros_like(m)
    cur = mask_img(m)
    for _ in range(steps):
        d += np.asarray(cur).astype(np.float32) / 255
        cur = cur.filter(ImageFilter.MinFilter(3))
    t = np.clip(d / steps, 0, 1)
    # 1 - (1 - t)^2 rises with a finite slope at the outline, so grazing views don't sawtooth
    h = 1 - (1 - t) ** 2
    h = gblur(h, 2.5) * m
    return Image.fromarray((h * 255).astype(np.uint8), "L")


# --------------------------------------------------------------------- main


def save(pid, front_rgb, front_a, back_rgb, back_a, manifest, kind):
    front_a = soft(front_a)
    back_a = soft(back_a)
    front_rgb = unpremultiply_edges(front_rgb, front_a)
    back_rgb = unpremultiply_edges(back_rgb, back_a)
    to_img(front_rgb, front_a).save(os.path.join(OUT, f"{pid}-front.webp"), quality=90, method=6)
    to_img(back_rgb, back_a).save(os.path.join(OUT, f"{pid}-back.webp"), quality=86, method=6)
    volume_map(front_a).save(os.path.join(OUT, f"{pid}-vol.png"), optimize=True)
    rows = np.where(front_a.max(1) > 0.5)[0]
    manifest[pid] = {"kind": kind, "top": int(rows[0]), "hem": int(rows.max())}
    print("wrote", pid, kind, manifest[pid])


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}

    # ---- tee base (ref 14) ------------------------------------------------
    a14, fa, (cf, tf, hf), brgb, ba, (cb, tb, hb) = tee_from_ref14()
    tee_f_rgb, tee_f_a, _ = normalise(a14, fa, tf, hf, width_hint=cf)
    # back: same scale as the front, then given the front's (mirrored) silhouette so both panels close
    tee_b_rgb, tee_b_a0, xf_b = normalise(brgb, ba, tb, hb, width_hint=cb)
    # the mockup draws the back tee a touch smaller than the front: match the widths
    def xspan(al):
        xs = np.where(al.max(0) > 0.5)[0]
        return xs.min(), xs.max()
    fx0, fx1 = xspan(tee_f_a)
    bx0, bx1 = xspan(tee_b_a0)
    k = (fx1 - fx0) / max(1, bx1 - bx0)
    if abs(k - 1) > 0.005:
        nw = int(round(W * k))
        def stretch(arr):
            im = to_img(arr) if arr.ndim == 3 else mask_img(arr)
            im = im.resize((nw, H), Image.LANCZOS)
            out = np.asarray(im).astype(np.float32) / 255
            x0 = (nw - W) // 2
            return out[:, x0 : x0 + W] if nw >= W else np.pad(out, [(0, 0), (-x0, W - nw + x0)] + ([(0, 0)] if arr.ndim == 3 else []))
        tee_b_rgb = stretch(tee_b_rgb)
        tee_b_a0 = stretch(tee_b_a0)
        sb_, oxb_, oyb_ = xf_b
        xf_b = (sb_, oxb_, oyb_, k)
    # both panels share one outline (so they close at the sides): where the two mockups disagree, keep the overlap
    tee_b_a = np.minimum(tee_f_a[:, ::-1], np.clip(gblur(tee_b_a0, 1.0) * 1.1, 0, 1))
    tee_b_rgb = unpremultiply_edges(tee_b_rgb, tee_b_a0)

    # KINTA(TM) logo: its own alpha (crisp, from the mockup), then erased for a blank tee
    L = lum(tee_f_rgb)
    # the wordmark = the rows on the chest with a dense run of near-black pixels
    dark = (L < 0.3) & (tee_f_a > 0.95)
    band = np.where(dark[:, 250:800].sum(1) > 15)[0]
    band = band[(band > 150) & (band < 500)]
    cols = np.where(dark[band.min() : band.max() + 1].sum(0) > 0)[0]
    zone = np.zeros_like(L)
    zone[band.min() - 6 : band.max() + 7, cols.min() - 6 : cols.max() + 7] = 1
    logo_a = smoothstep(0.42, 0.18, L) * zone * (tee_f_a > 0.9)
    ys, xs = np.where(logo_a > 0.3)
    logo_box = (ys.min(), ys.max(), xs.min(), xs.max())
    tee_blank = inpaint(tee_f_rgb, dilate(logo_a > 0.05, 4), texture_from=(150, 0))
    logo_alpha = logo_a[logo_box[0] - 4 : logo_box[1] + 5, logo_box[2] - 4 : logo_box[3] + 5]
    logo_cx = (logo_box[2] + logo_box[3]) / 2
    logo_top = logo_box[0] - 4

    tee_back_blank = tee_b_rgb
    S_front = shading(tee_blank, tee_f_a)
    S_back = shading(tee_back_blank, tee_b_a)

    def logo_on(rgb, S, ink):
        lay = place(logo_alpha, logo_cx, logo_top)
        ink = np.array(ink, np.float32) / 255
        shaded = ink[None, None, :] * np.clip(S, 0.6, 1.15)[..., None]
        return rgb * (1 - lay[..., None]) + shaded * lay[..., None]

    eagle_rgb, eagle_a = eagle_print()
    eagle_w = 360

    def eagle_on(rgb, S):
        er = resize_arr(eagle_rgb, eagle_w)
        ea = resize_arr(eagle_a, eagle_w)
        lay_a = place(ea, 505, 200)
        lay = place(er, 505, 200)
        shaded = lay * np.clip(S, 0.7, 1.1)[..., None]
        return rgb * (1 - lay_a[..., None]) + shaded * lay_a[..., None]

    # #01 Liberty tee: mockup front as-is, back = blank back + the real print
    lib = liberty_print()
    sb, oxb, oyb = xf_b[:3]
    kx = xf_b[3] if len(xf_b) > 3 else 1.0
    lib_r = resize_arr(lib, int(round(330 * sb * kx)))
    lib_full = np.ones((H, W, 3), np.float32)
    top = int(round(oyb + 262 * sb))
    x0 = int(round(W / 2 - lib_r.shape[1] / 2))
    h = min(lib_r.shape[0], H - top)
    lib_full[top : top + h, x0 : x0 + lib_r.shape[1]] = lib_r[:h]
    liberty_back = tee_back_blank * lib_full
    save("01", tee_f_rgb, tee_f_a, liberty_back, tee_b_a, manifest, "tee")

    # #02 New African Icon tee (ref 11), back = blank back in black
    a11, f11, (c11, t11, h11) = nai_from_ref11()
    nai_rgb, nai_a, _ = normalise(a11, f11, t11, h11, width_hint=c11)
    black_back, _ = recolour(tee_back_blank, tee_b_a, (26, 26, 28), S=S_back)
    save("02", nai_rgb, nai_a, black_back, nai_a[:, ::-1].copy(), manifest, "tee")

    # recoloured tees
    tees = {
        "03": ((21, 150, 222), "eagle", None),
        "05": ((34, 60, 46), "logo", (236, 233, 226)),
        "06": ((28, 28, 30), "eagle", None),
        "07": ((204, 188, 160), "logo", (24, 22, 20)),
        "10": ((82, 88, 98), "logo", (236, 233, 226)),
    }
    for pid, (col, print_kind, ink) in tees.items():
        f_rgb, _ = recolour(tee_blank, tee_f_a, col, S=S_front)
        b_rgb, _ = recolour(tee_back_blank, tee_b_a, col, S=S_back)
        f_rgb = eagle_on(f_rgb, S_front) if print_kind == "eagle" else logo_on(f_rgb, S_front, ink)
        save(pid, f_rgb, tee_f_a, b_rgb, tee_b_a, manifest, "tee")

    # ---- hoodie (ref 12) --------------------------------------------------
    a12, f12, (c12, t12, b12) = hoodie_from_ref12()
    # the drawstrings (slanted, ~8 px wide) and the "KIATA." text, in source pixels
    yy, xx = np.mgrid[0 : a12.shape[0], 0 : a12.shape[1]].astype(np.float32)

    def seg_dist(x0, y0, x1, y1):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / (dx * dx + dy * dy), 0, 1)
        return np.sqrt((xx - x0 - t * dx) ** 2 + (yy - y0 - t * dy) ** 2)

    strings_src = ((seg_dist(436, 250, 420.5, 372) < 4.6) | (seg_dist(511, 250, 502.5, 372) < 4.6)).astype(np.float32)
    L12 = lum(a12)
    text = np.zeros_like(L12)
    text[296:326, 426:506] = 1
    text *= (L12 < 0.5) * (dilate(strings_src, 1) < 0.5)
    clean12 = patch_fill(a12, dilate(text, 3) * (strings_src < 0.5), (-38, 0), exclude=dilate(strings_src, 1))

    hd_clean, hd_a, xf = normalise(clean12, f12, t12, b12, width_hint=c12, top_target=14, hem_target=1186)
    hd_orig, _, _ = normalise(a12, f12, t12, b12, width_hint=c12, top_target=14, hem_target=1186)
    Lh = lum(hd_clean)
    sat = hd_clean.max(-1) - hd_clean.min(-1)
    # everywhere else the strings / eyelets / aglets are the dark, unsaturated pixels
    band_strings = warp(dilate(strings_src, 2), xf)
    low_sat = smoothstep(0.12, 0.06, sat)
    strings = np.maximum(low_sat * (Lh < 0.55), low_sat * band_strings) * (hd_a > 0.5)
    S_h = shading(hd_clean, hd_a, protect=dilate(strings > 0.5, 1))

    # KINTA. wordmark (the tee's logo without the TM, plus a full stop) between the strings
    sc, ox, oy = xf
    hd_logo_w = int(round(64 * sc))
    # drop the TM: it is the last run of columns, separated from the wordmark by a gap
    cols = logo_alpha.max(0) > 0.08
    runs, start = [], None
    for x, on in enumerate(list(cols) + [False]):
        if on and start is None:
            start = x
        if not on and start is not None:
            runs.append((start, x))
            start = None
    word = logo_alpha[:, : runs[-2][1] + 2] if len(runs) > 1 and runs[-1][1] - runs[-1][0] < 0.15 * logo_alpha.shape[1] else logo_alpha
    hd_logo = resize_arr(word, hd_logo_w).copy()
    hd_logo_cx = ox + 463 * sc
    hd_logo_top = int(round(oy + 311 * sc - hd_logo.shape[0] * 0.55))
    yyN, xxN = np.mgrid[0:H, 0:W].astype(np.float32)
    dot_r = max(3.0, hd_logo.shape[0] * 0.11)
    dot_x = hd_logo_cx + hd_logo.shape[1] * 0.5 + dot_r * 1.5
    dot_y = hd_logo_top + hd_logo.shape[0] - dot_r * 1.2
    dot = smoothstep(dot_r + 1, dot_r - 1, np.sqrt((yyN - dot_y) ** 2 + (xxN - dot_x) ** 2))

    def hoodie(colour, ink):
        if colour is None:
            rgb = hd_clean.copy()
        else:
            rgb, _ = recolour(hd_clean, hd_a, colour, S=S_h)
            rgb = rgb * (1 - strings[..., None]) + hd_clean * strings[..., None]
        lay = np.maximum(place(hd_logo, hd_logo_cx, hd_logo_top), dot)
        inkc = np.array(ink, np.float32) / 255
        shaded = inkc[None, None, :] * np.clip(S_h, 0.6, 1.2)[..., None]
        rgb = rgb * (1 - lay[..., None]) + shaded * lay[..., None]
        # the strings hang over the print
        sat_o = hd_orig.max(-1) - hd_orig.min(-1)
        sm = (warp(strings_src, xf) * smoothstep(0.13, 0.07, sat_o))[..., None]
        rgb = rgb * (1 - sm) + hd_orig * sm
        # back: no strings, no logo -> mirrored blank
        back_src = hd_clean if colour is None else recolour(hd_clean, hd_a, colour, S=S_h)[0]
        back = inpaint(back_src, dilate(strings, 3), texture_from=(0, 24))[:, ::-1]
        return rgb, back

    for pid, col, ink in (("04", (167, 199, 229), (24, 28, 44)), ("08", None, (22, 20, 20)), ("09", (40, 48, 82), (236, 233, 226))):
        f_rgb, b_rgb = hoodie(col, ink)
        save(pid, f_rgb, hd_a, b_rgb, hd_a[:, ::-1].copy(), manifest, "hoodie")

    with open(os.path.join(ROOT, "lib", "garmentManifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    if DEBUG:
        sheet = Image.new("RGB", (5 * 300, 2 * 360), (223, 223, 220))
        for k, pid in enumerate(sorted(manifest)):
            im = Image.open(os.path.join(OUT, f"{pid}-front.webp")).resize((300, 360))
            sheet.paste(im, ((k % 5) * 300, (k // 5) * 360), im)
        sheet.save(DEBUG)


if __name__ == "__main__":
    main()
