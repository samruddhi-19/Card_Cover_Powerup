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

/**
 * Uploads a rendered cover image and makes it the card's cover in one call.
 *
 * This is how gradients and non-Trello colours get applied at all — the cover
 * API only takes its ten named colours, so anything else has to arrive as an
 * attachment. `setCover=true` saves a second round trip to PUT the cover.
 *
 * Note this goes through fetch directly rather than apiFetch: the body is
 * multipart FormData, not query params.
 */
export async function uploadCoverAttachment(t, cardId, blob, fileName) {
  const token = await getToken(t);
  if (!token) throw new Error(NOT_AUTHORIZED);

  const url = new URL(`https://api.trello.com/1/cards/${cardId}/attachments`);
  url.searchParams.set("key", APP_KEY);
  url.searchParams.set("token", token);
  url.searchParams.set("setCover", "true");

  const body = new FormData();
  body.append("file", blob, fileName);
  body.append("name", fileName);

  const res = await fetch(url, { method: "POST", body });

  if (res.status === 401) {
    await clearToken(t);
    throw new Error(NOT_AUTHORIZED);
  }
  if (!res.ok) {
    throw new Error(`Trello API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Removes attachments this Power-Up previously uploaded as covers.
 *
 * Without this, every gradient change would leave its predecessor behind and
 * the card's attachment list would fill up with dead cover images.
 */
export async function pruneGeneratedCovers(t, cardId, keepId) {
  const attachments = await apiFetch(t, `/cards/${cardId}/attachments`, {
    params: { fields: "id,name" },
  });

  const stale = attachments.filter(
    (a) => a.id !== keepId && /^card-cover-[\w-]+\.png$/.test(a.name)
  );

  await Promise.all(
    stale.map((a) =>
      apiFetch(t, `/cards/${cardId}/attachments/${a.id}`, { method: "DELETE" }).catch(
        () => {}
      )
    )
  );
}
