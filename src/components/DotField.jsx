import { useEffect, useRef, useState } from "react";
import { DotField as Field, isSupported } from "../lib/dotField";

/**
 * Fixed, full-page point-cloud backdrop.
 *
 * Renders behind everything and morphs between the shapes in src/lib/figures.js
 * as the page scrolls. Purely decorative: aria-hidden, pointer-events-none, and
 * it silently renders nothing if WebGL2 is unavailable.
 *
 * Text blocks marked with `data-dot-avoid` push dots aside so copy stays
 * readable. The attribute's value (0..1) sets how hard; default 0.85.
 */
const DotField = () => {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !isSupported()) {
      setFailed(true);
      return undefined;
    }

    let field;
    let cancelled = false;

    try {
      field = new Field(canvasRef.current);
    } catch {
      setFailed(true);
      return undefined;
    }

    field
      .init()
      .then(() => {
        if (cancelled) return;
        field.setAvoidTargets([...document.querySelectorAll("[data-dot-avoid]")]);
      })
      .catch((err) => {
        console.warn(err);
        if (!cancelled) setFailed(true);
      });

    // keep the light/dark ramp in sync with the theme toggle
    const observer = new MutationObserver(() =>
      field.setDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      field.destroy();
    };
  }, []);

  if (failed) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
};

export default DotField;
