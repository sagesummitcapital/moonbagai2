"use client";

/**
 * Global background — rendered once at the root.
 * - Aurora glow (CSS-only animation)
 * - Subtle grid
 * - Vignette
 * Everything is pointer-events:none so it never intercepts clicks.
 */
export function BackgroundFX() {
  return (
    <>
      {/* Soft vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-50 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"
      />
      {/* Animated aurora glows */}
      <div aria-hidden className="aurora" />
      <div aria-hidden className="aurora-mid" />
      {/* Ultra-fine grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-40 bg-grid-fine opacity-30 mask-radial-soft"
      />
    </>
  );
}
