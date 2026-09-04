#!/usr/bin/env python3
"""
clip_to_depth.py — turn a video clip into depth-map sprite sheets for the dot field.

    python3 scripts/clip_to_depth.py my-clip.mp4 --name walle --frames 8

Writes public/figures/<name>-NN.webp, one sprite sheet per shot, and prints the
lines to paste into src/lib/figures.js:

    { id: 'walle1', label: 'Shot 1', clip: '/figures/walle-01.webp',
      frames: 8, cols: 4 }

--------------------------------------------------------------------------
WHY THIS EXISTS

The dot field reads BRIGHTNESS AS DISTANCE: bright = close to camera. Ordinary
footage does not obey that rule — it records how much light a surface
reflects, not how far away it is.

There are two ways in, and the script picks automatically.

  A. KEYED FOOTAGE (green screen, or any flat background colour).
     Much the better input. The key gives an exact silhouette, and from a
     silhouette we can build real geometry: a distance transform says how far
     each pixel sits from the edge of the subject, which rounds the shape into
     a solid volume — the same trick that makes the hand-drawn figures read as
     objects rather than flat stencils. The subject's own shading is then
     mixed in gently so surface features stay legible.
     Because the background is a known colour, it becomes exactly zero: no
     haze, and nothing for the shader's edge pass to mistake for a silhouette.

  B. UNKEYED FOOTAGE. Falls back to inverting luminance (film lights subjects
     against brighter backgrounds more often than not) weighted by local
     sharpness (out-of-focus == far). An approximation. Works on cinematic
     footage with shallow depth of field; struggles on flatly lit scenes.

For a real solution on unkeyed footage, run the clip through a monocular depth
model first — Video Depth Anything (CVPR 2025) is the current pick, because it
adds temporal consistency and so does not flicker frame to frame the way
per-frame Depth Anything V2 does. Then feed the result here with --no-invert.

Either way, normalisation happens across the WHOLE shot, never per frame.
Per-frame normalisation is what makes naive depth video strobe.
"""
import argparse, subprocess, tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "figures"


# ---------------------------------------------------------------- probing --

def shot_boundaries(src, threshold=0.20, debounce=0.5):
    """
    Ask ffmpeg where the cuts are, so each shot becomes its own scene.

    Detection is much less reliable on KEYED footage: once the background is a
    flat colour, two different shots of the same subject look alike, so real
    cuts score low while camera movement inside a shot throws up a scatter of
    false ones. Nearby detections are therefore merged, and --cuts lets you
    state the real ones outright (take them from the ungraded original, where
    detection works properly).
    """
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src),
         "-vf", f"select='gt(scene,{threshold})',metadata=print:file=-",
         "-f", "null", "-"], capture_output=True, text=True).stdout
    times = [float(l.split("pts_time:")[1].split()[0])
             for l in out.splitlines() if "pts_time:" in l]
    merged = []
    for t in times:
        if not merged or t - merged[-1] > debounce:
            merged.append(t)
    return merged


def duration(src):
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(src)],
        capture_output=True, text=True).stdout.strip())


def grab(src, t, width, tmp):
    path = tmp / f"f{t:.3f}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t}", "-i", str(src),
                    "-frames:v", "1", "-vf", f"scale={width}:-2",
                    str(path), "-y"], check=True)
    return Image.open(path).convert("RGB")


def looks_keyed(img):
    """Flat, saturated corners mean somebody keyed this."""
    a = np.asarray(img, dtype=np.int16)
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3),
                              a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    r, g, b = np.median(corners, axis=0)
    return g > r * 1.2 and g > b * 1.2 and g > 110


# ----------------------------------------------------------------- masking --

def subject_mask(img, tol=26):
    """True where the subject is. Eroded, so the green fringe does not survive."""
    a = np.asarray(img, dtype=np.int16)
    greenness = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    m = ((greenness < tol).astype(np.uint8) * 255)
    pil = Image.fromarray(m)
    pil = pil.filter(ImageFilter.MinFilter(3))     # erode: drop the key fringe
    pil = pil.filter(ImageFilter.MedianFilter(3))  # drop speckles
    return np.asarray(pil) > 127


