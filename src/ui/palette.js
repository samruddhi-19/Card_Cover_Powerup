// Trello's own cover palette, so a swatch previews what the card will
// actually look like once the cover is applied.
export const PALETTE = [
  { id: "green", label: "Green", hex: "#4BCE97" },
  { id: "yellow", label: "Yellow", hex: "#F5CD47" },
  { id: "orange", label: "Orange", hex: "#FEA362" },
  { id: "red", label: "Red", hex: "#F87168" },
  { id: "purple", label: "Purple", hex: "#9F8FEF" },
  { id: "blue", label: "Blue", hex: "#579DFF" },
  { id: "sky", label: "Sky", hex: "#6CC3E0" },
  { id: "lime", label: "Lime", hex: "#94C748" },
  { id: "pink", label: "Pink", hex: "#E774BB" },
  { id: "black", label: "Graphite", hex: "#8590A2" },
];

const BY_ID = Object.fromEntries(PALETTE.map((c) => [c.id, c]));

export function swatchFor(colorId) {
  return BY_ID[colorId] ?? null;
}

export function labelFor(colorId) {
  return BY_ID[colorId]?.label ?? colorId;
}

/**
 * Picks black or white ink for a background, using the WCAG relative-luminance
 * formula. Half this palette is light enough that a white checkmark on it
 * would fail contrast — this keeps the selected state legible on every swatch
 * instead of only the dark ones.
 */
export function readableInk(hex) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#172B4D" : "#FFFFFF";
}
