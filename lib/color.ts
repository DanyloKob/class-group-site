// Free-form user-chosen accent colors mean the app can no longer assume
// white text reads on the accent background - this picks whichever of
// near-black/near-white actually contrasts better against the given color,
// using the same relative-luminance math browsers use for WCAG contrast.
function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const [rl, gl, bl] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

/** Best-contrast ink color (pure black or pure white) for text/icons drawn on top of `hex`. */
export function pickInkForAccent(hex: string): string {
  if (!isValidHexColor(hex)) return "#ffffff";
  const luminance = relativeLuminance(hex);
  const withBlack = contrastRatio(luminance, 0);
  const withWhite = contrastRatio(luminance, 1);
  return withBlack > withWhite ? "#000000" : "#ffffff";
}
