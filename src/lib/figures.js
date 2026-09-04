/* ============================================================================
 * FIGURES — the shapes the dot field morphs between.
 *
 * THIS IS THE FILE TO EDIT. Everything visual is here; the engine in
 * ./dotField.js never needs to change.
 *
 * ---------------------------------------------------------------------------
 * HOW A FIGURE WORKS
 *
 * The field is ~100k points. Every point looks up one pixel of a grayscale
 * "depth map" and uses its brightness as height: bright = close to camera,
 * black = empty space. So a figure is just a grayscale image.
 *
 * You do NOT draw the grayscale yourself. You draw a flat white SILHOUETTE
 * and the engine rounds it into 3D for you (via a distance transform — the
 * further a pixel is from the edge of your shape, the more it bulges toward
 * the viewer). Draw an outline, get a solid form.
 *
 * ---------------------------------------------------------------------------
 * THREE WAYS TO DEFINE ONE
 *
 *   1. draw    — a canvas function. All coordinates run 0..1, NOT pixels,
 *                so (0.5, 0.5) is dead centre regardless of resolution.
 *
 *                { id: 'thing', label: 'Thing', draw: (g) => { g.fillRect(...) } }
 *
 *   2. text    — a word or glyph. Letterforms make excellent depth maps.
 *
 *                { id: 'as', label: 'Initials', text: 'AS', weight: 700 }
 *
 *   3. image   — any grayscale image in /public. White = near, black = far.
 *                Photographic depth maps (the kind a phone's portrait mode
 *                produces) work beautifully here.
 *
 *                { id: 'me', label: 'Portrait', src: '/figures/me-depth.png' }
 *
 *   4. clip    — a sprite sheet of depth frames. The scene PLAYS as you scroll
 *                through it: frames cross-fade straight into one another, with
 *                none of the swarm that a change of scene gets.
 *
 *                { id: 'shot', label: 'Shot', clip: '/figures/walle-01.webp',
 *                  frames: 8, cols: 4 }
 *
 *                Make these with scripts/clip_to_depth.py — it splits a video
 *                at its cuts, converts each shot to depth, and prints the
 *                lines to paste below:
 *
 *                    python3 scripts/clip_to_depth.py myclip.mp4 --name myclip
 *
 *                Green-screen footage gives much the best result: the key is an
 *                exact silhouette, so the script can build real volume from it
 *                rather than guessing depth from brightness.
 *
 * Any figure also takes `gain` (default 1), a brightness multiplier for that
 * figure alone. A thin subject — a seedling, a wireframe — puts far fewer
 * points on screen than a solid one. Raise its gain rather than pushing
 * FIELD.strength, which would wash out every other figure with it.
 *
 * ---------------------------------------------------------------------------
 * ADDING, REMOVING, REORDERING
 *
 * Just edit the FIGURES array. The engine reads its length and spreads the
 * figures evenly down the page — two figures or nine, nothing else to change.
 * Order in the array is the order you meet them as you scroll.
 *
 * ---------------------------------------------------------------------------
 * DRAWING TIPS
 *
 * - Keep strokes at least ~0.03 wide. Anything thinner than roughly twice
 *   FIELD.relief/FIELD.mapSize never reaches full height and reads as a faint
 *   smudge rather than a line.
 * - Interior detail must be CUT, not drawn. Two shapes of the same white are
 *   one silhouette with no seam between them. Use cut(g, () => {...}) to
 *   punch holes — those edges are what the per-vertex Sobel pass finds and
 *   draws as crisp lines.
 * - Leave a margin. Shapes running past ~0.9 get clipped by the field's edge
 *   fade.
 * ========================================================================== */

/* --------------------------------------------------------------------------
 * TUNING — global feel of the field.
 * ------------------------------------------------------------------------ */
