// Renders a cover to a PNG blob so it can be uploaded as a card attachment.
//
// This is the escape hatch for everything Trello's colour API can't express.
// Trello scales cover images down itself, so we render at a modest 2x of the
// display size rather than something enormous — a gradient has no detail to
// lose, and a smaller blob means a faster upload.

import { gradientCss } from "./covers.js";

const WIDTH = 1000;
const HEIGHT = 560;

/**
 * @param selection `{ kind: "solid", hex }` or `{ kind: "gradient", angle, stops }`
 * @returns {Promise<Blob>} PNG blob
 */
export function renderCover(selection) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  if (selection.kind === "gradient") {
    ctx.fillStyle = buildGradient(ctx, selection);
  } else {
    ctx.fillStyle = selection.hex;
  }

  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("RENDER_FAILED"))),
      "image/png"
    );
  });
}

// Converts a CSS gradient angle into the two endpoints canvas wants.
// CSS measures clockwise from "pointing up"; canvas wants raw coordinates,
// so the -90deg rotation below reconciles the two conventions.
function buildGradient(ctx, { angle, stops }) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const halfDiagonal =
    (Math.abs(WIDTH * Math.cos(radians)) + Math.abs(HEIGHT * Math.sin(radians))) / 2;

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const dx = Math.cos(radians) * halfDiagonal;
  const dy = Math.sin(radians) * halfDiagonal;

  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  stops.forEach((color, i) => {
    gradient.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), color);
  });
  return gradient;
}

/** CSS background for previews — mirrors what renderCover will produce. */
export function previewBackground(selection) {
  if (!selection) return null;
  return selection.kind === "gradient" ? gradientCss(selection) : selection.hex;
}
