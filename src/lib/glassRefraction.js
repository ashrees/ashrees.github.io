/* ============================================================================
 * glassRefraction — real light-bending for .glass-pill, where the browser
 * can do it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * What separates Apple's Liquid Glass from 2020-era glassmorphism is that it
 * REFRACTS: the backdrop is displaced as it passes through a curved bezel, so
 * the edge of the panel samples the page differently from its middle. Blur and
 * tint alone cannot do that — they only average, they never bend.
 *
 * The bend needs `backdrop-filter: url(#svg-filter)`, and that is Chromium
 * only. Safari and Firefox parse the declaration and ignore the filter, so
 * shipping it unconditionally would leave the button unstyled on exactly the
 * machines a portfolio gets opened on. It is therefore ADDITIVE: this module
 * marks the document when the browser can bend light, the stylesheet layers
 * the refraction on top of the existing treatment, and everything else keeps
 * the blur-and-rim approximation that already works everywhere.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT liquid-glass-js
 *
 * The obvious library for this (dashersw/liquid-glass-js) renders its glass in
 * WebGL over an html2canvas snapshot of the page. Three things rule it out
 * here, and they are properties of THIS page rather than faults in the library:
 *
 *   1. The backdrop is a WebGL canvas created without `preserveDrawingBuffer`,
 *      which html2canvas reads as empty. The glass would refract blank paper.
 *   2. A snapshot is a still. The dot field moves on every scroll, so the
 *      refraction would show a stale image unless the entire DOM were
 *      re-rasterised per frame.
 *   3. Its Button builds its own element around an onClick handler. The Resume
 *      control is a real <a href="/resume.pdf">, and middle-click, open-in-new-
 *      tab and screen readers all depend on it staying one.
 *
 * The displacement map below is the same physics with none of that: no second
 * WebGL context, no snapshot, no dependency, and the live backdrop — moving
 * dots included — is what gets bent.
 *
 * ---------------------------------------------------------------------------
 * HOW THE MAP WORKS
 *
 * feDisplacementMap moves each backdrop pixel by
 *
 *     offset = scale * (channel - 0.5)
 *
 * so a channel value of 128 means "leave this pixel alone". The map is
 * therefore mid-grey everywhere except in a band around the rim, where the red
 * channel ramps away from 128 on the left and right edges (bending X) and the
 * green channel does the same top and bottom (bending Y). The middle stays
 * neutral on purpose: the label has to stay crisp.
 * ========================================================================== */

const FILTER_ID = 'glass-warp';

/**
 * Only Chromium ships SVG filters in backdrop-filter.
 *
 * `navigator.userAgentData` is the discriminator rather than a UA string
 * because it is itself Chromium-only — Safari and Firefox have not implemented
 * it, so its mere presence is the test. A CSS.supports() probe cannot be used:
 * Safari's parser ACCEPTS `backdrop-filter: url(#x)` and then does nothing with
 * it, so it reports true and renders nothing.
 */
function canBendLight() {
  const brands = navigator.userAgentData?.brands;
  if (!Array.isArray(brands)) return false;
  return brands.some((b) => /Chromium/i.test(b.brand))
    && CSS.supports('backdrop-filter', `url(#${FILTER_ID})`);
}

/**
 * The displacement map, as an SVG data URI.
 *
 * Drawn at a fixed size and stretched to whatever the button measures — the
 * bands scale with it, which is what you want: a wider pill gets a
 * proportionally wider bezel, exactly as a thicker piece of glass would.
 *
 * @param {number} band  rim thickness, as a fraction of the shorter side
 */
function displacementMap(band = 0.42) {
  const W = 200, H = 64;
  const bx = Math.round(H * band), by = Math.round(H * band);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="l" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="rgb(0,128,128)"/>
      <stop offset="1" stop-color="rgb(128,128,128)"/>
    </linearGradient>
    <linearGradient id="r" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="rgb(128,128,128)"/>
      <stop offset="1" stop-color="rgb(255,128,128)"/>
    </linearGradient>
    <linearGradient id="t" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="rgb(128,0,128)"/>
      <stop offset="1" stop-color="rgb(128,128,128)"/>
    </linearGradient>
    <linearGradient id="b" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="rgb(128,128,128)"/>
      <stop offset="1" stop-color="rgb(128,255,128)"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="rgb(128,128,128)"/>
  <rect x="0" y="0" width="${bx}" height="${H}" fill="url(#l)"/>
  <rect x="${W - bx}" y="0" width="${bx}" height="${H}" fill="url(#r)"/>
  <rect x="0" y="0" width="${W}" height="${by}" fill="url(#t)" opacity="0.5"/>
  <rect x="0" y="${H - by}" width="${W}" height="${by}" fill="url(#b)" opacity="0.5"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Inject the filter and mark the document. Safe to call more than once.
 * Returns true when the refraction is active.
 */
export function installGlassRefraction() {
  if (typeof document === 'undefined') return false;
  if (document.getElementById(FILTER_ID)) return true;
  if (!canBendLight()) return false;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  // Out of flow and out of the accessibility tree: this element is a filter
  // definition, not a picture.
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';

  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id', FILTER_ID);
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  // objectBoundingBox so one filter serves both the navbar pill and the larger
  // hero button without either of them needing its own copy.
  filter.setAttribute('filterUnits', 'objectBoundingBox');

  const image = document.createElementNS(NS, 'feImage');
  image.setAttribute('href', displacementMap());
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', '100%');
  image.setAttribute('height', '100%');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'map');

  // A touch of blur on the MAP, not the backdrop: it rounds the corners of the
  // four bands into one continuous bezel instead of four flat walls.
  const soften = document.createElementNS(NS, 'feGaussianBlur');
  soften.setAttribute('in', 'map');
  soften.setAttribute('stdDeviation', '1.6');
  soften.setAttribute('result', 'smoothMap');

  const displace = document.createElementNS(NS, 'feDisplacementMap');
  displace.setAttribute('in', 'SourceGraphic');
  displace.setAttribute('in2', 'smoothMap');
  displace.setAttribute('scale', '38');
  displace.setAttribute('xChannelSelector', 'R');
  displace.setAttribute('yChannelSelector', 'G');

  filter.append(image, soften, displace);
  svg.append(filter);
  document.body.append(svg);
  document.documentElement.classList.add('glass-refract');
  return true;
}