export const FIELD = {
  /** Points rendered, by device class. Lower = faster, sparser, more delicate. */
  points: { phone: 20000, tablet: 55000, desktop: 100000 },

  /** Dot size multiplier, by device class. */
  pointScale: { phone: 2.0, desktop: 2.6 },

  /** How far the depth map pushes points toward/away from camera. 0 = flat. */
  depthStrength: 0.96,

  /**
   * Of each figure's slice of the page, the fraction spent holding it fully
   * resolved before the morph to the next one begins. 0 = always in motion.
   */
  hold: 0.42,

  /** Fraction of the page scroll used by the sequence; the rest holds the
   *  last figure so it resolves before you reach the footer. */
  tail: 0.9,

  /**
   * Overall presence of the field. Full strength over the hero, then eased
   * back so it sits behind your copy instead of competing with it.
   *
   * Careful: this MULTIPLIES with the per-block `data-dot-avoid` clearing and
   * the shader's quietAlpha floor. Push all three down at once and the figures
   * vanish entirely. Raise this before raising avoid strength.
   */
  strength: { hero: 1.0, content: 0.78 },

  /**
   * Horizontal shift of the figure, as a fraction of viewport width, applied
   * from 768px up. 0 = dead centre (the default).
   *
   * Raising this slides the figure toward the right gutter and away from the
   * centred content column, which is the gentlest way to make it more present
   * without dimming it. Phones always use 0 — there is no gutter to move into.
   */
  offset: 0,

  /**
   * How much of the viewport the figure's plane spans, as a multiple of the
   * viewport's shorter side. 1.15 puts the drawn shape at roughly 80% of
   * screen height and gives the points a wider zone to move through.
   *
   * Raising this ALSO spreads the dots further apart, since the same point
   * count covers more area — raise `pointScale` a little alongside it if the
   * figures start to look thin.
   */
  spread: 1.15,

  /**
   * The opening: the field starts as one dense speck and unfurls into the
   * first figure.
   *   scrollSpan — the unfurl is driven by SCROLL, not by a timer. This is how
   *                many viewport heights of scrolling it takes to complete.
   *                Nothing moves until the visitor does. Set to 0 to go back
   *                to an automatic opening on load.
   *   swirl      — how much rotation is in it. 0 makes points fly straight out
   *                from the centre; 1 gives the coiled, spinner-like opening.
   *   core       — size of the bright condensed seed visible before scrolling.
   */
  intro: { scrollSpan: 0.6, swirl: 1, core: 2.35 },

  /**
   * The closing — the mirror of `intro`.
   *
   * The last figure spirals back into the centre and shrinks to nothing as the
   * footer comes up, so the page ends on clean paper rather than on a figure
   * that simply stops being scrolled past. It is anchored to the footer
   * element itself, not to a fraction of the page, so it keeps landing in the
   * right place when sections are added or removed.
   *
   *   scrollSpan — how many viewport heights of scrolling the collapse takes.
   *                It completes exactly as the footer's top edge reaches the
   *                bottom of the screen. 0 turns it off and the last figure
   *                just holds, as it used to.
   */
  outro: { scrollSpan: 0.85 },

  /**
   * DOT COLOUR — the ramp from far points to near ones, per theme.
   *
   * `far` is the colour of a point sitting deep in the frame, `near` the
   * colour of one closest to the camera, `mid` the turn between them, and
   * `haze` is what distant points fade toward: set it to the page background
   * so depth reads as atmosphere.
   *
   * Plain greyscale, lifted. The ramp originally bottomed out at #050505 and
   * the closest points landed at pixel level 8; they now sit at 54, which is
   * what "lighter" means here in practice — the cloud reads as soft grey
   * rather than as hard black specks. The median dot pixel barely moved (224
   * to 226) because most of the field was already faint; it is only the near
   * end that was heavy.
   *
   * Lift `near` further to go lighter still. Below about #4a4a4a the figures
   * start losing their edges against white.
   *
   * A cool slate cast was tried here and taken back out. Six palettes were
   * measured against each other in both themes (this greyscale, two slates,
   * warm graphite, a warm/cool depth gradient, and a lighter grey) and the
   * result is worth keeping: COLOUR BARELY MOVES READABILITY. Text contrast
   * landed at 4.48-4.50 against 4.66 for a clean page whatever the palette,
   * because the `data-dot-avoid` clearing already keeps dots off the copy —
   * the gaps between palettes came out smaller than the run-to-run noise. What
   * the palette really controls is whether the field competes for attention,
   * and that is a hierarchy question, not a contrast one.
   *
   * That hierarchy is now settled from the other end: body copy is #131110 at
   * 18.8:1, so the text is comfortably the darkest thing on the page even with
   * `near` at level 5. If the field ever starts feeling loud again, lifting
   * `near` is the lever — it costs nothing measurable in readability either way.
   *
   * Any hex works, and both themes are independent.
   */
  tint: {
    light: { far: '#8f8f8f', mid: '#525252', near: '#333333', haze: '#ffffff' },
    dark:  { far: '#575757', mid: '#9e9e9e', near: '#f0f0f0', haze: '#0a0a0a' },
  },

  /**
   * Pointer parallax. The whole cloud tilts toward the cursor by up to this
   * many radians; because the points carry real depth, that reads as a camera
   * easing around the figure rather than a flat image sliding. Damped, so it
   * settles and stops. 0 disables. Ignored on touch and reduced-motion.
   */
  parallax: 0.14,

  /**
   * How the point cloud is distributed across each figure.
   *
   * A uniform grid spends points evenly over the frame, so a subject covering
   * 5% of it gets 5% of the points and the rest are discarded against black —
   * which is why small subjects looked coarse. Points are instead drawn from
   * each figure's own density, redistributed at the midpoint of a transition
   * where the swarm hides the change.
   *
   *   floor — weight given to empty background, relative to 1.0 for the
   *           subject. 0 puts every point on the figure and leaves the
   *           surrounding space bare; higher spreads them back out.
   */
  sampling: { floor: 0.03 },

  /** Depth map resolution, and the shoulder (in map px) over which a
   *  silhouette rounds off. Smaller relief = harder, more graphic edges. */
  mapSize: 512,
  relief: 20,

  /** Font stack used by `text` figures. */
  font: '"Inter", system-ui, sans-serif',
};

