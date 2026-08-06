// Cover catalogue.
//
// Trello's cover API accepts exactly ten named colours, or an attachment.
// Anything outside that set — a custom hex, any gradient — has to be rendered
// to an image and uploaded (see coverRender.js). `trello` below marks the
// swatches that can take the instant native path; the rest cost one upload.

// Trello's ten cover colours at their true hex values. Because the swatch is
// the exact colour Trello will paint, these can take the native path: instant,
// and no attachment added to the card.
//
// `trello` is set ONLY where the swatch hex is genuinely that Trello colour.
// An earlier version mapped custom hexes to the "nearest" Trello colour, which
// meant picking Teal painted the card Sky — the swatch lied about the result.
export const TRELLO_COLORS = [
  { id: "t-green", label: "Green", hex: "#4BCE97", trello: "green" },
  { id: "t-yellow", label: "Yellow", hex: "#F5CD47", trello: "yellow" },
  { id: "t-orange", label: "Orange", hex: "#FEA362", trello: "orange" },
  { id: "t-red", label: "Red", hex: "#F87168", trello: "red" },
  { id: "t-purple", label: "Purple", hex: "#9F8FEF", trello: "purple" },
  { id: "t-blue", label: "Blue", hex: "#579DFF", trello: "blue" },
  { id: "t-sky", label: "Sky", hex: "#6CC3E0", trello: "sky" },
  { id: "t-lime", label: "Lime", hex: "#94C748", trello: "lime" },
  { id: "t-pink", label: "Pink", hex: "#E774BB", trello: "pink" },
  { id: "t-black", label: "Graphite", hex: "#8590A2", trello: "black" },
];

// Off-palette colours. Trello can't express these as a colour cover, so they
// are rendered and attached — the exact hex, never an approximation.
export const SOLID_COLORS = [
  { id: "midnight", label: "Midnight", hex: "#1D2D50" },
  { id: "cobalt", label: "Cobalt", hex: "#0B5FD3" },
  { id: "emerald", label: "Emerald", hex: "#18B588" },
  { id: "amber", label: "Amber", hex: "#F0A315" },
  { id: "coral", label: "Coral", hex: "#EF4B4B" },
  { id: "violet", label: "Violet", hex: "#9B6BFB" },
  { id: "teal", label: "Teal", hex: "#1BB79A" },
  { id: "magenta", label: "Magenta", hex: "#EF3D87" },
  { id: "slate", label: "Slate", hex: "#1F2733" },
  { id: "cream", label: "Cream", hex: "#FBEFCD" },
  { id: "mint", label: "Mint", hex: "#CDF5E2" },
  { id: "lilac", label: "Lilac", hex: "#EDE9FE" },
];

// `angle` is degrees clockwise from "left to right", matching CSS
// `linear-gradient(Ndeg, …)` so the swatch preview and the rendered PNG can
// share one definition instead of drifting apart.
export const GRADIENTS = [
  { id: "ocean-sunset", label: "Ocean Sunset", angle: 120, stops: ["#2B5CE6", "#B44BD6", "#F0577E"] },
  { id: "northern-lights", label: "Northern Lights", angle: 120, stops: ["#1DC8B6", "#1E88E5"] },
  { id: "cyberpunk-neon", label: "Cyberpunk Neon", angle: 120, stops: ["#7B2FF7", "#E23F94", "#F05A5A"] },
  { id: "golden-hour", label: "Golden Hour", angle: 120, stops: ["#F5A524", "#F0644B", "#E8456F"] },
  { id: "deep-space", label: "Deep Space", angle: 120, stops: ["#111A2E", "#2A2350", "#4B3A78"] },
  { id: "emerald-dream", label: "Emerald Dream", angle: 120, stops: ["#0FB58C", "#28C7B0", "#7BE3C4"] },
  { id: "peach-sorbet", label: "Peach Sorbet", angle: 120, stops: ["#FFE3E8", "#FFD1C4", "#FFC0CB"] },
  { id: "midnight-glow", label: "Midnight Glow", angle: 120, stops: ["#1B1F5C", "#3B2E8F", "#5B3FC4"] },
];

export function solidById(id) {
  return SOLID_COLORS.find((c) => c.id === id) ?? null;
}

export function gradientById(id) {
  return GRADIENTS.find((g) => g.id === id) ?? null;
}

/** CSS value for a gradient, used by both the swatch and the live preview. */
export function gradientCss(gradient) {
  return `linear-gradient(${gradient.angle}deg, ${gradient.stops.join(", ")})`;
}

/** Filename we attach uploads under, so our own covers are recognisable. */
export function coverFileName(selection) {
  return `card-cover-${selection.id}.png`;
}
