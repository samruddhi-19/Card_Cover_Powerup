# Card Cover — Trello Power-Up

Vite + React Power-Up that sets, changes and clears Trello card covers.

## Layout

```
powerup.html          connector page — the URL you register with Trello
auth.html             authorization popup
settings.html         board settings popup
cover.html            cover picker (opened from the card button)
public/
  authorized.html/js  OAuth return page; posts the token back to auth.html
  manifest.json       descriptive metadata for the admin listing
src/
  powerup/main.js     TrelloPowerUp.initialize — all capabilities
  auth/               connect / disconnect UI
  settings/           board-level preferences
  cover/              cover picker
  lib/auth.js         token storage + authorize URL (single source of truth)
  lib/trelloApi.js    REST wrapper; 401 clears the token automatically
  lib/settings.js     board settings read/write with defaults
  lib/ui.js           shared popup styles
```

## Setup

1. `npm install`
2. Create a Power-Up at <https://trello.com/power-ups/admin>, then copy its
   **API Key** into `.env` as `VITE_TRELLO_APP_KEY` (see `.env.example`).
3. `npm run dev` for local work, `npm run build` to produce `dist/`.

## Connecting it to Trello

On the Power-Up's admin page:

- **Iframe connector URL** → `https://<your-deployment>/powerup.html`
- **Capabilities** → enable `authorization-status`, `show-authorization`,
  `show-settings`, `card-buttons`, `card-detail-badges` (they must match
  `src/powerup/main.js`).
- **Allowed origins / API key origins** → add `https://<your-deployment>`.
  Trello refuses the `return_url` redirect if this is missing, which is the
  usual cause of "authorization opens but nothing happens".

Deploy anywhere that serves static files over HTTPS; `vercel.json` sets a CSP
that allows Trello's CDN and API, and permits framing from `trello.com` only.

## How authorization works

1. `authorization-status` reports whether a token exists in Trello's
   `member/private` plugin storage.
2. If not, Trello shows the authorize prompt → `auth.html`.
3. "Connect" opens `trello.com/1/authorize`; on approval Trello redirects the
   popup to `/authorized.html#token=…`.
4. `authorized.js` strips the token from the address bar and `postMessage`s it
   back to `auth.html`, pinned to this origin.
5. `auth.html` verifies the message origin and stores the token under
   `member/private`, which is scoped to that one member and unreadable by
   anyone else on the board.

The token is never written to `localStorage` and never leaves the browser
except to `api.trello.com`. A 401 from the API clears the stored token so the
member is re-prompted rather than hitting silent failures.

Authorization status is derived from the token itself — there is no separate
"authorized" boolean that could drift out of sync with it.
