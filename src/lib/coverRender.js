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

// Badge geometry, in the same 500px-wide reference units the text slider
// uses. One source for both the miniature preview and the rendered PNG, so
// a badge can't look one size in the editor and another on the card.
export const BADGE = {
  font: 15,
  height: 27,
  padX: 10,
  radius: 13.5,
  avatar: 40,
  avatarFont: 15,
  icon: 15,
  gap: 6,
};

/**
 * @param selection `{ kind: "solid", hex }` | `{ kind: "gradient", angle, stops }` | `{ kind: "image", dataUrl, url }`
 * @param text optional `{ heading, subheading, size, color, align }`
 * @param badges optional array of `{ kind, x, y, color, ink, text }`, where
 *   `kind` is "label" | "member" | "due" and x/y are percentages of the cover
 * @returns {Promise<Blob>} PNG blob
 */
export async function renderCover(selection, text, badges) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  if (selection.kind === "gradient") {
    ctx.fillStyle = buildGradient(ctx, selection);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (selection.kind === "image") {
    const src = selection.dataUrl || selection.url;
    if (src) {
      const img = await loadImage(src);
      drawImageCover(ctx, img, 0, 0, WIDTH, HEIGHT);
    }
  } else {
    ctx.fillStyle = selection.hex;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (hasText(text)) drawText(ctx, text);
  if (hasBadges(badges)) drawBadges(ctx, badges);

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

export function hasBadges(badges) {
  return Array.isArray(badges) && badges.length > 0;
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

// Labels, members and the due date, painted where they were dropped.
//
// Positions arrive as percentages rather than pixels because the editor's
// preview is 218px wide and this canvas is 1000px — a percentage is the only
// coordinate that means the same thing in both.
function drawBadges(ctx, badges) {
  ctx.save();
  ctx.textBaseline = "middle";

  for (const badge of badges) {
    const cx = (badge.x / 100) * WIDTH;
    const cy = (badge.y / 100) * HEIGHT;

    // Badges sit on arbitrary colours, so each carries its own drop shadow
    // rather than trusting the cover beneath it to provide separation.
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 7 * SCALE;
    ctx.shadowOffsetY = 1.5 * SCALE;

    if (badge.kind === "member") {
      drawMember(ctx, badge, cx, cy);
    } else {
      drawPill(ctx, badge, cx, cy);
    }
  }

  ctx.restore();
}

function drawMember(ctx, badge, cx, cy) {
  const radius = (BADGE.avatar * SCALE) / 2;

  ctx.fillStyle = badge.color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  clearShadow(ctx);

  ctx.fillStyle = badge.ink;
  ctx.font = `800 ${BADGE.avatarFont * SCALE}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText(badge.text, cx, cy);
}

function drawPill(ctx, badge, cx, cy) {
  const height = BADGE.height * SCALE;
  const padX = BADGE.padX * SCALE;
  const iconSize = BADGE.icon * SCALE;
  const iconWidth = badge.kind === "due" ? iconSize + BADGE.gap * SCALE : 0;

  // Labels are set in caps on the cover the way Trello sets its own, which
  // also keeps short names from looking like stray words.
  const text = badge.kind === "label" ? badge.text.toUpperCase() : badge.text;

  ctx.font = `800 ${BADGE.font * SCALE}px ${FONT_STACK}`;
  const width = ctx.measureText(text).width + padX * 2 + iconWidth;

  ctx.fillStyle = badge.color;
  roundRect(ctx, cx - width / 2, cy - height / 2, width, height, height / 2);
  ctx.fill();

  clearShadow(ctx);

  ctx.fillStyle = badge.ink;
  ctx.textAlign = "left";

  let x = cx - width / 2 + padX;
  if (badge.kind === "due") {
    drawClock(ctx, x + iconSize / 2, cy, iconSize / 2, badge.ink);
    x += iconWidth;
  }

  ctx.font = `800 ${BADGE.font * SCALE}px ${FONT_STACK}`;
  ctx.fillText(text, x, cy);
}

function drawClock(ctx, cx, cy, radius, ink) {
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, radius * 0.24);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - radius * 0.44);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + radius * 0.36, cy + radius * 0.2);
  ctx.stroke();
  ctx.restore();
}

// `roundRect` is only in newer browsers, and a Power-Up runs in whatever the
// member happens to have. The fallback draws the same shape by hand.
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function clearShadow(ctx) {
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

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sWidth = img.width;
  let sHeight = img.height;
  let sx = 0;
  let sy = 0;

  if (imgRatio > targetRatio) {
    sWidth = img.height * targetRatio;
    sx = (img.width - sWidth) / 2;
  } else {
    sHeight = img.width / targetRatio;
    sy = (img.height - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cover rendering"));
    img.src = src;
  });
}

/** CSS background for previews — mirrors what renderCover will produce. */
export function previewBackground(selection) {
  if (!selection) return null;
  if (selection.kind === "gradient") return gradientCss(selection);
  if (selection.kind === "image") return `url("${selection.dataUrl || selection.url}") center / cover no-repeat`;
  return selection.hex;
}

/** Scales a slider px value for a preview of a given width. */
export function previewFontScale(previewWidth) {
  return previewWidth / REFERENCE_WIDTH;
}

