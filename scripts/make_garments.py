"""
Builds the ghost-mannequin garment mockups used on the rack.

Prints are cut from the brand's product photos (see `PHOTOS`), keyed off the
fabric they were shot on and composited onto procedurally drawn, shaded
garment silhouettes. Output: public/garments/NN-front.webp + NN-back.webp
(1000 x 1200, transparent).

    python3 scripts/make_garments.py <dir-with-1..5.png>
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 1000, 1200
SS = 2  # supersampling for silhouettes
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "garments")
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "scripts", "photos")


def photo(i):
    return Image.open(os.path.join(SRC, f"{i}.png")).convert("RGB")


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def blur(arr, r):
    """Gaussian blur of a float [0,1] array via 16-bit PIL image."""
    im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


# ------------------------------------------------------------------ prints


def print_logo():
    """KINTA(TM) wordmark from the white tee (photo 1) -> alpha mask."""
    im = photo(1).crop((152, 104, 338, 176))
    im = im.resize((im.width * 5, im.height * 5), Image.BICUBIC)
    a = np.asarray(im).astype(np.float32)
    alpha = 1 - smoothstep(95, 175, lum(a))
    return alpha


def print_liberty():
    """Back print of the white tee (photo 2), as a multiply layer."""
    im = photo(2).crop((108, 98, 403, 508))
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    # normalise against the (shadowed) fabric so the off-white disappears
    bg = np.stack([blur(a[..., c], 60) for c in range(3)], -1)
    bg = np.maximum(bg, np.percentile(a, 92, axis=(0, 1)) * 0.92)
    f = np.clip(a / np.maximum(bg, 1e-3), 0, 1)
    f = np.clip((f - 0.06) / 0.86, 0, 1) ** 1.15
    hh, ww = f.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww]
    edge = np.minimum.reduce([xx, ww - 1 - xx, yy, hh - 1 - yy]).astype(np.float32)
    feather = smoothstep(0, 18, edge)[..., None]
    return 1 - (1 - f) * feather  # multiply factor


def print_nai():
    """'The New African Icon' print (photo 3), black fabric keyed to alpha."""
    im = photo(3).crop((112, 112, 372, 420))
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    l = lum(a)
    alpha = smoothstep(30, 62, l)
    hh, ww = alpha.shape
    yy, xx = np.mgrid[0:hh, 0:ww]
    edge = np.minimum.reduce([xx, ww - 1 - xx, yy, hh - 1 - yy]).astype(np.float32)
    alpha *= smoothstep(0, 10, edge)
    return a / 255, alpha


def print_eagle():
    """Diamond eagle + Africa + RESTRICTED tag (photo 4), azure keyed out."""
    im = photo(4).crop((182, 160, 402, 436))
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    blueness = a[..., 2] - a[..., 0]
    alpha = 1 - smoothstep(55, 125, blueness)
    hh, ww = alpha.shape
    yy, xx = np.mgrid[0:hh, 0:ww]
    edge = np.minimum.reduce([xx, ww - 1 - xx, yy, hh - 1 - yy]).astype(np.float32)
    alpha *= smoothstep(0, 8, edge)
    # despill the blue fringe
    rgb = a.copy()
    cap = np.maximum(rgb[..., 0], rgb[..., 1]) + 12
    rgb[..., 2] = np.minimum(rgb[..., 2], cap)
    return rgb / 255, alpha


# ------------------------------------------------------------- silhouettes


def P(pts):
    return [(x * SS, y * SS) for x, y in pts]


def mirror(pts):
    return [(W - x, y) for x, y in reversed(pts)]


def bezier(p0, p1, p2, n=16):
    out = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        out.append((x, y))
    return out


NECK_L, NECK_R = (392, 40), (608, 40)


def outline(kind):
    """Left half (neck -> hem centre) of the garment outline, then mirrored."""
    if kind == "tee":
        left = (
            [NECK_L]
            + bezier((392, 40), (300, 60), (212, 92))
            + [(150, 205), (82, 322), (180, 392), (244, 330)]
            + bezier((244, 330), (240, 700), (236, 1072))
            + [(500, 1080)]
        )
    elif kind == "longsleeve":
        left = (
            [NECK_L]
            + bezier((392, 40), (300, 60), (214, 94))
            + [(158, 240), (128, 520), (112, 860), (106, 1012), (186, 1018), (204, 700), (232, 400), (252, 336)]
            + bezier((252, 336), (246, 720), (244, 1106))
            + [(500, 1112)]
        )
    else:  # crewneck / hoodie: blousy body, rib hem + cuffs
        left = (
            [NECK_L]
            + bezier((392, 40), (300, 60), (210, 96))
            + [(150, 250), (118, 540), (106, 880), (118, 1028), (122, 1086), (192, 1090), (196, 1030), (214, 720), (238, 420), (250, 340)]
            + bezier((250, 340), (232, 760), (246, 1092))
            + [(262, 1162), (500, 1166)]
        )
    return left[:-1] + [left[-1]] + mirror(left[:-1])


def neck_hole(kind):
    depth = {"tee": 122, "longsleeve": 118, "crewneck": 108, "hoodie": 108}[kind]
    return bezier(NECK_L, (500, depth + 18), NECK_R, 24) + bezier(NECK_R, (500, 70), NECK_L, 24)


def poly_mask(pts, blur_r=0.7):
    m = Image.new("L", (W * SS, H * SS), 0)
    ImageDraw.Draw(m).polygon(P(pts), fill=255)
    m = m.resize((W, H), Image.LANCZOS)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(blur_r))).astype(np.float32) / 255


def stroke_mask(lines, width, blur_r=0.8):
    m = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(m)
    for pts in lines:
        d.line(P(pts), fill=255, width=int(width * SS), joint="curve")
    m = m.resize((W, H), Image.LANCZOS)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(blur_r))).astype(np.float32) / 255


def dashed(pts, on=7, off=5):
    """Split a polyline into dash segments (stitching)."""
    out, acc, cur, draw = [], 0.0, [pts[0]], True
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        t = 0.0
        while t < seg:
            step = min((on if draw else off) - acc, seg - t)
            t += step
            acc += step
            p = (x0 + (x1 - x0) * t / seg, y0 + (y1 - y0) * t / seg)
            if draw:
                cur.append(p)
            if acc >= (on if draw else off) - 1e-6:
                if draw and len(cur) > 1:
                    out.append(cur)
                draw, acc, cur = not draw, 0.0, [p]
    return out


# ----------------------------------------------------------------- shading


def shading(kind, alpha, seed):
    rnd = random.Random(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u, v = (xx - 500) / 500, yy / H
    m = np.ones((H, W), np.float32)
    # soft key light from upper-left, falling off to the hem and the sides
    m *= 1.04 - 0.10 * v - 0.07 * u - 0.10 * u * u
    # vertical hanging folds, stronger toward the hem
    folds = np.zeros_like(m)
    for _ in range(7):
        fx = rnd.uniform(-0.55, 0.55)
        wdt = rnd.uniform(0.025, 0.07)
        amp = rnd.uniform(0.025, 0.06) * rnd.choice([-1, 1])
        start = rnd.uniform(0.25, 0.6)
        folds += amp * np.exp(-((u - fx - 0.05 * (v - start)) ** 2) / (2 * wdt * wdt)) * smoothstep(start, start + 0.25, v)
    # drag lines from the collar to the armpits
    for s in (-1, 1):
        d = (u * s - 0.28) - (0.55 - (v - 0.05) * 1.8) * 0.0
        line = np.exp(-(((v - 0.10) - (u * s - 0.12) * 0.55) ** 2) / (2 * 0.018 ** 2))
        folds -= 0.05 * line * smoothstep(0.1, 0.35, u * s) * (1 - smoothstep(0.5, 0.62, u * s))
    folds = blur(np.clip(folds * 2 + 0.5, 0, 1), 6) * 0.5 - 0.25
    m += folds
    # underarm shadows
    for s in (-1, 1):
        ax = 500 + s * 250
        m -= 0.10 * np.exp(-(((xx - ax) / 40) ** 2 + ((yy - 345) / 60) ** 2))
    # inner edge darkening = volume
    m *= 0.86 + 0.14 * blur(alpha, 18)
    return m


def compose(kind, color, prints_front, seed, back=False, back_print=None, piping=None):
    base = np.array(color, np.float32) / 255
    out_line = outline(kind)
    alpha = poly_mask(out_line)
    if kind == "hoodie" and not back:
        hood = poly_mask(bezier((300, 150), (292, 6), (500, 2), 24) + bezier((500, 2), (708, 6), (700, 150), 24) + [(560, 200), (440, 200)])
        alpha = np.maximum(alpha, hood)
    rgb = np.ones((H, W, 3), np.float32) * base

    def over(color_rgb, a):
        nonlocal rgb
        a = a[..., None]
        rgb = rgb * (1 - a) + color_rgb * a

    if not back:
        for p in prints_front:
            p(rgb, over)
    elif back_print is not None:
        back_print(rgb, over)

    # sleeve piping (track hoodie)
    if piping is not None:
        lines = []
        for s in (-1, 1):
            for off in (0, 34):
                pts = [(500 + s * (290 - off * 0.2), 110 + off * 0.3), (500 + s * (350 - off), 300), (500 + s * (372 - off * 1.05), 600), (500 + s * (365 - off * 1.1), 1020)]
                lines.append(pts)
        pm = stroke_mask(lines, 7) * alpha
        over(np.array(piping, np.float32) / 255, pm)

    m = shading(kind, alpha, seed + (100 if back else 0))
    lift = 0.10 if lum(base * 255) < 80 else 0.0
    rgb = rgb * m[..., None] + (m[..., None] - 1) * lift

    # seams, rib and stitching (slightly darker than the fabric)
    dark = 0.80 if lum(base * 255) > 80 else 0.70
    hi = 1.0 if lum(base * 255) > 80 else 1.25
    seams = []
    stitches = []
    if kind == "tee":
        seams += [bezier((212, 92), (236, 210), (244, 330)), bezier((788, 92), (764, 210), (756, 330))]
        stitches += [[(92, 310), (186, 372)], [(908, 310), (814, 372)], [(240, 1052), (500, 1058), (760, 1052)]]
    elif kind == "longsleeve":
        seams += [bezier((214, 94), (240, 220), (252, 336)), bezier((786, 94), (760, 220), (748, 336))]
        stitches += [[(108, 990), (188, 996)], [(892, 990), (812, 996)], [(246, 1086), (500, 1092), (754, 1086)]]
    else:
        seams += [bezier((210, 96), (236, 220), (250, 340)), bezier((790, 96), (764, 220), (750, 340))]
        seams += [[(120, 1030), (196, 1032)], [(880, 1030), (804, 1032)], [(250, 1096), (500, 1104), (750, 1096)]]
    sm = stroke_mask(seams, 3.2, 1.2) * alpha
    rgb *= (1 - sm[..., None] * (1 - dark))
    st = stroke_mask([d for s in stitches for d in dashed(s)], 2.2, 0.6) * alpha
    rgb *= (1 - st[..., None] * (1 - dark * 1.05))

    # rib on cuffs/hem for crew + hoodie
    if kind in ("crewneck", "hoodie"):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        rib = (0.5 + 0.5 * np.sin(xx * 0.9)) * 0.06
        band = ((yy > 1100) | ((yy > 1032) & ((xx < 200) | (xx > 800)))).astype(np.float32)
        rgb *= (1 - (rib * band * alpha)[..., None])

    # collar
    if not back:
        hole = poly_mask(neck_hole(kind), 0.8)
        depth = {"tee": 122, "longsleeve": 118, "crewneck": 108, "hoodie": 108}[kind]
        rib_w = 16 if kind == "tee" else 24
        collar = stroke_mask([bezier(NECK_L, (500, depth + 18), NECK_R, 40)], rib_w, 1.0)
        rgb *= (1 - collar[..., None] * (1 - (dark + 0.1)))
        edge = stroke_mask([bezier(NECK_L, (500, depth + 18 + rib_w), NECK_R, 40)], 2.0, 0.8)
        rgb *= (1 - edge[..., None] * (1 - dark))
        if kind == "hoodie":
            # hood: lining visible inside the opening + drawstrings
            lining_pts = bezier((352, 128), (350, 30), (500, 30), 24) + bezier((500, 30), (650, 30), (648, 128), 24) + [(500, 176)]
            lining = poly_mask(lining_pts, 1.2)
            yy_, _ = np.mgrid[0:H, 0:W].astype(np.float32)
            depth_shade = 0.42 + 0.28 * smoothstep(30, 176, yy_)
            rgb *= (1 - (lining * (1 - depth_shade))[..., None])
            rim = stroke_mask([lining_pts + [lining_pts[0]]], 7, 2.0)
            rgb *= (1 - rim[..., None] * (1 - dark))
            alpha = np.maximum(alpha, lining)
            hole = hole * 0
            cords = stroke_mask([[(462, 168), (458, 300), (452, 470)], [(538, 168), (544, 300), (550, 486)]], 8, 0.7)
            over(np.array([0.06, 0.06, 0.07]), cords)
            flecks = stroke_mask([[(457, y), (457, y + 4)] for y in range(180, 466, 16)] + [[(546, y + 7), (546, y + 11)] for y in range(180, 480, 16)], 6, 0.5)
            over(np.array([0.92, 0.92, 0.92]), flecks * cords)
            aglets = stroke_mask([[(452, 470), (451, 496)], [(550, 486), (551, 512)]], 10, 0.6)
            over(np.array([0.08, 0.08, 0.09]), aglets)
        alpha = alpha * (1 - hole)
    else:
        # back: collar rib along a shallow back neck
        collar = stroke_mask([bezier(NECK_L, (500, 70), NECK_R, 40)], 14, 1.0)
        rgb *= (1 - collar[..., None] * (1 - (dark + 0.1)))

    # fabric grain
    rng = np.random.default_rng(seed)
    grain = rng.normal(0, 0.007, (H, W)).astype(np.float32)
    rgb = rgb + grain[..., None] * (0.6 if lum(base * 255) > 80 else 1.0)
    rgb = np.clip(rgb, 0, 1)
    out = np.dstack([rgb * 255, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


# --------------------------------------------------------------- placement

LOGO = None
LIB = None
NAI = None
EAGLE = None


def place(arr, cx, top, width):
    """Resize a [H,W(,C)] float array to `width` px and return (arr, x0, y0)."""
    hh, ww = arr.shape[:2]
    nh = int(round(hh * width / ww))
    if arr.ndim == 2:
        im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), "L").resize((width, nh), Image.LANCZOS)
        r = np.asarray(im).astype(np.float32) / 255
    else:
        im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), "RGB").resize((width, nh), Image.LANCZOS)
        r = np.asarray(im).astype(np.float32) / 255
    return r, int(cx - width / 2), int(top)


def full(r, x0, y0):
    f = np.zeros((H, W) + r.shape[2:], np.float32)
    f[y0 : y0 + r.shape[0], x0 : x0 + r.shape[1]] = r
    return f


def logo_print(ink, cx=500, top=210, width=250):
    def apply(rgb, over):
        r, x0, y0 = place(LOGO, cx, top, width)
        over(np.array(ink, np.float32) / 255, full(r, x0, y0))
    return apply


def liberty_print(rgb_, over):
    r, x0, y0 = place(LIB, 500, 150, 360)
    f = np.ones((H, W, 3), np.float32)
    f[y0 : y0 + r.shape[0], x0 : x0 + r.shape[1]] = r
    rgb_ *= f


def nai_print(rgb_, over):
    rgb, a = NAI
    r, x0, y0 = place(rgb, 500, 168, 330)
    ra, _, _ = place(a, 500, 168, 330)
    over(full(r, x0, y0), full(ra, x0, y0))


def eagle_print(rgb_, over):
    rgb, a = EAGLE
    r, x0, y0 = place(rgb, 505, 172, 320)
    ra, _, _ = place(a, 505, 172, 320)
    over(full(r, x0, y0), full(ra, x0, y0))


BONE = (238, 235, 229)
BLACK = (26, 26, 28)
PRODUCTS = [
    # id, kind, colour, front prints, back print, piping
    ("01", "tee", BONE, [logo_print((22, 22, 24))], liberty_print, None),
    ("02", "tee", BLACK, [nai_print], None, None),
    ("03", "tee", (21, 150, 222), [eagle_print], None, None),
    ("04", "hoodie", (167, 199, 229), [logo_print((20, 22, 30), top=228, width=120)], None, (40, 52, 92)),
    ("05", "crewneck", (34, 60, 46), [logo_print((236, 233, 226), top=220, width=260)], None, None),
    ("06", "longsleeve", BLACK, [nai_print], None, None),
    ("07", "tee", (204, 188, 160), [logo_print((26, 24, 22))], None, None),
    ("08", "tee", (30, 30, 33), [eagle_print], None, None),
    ("09", "hoodie", (40, 48, 82), [logo_print((238, 236, 230), top=228, width=120)], None, (167, 199, 229)),
    ("10", "tee", (82, 88, 98), [logo_print((236, 233, 226))], None, None),
]


def main():
    global LOGO, LIB, NAI, EAGLE
    os.makedirs(OUT, exist_ok=True)
    LOGO = print_logo()
    LIB = print_liberty()
    NAI = print_nai()
    EAGLE = print_eagle()
    # the wordmark on its own, for the site logo
    Image.fromarray((LOGO * 255).astype(np.uint8), "L").save(os.path.join(ROOT, "scripts", "kinta-wordmark-mask.png"))
    for i, (pid, kind, col, fronts, backp, piping) in enumerate(PRODUCTS):
        front = compose(kind, col, fronts, seed=i * 7 + 3, piping=piping)
        back = compose(kind, col, [], seed=i * 7 + 3, back=True, back_print=backp, piping=piping)
        front.save(os.path.join(OUT, f"{pid}-front.webp"), quality=88, method=6)
        back.save(os.path.join(OUT, f"{pid}-back.webp"), quality=86, method=6)
        print("wrote", pid, kind)


if __name__ == "__main__":
    main()
