// Board-level Power-Up settings, shared by every member of the board.
// Feature work lands here: add a key, a default, and the settings UI picks
// it up without touching the read/write plumbing.

const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS = {
  defaultColor: "blue",
  coverSize: "normal", // "normal" | "full"
  dynamicSync: true,
};

export async function getSettings(t) {
  const stored = await t.get("board", "shared", SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function saveSettings(t, patch) {
  const next = { ...(await getSettings(t)), ...patch };
  await t.set("board", "shared", SETTINGS_KEY, next);
  return next;
}
