// Turns a Trello card's labels, members and due date into things that can be
// dragged onto a cover.
//
// Everything here is read-only and defensive: `t.card()` shapes vary a little
// between Trello clients, and a missing field should thin the tray out rather
// than break the tab.

import { readableInk } from "../ui/palette.js";

// Trello's label palette. Labels are *not* the cover palette — they carry
// light and dark shades the ten cover colours don't have, and a swatch that
// guessed at the nearest cover colour would show a green label as lime.
const LABEL_COLORS = {
  green_light: "#BAF3DB", green: "#4BCE97", green_dark: "#1F845A",
  yellow_light: "#F8E6A0", yellow: "#F5CD47", yellow_dark: "#946F00",
  orange_light: "#FEDEC8", orange: "#FEA362", orange_dark: "#C25100",
  red_light: "#FFD5D2", red: "#F87168", red_dark: "#C9372C",
  purple_light: "#DFD8FD", purple: "#9F8FEF", purple_dark: "#6E5DC6",
  blue_light: "#CCE0FF", blue: "#579DFF", blue_dark: "#0C66E4",
  sky_light: "#C6EDFB", sky: "#6CC3E0", sky_dark: "#227D9B",
  lime_light: "#D3F1A7", lime: "#94C748", lime_dark: "#5B7F24",
  pink_light: "#FDD0EC", pink: "#E774BB", pink_dark: "#AE4787",
  black_light: "#DCDFE4", black: "#8590A2", black_dark: "#626F86",
};

// A label with no colour set still has a name and still deserves a chip.
const COLOURLESS = "#8590A2";

// Trello doesn't expose a member's avatar colour, and their avatar *image* is
// served cross-origin — drawing one into the canvas taints it and makes
// `toBlob` throw, killing the whole cover, not just the avatar. So members are
// initials on a colour derived from their id: stable per person, no network.
const MEMBER_COLORS = [
  "#8B5CF6", "#E23F94", "#0B5FD3", "#18B588",
  "#F0644B", "#227D9B", "#946F00", "#AE4787",
];

export function labelItems(labels) {
  if (!Array.isArray(labels)) return [];
  return labels.map((label) => {
    const hex = LABEL_COLORS[label.color] ?? COLOURLESS;
    return {
      id: `label-${label.id}`,
      kind: "label",
      // Colour-only labels have an empty name. Naming them after their colour
      // beats an empty pill you can't tell apart from its neighbour.
      text: label.name?.trim() || titleCase(label.color) || "Label",
      color: hex,
      ink: readableInk(hex),
    };
  });
}

export function memberItems(members) {
  if (!Array.isArray(members)) return [];
  return members.map((member) => {
    const hex = MEMBER_COLORS[hashCode(member.id ?? "") % MEMBER_COLORS.length];
    return {
      id: `member-${member.id}`,
      kind: "member",
      text: initialsFor(member),
      name: member.fullName || member.username || "Member",
      color: hex,
      ink: readableInk(hex),
    };
  });
}

export function dueItem(due, dueComplete) {
  if (!due) return null;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return null;

  const hex = dueComplete ? "#4BCE97" : "#FEA362";
  return {
    id: "due",
    kind: "due",
    text: formatDue(date),
    color: hex,
    ink: readableInk(hex),
  };
}

/** Day and month only — a cover is too small for a year nobody reads. */
function formatDue(date) {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function initialsFor(member) {
  if (member.initials) return member.initials.slice(0, 2).toUpperCase();

  const name = (member.fullName || member.username || "").trim();
  if (!name) return "?";

  const parts = name.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : name.slice(0, 2))
    .toUpperCase();
}

function titleCase(value) {
  if (!value) return "";
  return value
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Small deterministic hash — the same member keeps the same colour between
// sessions, which matters because the initials alone don't distinguish two
// people who share them.
function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
