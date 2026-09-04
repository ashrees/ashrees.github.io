#!/usr/bin/env python3
"""
make_figures.py — synthesise animated depth-map sprite sheets for the dot field.

    python3 scripts/make_figures.py            # all of them
    python3 scripts/make_figures.py galaxy     # just one

Writes public/figures/<name>-01.webp and prints the lines to paste into
src/lib/figures.js.

--------------------------------------------------------------------------
These are the same product as scripts/clip_to_depth.py makes from video — a
grid of grayscale frames where BRIGHT MEANS CLOSE — except drawn by maths
rather than filmed. The engine cannot tell the difference.

Everything is built as a float field in numpy and only converted to 8-bit at
the very end, so gradients stay smooth: the shader's per-vertex Sobel reads
those gradients as silhouettes, and banding in the source becomes visible
banding in the dots.

Rules worth keeping if you add your own:
  - Leave the background at EXACTLY zero. Anything above it spends points and
    hazes the figure.
  - Keep strokes wide enough to survive. The field resolves about 3-4 screen
    pixels; a line thinner than ~2px in a 384px-wide frame will not read.
  - Animate by PHASE, not by regenerating randomness per frame — the frames
    cross-fade into one another as you scroll, so frame-to-frame coherence is
    what makes it look like motion rather than noise.
"""
import argparse, math, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "figures"
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
]


# ------------------------------------------------------------------ helpers --

