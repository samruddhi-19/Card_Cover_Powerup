// Renders a cover to a PNG blob so it can be uploaded as a card attachment.
//
// This is the escape hatch for everything Trello's colour API can't express:
// custom hexes, gradients, and any cover carrying text. Trello scales cover
// images down itself, so we render at a modest size rather than something
// enormous — a flat fill has no detail to lose, and a smaller blob uploads
// faster.

import { gradientCss } from "./covers.js";

const WIDTH = 1000;
const HEIGHT = 560;

// Slider values are "px as they'd look on a card back", where a cover renders
// around 500px wide. Everything scales off that so 18px means 18px to the eye
// rather than 18/1000ths of a canvas.
const REFERENCE_WIDTH = 500;
const SCALE = WIDTH / REFERENCE_WIDTH;

const FONT_STACK =
  '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif';

/**
 * @param selection `{ kind: "solid", hex }` or `{ kind: "gradient", angle, stops }`
 * @param text optional `{ heading, subheading, size, color, align }`
 * @returns {Promise<Blob>} PNG blob
 */
export function renderCover(selection, text) {
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

  if (hasText(text)) drawText(ctx, text);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("RENDER_FAILED"))),
      "image/png"
    );
  });
}

export function hasText(text) {
  return Boolean(text && (text.heading?.trim() || text.subheading?.trim()));
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

function drawText(ctx, { heading, subheading, size, color, align }) {
  const pad = 44 * (SCALE / 2);
  const maxWidth = WIDTH - pad * 2;

  const headingSize = size * SCALE;
  const subSize = headingSize * 0.62;
  const ink = color === "dark" ? "#172B4D" : "#FFFFFF";

  // Covers sit under arbitrary colours and gradients, so text carries its own
  // shadow rather than trusting the background to provide contrast.
  ctx.shadowColor =
    color === "dark" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)";
  ctx.shadowBlur = headingSize * 0.3;
  ctx.shadowOffsetY = headingSize * 0.04;

  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;

  const x = align === "left" ? pad : align === "right" ? WIDTH - pad : WIDTH / 2;

  // Build every line first so the block can be centred vertically as a whole,
  // instead of drifting down as lines are added.
  const block = [];
  if (heading?.trim()) {
    const font = `700 ${headingSize}px ${FONT_STACK}`;
    ctx.font = font;
    for (const line of wrap(ctx, heading.trim(), maxWidth)) {
      block.push({ line, font, height: headingSize * 1.22 });
    }
  }
  if (subheading?.trim()) {
    const font = `400 ${subSize}px ${FONT_STACK}`;
    ctx.font = font;
    for (const line of wrap(ctx, subheading.trim(), maxWidth)) {
      block.push({ line, font, height: subSize * 1.38 });
    }
  }

  const total = block.reduce((sum, l) => sum + l.height, 0);
  let y = HEIGHT / 2 - total / 2 + block[0].height * 0.76;

  for (const item of block) {
    ctx.font = item.font;
    ctx.fillText(item.line, x, y);
    y += item.height;
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// Greedy word wrap. A long single word is left to overflow rather than being
// broken mid-word, which reads worse than a slightly wide line.
function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  // Four lines is all a 560px-tall cover can hold legibly.
  return lines.slice(0, 4);
}

/** CSS background for previews — mirrors what renderCover will produce. */
export function previewBackground(selection) {
  if (!selection) return null;
  return selection.kind === "gradient" ? gradientCss(selection) : selection.hex;
}

/** Scales a slider px value for a preview of a given width. */
export function previewFontScale(previewWidth) {
  return previewWidth / REFERENCE_WIDTH;
}
