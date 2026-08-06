// Single source of truth for the member's Trello token.
//
// The token lives in Trello's own `member/private` plugin storage: it is
// scoped to one member on one board and is never readable by anyone else,
// so we never copy it into localStorage or ship it anywhere.

export const APP_KEY = import.meta.env.VITE_TRELLO_APP_KEY;
export const APP_NAME = "Card Cover";

// Message tag shared with public/authorized.js.
export const AUTH_MESSAGE_SOURCE = "card-cover-auth";

const TOKEN_KEY = "token";

export function getToken(t) {
  return t.get("member", "private", TOKEN_KEY);
}

export function saveToken(t, token) {
  return t.set("member", "private", TOKEN_KEY, token);
}

export function clearToken(t) {
  return t.remove("member", "private", TOKEN_KEY);
}

export async function isAuthorized(t) {
  const token = await getToken(t);
  return Boolean(token);
}

// URL the member is sent to in order to approve access. `return_url` must be
// on this same origin, and must be listed as an allowed origin on the
// Power-Up's admin page or Trello will refuse the redirect.
export function buildAuthorizeUrl(returnUrl) {
  const params = new URLSearchParams({
    expiration: "never",
    name: APP_NAME,
    scope: "read,write",
    response_type: "token",
    key: APP_KEY,
    return_url: returnUrl,
  });
  return `https://trello.com/1/authorize?${params.toString()}`;
}
