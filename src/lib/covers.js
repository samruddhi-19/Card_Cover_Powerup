// Cover catalogue.
//
// Trello's cover API accepts exactly ten named colours, or an attachment.
// Anything outside that set — a custom hex, any gradient — has to be rendered
// to an image and uploaded (see coverRender.js). `trello` below marks the
// swatches that can take the instant native path; the rest cost one upload.

export const SOLID_COLORS = [
  { id: "midnight", label: "Midnight", hex: "#1D2D50" },
  { id: "cobalt", label: "Cobalt", hex: "#0B5FD3", trello: "blue" },
  { id: "emerald", label: "Emerald", hex: "#18B588", trello: "green" },
  { id: "amber", label: "Amber", hex: "#F0A315", trello: "orange" },
  { id: "coral", label: "Coral", hex: "#EF4B4B", trello: "red" },
  { id: "violet", label: "Violet", hex: "#9B6BFB", trello: "purple" },
  { id: "teal", label: "Teal", hex: "#1BB79A", trello: "sky" },
  { id: "magenta", label: "Magenta", hex: "#EF3D87", trello: "pink" },
  { id: "slate", label: "Slate", hex: "#1F2733", trello: "black" },
  { id: "cream", label: "Cream", hex: "#FBEFCD", trello: "yellow" },
  { id: "mint", label: "Mint", hex: "#CDF5E2", trello: "lime" },
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