def grid(w, h):
    """Pixel-centre coordinate grids, normalised so y runs -0.5..0.5."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    return (xs + 0.5) / w, (ys + 0.5) / h


def splat(buf, cx, cy, r, v, w, h):
    """Add a soft round blob. cx/cy/r in 0..1 units of WIDTH."""
    x, y = grid(w, h)
    d2 = ((x - cx) ** 2 + ((y - cy) * (h / w)) ** 2) / max(r * r, 1e-9)
    buf += v * np.exp(-d2 * 2.4)


def stroke(buf, p0, p1, width, v, w, h):
    """Add a soft line segment between two 0..1 points."""
    x, y = grid(w, h)
    ax, ay = p0
    bx, by = p1
    ay, by = ay * (h / w), by * (h / w)
    py = y * (h / w)
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = np.clip(((x - ax) * dx + (py - ay) * dy) / max(L2, 1e-9), 0, 1)
    d2 = (x - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2
    buf += v * np.exp(-d2 / max(width * width, 1e-9) * 2.0)


def write_sheet(name, frames, cols=4, blur=0.5, gamma=1.0):
    """Normalise across the whole sequence, pack, and save."""
    stack = np.stack(frames).astype(np.float32)
    hi = np.percentile(stack, 99.6)
    stack = np.clip(stack / max(hi, 1e-6), 0, 1) ** gamma
    stack[stack < 0.05] = 0.0            # true-black floor, as the clips have

    n, fh, fw = stack.shape
    rows = -(-n // cols)
    sheet = Image.new("L", (fw * cols, fh * rows), 0)
    for i, f in enumerate(stack):
        im = Image.fromarray((f * 255).astype(np.uint8), mode="L")
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur))
        sheet.paste(im, ((i % cols) * fw, (i // cols) * fh))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{name}-01.webp"
    sheet.save(out, quality=84, method=6)
    print(f"  {name:8} {fw}x{fh} x{n}  {out.stat().st_size / 1024:6.1f} KB")
    return {"id": f"{name}1", "clip": f"/figures/{out.name}", "frames": n, "cols": cols}


# ----------------------------------------------------------- solid renderer --

class Solid:
    """
    A tiny depth-buffer renderer for spheres and capsules.

    Because brightness IS closeness in a depth map, compositing is simply a
    MAXIMUM: whichever surface is nearest the camera wins the pixel, and no
    sorting is needed. Everything it can draw is curved, which matters more
    than it sounds — the field's alpha comes from a Sobel pass over this image,
    so it reads SLOPE, not depth. A flat face earns no dots at any brightness,
    which is exactly how three earlier figures failed.
    """

    def __init__(self, w, h, foc, znear, zfar, cy=None):
        self.w, self.h, self.F = w, h, foc
        self.CX, self.CY = w / 2, (h / 2 if cy is None else cy)
        self.znear, self.zfar = znear, zfar
        self.buf = np.zeros((h, w), np.float32)

    def _shade(self, z):
        t = (self.zfar - z) / max(self.zfar - self.znear, 1e-6)
        return np.clip(t, 0.0, 1.0) ** 0.9

    def sphere(self, c, r, tint=1.0):
        cx, cy, cz = float(c[0]), float(c[1]), float(c[2])
        if cz <= max(self.znear * 0.35, 0.2):
            return
        s = self.F / cz
        R = r * s
        px, py = self.CX + cx * s, self.CY - cy * s
        x0, x1 = max(0, int(px - R - 1)), min(self.w, int(px + R + 2))
        y0, y1 = max(0, int(py - R - 1)), min(self.h, int(py + R + 2))
        if x1 <= x0 or y1 <= y0:
            return
        dx = (np.arange(x0, x1) + 0.5 - px) / s
        dy = -(np.arange(y0, y1) + 0.5 - py) / s
        d2 = dx[None, :] ** 2 + dy[:, None] ** 2
        inside = d2 < r * r
        if not inside.any():
            return
        zs = cz - np.sqrt(np.maximum(r * r - d2, 0.0))     # the near surface
        sub = self.buf[y0:y1, x0:x1]
        np.maximum(sub, np.where(inside, self._shade(zs) * tint, 0.0), out=sub)

    def capsule(self, a, b, r, tint=1.0):
        a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
        steps = max(2, int(np.linalg.norm(b - a) / (r * 0.34)) + 1)
        for i in range(steps + 1):
            self.sphere(a + (b - a) * (i / steps), r, tint)


def orient(P, pitch=0.0, yaw=0.0, roll=0.0):
    """Rotate a point (or an Nx3 array of them) yaw, then pitch, then roll."""
    P = np.asarray(P, np.float32)
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    cy_, sy_ = math.cos(yaw), math.sin(yaw)
    x, z = x * cy_ + z * sy_, -x * sy_ + z * cy_
    cp, sp = math.cos(pitch), math.sin(pitch)
    y, z = y * cp - z * sp, y * sp + z * cp
    cr, sr = math.cos(roll), math.sin(roll)
    x, y = x * cr - y * sr, x * sr + y * cr
    return np.stack([x, y, z], -1)


# ------------------------------------------------------------------ figures --

def neural(n=12, w=384, h=216):
    """
    A feed-forward net with a pulse of activation sweeping left to right.

    The wavefront is a function of each node's x, so nodes light in column
    order and the edges behind them stay warm — it reads as computation
    flowing rather than as lights blinking at random.
    """
    layers = [4, 6, 6, 3]
    xs = np.linspace(0.13, 0.87, len(layers))
    nodes = [[(x, 0.5 + (j - (c - 1) / 2) * (0.62 / max(c - 1, 1)) * (h / w) ** 0)
              for j in range(c)] for x, c in zip(xs, layers)]

    frames = []
    for f in range(n):
        t = f / n
        buf = np.zeros((h, w), np.float32)
        front = -0.25 + t * 1.5          # the sweep, off-frame at both ends

        # SPARSE connections. Fully connecting the layers fills the frame with
        # a solid mesh that reads as a blob — each node links only to its
        # nearest few in the next layer, so the structure stays legible.
        for li in range(len(layers) - 1):
            c1, c2 = layers[li], layers[li + 1]
            for j, a in enumerate(nodes[li]):
                centre = round(j * (c2 - 1) / max(c1 - 1, 1))
                for kk in (-1, 0, 1):
                    m = centre + kk
                    if not 0 <= m < c2:
                        continue
                    b = nodes[li + 1][m]
                    mid = (a[0] + b[0]) * 0.5
                    lit = math.exp(-((mid - front) / 0.16) ** 2)
                    stroke(buf, a, b, 0.0060, 0.16 + 0.70 * lit, w, h)

        for layer in nodes:
            for (x, y) in layer:
                lit = math.exp(-((x - front) / 0.13) ** 2)
                splat(buf, x, y, 0.026 + 0.014 * lit, 0.85 + 1.0 * lit, w, h)
        frames.append(buf)
    return write_sheet("neural", frames, gamma=0.95)


def binary(n=12, w=384, h=216):
    """
    Columns of ones and zeros falling, brightest at the head of each column.

    Glyphs are drawn with a mono font and the whole column is shifted by a
    fraction of a row per frame, so successive frames cross-fade into motion
    instead of a reshuffle.
    """
    font = None
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            font = ImageFont.truetype(path, 30)
            break
    if font is None:
        font = ImageFont.load_default()

    rng = np.random.default_rng(7)
    # The field resolves ~3-4 screen px, so a 15px glyph reads as texture
    # rather than as a digit. Fewer, bigger glyphs is the only way to make
    # ones and zeros legible as ones and zeros.
    cols_n, rows_n = 13, 8
    cw, rh = w / cols_n, h / rows_n
    bits = rng.integers(0, 2, (rows_n + 2, cols_n))
    speed = rng.uniform(0.6, 1.6, cols_n)
    head0 = rng.uniform(0, rows_n, cols_n)

    frames = []
    for f in range(n):
        t = f / n
        img = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(img)
        for c in range(cols_n):
            head = (head0[c] + t * rows_n * speed[c]) % (rows_n + 4)
            for r in range(rows_n + 2):
                behind = (head - r) % (rows_n + 4)
                if behind > 6:
                    continue
                v = int(255 * math.exp(-behind * 0.42))
                if v < 12:
                    continue
                d.text((c * cw + cw * 0.18, r * rh - rh * 0.9),
                       str(bits[(r + int(head)) % bits.shape[0], c]),
                       fill=v, font=font)
        frames.append(np.asarray(img, np.float32) / 255.0)
    return write_sheet("binary", frames, blur=0.7, gamma=1.05)


def galaxy(n=12, w=384, h=384):
    """
    A barred spiral, rotating and drifting inward.

    Arms come from a logarithmic spiral: an arm sits wherever
    theta - k*ln(r) lands on a multiple of 2pi/arms. Rotating is adding to
    theta, zooming is scaling r, so both are one line each and the motion is
    perfectly continuous between frames.
    """
    arms, k = 2, 2.6
    x, y = grid(w, h)
    X, Y = (x - 0.5) * 2, (y - 0.5) * 2
    R = np.sqrt(X * X + Y * Y) + 1e-6
    TH = np.arctan2(Y, X)

    rng = np.random.default_rng(3)
    sx, sy = rng.uniform(0, 1, 420), rng.uniform(0, 1, 420)
    smag = rng.uniform(0.25, 1.0, 420)

    frames = []
    for f in range(n):
        t = f / n
        rot = t * 2 * math.pi / arms          # one arm-period: seamless loop
        zoom = 1.0 - 0.16 * t                 # slow push in
        r = np.clip(R * zoom, 1e-6, None)

        phase = (TH + rot - k * np.log(r)) * arms
        arm = np.exp(-((np.angle(np.exp(1j * phase))) ** 2) / 0.55)
        falloff = np.exp(-(r / 0.62) ** 2) * np.clip((r - 0.03) / 0.12, 0, 1)
        buf = arm * falloff * 0.85
        buf += np.exp(-(r / 0.085) ** 2) * 1.5           # core
        buf += np.exp(-(r / 0.30) ** 2) * 0.16           # halo

        for i in range(len(sx)):                          # foreground stars
            splat(buf, sx[i], sy[i], 0.0035, 0.30 * smag[i], w, h)
        frames.append(buf)
    return write_sheet("galaxy", frames, gamma=1.0)


def atom(n=16, w=384, h=384):
    """
    An atom: a packed nucleus with three tilted electron orbits turning round it.

    This replaces the filmed green-screen atom. Everything moves — the whole
    assembly spins through exactly one full turn across the sequence, and each
    electron completes exactly one lap — so the last frame lands back on the
    first and the scene loops seamlessly however far you scroll.

    Rings are drawn as tubes of overlapping spheres rather than as lines. A
    line has no thickness to round off; a tube has a curved cross-section, and
    the field needs that curve to find the ring at all.
    """
    DIST, RING, TUBE = 5.2, 1.52, 0.078
    sol_args = dict(foc=w * 0.95, znear=DIST - 2.9, zfar=DIST + 2.3)

    rng = np.random.default_rng(3)
    dirs = rng.normal(size=(15, 3))
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    nucleons = dirs * (0.36 * rng.random(15) ** (1 / 3))[:, None]

    # three orbital planes, each with its own tilt and its own electron phase
    PLANES = [(0.00, 0.00, 0.00), (1.12, 0.62, 0.35), (-1.05, -0.72, 0.71)]
    theta = np.linspace(0, 2 * math.pi, 190, endpoint=False)
    circle = np.stack([RING * np.cos(theta), RING * np.sin(theta),
                       np.zeros_like(theta)], -1)

    frames = []
    for k in range(n):
        t = k / n                                  # phase, so frame n == frame 0
        spin = 2 * math.pi * t
        sol = Solid(w, h, **sol_args)

        for nuc in orient(nucleons, pitch=spin * 0.6, yaw=spin):
            sol.sphere(nuc + np.array([0, 0, DIST]), 0.30, 1.0)

        for pitch, yaw, phase in PLANES:
            pts = orient(orient(circle, pitch=pitch, yaw=yaw), yaw=spin)
            for q in pts:
                sol.sphere(q + np.array([0, 0, DIST]), TUBE, 0.94)
            a = 2 * math.pi * (t + phase)
            e = orient(np.array([[RING * math.cos(a), RING * math.sin(a), 0]]),
                       pitch=pitch, yaw=yaw)
            e = orient(e, yaw=spin)[0]
            sol.sphere(e + np.array([0, 0, DIST]), 0.17, 1.0)

        frames.append(sol.buf)

    return write_sheet("atom2", frames, blur=0.4, gamma=0.95)


def keytap(n=16, w=384, h=288):
    """
    A finger coming down on a key, pressing it, and lifting off.

    The finger is a chain of capsules laid along a Bezier from the knuckle to
    the fingertip, so it curls naturally instead of hinging like a mechanism,
    and the keycaps are flat capsules — pillows, not boxes, because a box top
    is a flat plane and flat planes do not render here.

    Timing is a single down-and-up over the sequence, easing into the contact,
    with the key travelling only in the last quarter of the descent. That short
    late travel is what makes it read as a press rather than as a finger
    sinking through the board.
    """
    DIST, PITCH, YAW = 5.9, math.radians(-49), math.radians(-13)
    KEY_R, KEY_HALF, GAP_X, GAP_Z = 0.16, 0.20, 0.86, 0.74
    COLS, ROWS = 4, 3
    HIT_C, HIT_R = 1, 1                             # the key that gets pressed

    def place(P):
        """World -> camera: look DOWN on the board, slightly off to one side.

        A shallow angle was the first version's mistake — at 27 degrees the
        rows stacked up behind one another and the whole keyboard merged into
        one loaf. Looking down at 49 opens the grid out so the keys read as
        separate objects with black between them. The pitch is NEGATIVE so the
        back row lands higher up the frame and further from the camera; the
        other sign renders a board seen from underneath, which lights the far
        keys brighter than the near ones and reads as an optical illusion."""
        return orient(P, pitch=PITCH, yaw=YAW) + np.array([0, 0, DIST], np.float32)

    def bezier(p0, p1, p2, u):
        return ((1 - u) ** 2 * np.asarray(p0, np.float32)
                + 2 * (1 - u) * u * np.asarray(p1, np.float32)
                + u * u * np.asarray(p2, np.float32))

    frames = []
    for k in range(n):
        t = k / n
        press = math.sin(math.pi * t) ** 1.25       # 0 -> 1 -> 0, loops
        sol = Solid(w, h, foc=w * 0.95, znear=DIST - 3.7, zfar=DIST + 2.6,
                    cy=h * 0.58)

        for c in range(COLS):
            for r in range(ROWS):
                x = (c - (COLS - 1) / 2) * GAP_X
                z = (r - (ROWS - 1) / 2) * GAP_Z
                drop = 0.13 * max(0.0, (press - 0.72) / 0.28) if (
                    c == HIT_C and r == HIT_R) else 0.0
                a = place(np.array([x - KEY_HALF, -drop, z]))
                b = place(np.array([x + KEY_HALF, -drop, z]))
                sol.capsule(a, b, KEY_R, 0.92)

        # the finger, from a knuckle off the top-right down to the hit key
        kx = (HIT_C - (COLS - 1) / 2) * GAP_X
        kz = (HIT_R - (ROWS - 1) / 2) * GAP_Z
        tip = np.array([kx, 0.26 + 0.70 * (1 - press), kz - 0.03], np.float32)
        # The hand enters from above and BEHIND the board (+z), not from the
        # near side: anything placed in front of a camera this close balloons
        # to fill the frame, which is how the first attempt turned the finger
        # into a wedge lying across the keys.
        root = np.array([1.52, 1.94, 1.62], np.float32)
        ctrl = np.array([0.70, 0.92 + 0.26 * (1 - press), kz + 0.78], np.float32)

        joints = [place(bezier(root, ctrl, tip, u)) for u in (0, 0.34, 0.68, 1.0)]
        for (a, b), rad in zip(zip(joints, joints[1:]), (0.215, 0.185, 0.152)):
            sol.capsule(a, b, rad, 1.0)
        for j, rad in zip(joints[1:3], (0.200, 0.170)):
            sol.sphere(j, rad, 1.0)                            # knuckle bulges
        sol.sphere(joints[-1], 0.150, 1.0)                     # the fingertip
        sol.sphere(joints[0], 0.31, 0.97)                      # the hand knuckle
        sol.capsule(joints[0], place(root + np.array([0.40, 0.26, 0.30])),
                    0.31, 0.95)                                # hand, leaving frame

        frames.append(sol.buf)

    return write_sheet("keytap", frames, blur=0.4, gamma=0.95)


def probe(n=12, w=384, h=384):
    """
    A deep-space probe tumbling past the camera.

    Three attempts at an ENVIRONMENT failed here before this one, and they all
    failed for the same reason. `terrain` was a smooth heightfield: no
    silhouette anywhere. `city` was a thousand blocks a few pixels wide: it
    measured a healthy 3.6% ink and rendered as grey dust. `corridor` put its
    mass at the left and right frame edges with a black hole in the middle —
    the exact inverse of what a centred, edge-faded point cloud can draw, and
    it rendered as two faint smudges at the borders.

    What actually works in this field is what WALL-E and the atom are: ONE
    centred object with black all round it and real rounded volume. So this
    figure is built the way the keyed clips are, not the way the synthetic ones
    were — the 3D pass produces a SILHOUETTE plus a shaded luminance image, and
    the depth comes from a distance transform of that silhouette, shaped by
    sqrt(1-(1-t)^2) so the body rounds off instead of reading as a cut-out.
    Panel seams live in the luminance only, never as holes in the mask, so they
    draw as creases without breaking the volume into islands.
    """
    import cv2
    from scipy.ndimage import distance_transform_edt

    CX, CY, FOC = w / 2, h * 0.5, w * 0.95
    LIGHT = np.array([-0.42, 0.76, -0.5], dtype=np.float32)
    LIGHT /= np.linalg.norm(LIGHT)

    def panel(o, u, v, nu, nv, albedo, inset=0.06):
        """A flat panel split into nu x nv tiles, each slightly inset so the
        darker backing shows through as a seam."""
        out = [(np.array(o, np.float32), np.array(u, np.float32),
                np.array(v, np.float32), albedo * 0.45)]
        for a in range(nu):
            for b in range(nv):
                du, dv = np.array(u, np.float32) / nu, np.array(v, np.float32) / nv
                base = np.array(o, np.float32) + du * a + dv * b
                out.append((base + (du + dv) * inset,
                            du * (1 - 2 * inset), dv * (1 - 2 * inset), albedo))
        return out

    # ---- the model, as (origin, edge u, edge v, albedo) parallelograms -------
    BW, BH, BD = 0.62, 0.62, 0.85          # the bus, half-extents
    faces = []
    for sx, u, v, alb in [
        ((-BW, -BH, -BD), (2 * BW, 0, 0), (0, 2 * BH, 0), 0.95),   # front
        ((-BW, -BH, BD), (2 * BW, 0, 0), (0, 2 * BH, 0), 0.55),    # back
        ((-BW, BH, -BD), (2 * BW, 0, 0), (0, 0, 2 * BD), 0.85),    # top
        ((-BW, -BH, -BD), (2 * BW, 0, 0), (0, 0, 2 * BD), 0.42),   # bottom
        ((-BW, -BH, -BD), (0, 0, 2 * BD), (0, 2 * BH, 0), 0.68),   # left
        ((BW, -BH, -BD), (0, 0, 2 * BD), (0, 2 * BH, 0), 0.68),    # right
    ]:
        faces += panel(sx, u, v, 2, 2, alb, inset=0.05)

    # solar wings: the big readable shapes, and the reason the silhouette is
    # not just a box — a 6x3 cell grid gives the form its seams
    for side in (-1, 1):
        x0 = side * BW if side > 0 else side * BW - 2.55
        faces += panel((x0, -0.03, -0.62), (2.55, 0, 0), (0, 0, 1.24), 6, 3, 0.62)
        faces += panel((x0, 0.03, -0.62), (2.55, 0, 0), (0, 0, 1.24), 6, 3, 0.5)

    # the dish, as a fan of triangles on a short boom
    DR, DZ = 0.52, -1.30
    dish = [(np.array([0, 0, DZ], np.float32),
             np.array([DR * math.cos(a), DR * math.sin(a), DZ + 0.20], np.float32),
             np.array([DR * math.cos(a + 0.32), DR * math.sin(a + 0.32), DZ + 0.20],
                      np.float32), 1.0)
            for a in np.arange(0, 6.2832, 0.32)]

    def rot(P, yaw, pitch):
        cy, sy = math.cos(yaw), math.sin(yaw)
        cp, sp = math.cos(pitch), math.sin(pitch)
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        x, z = x * cy + z * sy, -x * sy + z * cy
        y, z = y * cp - z * sp, y * sp + z * cp
        return np.stack([x, y, z], -1)

    frames = []
    for k in range(n):
        t = k / max(n - 1, 1)
        yaw = math.radians(-38 + 76 * t)
        pitch = math.radians(30 + 9 * math.sin(t * math.pi))
        dist = 8.6 - 1.5 * t                       # a slow push in
        lum = np.zeros((h, w), np.float32)
        mask = np.zeros((h, w), np.uint8)

        # every face as its four corners, plus the dish triangles
        prims = []
        for o, u, v, alb in faces:
            prims.append((np.stack([o, o + u, o + u + v, o + v]), alb))
        for a, b, c in [(d[0], d[1], d[2]) for d in dish]:
            prims.append((np.stack([a, b, c]), 1.0))

        drawn = []
        for pts, alb in prims:
            P = rot(pts, yaw, pitch)
            e = P[:, 2] + dist
            if np.any(e < 0.6):
                continue
            s = FOC / e
            scr = np.stack([CX + P[:, 0] * s, CY - P[:, 1] * s], -1)
            nrm = np.cross(P[1] - P[0], P[2] - P[0])
            ln = np.linalg.norm(nrm)
            if ln < 1e-6:
                continue
            nrm = nrm / ln
            if nrm[2] > 0:                          # back-face cull
                nrm = -nrm
            shade = 0.30 + 0.70 * max(0.0, float(np.dot(nrm, LIGHT)))
            drawn.append((float(e.mean()), scr, alb * shade))

        for _, scr, val in sorted(drawn, key=lambda d: -d[0]):
            poly = [np.round(scr).astype(np.int32)]
            cv2.fillPoly(lum, poly, float(min(1.0, val)))
            cv2.fillPoly(mask, poly, 1)

        # ---- silhouette -> volume, the same model the keyed clips use --------
        m = mask > 0
        d = distance_transform_edt(m).astype(np.float32)
        interior = d[m]
        r = float(np.clip(np.percentile(interior, 88), 5.0, 13.0)) if interior.size else 12.0
        shape = np.sqrt(np.clip(1 - (1 - np.clip(d / r, 0, 1)) ** 2, 0, 1))

        g = lum
        if interior.size:
            lo, hi = np.percentile(g[m], 5), np.percentile(g[m], 95)
            g = np.clip((g - lo) / max(hi - lo, 1e-6), 0, 1)
        soft = cv2.GaussianBlur(g, (0, 0), 2.0)
        detail = cv2.GaussianBlur(np.abs(g - soft) * 6.0, (0, 0), 3.0)

        frames.append(np.where(m, shape * (0.70 + 0.30 * g) + shape * 0.20 * detail, 0.0))

    return write_sheet("probe", frames, blur=0.4, gamma=0.95)


FIGURES = {"neural": neural, "binary": binary, "galaxy": galaxy,
           "probe": probe, "atom2": atom, "keytap": keytap}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("which", nargs="*", default=list(FIGURES))
    a = ap.parse_args()
    made = []
    for name in a.which:
        if name not in FIGURES:
            sys.exit(f"unknown figure: {name} (have {', '.join(FIGURES)})")
        made.append(FIGURES[name]())
    print("\nPaste into src/lib/figures.js:\n")
    for m in made:
        print(f"  {{ id: '{m['id']}', label: '{m['id'][:-1].title()}', "
              f"clip: '{m['clip']}', frames: {m['frames']}, cols: {m['cols']} }},")