def distance_transform(mask):
    """Chamfer 3-4. Distance from the edge of the subject, in pixels."""
    H, W = mask.shape
    INF, D2 = 1e9, 1.41421356
    d = np.where(mask, INF, 0.0).astype(np.float32)
    for y in range(H):
        for x in range(W):
            if d[y, x] == 0:
                continue
            m = d[y, x]
            if x > 0:            m = min(m, d[y, x - 1] + 1)
            if y > 0:            m = min(m, d[y - 1, x] + 1)
            if x > 0 and y > 0:  m = min(m, d[y - 1, x - 1] + D2)
            if x < W - 1 and y > 0: m = min(m, d[y - 1, x + 1] + D2)
            d[y, x] = m
    for y in range(H - 1, -1, -1):
        for x in range(W - 1, -1, -1):
            if d[y, x] == 0:
                continue
            m = d[y, x]
            if x < W - 1:            m = min(m, d[y, x + 1] + 1)
            if y < H - 1:            m = min(m, d[y + 1, x] + 1)
            if x < W - 1 and y < H - 1: m = min(m, d[y + 1, x + 1] + D2)
            if x > 0 and y < H - 1:  m = min(m, d[y + 1, x - 1] + D2)
            d[y, x] = m
    return d


def blur(arr, r):
    return np.asarray(
        Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
             .filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


# ------------------------------------------------------------ depth models --

def depth_keyed(img, mask, relief):
    """
    Silhouette -> solid volume.

    The distance transform gives every interior pixel its distance from the
    edge; shaping that with sqrt(1-(1-t)^2) rounds the shape off like a body
    rather than a cut-out. The subject's own luminance and its high-frequency
    detail are then folded in at low weight so eyes, seams and edges read,
    without letting a dark surface punch a hole in the form.
    """
    g = np.asarray(img.convert("L"), dtype=np.float32) / 255.0
    dist = distance_transform(mask)

    # The shoulder has to suit how THICK this subject actually is. A shoulder
    # wider than half the thinnest limb means that limb never reaches full
    # height and renders as a faint smudge — a seedling stem is a few pixels
    # across where a head is forty, so a fixed value cannot serve both. Take it
    # from the subject's own distance distribution, capped by the flag.
    interior = dist[mask]
    r = relief
    if interior.size:
        r = float(np.clip(np.percentile(interior, 88), 5.0, relief))
    t = np.clip(dist / r, 0, 1)
    shape = np.sqrt(1 - (1 - t) ** 2)

    inside = g[mask]
    if inside.size:
        lo, hi = np.percentile(inside, 5), np.percentile(inside, 95)
        lum = np.clip((g - lo) / max(hi - lo, 1e-6), 0, 1)
    else:
        lum = g
    detail = blur(np.abs(g - blur(g, 2)) * 6, 3)

    d = shape * (0.70 + 0.30 * lum) + shape * 0.20 * detail
    return np.where(mask, d, 0.0)


def depth_unkeyed(img, invert=True):
    g = np.asarray(img.convert("L"), dtype=np.float32) / 255.0
    sharp = blur(np.abs(g - blur(g, 2)) * 6, 10)
    base = (1.0 - g) if invert else g
    return base * (0.40 + 0.60 * sharp)


# -------------------------------------------------------------------- build --

def build(src, name, per_shot, width, cols, invert, min_shot, black_point,
          relief, crop, cuts=None, work=760):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = duration(src)
    cuts = cuts if cuts else shot_boundaries(src)
    bounds = [0.0] + cuts + [total]
    shots = [(a, b) for a, b in zip(bounds, bounds[1:]) if b - a >= min_shot]

    manifest = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        keyed = looks_keyed(grab(src, min(1.0, total / 2), 320, tmp))
        print(f"{total:.1f}s, {len(cuts)} cuts -> {len(shots)} shots"
              f"   [{'keyed: silhouette relief' if keyed else 'unkeyed: luminance+defocus'}]")

        for si, (a, b) in enumerate(shots, start=1):
            pad = (b - a) * 0.10
            times = np.linspace(a + pad, b - pad, per_shot)
            frames = [grab(src, t, work, tmp) for t in times]

            if keyed:
                masks = [subject_mask(f) for f in frames]
                if crop:
                    # crop to the union of the subject across the shot, so a
                    # small subject fills the plane instead of floating in it
                    union = np.any(np.stack(masks), axis=0)
                    ys, xs = np.nonzero(union)
                    if ys.size:
                        H, W = union.shape
                        my, mx = int(H * 0.06), int(W * 0.06)
                        y0, y1 = max(0, ys.min() - my), min(H, ys.max() + my)
                        x0, x1 = max(0, xs.min() - mx), min(W, xs.max() + mx)
                        frames = [f.crop((x0, y0, x1, y1)) for f in frames]
                        masks = [m[y0:y1, x0:x1] for m in masks]
                scale = width / frames[0].width
                size = (width, max(2, int(round(frames[0].height * scale))))
                frames = [f.resize(size, Image.LANCZOS) for f in frames]
                masks = [np.asarray(Image.fromarray((m * 255).astype(np.uint8))
                                    .resize(size, Image.BILINEAR)) > 127
                         for m in masks]
                raw = [depth_keyed(f, m, relief) for f, m in zip(frames, masks)]
            else:
                scale = width / frames[0].width
                size = (width, max(2, int(round(frames[0].height * scale))))
                frames = [f.resize(size, Image.LANCZOS) for f in frames]
                raw = [depth_unkeyed(f, invert) for f in frames]

            # Normalise over the WHOLE shot so the depth does not strobe, and
            # keep a true-black floor: lossy compression has nothing to ring
            # against and the shader's edge pass nothing to mistake for a
            # silhouette.
            stack = np.stack(raw)
            pool = stack[stack > 0.01]
            lo = np.percentile(pool, 2) if pool.size else 0.0
            hi = np.percentile(pool, 99) if pool.size else 1.0
            if not keyed:
                lo = np.percentile(stack, black_point)
            stack = np.clip((stack - lo) / max(hi - lo, 1e-6), 0, 1) ** 1.1
            stack[stack < 0.05] = 0.0

            fh, fw = stack.shape[1], stack.shape[2]
            rows = -(-per_shot // cols)
            sheet = Image.new("L", (fw * cols, fh * rows), 0)
            for i, frame in enumerate(stack):
                im = Image.fromarray((frame * 255).astype(np.uint8), mode="L")
                im = im.filter(ImageFilter.GaussianBlur(0.6))   # keep Sobel clean
                sheet.paste(im, ((i % cols) * fw, (i // cols) * fh))

            out = OUT_DIR / f"{name}-{si:02d}.webp"
            sheet.save(out, quality=82, method=6)
            print(f"  shot {si}: {a:5.1f}-{b:5.1f}s  {fw}x{fh} x{per_shot}"
                  f"  {out.stat().st_size / 1024:6.1f} KB")
            manifest.append({"id": f"{name}{si}", "clip": f"/figures/{out.name}",
                             "frames": per_shot, "cols": cols})

    print("\nPaste into src/lib/figures.js:\n")
    for m in manifest:
        print(f"  {{ id: '{m['id']}', label: 'Shot {m['id'][-1]}', "
              f"clip: '{m['clip']}', frames: {m['frames']}, cols: {m['cols']} }},")
    return manifest


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--name", default="clip")
    ap.add_argument("--frames", type=int, default=8, help="frames per shot")
    ap.add_argument("--width", type=int, default=384, help="frame width in px")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--min-shot", type=float, default=1.0)
    ap.add_argument("--cuts", default="",
                    help="comma-separated cut times in seconds, overriding detection "
                         "(detection is unreliable on keyed footage)")
    ap.add_argument("--relief", type=float, default=30,
                    help="keyed only: px over which the silhouette rounds into volume")
    ap.add_argument("--no-crop", action="store_true",
                    help="keyed only: keep the original framing instead of cropping to the subject")
    ap.add_argument("--black-point", type=float, default=45,
                    help="unkeyed only: percentile clipped to black")
    ap.add_argument("--no-invert", action="store_true",
                    help="unkeyed only: use when the subject is BRIGHTER than its background")
    a = ap.parse_args()
    cuts = [float(x) for x in a.cuts.split(',') if x.strip()]
    build(Path(a.src), a.name, a.frames, a.width, a.cols, not a.no_invert,
          a.min_shot, a.black_point, a.relief, not a.no_crop, cuts)