/* --------------------------------------------------------------------------
 * DRAWING HELPERS — all coordinates 0..1.
 * ------------------------------------------------------------------------ */

/** Punch a hole. Everything drawn inside the callback is removed, creating an
 *  interior edge the Sobel pass will render as a line. */
export function cut(g, fn) {
  g.globalCompositeOperation = 'destination-out';
  fn();
  g.globalCompositeOperation = 'source-over';
}

export function line(g, x1, y1, x2, y2, width) {
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

export function dot(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}

/* --------------------------------------------------------------------------
 * THE SEQUENCE
 *
 * Five shots cut out of walle.webm, each one playing as you scroll through it.
 * The cuts between shots are where the swarm transition happens — which is
 * exactly how datacurve sequences its own clips.
 *
 * To go back to the drawn shapes: `export const FIGURES = SHAPES`.
 * To mix: `export const FIGURES = [SHAPES[0], ...CLIP, SHAPES[4]]`.
 * ------------------------------------------------------------------------ */
/** Five shots cut out of the green-screened walle clip. */
export const WALLE = [
  { id: 'walle1', label: 'Eyes', clip: '/figures/walle-01.webp', frames: 8, cols: 4 },
];

/**
 * The atom clip — green-screened, so it takes the keyed path and gets real
 * volume from its silhouette. One continuous rotation, no cuts, so it is a
 * single scene whose frames play as you scroll: the atom spins. This is the
 * one in the live sequence.
 */
export const ATOM = [
  { id: 'atom1', label: 'Atom', clip: '/figures/atom-01.webp', frames: 16, cols: 4 },
];

/**
 * Figures drawn by maths rather than filmed — see scripts/make_figures.py.
 * Same product as a clip: a sheet of grayscale depth frames.
 */
export const SYNTH = [
  { id: 'neural1', label: 'Neural', clip: '/figures/neural-01.webp', frames: 12, cols: 4 },
  { id: 'binary1', label: 'Binary', clip: '/figures/binary-01.webp', frames: 12, cols: 4 },
  // the solar wings are thin next to the bus, so the whole figure takes a
  // small lift rather than letting the tips fade out
  { id: 'probe1', label: 'Probe', clip: '/figures/probe-01.webp', frames: 12, cols: 4, gain: 1.15 },
  { id: 'galaxy1', label: 'Galaxy', clip: '/figures/galaxy-01.webp', frames: 12, cols: 4 },
];
const [NEURAL, BINARY, PROBE, GALAXY] = SYNTH;

/**
 * The live sequence, in scroll order: a story, then matter, intelligence,
 * computation, a machine built to carry it, and finally the pull back to the
 * cosmos.
 *
 * Everything here is live. Figures that were tried and dropped — a network
 * plexus, a synthesised atom, a finger pressing a key, and four more WALL-E
 * shots — have had their sheets deleted; scripts/make_figures.py still holds
 * the generators, so any of them can be rebuilt with one command.
 */
export const FIGURES = [WALLE[0], ATOM[0], NEURAL, BINARY, PROBE, GALAXY];

/* -- the hand-drawn shapes, kept for swapping back in --------------------- */
export const SHAPES = [
  {
    id: 'cube',
    label: 'Containers',
    draw: (g) => {
      // isometric cube: a hexagon, with three seams cut from the centre
      const cx = 0.5, cy = 0.5, R = 0.29;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i + 30);
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.fill();
      cut(g, () => {
        for (const deg of [90, 210, 330]) {
          const a = (Math.PI / 180) * deg;
          line(g, cx, cy, cx + R * Math.cos(a), cy + R * Math.sin(a), 0.02);
        }
      });
    },
  },

  {
    id: 'graph',
    label: 'Event mesh',
    draw: (g) => {
      const nodes = [[0.5, 0.2], [0.2, 0.44], [0.8, 0.44], [0.32, 0.78], [0.68, 0.78]];
      const edges = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [1, 2]];
      for (const [a, b] of edges) {
        line(g, nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], 0.034);
      }
      nodes.forEach(([x, y], i) => dot(g, x, y, i === 0 ? 0.085 : 0.065));
      cut(g, () => nodes.forEach(([x, y], i) => i && dot(g, x, y, 0.022)));
    },
  },

  {
    id: 'terminal',
    label: 'Terminal',
    draw: (g) => {
      roundRect(g, 0.15, 0.27, 0.7, 0.46, 0.04);
      cut(g, () => {
        g.fillRect(0.15, 0.355, 0.7, 0.014);                 // title rule
        for (let i = 0; i < 3; i++) dot(g, 0.205 + i * 0.05, 0.312, 0.015);
        g.lineJoin = 'round';
        g.beginPath();                                        // prompt chevron
        g.lineWidth = 0.028; g.lineCap = 'round';
        g.moveTo(0.25, 0.44); g.lineTo(0.32, 0.505); g.lineTo(0.25, 0.57);
        g.stroke();
        g.fillRect(0.36, 0.492, 0.12, 0.028);                 // cursor
        g.fillRect(0.25, 0.625, 0.34, 0.024);                 // output lines
        g.fillRect(0.25, 0.675, 0.24, 0.024);
      });
    },
  },

  {
    id: 'store',
    label: 'Datastore',
    draw: (g) => {
      g.fillRect(0.3, 0.3, 0.4, 0.4);
      g.beginPath(); g.ellipse(0.5, 0.3, 0.2, 0.08, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(0.5, 0.7, 0.2, 0.08, 0, 0, Math.PI * 2); g.fill();
      cut(g, () => {
        g.lineWidth = 0.016; g.lineCap = 'butt';
        for (const y of [0.43, 0.56]) {
          g.beginPath();
          g.ellipse(0.5, y, 0.2, 0.08, 0, 0.12 * Math.PI, 0.88 * Math.PI);
          g.stroke();
        }
      });
    },
  },

  {
    id: 'net',
    label: 'Inference',
    draw: (g) => {
      const cols = [
        [0.24, [0.33, 0.5, 0.67]],
        [0.5, [0.25, 0.415, 0.585, 0.75]],
        [0.76, [0.38, 0.5, 0.62]],
      ];
      for (let c = 0; c < cols.length - 1; c++) {
        const [x1, ys1] = cols[c], [x2, ys2] = cols[c + 1];
        for (const y1 of ys1) for (const y2 of ys2) line(g, x1, y1, x2, y2, 0.014);
      }
      for (const [x, ys] of cols) for (const y of ys) dot(g, x, y, 0.055);
      cut(g, () => { for (const [x, ys] of cols) for (const y of ys) dot(g, x, y, 0.018); });
    },
  },
];
