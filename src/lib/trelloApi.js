// Thin wrapper over the Trello REST API.
//
// The Power-Up client library can *read* a card's cover (`t.card("cover")`)
// but has no method to change it, so every write here goes through
// api.trello.com authenticated with the member's stored token.

import { APP_KEY, getToken, clearToken } from "./auth.js";

export const NOT_AUTHORIZED = "NOT_AUTHORIZED";

export const COVER_COLORS = [
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "blue",
  "sky",
  "lime",
  "pink",
  "black",
];

async function apiFetch(t, path, { method = "GET", params = {} } = {}) {
  const token = await getToken(t);
  if (!token) throw new Error(NOT_AUTHORIZED);

  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set("key", APP_KEY);
  url.searchParams.set("token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { method });

  // The member revoked the token from their Trello account settings, or it
  // expired. Drop our copy so `authorization-status` reports the truth and
  // the member is prompted to reconnect instead of hitting silent failures.
  if (res.status === 401) {
    await clearToken(t);
    throw new Error(NOT_AUTHORIZED);
  }

  if (!res.ok) {
    throw new Error(`Trello API error ${res.status}: ${await res.text()}`);
  }

  return res.status === 204 ? null : res.json();
}

// Confirms the stored token is still valid. Used by the settings popup —
// deliberately *not* by `authorization-status`, which Trello calls often
// enough that a network round trip per call would be wasteful.
export function getCurrentMember(t) {
  return apiFetch(t, "/members/me", { params: { fields: "id,username,fullName" } });
}

export function getCard(t, cardId) {
  return apiFetch(t, `/cards/${cardId}`, { params: { fields: "id,name,cover" } });
}

/**
 * Sets a card's cover.
 * @param cover `null` clears the cover; otherwise an object such as
 *   `{ color: "blue", size: "normal", brightness: "dark" }`.
 */
export function setCardCover(t, cardId, cover) {
  return apiFetch(t, `/cards/${cardId}`, {
    method: "PUT",
    // Trello takes the cover as a JSON-encoded object; `{}` removes it.
    params: { cover: JSON.stringify(cover ?? {}) },
  });
}

export function clearCardCover(t, cardId) {
  return setCardCover(t, cardId, null);
}
